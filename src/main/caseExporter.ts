/**
 * Case Exporter - Exports complete case with all data and files
 * Creates encrypted .pulse file for transfer between ICAC P.U.L.S.E. installations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { getDatabase, getCasesPath } from './database';
import type { Database } from './db-wrapper';

export interface ExportProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export interface ExportOptions {
  caseId: number;
  password: string;
  outputPath: string;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  fileCount?: number;
  error?: string;
}

/**
 * Calculate total size of case files before export
 */
export async function calculateExportSize(caseId: number): Promise<number> {
  const db = getDatabase();
  
  // Get case info
  const caseStmt = db.prepare('SELECT case_number FROM cases WHERE id = ?');
  const caseInfo = caseStmt.get(caseId);
  
  if (!caseInfo) {
    throw new Error('Case not found');
  }
  
  const casePath = path.join(getCasesPath(), caseInfo.case_number);
  
  if (!fs.existsSync(casePath)) {
    return 0; // No files yet
  }
  
  return getDirectorySize(casePath);
}

/**
 * Recursively calculate directory size
 */
function getDirectorySize(dirPath: string): number {
  let size = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      size += getDirectorySize(itemPath);
    } else {
      size += stats.size;
    }
  }
  
  return size;
}

/**
 * Count files in directory recursively
 */
function countFiles(dirPath: string): number {
  let count = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      count += countFiles(itemPath);
    } else {
      count++;
    }
  }
  
  return count;
}

/**
 * Generate SHA-256 checksum for file
 */
function generateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Best-effort row fetch — returns undefined/[] if the table doesn't exist
 * or the query fails. Used to keep the export resilient across schema
 * versions when older databases may be missing newer migration tables.
 */
function safeGet(db: Database, sql: string, ...params: any[]): any {
  try {
    return db.prepare(sql).get(...params);
  } catch {
    return undefined;
  }
}

function safeAll(db: Database, sql: string, ...params: any[]): any[] {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

/**
 * Gather all database records for a case.
 *
 * Pulls every case-scoped table the application knows about so that an
 * exported .pulse file is a true complete snapshot. Tables without a
 * direct case_id are joined through their parent (ops plan children,
 * chat_highlights through evidence). audit_log is filtered by
 * JSON event_data substring since it has no case_id column.
 */
function gatherCaseData(db: Database, caseId: number): any {
  // Main case record
  const caseStmt = db.prepare('SELECT * FROM cases WHERE id = ?');
  const caseRecord = caseStmt.get(caseId);

  if (!caseRecord) {
    throw new Error('Case not found');
  }

  // Get case type specific data
  let caseTypeData: any = null;

  if (caseRecord.case_type === 'cybertip') {
    caseTypeData = safeGet(db, 'SELECT * FROM cybertip_data WHERE case_id = ?', caseId) || {};
    caseTypeData.identifiers = safeAll(db, 'SELECT * FROM cybertip_identifiers WHERE case_id = ?', caseId);
    caseTypeData.files = safeAll(db, 'SELECT * FROM cybertip_files WHERE case_id = ?', caseId);
  } else if (caseRecord.case_type === 'p2p') {
    caseTypeData = safeGet(db, 'SELECT * FROM p2p_data WHERE case_id = ?', caseId) || {};
  } else if (caseRecord.case_type === 'chat') {
    caseTypeData = safeGet(db, 'SELECT * FROM chat_data WHERE case_id = ?', caseId) || {};
    caseTypeData.identifiers = safeAll(db, 'SELECT * FROM chat_identifiers WHERE case_id = ?', caseId);
  } else if (caseRecord.case_type === 'other') {
    caseTypeData = safeGet(db, 'SELECT * FROM other_data WHERE case_id = ?', caseId) || {};
    caseTypeData.identifiers = safeAll(db, 'SELECT * FROM other_identifiers WHERE case_id = ?', caseId);
  }

  // Core case-scoped tables
  const notes = safeAll(db, 'SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC', caseId);
  const warrants = safeAll(db, 'SELECT * FROM warrants WHERE case_id = ?', caseId);
  const evidence = safeAll(db, 'SELECT * FROM evidence WHERE case_id = ?', caseId);
  const suspect = safeGet(db, 'SELECT * FROM suspects WHERE case_id = ?', caseId);

  let weapons: any[] = [];
  let suspectPhotos: any[] = [];
  if (suspect) {
    weapons = safeAll(db, 'SELECT * FROM weapons WHERE suspect_id = ?', suspect.id);
    suspectPhotos = safeAll(db, 'SELECT * FROM suspect_photos WHERE case_id = ?', caseId);
  }

  // Prosecution / ops plan / report (correct table names from schema)
  const prosecution =
    safeGet(db, 'SELECT * FROM prosecution_info WHERE case_id = ?', caseId) ||
    safeGet(db, 'SELECT * FROM prosecution WHERE case_id = ?', caseId);

  const opsPlan =
    safeGet(db, 'SELECT * FROM operations_plans WHERE case_id = ?', caseId) ||
    safeGet(db, 'SELECT * FROM operations_plan WHERE case_id = ?', caseId);

  // Ops plan child rows (joined through ops_plan_id)
  let opsEntryTeam: any[] = [];
  let opsOtherResidents: any[] = [];
  if (opsPlan && opsPlan.id != null) {
    opsEntryTeam = safeAll(db, 'SELECT * FROM ops_entry_team WHERE ops_plan_id = ? ORDER BY sort_order ASC', opsPlan.id);
    opsOtherResidents = safeAll(db, 'SELECT * FROM ops_other_residents WHERE ops_plan_id = ? ORDER BY sort_order ASC', opsPlan.id);
  }

  const report =
    safeGet(db, 'SELECT * FROM case_reports WHERE case_id = ?', caseId) ||
    safeGet(db, 'SELECT * FROM reports WHERE case_id = ?', caseId);

  const probableCause = safeGet(db, 'SELECT * FROM probable_cause WHERE case_id = ?', caseId);
  const todos = safeAll(db, 'SELECT * FROM todos WHERE case_id = ?', caseId);

  // Newer case-scoped tables (migrations 14-21)
  const timelineEvents = safeAll(db, 'SELECT * FROM timeline_events WHERE case_id = ?', caseId);
  const cdrRecords = safeAll(db, 'SELECT * FROM cdr_records WHERE case_id = ?', caseId);
  const apertureEmails = safeAll(db, 'SELECT * FROM aperture_emails WHERE case_id = ?', caseId);
  const apertureNotes = safeAll(db, 'SELECT * FROM aperture_notes WHERE case_id = ?', caseId);
  const warrantReturnImports = safeAll(db, 'SELECT * FROM warrant_return_imports WHERE case_id = ?', caseId);
  const warrantReturnFlags = safeAll(db, 'SELECT * FROM warrant_return_flags WHERE case_id = ?', caseId);

  // chat_highlights has no case_id — join through evidence.id
  const chatHighlights = safeAll(
    db,
    `SELECT ch.* FROM chat_highlights ch
     INNER JOIN evidence ev ON ev.id = ch.evidence_id
     WHERE ev.case_id = ?`,
    caseId
  );

  // audit_log has no case_id — filter by JSON event_data substring.
  // Matches both "case_id":<id> and "case_number":"<number>" so any audit
  // entry that references this case ships with the export.
  const auditLog = safeAll(
    db,
    `SELECT * FROM audit_log
     WHERE event_data LIKE ? OR event_data LIKE ?
     ORDER BY seq ASC`,
    `%"case_id":${caseId}%`,
    `%"case_number":"${caseRecord.case_number}"%`
  );

  // Get user info for officer name
  const userStmt = db.prepare('SELECT username FROM users WHERE id = ?');
  const user = userStmt.get(caseRecord.user_id);

  return {
    case: caseRecord,
    caseTypeData,
    notes,
    warrants,
    evidence,
    suspect,
    weapons,
    suspectPhotos,
    prosecution,
    opsPlan,
    opsEntryTeam,
    opsOtherResidents,
    report,
    probableCause,
    todos,
    timelineEvents,
    cdrRecords,
    apertureEmails,
    apertureNotes,
    warrantReturnImports,
    warrantReturnFlags,
    chatHighlights,
    auditLog,
    exportedBy: user?.username || 'Unknown'
  };
}

/**
 * Build file inventory with checksums
 */
function buildFileInventory(casePath: string, relativePath: string = ''): any[] {
  const inventory: any[] = [];
  
  if (!fs.existsSync(casePath)) {
    return inventory;
  }
  
  const items = fs.readdirSync(casePath);
  
  for (const item of items) {
    const itemPath = path.join(casePath, item);
    const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      inventory.push(...buildFileInventory(itemPath, itemRelativePath));
    } else {
      inventory.push({
        path: itemRelativePath.replace(/\\/g, '/'), // Normalize to forward slashes
        size: stats.size,
        checksum: generateChecksum(itemPath)
      });
    }
  }
  
  return inventory;
}

/**
 * Encrypt data with AES-256
 */
function encryptData(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(32);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  
  // Prepend salt and IV to encrypted data
  return Buffer.concat([salt, iv, encrypted]);
}

/**
 * Main export function
 */
export async function exportCompleteCase(options: ExportOptions): Promise<ExportResult> {
  const { caseId, password, outputPath, onProgress } = options;
  const db = getDatabase();
  
  let tempDir: string | null = null;
  
  try {
    // Step 1: Gather case data
    onProgress?.({
      step: 'gathering',
      current: 1,
      total: 5,
      message: 'Gathering case data...'
    });
    
    const caseData = gatherCaseData(db, caseId);
    const caseNumber = caseData.case.case_number;
    const casePath = path.join(getCasesPath(), caseNumber);
    
    // Step 2: Build file inventory
    onProgress?.({
      step: 'inventory',
      current: 2,
      total: 5,
      message: 'Building file inventory...'
    });
    
    const fileInventory = buildFileInventory(casePath);
    const fileCount = fileInventory.length;
    
    // Create manifest
    const manifest = {
      export_metadata: {
        pulse_version: '1.1.0', // 1.1.0 adds: timeline, cdr, aperture, warrant returns,
                                //              chat highlights, audit log, probable cause,
                                //              ops entry team / other residents
        manifest_schema: 2,
        export_date: new Date().toISOString(),
        exporting_officer: caseData.exportedBy,
        case_number: caseNumber
      },
      data: caseData,
      file_inventory: fileInventory
    };
    
    // Step 3: Create temporary directory and write manifest
    tempDir = path.join(require('os').tmpdir(), `pulse_export_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    const manifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Step 4: Copy case files
    if (fs.existsSync(casePath)) {
      onProgress?.({
        step: 'copying',
        current: 3,
        total: 5,
        message: `Copying files... (0 of ${fileCount})`
      });
      
      const filesDir = path.join(tempDir, 'files');
      fs.mkdirSync(filesDir, { recursive: true });
      
      await copyDirectory(casePath, filesDir, (current: number) => {
        onProgress?.({
          step: 'copying',
          current: 3,
          total: 5,
          message: `Copying files... (${current} of ${fileCount})`
        });
      });
    }
    
    // Step 5: Create ZIP archive
    onProgress?.({
      step: 'zipping',
      current: 4,
      total: 5,
      message: 'Creating archive...'
    });
    
    const zipPath = path.join(require('os').tmpdir(), `pulse_temp_${Date.now()}.zip`);
    await createZipArchive(tempDir, zipPath);
    
    // Step 6: Encrypt and save
    onProgress?.({
      step: 'encrypting',
      current: 5,
      total: 5,
      message: 'Encrypting package...'
    });
    
    const zipData = fs.readFileSync(zipPath);
    const encryptedData = encryptData(zipData, password);
    
    fs.writeFileSync(outputPath, encryptedData);
    
    const finalSize = fs.statSync(outputPath).size;
    
    // Cleanup
    fs.unlinkSync(zipPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      filePath: outputPath,
      fileSize: finalSize,
      fileCount
    };
    
  } catch (error: any) {
    // Cleanup on error
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    return {
      success: false,
      error: error.message || 'Export failed'
    };
  }
}

/**
 * Copy directory recursively
 */
async function copyDirectory(src: string, dest: string, onProgress?: (count: number) => void): Promise<void> {
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

/**
 * Create ZIP archive from directory
 */
function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
