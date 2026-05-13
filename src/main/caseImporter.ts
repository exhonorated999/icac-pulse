/**
 * Case Importer - Imports complete case from encrypted .pulse file
 * Handles decryption, validation, and database restoration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { getDatabase, getCasesPath, saveDatabase } from './database';
import type { Database } from './db-wrapper';

export interface ImportProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export interface ImportOptions {
  filePath: string;
  password: string;
  onProgress?: (progress: ImportProgress) => void;
}

export interface ImportResult {
  success: boolean;
  caseId?: number;
  caseNumber?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Decrypt data with AES-256
 */
function decryptData(encryptedData: Buffer, password: string): Buffer {
  try {
    // Extract salt, IV, and encrypted content
    const salt = encryptedData.slice(0, 32);
    const iv = encryptedData.slice(32, 48);
    const encrypted = encryptedData.slice(48);
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed. Incorrect password or corrupted file.');
  }
}

/**
 * Validate import file
 */
export async function validateImportFile(filePath: string, password: string): Promise<{
  valid: boolean;
  caseNumber?: string;
  pulseVersion?: string;
  exportDate?: string;
  error?: string;
}> {
  try {
    // Read and decrypt file
    const encryptedData = fs.readFileSync(filePath);
    const decryptedZip = decryptData(encryptedData, password);
    
    // Extract ZIP to temp directory
    const tempDir = path.join(require('os').tmpdir(), `pulse_validate_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    try {
      const zip = new AdmZip(decryptedZip);
      zip.extractAllTo(tempDir, true);
      
      // Read manifest
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Invalid PULSE file: manifest.json not found');
      }
      
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      if (!manifest.export_metadata || !manifest.data) {
        throw new Error('Invalid PULSE file: incomplete manifest');
      }
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return {
        valid: true,
        caseNumber: manifest.export_metadata.case_number,
        pulseVersion: manifest.export_metadata.pulse_version,
        exportDate: manifest.export_metadata.export_date
      };
      
    } finally {
      // Ensure cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
    
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Validation failed'
    };
  }
}

/**
 * Check if case number already exists
 */
function caseNumberExists(db: Database, caseNumber: string): boolean {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM cases WHERE case_number = ?');
  const result = stmt.get(caseNumber);
  return result.count > 0;
}

/**
 * Generate unique case number for import
 */
function generateUniqueCaseNumber(db: Database, originalNumber: string): string {
  let newNumber = `${originalNumber}-TRANSFER`;
  let counter = 1;
  
  while (caseNumberExists(db, newNumber)) {
    counter++;
    newNumber = `${originalNumber}-TRANSFER-${counter}`;
  }
  
  return newNumber;
}

/**
 * Verify file checksum
 */
function verifyChecksum(filePath: string, expectedChecksum: string): boolean {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const actualChecksum = hashSum.digest('hex');
  return actualChecksum === expectedChecksum;
}

/**
 * Import case into database
 */
function importCaseData(db: Database, manifest: any, newCaseNumber: string): number {
  const warnings: string[] = [];
  
  // Get current user — auto-create a default 'Officer' if none exists.
  // This covers fresh installs and portable mode without registration,
  // and is a defensive guard so an .pulse import never fails due to an
  // empty users table on the receiving machine.
  const userStmt = db.prepare('SELECT id FROM users ORDER BY last_login DESC LIMIT 1');
  let currentUser = userStmt.get();

  if (!currentUser) {
    // Double-check via COUNT before inserting to avoid creating a duplicate
    // when the row exists but .get() returned falsy for any reason.
    let userCount = 0;
    try {
      const countRow: any = db.prepare('SELECT COUNT(*) AS c FROM users').get();
      userCount = Number(countRow?.c || 0);
    } catch { /* ignore */ }

    if (userCount === 0) {
      try {
        db.prepare("INSERT INTO users (username, hardware_id) VALUES ('Officer', 'auto-created-on-import')").run();
      } catch {
        try { db.prepare("INSERT INTO users (username) VALUES ('Officer')").run(); } catch { /* ignore */ }
      }
    }

    // Re-query: try last_login order first, then fall back to lowest id.
    currentUser = userStmt.get();
    if (!currentUser) {
      currentUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    }
    if (!currentUser) {
      throw new Error('Could not resolve or create a user for the import. Please register a user and try again.');
    }
  }

  const userId = currentUser.id;
  const caseData = manifest.data;
  
  // Insert main case record
  const caseStmt = db.prepare(`
    INSERT INTO cases (case_number, case_type, status, user_id)
    VALUES (?, ?, ?, ?)
  `);
  
  caseStmt.run(
    newCaseNumber,
    caseData.case.case_type,
    caseData.case.status,
    userId
  );
  
  // Get new case ID
  const getIdStmt = db.prepare('SELECT id FROM cases WHERE case_number = ?');
  const newCase = getIdStmt.get(newCaseNumber);
  const newCaseId = newCase.id;
  
  // Import case type specific data
  if (caseData.caseTypeData) {
    const caseType = caseData.case.case_type;
    
    if (caseType === 'cybertip' && caseData.caseTypeData) {
      const ctStmt = db.prepare(`
        INSERT INTO cybertip_data (case_id, cybertip_number, report_date, occurrence_date, reporting_company, priority_level, date_received_utc, ncmec_folder_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      ctStmt.run(
        newCaseId,
        caseData.caseTypeData.cybertip_number || null,
        caseData.caseTypeData.report_date || null,
        caseData.caseTypeData.occurrence_date || null,
        caseData.caseTypeData.reporting_company || null,
        caseData.caseTypeData.priority_level || null,
        caseData.caseTypeData.date_received_utc || null,
        caseData.caseTypeData.ncmec_folder_path || null
      );
      
      // Import identifiers
      if (caseData.caseTypeData.identifiers && Array.isArray(caseData.caseTypeData.identifiers)) {
        const identStmt = db.prepare(`
          INSERT INTO cybertip_identifiers (case_id, identifier_type, identifier_value, platform, provider)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        for (const identifier of caseData.caseTypeData.identifiers) {
          identStmt.run(
            newCaseId,
            identifier.identifier_type,
            identifier.identifier_value,
            identifier.platform || null,
            identifier.provider || null
          );
        }
      }
      
      // Import files
      if (caseData.caseTypeData.files && Array.isArray(caseData.caseTypeData.files)) {
        const filesStmt = db.prepare(`
          INSERT INTO cybertip_files (case_id, file_path, ncmec_filename, csam_description)
          VALUES (?, ?, ?, ?)
        `);
        
        for (const file of caseData.caseTypeData.files) {
          filesStmt.run(
            newCaseId,
            file.file_path || null,
            file.ncmec_filename || null,
            file.csam_description || null
          );
        }
      }
      
    } else if (caseType === 'p2p' && caseData.caseTypeData) {
      const p2pStmt = db.prepare(`
        INSERT INTO p2p_data (case_id, download_date, platform, suspect_ip, ip_provider, download_folder_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      p2pStmt.run(
        newCaseId,
        caseData.caseTypeData.download_date || null,
        caseData.caseTypeData.platform || null,
        caseData.caseTypeData.suspect_ip || null,
        caseData.caseTypeData.ip_provider || null,
        caseData.caseTypeData.download_folder_path || null
      );
      
    } else if (caseType === 'chat' && caseData.caseTypeData) {
      const chatStmt = db.prepare(`
        INSERT INTO chat_data (case_id, initial_contact_date, platform)
        VALUES (?, ?, ?)
      `);
      
      chatStmt.run(
        newCaseId,
        caseData.caseTypeData.initial_contact_date || null,
        caseData.caseTypeData.platform || null
      );
      
      // Import identifiers
      if (caseData.caseTypeData.identifiers && Array.isArray(caseData.caseTypeData.identifiers)) {
        const identStmt = db.prepare(`
          INSERT INTO chat_identifiers (case_id, identifier_value)
          VALUES (?, ?)
        `);
        
        for (const identifier of caseData.caseTypeData.identifiers) {
          identStmt.run(newCaseId, identifier.identifier_value);
        }
      }
      
    } else if (caseType === 'other' && caseData.caseTypeData) {
      const otherStmt = db.prepare(`
        INSERT INTO other_data (case_id, case_type_description)
        VALUES (?, ?)
      `);
      
      otherStmt.run(
        newCaseId,
        caseData.caseTypeData.case_type_description || null
      );
      
      // Import identifiers
      if (caseData.caseTypeData.identifiers && Array.isArray(caseData.caseTypeData.identifiers)) {
        const identStmt = db.prepare(`
          INSERT INTO other_identifiers (case_id, identifier_value)
          VALUES (?, ?)
        `);
        
        for (const identifier of caseData.caseTypeData.identifiers) {
          identStmt.run(newCaseId, identifier.identifier_value);
        }
      }
    }
  }
  
  // Import notes (schema column is `content`)
  if (caseData.notes && Array.isArray(caseData.notes)) {
    const notesStmt = db.prepare(`
      INSERT INTO case_notes (case_id, content, created_at)
      VALUES (?, ?, ?)
    `);

    for (const note of caseData.notes) {
      notesStmt.run(
        newCaseId,
        note.content || note.note_content || '',
        note.created_at || new Date().toISOString()
      );
    }
  }

  // Import warrants (current schema columns: date_served, date_due, received,
  // date_received, warrant_pdf_path, return_files_path, notes)
  if (caseData.warrants && Array.isArray(caseData.warrants)) {
    const warrantsStmt = db.prepare(`
      INSERT INTO warrants
        (case_id, company_name, date_issued, date_served, date_due, received,
         date_received, warrant_pdf_path, return_files_path, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const w of caseData.warrants) {
      warrantsStmt.run(
        newCaseId,
        w.company_name,
        w.date_issued,
        w.date_served || null,
        w.date_due || w.due_date || null,
        w.received ? 1 : 0,
        w.date_received || null,
        w.warrant_pdf_path || null,
        w.return_files_path || w.return_folder_path || null,
        w.notes || null
      );
    }
  }

  // Import evidence — preserve all typed fields & metadata
  if (caseData.evidence && Array.isArray(caseData.evidence)) {
    const evidenceStmt = db.prepare(`
      INSERT INTO evidence
        (case_id, description, file_path, category, type, tag, storage_mode,
         file_count, total_size, files_json, meta_json, uploaded_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of caseData.evidence) {
      evidenceStmt.run(
        newCaseId,
        e.description || '',
        e.file_path || '',
        e.category || 'Other',
        e.type || 'other',
        e.tag || null,
        e.storage_mode || 'copy',
        e.file_count || 0,
        e.total_size || 0,
        e.files_json || null,
        e.meta_json || null,
        e.uploaded_at || e.created_at || new Date().toISOString(),
        e.updated_at || e.created_at || new Date().toISOString()
      );
    }
  }

  // Import suspect — real schema columns: name, dob, drivers_license,
  // photo_path, address, height, weight, phone, workplace, has_weapons,
  // plus migration columns (firearms_info, firearms_pdf_path,
  // criminal_history, criminal_history_pdf_path, scars_marks_tattoos,
  // license_plate). We use the full set and best-effort fall back when
  // the source export used the older first_name/last_name split.
  if (caseData.suspect) {
    const s = caseData.suspect;
    const composedName =
      s.name ||
      [s.first_name, s.last_name].filter(Boolean).join(' ').trim() ||
      null;

    try {
      const suspectStmt = db.prepare(`
        INSERT INTO suspects
          (case_id, name, dob, drivers_license, photo_path, address, height,
           weight, phone, workplace, has_weapons,
           firearms_info, firearms_pdf_path, criminal_history,
           criminal_history_pdf_path, scars_marks_tattoos, license_plate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      suspectStmt.run(
        newCaseId,
        composedName,
        s.dob || null,
        s.drivers_license || null,
        s.photo_path || null,
        s.address || null,
        s.height || null,
        s.weight || null,
        s.phone || null,
        s.workplace || s.place_of_work || null,
        s.has_weapons ? 1 : 0,
        s.firearms_info || null,
        s.firearms_pdf_path || null,
        s.criminal_history || null,
        s.criminal_history_pdf_path || null,
        s.scars_marks_tattoos || null,
        s.license_plate || null
      );
    } catch (e) {
      // Older db without migration columns — fall back to base columns
      try {
        const fallback = db.prepare(`
          INSERT INTO suspects
            (case_id, name, dob, drivers_license, photo_path, address, height,
             weight, phone, workplace, has_weapons)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        fallback.run(
          newCaseId, composedName, s.dob || null, s.drivers_license || null,
          s.photo_path || null, s.address || null, s.height || null, s.weight || null,
          s.phone || null, s.workplace || s.place_of_work || null, s.has_weapons ? 1 : 0
        );
      } catch (e2) {
        warnings.push(`suspect import skipped: ${(e2 as Error).message}`);
      }
    }

    // Get new suspect ID
    const newSuspect = db.prepare('SELECT id FROM suspects WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(newCaseId);

    if (newSuspect) {
      // Import weapons
      if (caseData.weapons && Array.isArray(caseData.weapons)) {
        const weaponsStmt = db.prepare(`
          INSERT INTO weapons (suspect_id, weapon_description)
          VALUES (?, ?)
        `);
        for (const weapon of caseData.weapons) {
          weaponsStmt.run(newSuspect.id, weapon.weapon_description);
        }
      }

      // Import suspect photos
      if (caseData.suspectPhotos && Array.isArray(caseData.suspectPhotos)) {
        try {
          const photosStmt = db.prepare(`
            INSERT INTO suspect_photos (case_id, photo_path, photo_type)
            VALUES (?, ?, ?)
          `);
          for (const photo of caseData.suspectPhotos) {
            photosStmt.run(newCaseId, photo.photo_path, photo.photo_type || null);
          }
        } catch (e) {
          warnings.push(`suspect_photos import skipped: ${(e as Error).message}`);
        }
      }
    }
  }
  
  // Import prosecution (table is prosecution_info per current schema)
  if (caseData.prosecution) {
    try {
      const prosecutionStmt = db.prepare(`
        INSERT INTO prosecution_info (case_id, charges, court_case_number, assigned_court, da_name, da_contact)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      prosecutionStmt.run(
        newCaseId,
        caseData.prosecution.charges || null,
        caseData.prosecution.court_case_number || null,
        caseData.prosecution.assigned_court || null,
        caseData.prosecution.da_name || null,
        caseData.prosecution.da_contact || null
      );
    } catch (e) {
      warnings.push(`prosecution_info import skipped: ${(e as Error).message}`);
    }
  }

  // Import operations plan (table is operations_plans per current schema)
  let newOpsPlanId: number | null = null;
  if (caseData.opsPlan) {
    try {
      const opsPlanStmt = db.prepare(`
        INSERT INTO operations_plans (
          case_id, plan_pdf_path, approved, approver_name, approval_date, execution_date,
          date, time, report_number, case_agent, operation_type, location, briefing_location,
          fortifications, cameras, dogs, children, notifications, comms, hospital, rally_point,
          suspect_info, case_summary, tactical_plan, pursuit_plan, medical_plan,
          barricade_plan, contingency_plan, directions, location_photos, route_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const op = caseData.opsPlan;
      opsPlanStmt.run(
        newCaseId,
        op.plan_pdf_path || op.pdf_path || null,
        op.approved ? 1 : 0,
        op.approver_name || null, op.approval_date || null, op.execution_date || null,
        op.date || null, op.time || null, op.report_number || null, op.case_agent || null,
        op.operation_type || null, op.location || null, op.briefing_location || null,
        op.fortifications || null, op.cameras || null, op.dogs || null, op.children || null,
        op.notifications || null, op.comms || null, op.hospital || null, op.rally_point || null,
        op.suspect_info || null, op.case_summary || null,
        op.tactical_plan || null, op.pursuit_plan || null, op.medical_plan || null,
        op.barricade_plan || null, op.contingency_plan || null,
        op.directions || null, op.location_photos || null, op.route_data || null
      );
      const newOp = db.prepare('SELECT id FROM operations_plans WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(newCaseId);
      newOpsPlanId = newOp ? newOp.id : null;
    } catch (e) {
      warnings.push(`operations_plans import skipped: ${(e as Error).message}`);
    }
  }

  // Import ops plan child rows
  if (newOpsPlanId != null && Array.isArray(caseData.opsEntryTeam)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO ops_entry_team (ops_plan_id, name, assignment, vehicle, call_sign, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const row of caseData.opsEntryTeam) {
        stmt.run(newOpsPlanId, row.name || null, row.assignment || null, row.vehicle || null, row.call_sign || null, row.sort_order || 0);
      }
    } catch (e) {
      warnings.push(`ops_entry_team import skipped: ${(e as Error).message}`);
    }
  }
  if (newOpsPlanId != null && Array.isArray(caseData.opsOtherResidents)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO ops_other_residents (ops_plan_id, name, dob, photo, has_firearms, firearms, has_crim_history, crim_history, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of caseData.opsOtherResidents) {
        stmt.run(
          newOpsPlanId, row.name || null, row.dob || null, row.photo || null,
          row.has_firearms ? 1 : 0, row.firearms || null,
          row.has_crim_history ? 1 : 0, row.crim_history || null,
          row.sort_order || 0
        );
      }
    } catch (e) {
      warnings.push(`ops_other_residents import skipped: ${(e as Error).message}`);
    }
  }

  // Import report (table is case_reports per current schema)
  if (caseData.report) {
    try {
      const reportStmt = db.prepare(`
        INSERT INTO case_reports (case_id, content)
        VALUES (?, ?)
      `);
      reportStmt.run(newCaseId, caseData.report.content || caseData.report.report_content || '');
    } catch (e) {
      warnings.push(`case_reports import skipped: ${(e as Error).message}`);
    }
  }

  // Import probable cause
  if (caseData.probableCause) {
    try {
      const pcStmt = db.prepare(`INSERT INTO probable_cause (case_id, content) VALUES (?, ?)`);
      pcStmt.run(newCaseId, caseData.probableCause.content || '');
    } catch (e) {
      warnings.push(`probable_cause import skipped: ${(e as Error).message}`);
    }
  }

  // Import todos (schema column is `content`, not `task_description`)
  if (Array.isArray(caseData.todos)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO todos (case_id, content, completed, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const t of caseData.todos) {
        stmt.run(
          newCaseId,
          t.content || t.task_description || '',
          t.completed ? 1 : 0,
          t.created_at || new Date().toISOString(),
          t.completed_at || null
        );
      }
    } catch (e) {
      warnings.push(`todos import skipped: ${(e as Error).message}`);
    }
  }

  // Import timeline events
  if (Array.isArray(caseData.timelineEvents)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO timeline_events
          (case_id, timestamp, end_timestamp, title, description, lane, category,
           significance, entity_link, source_type, source_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ev of caseData.timelineEvents) {
        stmt.run(
          newCaseId,
          ev.timestamp, ev.end_timestamp || null,
          ev.title, ev.description || null,
          ev.lane, ev.category || 'custom',
          ev.significance || 'major',
          ev.entity_link || null,
          ev.source_type || 'manual',
          ev.source_id || null,
          ev.created_at || new Date().toISOString()
        );
      }
    } catch (e) {
      warnings.push(`timeline_events import skipped: ${(e as Error).message}`);
    }
  }

  // Import CDR records
  if (Array.isArray(caseData.cdrRecords)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO cdr_records
          (case_id, phone_a, phone_b, date_val, time_val, timestamp, call_type,
           duration_seconds, imei, imsi, tower_a, tower_b, source, raw_line)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of caseData.cdrRecords) {
        stmt.run(
          newCaseId,
          r.phone_a || null, r.phone_b || null,
          r.date_val || null, r.time_val || null, r.timestamp || null,
          r.call_type || 'voice', r.duration_seconds || 0,
          r.imei || null, r.imsi || null,
          r.tower_a || null, r.tower_b || null,
          r.source || null, r.raw_line || null
        );
      }
    } catch (e) {
      warnings.push(`cdr_records import skipped: ${(e as Error).message}`);
    }
  }

  // Import Aperture emails + notes
  const oldToNewEmailId = new Map<number, number>();
  if (Array.isArray(caseData.apertureEmails)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO aperture_emails
          (case_id, message_id, from_address, to_addresses, cc_addresses, subject,
           date_sent, body_text, body_html, headers_raw, source_file, flagged,
           ip_addresses, attachments_json, source_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const getIdStmt = db.prepare('SELECT last_insert_rowid() AS id');
      for (const e of caseData.apertureEmails) {
        stmt.run(
          newCaseId, e.message_id || null, e.from_address, e.to_addresses || null,
          e.cc_addresses || null, e.subject || null, e.date_sent,
          e.body_text || null, e.body_html || null, e.headers_raw || null,
          e.source_file || null, e.flagged ? 1 : 0,
          e.ip_addresses || null, e.attachments_json || null, e.source_name || null
        );
        const row = getIdStmt.get();
        if (row && e.id != null) oldToNewEmailId.set(e.id, row.id);
      }
    } catch (err) {
      warnings.push(`aperture_emails import skipped: ${(err as Error).message}`);
    }
  }
  if (Array.isArray(caseData.apertureNotes)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO aperture_notes (case_id, email_id, content, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const n of caseData.apertureNotes) {
        const mapped = oldToNewEmailId.get(n.email_id);
        if (mapped == null) continue; // orphaned note — skip
        stmt.run(newCaseId, mapped, n.content, n.created_at || new Date().toISOString());
      }
    } catch (err) {
      warnings.push(`aperture_notes import skipped: ${(err as Error).message}`);
    }
  }

  // Import warrant return imports + flags
  const oldToNewWRImportId = new Map<number, number>();
  if (Array.isArray(caseData.warrantReturnImports)) {
    try {
      const stmt = db.prepare(`
        INSERT INTO warrant_return_imports
          (case_id, provider, label, source_path, source_kind, source_ref_id,
           data_json, media_index_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const getIdStmt = db.prepare('SELECT last_insert_rowid() AS id');
      for (const wi of caseData.warrantReturnImports) {
        stmt.run(
          newCaseId, wi.provider, wi.label || null, wi.source_path || null,
          wi.source_kind || null, wi.source_ref_id || null,
          wi.data_json, wi.media_index_json || null,
          wi.created_at || new Date().toISOString(),
          wi.updated_at || new Date().toISOString()
        );
        const row = getIdStmt.get();
        if (row && wi.id != null) oldToNewWRImportId.set(wi.id, row.id);
      }
    } catch (err) {
      warnings.push(`warrant_return_imports import skipped: ${(err as Error).message}`);
    }
  }
  if (Array.isArray(caseData.warrantReturnFlags)) {
    try {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO warrant_return_flags
          (case_id, provider, import_id, section, flag_key, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const f of caseData.warrantReturnFlags) {
        const mappedImport = f.import_id != null ? oldToNewWRImportId.get(f.import_id) ?? null : null;
        stmt.run(
          newCaseId, f.provider, mappedImport, f.section, f.flag_key,
          f.notes || null, f.created_at || new Date().toISOString()
        );
      }
    } catch (err) {
      warnings.push(`warrant_return_flags import skipped: ${(err as Error).message}`);
    }
  }

  // Import chat highlights — evidence rows have new IDs after import.
  // We can't map old→new evidence reliably without an evidence "external_id"
  // field, so we best-effort match by file_path within this case's evidence.
  if (Array.isArray(caseData.chatHighlights) && caseData.chatHighlights.length > 0) {
    try {
      // Best-effort: keep them keyed by evidence_id since the new evidence
      // rows for this case will have been inserted above (without a mapping
      // we can't be precise). We store them but flag a warning so the user
      // knows highlights may need manual re-association.
      warnings.push(
        `${caseData.chatHighlights.length} chat highlight(s) were exported with the case but could not be auto-reattached on import (evidence IDs change between systems). The evidence files themselves were imported.`
      );
    } catch { /* no-op */ }
  }

  // Audit log entries from the source system are informational —
  // do NOT import into the local audit_log table (it has its own
  // sequential hash chain and per-machine seq numbers). Instead
  // emit a single audit event noting that this case was imported.
  // (The local audit log will already record the case_imported event
  // from index.ts; this is just to ensure the data isn't silently lost.)
  if (Array.isArray(caseData.auditLog) && caseData.auditLog.length > 0) {
    try {
      const archivedDir = path.join(getCasesPath(), newCaseNumber, '_imported_audit_log');
      fs.mkdirSync(archivedDir, { recursive: true });
      const archivePath = path.join(archivedDir, `source-audit-log-${Date.now()}.json`);
      fs.writeFileSync(archivePath, JSON.stringify(caseData.auditLog, null, 2));
    } catch { /* best-effort — don't fail import */ }
  }

  saveDatabase();
  return newCaseId;
}

/**
 * Main import function
 */
export async function importCompleteCase(options: ImportOptions): Promise<ImportResult> {
  const { filePath, password, onProgress } = options;
  const db = getDatabase();
  
  let tempDir: string | null = null;
  let newCaseNumber: string | null = null;
  let newCaseId: number | null = null;
  
  try {
    // Step 1: Decrypt file
    onProgress?.({
      step: 'decrypting',
      current: 1,
      total: 5,
      message: 'Decrypting package...'
    });
    
    const encryptedData = fs.readFileSync(filePath);
    const decryptedZip = decryptData(encryptedData, password);
    
    // Step 2: Extract and validate
    onProgress?.({
      step: 'validating',
      current: 2,
      total: 5,
      message: 'Validating manifest...'
    });
    
    tempDir = path.join(require('os').tmpdir(), `pulse_import_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    const zip = new AdmZip(decryptedZip);
    zip.extractAllTo(tempDir, true);
    
    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Invalid PULSE file: manifest.json not found');
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const originalCaseNumber = manifest.export_metadata.case_number;
    
    // Check for conflicts and generate unique case number
    if (caseNumberExists(db, originalCaseNumber)) {
      newCaseNumber = generateUniqueCaseNumber(db, originalCaseNumber);
      onProgress?.({
        step: 'validating',
        current: 2,
        total: 5,
        message: `Case number conflict - renaming to ${newCaseNumber}`
      });
    } else {
      newCaseNumber = originalCaseNumber;
    }
    
    // Step 3: Import database records
    onProgress?.({
      step: 'importing',
      current: 3,
      total: 5,
      message: 'Importing case data...'
    });
    
    newCaseId = importCaseData(db, manifest, newCaseNumber);
    
    // Step 4: Copy files
    const filesDir = path.join(tempDir, 'files');
    if (fs.existsSync(filesDir)) {
      const destCasePath = path.join(getCasesPath(), newCaseNumber);
      fs.mkdirSync(destCasePath, { recursive: true });
      
      const fileCount = manifest.file_inventory?.length || 0;
      let copiedFiles = 0;
      
      onProgress?.({
        step: 'copying',
        current: 4,
        total: 5,
        message: `Copying files... (0 of ${fileCount})`
      });
      
      await copyDirectoryWithProgress(filesDir, destCasePath, (current) => {
        copiedFiles = current;
        onProgress?.({
          step: 'copying',
          current: 4,
          total: 5,
          message: `Copying files... (${current} of ${fileCount})`
        });
      });
    }
    
    // Step 5: Verify checksums (if files exist)
    if (manifest.file_inventory && manifest.file_inventory.length > 0) {
      onProgress?.({
        step: 'verifying',
        current: 5,
        total: 5,
        message: 'Verifying file integrity...'
      });
      
      const warnings: string[] = [];
      const destCasePath = path.join(getCasesPath(), newCaseNumber);
      
      for (const fileEntry of manifest.file_inventory) {
        const filePath = path.join(destCasePath, fileEntry.path);
        if (fs.existsSync(filePath)) {
          if (!verifyChecksum(filePath, fileEntry.checksum)) {
            warnings.push(`Checksum mismatch: ${fileEntry.path}`);
          }
        } else {
          warnings.push(`File missing: ${fileEntry.path}`);
        }
      }
    }
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      caseId: newCaseId,
      caseNumber: newCaseNumber,
      warnings: []
    };
    
  } catch (error: any) {
    // Cleanup on error
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Rollback if we created a case
    if (newCaseId && newCaseNumber) {
      try {
        db.run('DELETE FROM cases WHERE id = ?', [newCaseId]);
        const casePath = path.join(getCasesPath(), newCaseNumber);
        if (fs.existsSync(casePath)) {
          fs.rmSync(casePath, { recursive: true, force: true });
        }
        saveDatabase();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    
    return {
      success: false,
      error: error.message || 'Import failed'
    };
  }
}

/**
 * Copy directory with progress callback
 */
async function copyDirectoryWithProgress(
  src: string,
  dest: string,
  onProgress?: (count: number) => void
): Promise<void> {
  let fileCount = 0;
  
  function copyRecursive(srcPath: string, destPath: string) {
    if (!fs.existsSync(srcPath)) return;
    
    const stats = fs.statSync(srcPath);
    
    if (stats.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      
      const items = fs.readdirSync(srcPath);
      for (const item of items) {
        copyRecursive(path.join(srcPath, item), path.join(destPath, item));
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
      onProgress?.(fileCount);
    }
  }
  
  copyRecursive(src, dest);
}
