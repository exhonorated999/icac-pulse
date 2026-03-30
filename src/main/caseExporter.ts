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
 * Gather all database records for a case
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
    const ctStmt = db.prepare('SELECT * FROM cybertip_data WHERE case_id = ?');
    caseTypeData = ctStmt.get(caseId);
    
    // Get identifiers
    const identStmt = db.prepare('SELECT * FROM cybertip_identifiers WHERE case_id = ?');
    caseTypeData.identifiers = identStmt.all(caseId);
    
    // Get files
    const filesStmt = db.prepare('SELECT * FROM cybertip_files WHERE case_id = ?');
    caseTypeData.files = filesStmt.all(caseId);
  } else if (caseRecord.case_type === 'p2p') {
    const p2pStmt = db.prepare('SELECT * FROM p2p_data WHERE case_id = ?');
    caseTypeData = p2pStmt.get(caseId);
  } else if (caseRecord.case_type === 'chat') {
    const chatStmt = db.prepare('SELECT * FROM chat_data WHERE case_id = ?');
    caseTypeData = chatStmt.get(caseId);
    
    // Get identifiers
    const identStmt = db.prepare('SELECT * FROM chat_identifiers WHERE case_id = ?');
    caseTypeData.identifiers = identStmt.all(caseId);
  } else if (caseRecord.case_type === 'other') {
    const otherStmt = db.prepare('SELECT * FROM other_data WHERE case_id = ?');
    caseTypeData = otherStmt.get(caseId);
    
    // Get identifiers
    const identStmt = db.prepare('SELECT * FROM other_identifiers WHERE case_id = ?');
    caseTypeData.identifiers = identStmt.all(caseId);
  }
  
  // Get notes
  const notesStmt = db.prepare('SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC');
  const notes = notesStmt.all(caseId);
  
  // Get warrants
  const warrantsStmt = db.prepare('SELECT * FROM warrants WHERE case_id = ?');
  const warrants = warrantsStmt.all(caseId);
  
  // Get evidence
  const evidenceStmt = db.prepare('SELECT * FROM evidence WHERE case_id = ?');
  const evidence = evidenceStmt.all(caseId);
  
  // Get suspect
  const suspectStmt = db.prepare('SELECT * FROM suspects WHERE case_id = ?');
  const suspect = suspectStmt.get(caseId);
  
  let weapons: any[] = [];
  let suspectPhotos: any[] = [];
  
  if (suspect) {
    const weaponsStmt = db.prepare('SELECT * FROM weapons WHERE suspect_id = ?');
    weapons = weaponsStmt.all(suspect.id);
    
    const photosStmt = db.prepare('SELECT * FROM suspect_photos WHERE case_id = ?');
    suspectPhotos = photosStmt.all(caseId);
  }
  
  // Get prosecution
  const prosecutionStmt = db.prepare('SELECT * FROM prosecution WHERE case_id = ?');
  const prosecution = prosecutionStmt.get(caseId);
  
  // Get operations plan
  const opsPlanStmt = db.prepare('SELECT * FROM operations_plan WHERE case_id = ?');
  const opsPlan = opsPlanStmt.get(caseId);
  
  // Get report
  const reportStmt = db.prepare('SELECT * FROM reports WHERE case_id = ?');
  const report = reportStmt.get(caseId);
  
  // Get todos
  const todosStmt = db.prepare('SELECT * FROM todos WHERE case_id = ?');
  const todos = todosStmt.all(caseId);
  
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
    report,
    todos,
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
        pulse_version: '1.0.0',
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
