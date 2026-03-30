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
  
  // Get current user
  const userStmt = db.prepare('SELECT id FROM users ORDER BY last_login DESC LIMIT 1');
  const currentUser = userStmt.get();
  
  if (!currentUser) {
    throw new Error('No user found. Please register first.');
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
  
  // Import notes
  if (caseData.notes && Array.isArray(caseData.notes)) {
    const notesStmt = db.prepare(`
      INSERT INTO case_notes (case_id, note_content, created_at)
      VALUES (?, ?, ?)
    `);
    
    for (const note of caseData.notes) {
      notesStmt.run(
        newCaseId,
        note.note_content,
        note.created_at
      );
    }
  }
  
  // Import warrants
  if (caseData.warrants && Array.isArray(caseData.warrants)) {
    const warrantsStmt = db.prepare(`
      INSERT INTO warrants (case_id, company_name, date_issued, due_date, warrant_pdf_path, return_folder_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (const warrant of caseData.warrants) {
      warrantsStmt.run(
        newCaseId,
        warrant.company_name,
        warrant.date_issued,
        warrant.due_date || null,
        warrant.warrant_pdf_path || null,
        warrant.return_folder_path || null
      );
    }
  }
  
  // Import evidence
  if (caseData.evidence && Array.isArray(caseData.evidence)) {
    const evidenceStmt = db.prepare(`
      INSERT INTO evidence (case_id, file_path, description, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    for (const evidence of caseData.evidence) {
      evidenceStmt.run(
        newCaseId,
        evidence.file_path,
        evidence.description || null,
        evidence.created_at
      );
    }
  }
  
  // Import suspect
  if (caseData.suspect) {
    const suspectStmt = db.prepare(`
      INSERT INTO suspects (case_id, first_name, last_name, dob, phone, address, place_of_work, vehicle_make, vehicle_model, vehicle_color, has_weapons)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    suspectStmt.run(
      newCaseId,
      caseData.suspect.first_name || null,
      caseData.suspect.last_name || null,
      caseData.suspect.dob || null,
      caseData.suspect.phone || null,
      caseData.suspect.address || null,
      caseData.suspect.place_of_work || null,
      caseData.suspect.vehicle_make || null,
      caseData.suspect.vehicle_model || null,
      caseData.suspect.vehicle_color || null,
      caseData.suspect.has_weapons ? 1 : 0
    );
    
    // Get new suspect ID
    const getSuspectStmt = db.prepare('SELECT id FROM suspects WHERE case_id = ?');
    const newSuspect = getSuspectStmt.get(newCaseId);
    
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
        const photosStmt = db.prepare(`
          INSERT INTO suspect_photos (case_id, photo_path, photo_type)
          VALUES (?, ?, ?)
        `);
        
        for (const photo of caseData.suspectPhotos) {
          photosStmt.run(
            newCaseId,
            photo.photo_path,
            photo.photo_type
          );
        }
      }
    }
  }
  
  // Import prosecution
  if (caseData.prosecution) {
    const prosecutionStmt = db.prepare(`
      INSERT INTO prosecution (case_id, court_case_number, da_assigned, charges_filed, convicted, sentence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    prosecutionStmt.run(
      newCaseId,
      caseData.prosecution.court_case_number || null,
      caseData.prosecution.da_assigned || null,
      caseData.prosecution.charges_filed || null,
      caseData.prosecution.convicted ? 1 : 0,
      caseData.prosecution.sentence || null
    );
  }
  
  // Import operations plan
  if (caseData.opsPlan) {
    const opsPlanStmt = db.prepare(`
      INSERT INTO operations_plan (case_id, pdf_path)
      VALUES (?, ?)
    `);
    
    opsPlanStmt.run(
      newCaseId,
      caseData.opsPlan.pdf_path || null
    );
  }
  
  // Import report
  if (caseData.report) {
    const reportStmt = db.prepare(`
      INSERT INTO reports (case_id, report_content)
      VALUES (?, ?)
    `);
    
    reportStmt.run(
      newCaseId,
      caseData.report.report_content || null
    );
  }
  
  // Import todos
  if (caseData.todos && Array.isArray(caseData.todos)) {
    const todosStmt = db.prepare(`
      INSERT INTO todos (case_id, task_description, completed)
      VALUES (?, ?, ?)
    `);
    
    for (const todo of caseData.todos) {
      todosStmt.run(
        newCaseId,
        todo.task_description,
        todo.completed ? 1 : 0
      );
    }
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
