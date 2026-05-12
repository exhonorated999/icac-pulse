/**
 * Evidence Manager — file copy / reference helpers for the rewritten Evidence module.
 *
 * Storage layout (per case):
 *   cases/<caseNumber>/evidence/
 *     <tag>/                              — Copy-mode standard uploads
 *     datapilot/<tag>/                    — Copy-mode Datapilot extractions
 *     meta_warrant_bundles/<safe-label>/  — Meta bundles
 *     <orphan-file.ext>                   — Legacy / untagged files
 *
 * All paths returned to the renderer are RELATIVE to getCasesPath() so they stay
 * stable across machines and case moves.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCasesPath } from './database';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EvidenceFileEntry {
  name: string;
  relPath: string;     // relative to getCasesPath()
  size: number;
  mimeType: string;
}

export interface CopyResult {
  files: EvidenceFileEntry[];
  fileCount: number;
  totalSize: number;
  evidenceDir: string;       // absolute
  evidenceDirRel: string;    // relative to getCasesPath()
}

// ─── Tag sanitization ───────────────────────────────────────────────────────

/**
 * Make a tag safe for use as a folder name on Windows/macOS/Linux.
 * Removes path separators, control chars, and reserved Windows names.
 */
export function sanitizeTag(tag: string | null | undefined): string {
  if (!tag) return '';
  let t = String(tag).trim();
  // Strip path traversal, control chars, and reserved chars
  t = t.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  // Collapse whitespace
  t = t.replace(/\s+/g, '_');
  // Trim trailing dots / underscores (Windows hates trailing dots)
  t = t.replace(/[._]+$/, '');
  // Reserved Windows names
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(t)) t = '_' + t;
  return t.substring(0, 80);
}

/**
 * Ensure a target folder exists. If it already exists and `unique` is true,
 * append `-2`, `-3`, ... until we find an unused name. Returns the chosen path.
 */
export function ensureUniqueFolder(baseDir: string, name: string, unique = true): string {
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  let target = path.join(baseDir, name);
  if (!unique || !fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    return target;
  }
  let n = 2;
  while (fs.existsSync(path.join(baseDir, `${name}-${n}`))) n++;
  target = path.join(baseDir, `${name}-${n}`);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

// ─── MIME sniffing (extension-based; sufficient for preview routing) ────────

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
  pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml',
  html: 'text/html', htm: 'text/html',
  zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/x-rar-compressed',
  db: 'application/x-sqlite3', sqlite: 'application/x-sqlite3',
  eml: 'message/rfc822', mbox: 'application/mbox',
};

export function sniffMime(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// ─── Copy / reference operations ───────────────────────────────────────────

/**
 * Copy a list of files into the case evidence folder under the given tag.
 * Returns metadata for each copied file (relative paths).
 */
export function copyFilesToEvidence(
  caseNumber: string,
  tag: string,
  sourcePaths: string[],
  subdir: string | null = null,        // optional sub-folder e.g. 'datapilot'
  onProgress?: (done: number, total: number, current: string) => void,
): CopyResult {
  const casesDir = getCasesPath();
  const caseDir = path.join(casesDir, caseNumber);
  const evidenceBase = path.join(caseDir, 'evidence', ...(subdir ? [subdir] : []));
  if (!fs.existsSync(evidenceBase)) fs.mkdirSync(evidenceBase, { recursive: true });

  const safeTag = sanitizeTag(tag) || `evidence_${Date.now()}`;
  const target = ensureUniqueFolder(evidenceBase, safeTag, true);

  const files: EvidenceFileEntry[] = [];
  let totalSize = 0;
  const total = sourcePaths.length;

  for (let i = 0; i < total; i++) {
    const src = sourcePaths[i];
    if (!fs.existsSync(src)) continue;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      // Recursively copy directory contents into a same-named subfolder
      const subTarget = path.join(target, path.basename(src));
      copyDirRecursive(src, subTarget, (size, name) => {
        totalSize += size;
        files.push({
          name: path.basename(name),
          relPath: path.relative(casesDir, name),
          size,
          mimeType: sniffMime(name),
        });
      });
    } else {
      const name = path.basename(src);
      const dest = path.join(target, name);
      fs.copyFileSync(src, dest);
      totalSize += stat.size;
      files.push({
        name,
        relPath: path.relative(casesDir, dest),
        size: stat.size,
        mimeType: sniffMime(name),
      });
    }
    if (onProgress) onProgress(i + 1, total, src);
  }

  return {
    files,
    fileCount: files.length,
    totalSize,
    evidenceDir: target,
    evidenceDirRel: path.relative(casesDir, target),
  };
}

/**
 * Build a reference-only file listing for a folder. Does NOT copy anything.
 * Returns the same shape as `copyFilesToEvidence` so callers can treat both modes
 * uniformly. `relPath` for reference items is the ABSOLUTE path (since they live
 * outside the case folder).
 */
export function referenceFilesAsEvidence(folderPath: string): CopyResult {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Reference folder does not exist: ${folderPath}`);
  }
  const files: EvidenceFileEntry[] = [];
  let totalSize = 0;
  walkDir(folderPath, (full, stat) => {
    totalSize += stat.size;
    files.push({
      name: path.basename(full),
      relPath: full,                        // absolute (reference)
      size: stat.size,
      mimeType: sniffMime(full),
    });
  });
  return {
    files,
    fileCount: files.length,
    totalSize,
    evidenceDir: folderPath,
    evidenceDirRel: folderPath,
  };
}

/** Delete the evidence folder for an evidence row (Copy mode only). */
export function deleteEvidenceFiles(caseNumber: string, evidenceDirRel: string): { deleted: boolean; error?: string } {
  try {
    const casesDir = getCasesPath();
    const full = path.isAbsolute(evidenceDirRel) ? evidenceDirRel : path.join(casesDir, evidenceDirRel);
    // Safety: only delete if path is inside the case's evidence folder
    const caseEvidenceRoot = path.join(casesDir, caseNumber, 'evidence');
    const resolved = path.resolve(full);
    if (!resolved.startsWith(path.resolve(caseEvidenceRoot))) {
      return { deleted: false, error: 'Refusing to delete files outside the case evidence folder' };
    }
    if (fs.existsSync(resolved)) {
      // Try directory first; fall back to single file delete.
      const st = fs.statSync(resolved);
      if (st.isDirectory()) fs.rmSync(resolved, { recursive: true, force: true });
      else fs.unlinkSync(resolved);
    }
    return { deleted: true };
  } catch (e: any) {
    return { deleted: false, error: e.message };
  }
}

/** Calculate total size of a folder recursively. */
export function getFolderSize(folderPath: string): number {
  if (!fs.existsSync(folderPath)) return 0;
  let total = 0;
  walkDir(folderPath, (_full, stat) => { total += stat.size; });
  return total;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string, onFile: (size: number, destPath: string) => void): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d, onFile);
    else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      const st = fs.statSync(d);
      onFile(st.size, d);
    }
  }
}

function walkDir(dir: string, onFile: (full: string, stat: fs.Stats) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, onFile);
    else if (entry.isFile()) {
      try { onFile(full, fs.statSync(full)); } catch { /* skip unreadable */ }
    }
  }
}

// ─── Persistence helpers (used by IPC layer) ───────────────────────────────

export interface EvidenceRowPayload {
  type: string;
  tag: string | null;
  description: string;
  storage_mode: 'copy' | 'reference';
  file_path: string;            // canonical entry path (folder or single file, relative or absolute)
  file_count: number;
  total_size: number;
  files: EvidenceFileEntry[];   // serialized into files_json
  meta?: any;                   // serialized into meta_json
  category?: string;            // legacy compat
}

export function serializePayload(p: EvidenceRowPayload): {
  description: string;
  file_path: string;
  category: string;
  type: string;
  tag: string | null;
  storage_mode: string;
  file_count: number;
  total_size: number;
  files_json: string;
  meta_json: string | null;
} {
  return {
    description: p.description || '',
    file_path: p.file_path || '',
    category: p.category || 'Other',
    type: p.type || 'other',
    tag: p.tag || null,
    storage_mode: p.storage_mode || 'copy',
    file_count: p.file_count || 0,
    total_size: p.total_size || 0,
    files_json: JSON.stringify(p.files || []),
    meta_json: p.meta ? JSON.stringify(p.meta) : null,
  };
}
