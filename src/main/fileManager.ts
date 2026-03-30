import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';
import { getCasesPath } from './database';

/**
 * Create case directory structure
 */
export function createCaseDirectory(caseNumber: string): string {
  const caseDir = path.join(getCasesPath(), caseNumber);
  
  if (!fs.existsSync(caseDir)) {
    fs.mkdirSync(caseDir, { recursive: true });
    
    // Create subdirectories
    const subdirs = [
      'cybertip',
      'warrants',
      'operations_plan',
      'suspect',
      'reports'
    ];
    
    subdirs.forEach(subdir => {
      const subdirPath = path.join(caseDir, subdir);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
      }
    });
  }
  
  return caseDir;
}

/**
 * Copy file to case directory
 * @param sourcePath - Original file path
 * @param caseNumber - Case number
 * @param category - Subdirectory category (cybertip, warrants, etc.)
 * @param filename - Optional custom filename
 * @returns Relative path from cases directory
 */
export function copyFileToCase(
  sourcePath: string,
  caseNumber: string,
  category: string,
  filename?: string
): string {
  const caseDir = createCaseDirectory(caseNumber);
  const categoryDir = path.join(caseDir, category);
  
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  
  const originalFilename = filename || path.basename(sourcePath);
  const destPath = path.join(categoryDir, originalFilename);
  
  fs.copyFileSync(sourcePath, destPath);
  
  // Return relative path for database storage
  return path.relative(getCasesPath(), destPath);
}

/**
 * Copy folder to case directory with progress tracking
 * @param sourcePath - Original folder path
 * @param caseNumber - Case number
 * @param category - Subdirectory category
 * @param folderName - Optional custom folder name
 * @param progressCallback - Optional callback for progress updates
 * @returns Relative path from cases directory
 */
export function copyFolderToCase(
  sourcePath: string,
  caseNumber: string,
  category: string,
  folderName?: string,
  progressCallback?: (progress: { current: number; total: number; currentFile: string }) => void
): string {
  const caseDir = createCaseDirectory(caseNumber);
  const categoryDir = path.join(caseDir, category);
  
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  
  const originalFolderName = folderName || path.basename(sourcePath);
  const destPath = path.join(categoryDir, originalFolderName);
  
  // Count total files first for progress tracking
  const totalFiles = countFiles(sourcePath);
  let copiedFiles = 0;
  
  copyDirectoryRecursive(sourcePath, destPath, (currentFile) => {
    copiedFiles++;
    if (progressCallback) {
      progressCallback({
        current: copiedFiles,
        total: totalFiles,
        currentFile: path.basename(currentFile)
      });
    }
  });
  
  // Return relative path for database storage
  return path.relative(getCasesPath(), destPath);
}

/**
 * Count total files in directory recursively
 */
function countFiles(dirPath: string): number {
  let count = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        count += countFiles(fullPath);
      } else {
        count++;
      }
    });
  } catch (error) {
    console.error('Error counting files:', error);
  }
  
  return count;
}

/**
 * Recursively copy directory with progress callback
 */
function copyDirectoryRecursive(
  source: string, 
  destination: string,
  progressCallback?: (currentFile: string) => void
): void {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectoryRecursive(sourcePath, destPath, progressCallback);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      if (progressCallback) {
        progressCallback(sourcePath);
      }
    }
  });
}

/**
 * Open file location in Windows Explorer
 * @param relativePath - Relative path from cases directory
 */
export function openFileLocation(relativePath: string): void {
  const fullPath = path.join(getCasesPath(), relativePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Path not found: ${fullPath}`);
  }
  
  const stats = fs.statSync(fullPath);
  
  if (stats.isDirectory()) {
    // For directories, open the folder directly
    shell.openPath(fullPath);
  } else {
    // For files, open Explorer and select the file
    shell.showItemInFolder(fullPath);
  }
}

/**
 * Get absolute path from relative path
 */
export function getAbsolutePath(relativePath: string): string {
  return path.join(getCasesPath(), relativePath);
}

/**
 * Create warrant subdirectory
 * @param caseNumber - Case number
 * @param companyName - Company name for the warrant
 * @param date - Date string for the warrant
 * @returns Relative path to warrant directory
 */
export function createWarrantDirectory(
  caseNumber: string,
  companyName: string,
  date: string
): string {
  const caseDir = createCaseDirectory(caseNumber);
  const warrantsDir = path.join(caseDir, 'warrants');
  
  // Clean company name for directory name (remove invalid characters)
  const cleanCompanyName = companyName.replace(/[<>:"/\\|?*]/g, '_');
  const warrantDirName = `${cleanCompanyName}_${date.replace(/\//g, '-')}`;
  const warrantDir = path.join(warrantsDir, warrantDirName);
  
  if (!fs.existsSync(warrantDir)) {
    fs.mkdirSync(warrantDir, { recursive: true });
    
    // Create returns subdirectory
    const returnsDir = path.join(warrantDir, 'returns');
    fs.mkdirSync(returnsDir, { recursive: true });
  }
  
  return path.relative(getCasesPath(), warrantDir);
}

/**
 * Export case to a specified location
 * @param caseNumber - Case number to export
 * @param exportPath - Destination path for export
 */
export function exportCase(caseNumber: string, exportPath: string): void {
  const sourceCaseDir = path.join(getCasesPath(), caseNumber);
  
  if (!fs.existsSync(sourceCaseDir)) {
    throw new Error(`Case directory not found: ${caseNumber}`);
  }
  
  const exportDir = path.join(
    exportPath,
    `Exported_Case_${caseNumber}_${new Date().toISOString().split('T')[0]}`
  );
  
  copyDirectoryRecursive(sourceCaseDir, exportDir);
  
  // Open the exported folder location
  shell.showItemInFolder(exportDir);
}

/**
 * Check if file exists
 */
export function fileExists(relativePath: string): boolean {
  const fullPath = path.join(getCasesPath(), relativePath);
  return fs.existsSync(fullPath);
}

/**
 * Delete file
 */
export function deleteFile(relativePath: string): void {
  const fullPath = path.join(getCasesPath(), relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * Delete directory recursively
 */
export function deleteDirectory(relativePath: string): void {
  const fullPath = path.join(getCasesPath(), relativePath);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}
