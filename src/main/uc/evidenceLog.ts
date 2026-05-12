/**
 * Evidence Log — Append-only chain-of-custody record.
 *
 * Every evidence file write (UC capture, resource capture, manual upload)
 * should call recordEvidenceLog() with a SHA-256 of the file content.
 * The log is queryable for court-defensible audit + integrity checks.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from '../database';

export type EvidenceLogAction = 'create' | 'export' | 'hash' | 'verify' | 'route';

export interface RecordEvidenceLogOpts {
  evidenceId?: number | null;
  caseId?: number | null;
  chatId?: number | null;
  action: EvidenceLogAction;
  filePath: string;          // file to hash + log
  operatorUserId?: number | null;
  meta?: Record<string, any>;
}

export interface EvidenceLogRow {
  id: number;
  evidence_id: number | null;
  case_id: number | null;
  chat_id: number | null;
  action: EvidenceLogAction;
  sha256: string | null;
  file_path: string | null;
  size_bytes: number | null;
  operator_user_id: number | null;
  ts: string;
  meta_json: string | null;
}

/** Compute SHA-256 of a file on disk. Streams to handle large files. */
export function sha256File(filePath: string): Promise<{ sha256: string; size: number }> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`sha256File: file not found: ${filePath}`));
      return;
    }
    const stat = fs.statSync(filePath);
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve({ sha256: hash.digest('hex'), size: stat.size }));
    stream.on('error', reject);
  });
}

/**
 * Hash the file and insert a row into evidence_log.
 * Returns the inserted row id and the computed hash.
 */
export async function recordEvidenceLog(opts: RecordEvidenceLogOpts): Promise<{ id: number; sha256: string; size: number }> {
  const db = getDatabase();
  const { sha256, size } = await sha256File(opts.filePath);
  db.prepare(
    `INSERT INTO evidence_log
       (evidence_id, case_id, chat_id, action, sha256, file_path, size_bytes, operator_user_id, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.evidenceId ?? null,
    opts.caseId ?? null,
    opts.chatId ?? null,
    opts.action,
    sha256,
    opts.filePath,
    size,
    opts.operatorUserId ?? null,
    opts.meta ? JSON.stringify(opts.meta) : null,
  );
  saveDatabase();
  // sql.js lastInsertRowid returns 0 — query MAX(id) instead.
  const row = db.prepare('SELECT id FROM evidence_log ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  return { id: row?.id ?? 0, sha256, size };
}

/** Verify a file still matches its recorded hash. */
export async function verifyEvidenceLogEntry(rowId: number): Promise<{ match: boolean; expected: string | null; actual: string | null }> {
  const db = getDatabase();
  const row = db.prepare('SELECT file_path, sha256 FROM evidence_log WHERE id = ?').get(rowId) as { file_path: string | null; sha256: string | null } | undefined;
  if (!row || !row.file_path || !row.sha256) {
    return { match: false, expected: row?.sha256 || null, actual: null };
  }
  try {
    const { sha256 } = await sha256File(row.file_path);
    return { match: sha256 === row.sha256, expected: row.sha256, actual: sha256 };
  } catch {
    return { match: false, expected: row.sha256, actual: null };
  }
}

/** List evidence_log rows filtered by case/chat. */
export function listEvidenceLog(filter: { caseId?: number; chatId?: number; limit?: number } = {}): EvidenceLogRow[] {
  const db = getDatabase();
  const where: string[] = [];
  const params: any[] = [];
  if (filter.caseId != null) { where.push('case_id = ?'); params.push(filter.caseId); }
  if (filter.chatId != null) { where.push('chat_id = ?'); params.push(filter.chatId); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const limit = filter.limit ?? 500;
  const rows = db.prepare(`SELECT * FROM evidence_log${whereSql} ORDER BY ts DESC LIMIT ?`).all(...params, limit) as EvidenceLogRow[];
  return rows || [];
}
