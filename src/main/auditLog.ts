/**
 * Audit Log — Tamper-evident hash-chained record of security/license/case/
 * evidence/warrant/update events.
 *
 * Each entry stores:
 *   - seq        monotonic sequence number
 *   - event_type string identifier (e.g. "app_launch", "case_created")
 *   - event_data JSON-stringified key/value payload
 *   - prev_hash  SHA-256 of the prior entry (NULL for entry #1)
 *   - hash       SHA-256(prev_hash + seq + event_type + event_data + timestamp)
 *   - timestamp  UTC ISO
 *   - user, host, app_version
 *
 * Modifying or deleting any entry invalidates every subsequent hash.
 * `verifyChain()` walks the table and reports the first break.
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import { getDatabase, saveDatabase, getUserDataPath } from './database';

export type AuditEventType =
  | 'app_launch'
  | 'app_exit'
  | 'case_created'
  | 'case_opened'
  | 'case_deleted'
  | 'evidence_created'
  | 'warrant_created'
  | 'registration'
  | 'license_activated'
  | 'unlock'
  | 'lock'
  | 'update_check'
  | 'update_downloaded'
  | 'update_installed'
  | 'audit_export'
  | 'audit_verify'
  | string;

export interface AuditEntry {
  id: number;
  seq: number;
  event_type: string;
  event_data: Record<string, any> | null;
  prev_hash: string | null;
  hash: string;
  timestamp: string;
  user: string | null;
  host: string | null;
  app_version: string | null;
}

interface RawRow {
  id: number;
  seq: number;
  event_type: string;
  event_data: string | null;
  prev_hash: string | null;
  hash: string;
  timestamp: string;
  user: string | null;
  host: string | null;
  app_version: string | null;
}

function hashEntry(
  prevHash: string | null,
  seq: number,
  eventType: string,
  eventDataJson: string,
  timestamp: string,
): string {
  const h = crypto.createHash('sha256');
  h.update(prevHash || '');
  h.update('|');
  h.update(String(seq));
  h.update('|');
  h.update(eventType);
  h.update('|');
  h.update(eventDataJson);
  h.update('|');
  h.update(timestamp);
  return h.digest('hex');
}

function getCurrentUser(): string {
  try {
    return os.userInfo().username || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getHost(): string {
  try {
    return os.hostname() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getAppVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return 'unknown';
  }
}

// ============ Windows Event Log forwarding ============

const EVENT_SOURCE = 'ICAC PULSE';
const SETTINGS_FILE = 'audit-settings.json';

interface AuditSettings {
  windowsEventLogEnabled: boolean;
  windowsEventLogSourceRegistered: boolean;
}

function getSettingsPath(): string {
  return path.join(getUserDataPath(), SETTINGS_FILE);
}

function readSettings(): AuditSettings {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        windowsEventLogEnabled: Boolean(parsed.windowsEventLogEnabled),
        windowsEventLogSourceRegistered: Boolean(parsed.windowsEventLogSourceRegistered),
      };
    }
  } catch (err) {
    console.error('[auditLog] readSettings failed:', err);
  }
  return { windowsEventLogEnabled: false, windowsEventLogSourceRegistered: false };
}

function writeSettings(s: AuditSettings): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), 'utf8');
  } catch (err) {
    console.error('[auditLog] writeSettings failed:', err);
  }
}

let cachedSettings: AuditSettings | null = null;
function settings(): AuditSettings {
  if (!cachedSettings) cachedSettings = readSettings();
  return cachedSettings;
}

export function isWindowsEventLogEnabled(): boolean {
  if (process.platform !== 'win32') return false;
  return settings().windowsEventLogEnabled;
}

export function getWindowsEventLogState(): {
  supported: boolean;
  enabled: boolean;
  sourceRegistered: boolean;
  source: string;
} {
  return {
    supported: process.platform === 'win32',
    enabled: settings().windowsEventLogEnabled,
    sourceRegistered: settings().windowsEventLogSourceRegistered,
    source: EVENT_SOURCE,
  };
}

/**
 * Toggle Windows Event Log forwarding. When enabling for the first time we
 * also attempt a "source-registration" write — this is a no-op informational
 * event that causes eventcreate.exe to register the source name. The first
 * registration requires admin on locked-down systems; we surface that error
 * back to the caller so the UI can prompt to run as administrator once.
 */
export async function setWindowsEventLogEnabled(enabled: boolean): Promise<{ success: boolean; error?: string; needsAdmin?: boolean }> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows Event Log forwarding is only available on Windows.' };
  }
  const s = settings();

  if (enabled && !s.windowsEventLogSourceRegistered) {
    // Try one bootstrap write to register the source
    const res = await writeWindowsEvent('app_launch', { bootstrap: true, source: EVENT_SOURCE }, 1);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to register Windows event source.',
        needsAdmin: res.needsAdmin,
      };
    }
    s.windowsEventLogSourceRegistered = true;
  }

  s.windowsEventLogEnabled = enabled;
  cachedSettings = s;
  writeSettings(s);
  return { success: true };
}

/**
 * Write a single event to the Windows Application log under our source.
 * Uses eventcreate.exe — available on every supported Windows SKU.
 * Returns success=false (with needsAdmin if applicable) instead of throwing
 * so the caller never gets a hard failure.
 */
function writeWindowsEvent(
  eventType: string,
  data: Record<string, any>,
  eventId: number = 100,
): Promise<{ success: boolean; error?: string; needsAdmin?: boolean }> {
  return new Promise(resolve => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'Not Windows' });
      return;
    }
    try {
      // eventcreate /ID range is 1-1000
      const id = Math.max(1, Math.min(1000, eventId));
      // Compose human-readable description (eventcreate truncates ~512 chars)
      const dataStr = Object.entries(data || {})
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' ');
      const message = `[${eventType}] ${dataStr}`.slice(0, 480);

      const args = [
        '/T', 'INFORMATION',
        '/SO', EVENT_SOURCE,
        '/ID', String(id),
        '/L', 'APPLICATION',
        '/D', message,
      ];

      const proc = spawn('eventcreate.exe', args, { windowsHide: true });
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
      proc.on('exit', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          const text = stderr.trim() || `eventcreate exited with code ${code}`;
          const needsAdmin = /access is denied|elevation|administrat/i.test(text);
          resolve({ success: false, error: text, needsAdmin });
        }
      });
    } catch (err: any) {
      resolve({ success: false, error: err?.message ?? 'spawn failed' });
    }
  });
}

/**
 * Append a new event to the audit log.
 * Safe to call from any main-process code. Failures are swallowed so that
 * audit logging never blocks the originating operation.
 */
export function logEvent(eventType: AuditEventType, data: Record<string, any> = {}): void {
  try {
    const db = getDatabase();

    // Get last entry to chain hash
    const lastRow = db.prepare('SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1').get() as
      | { seq: number; hash: string }
      | undefined;
    const prevSeq = lastRow?.seq ?? 0;
    const prevHash = lastRow?.hash ?? null;
    const seq = prevSeq + 1;

    const timestamp = new Date().toISOString();
    const eventDataJson = JSON.stringify(data ?? {});
    const hash = hashEntry(prevHash, seq, eventType, eventDataJson, timestamp);
    const user = getCurrentUser();
    const host = getHost();
    const version = getAppVersion();

    db.prepare(
      `INSERT INTO audit_log (seq, event_type, event_data, prev_hash, hash, timestamp, user, host, app_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(seq, eventType, eventDataJson, prevHash, hash, timestamp, user, host, version);

    saveDatabase();

    // Optional: mirror to Windows Application event log
    if (isWindowsEventLogEnabled()) {
      // Fire-and-forget; failures are logged but never block.
      void writeWindowsEvent(eventType, { ...data, seq, user, host, app_version: version })
        .then((r) => {
          if (!r.success) {
            try { console.warn('[auditLog] Windows Event Log write failed:', r.error); } catch {}
          }
        });
    }
  } catch (err) {
    // Never let audit logging crash the caller
    try { console.error('[auditLog] logEvent failed:', err); } catch {}
  }
}

function parseRow(row: RawRow): AuditEntry {
  let parsedData: Record<string, any> | null = null;
  if (row.event_data) {
    try { parsedData = JSON.parse(row.event_data); } catch { parsedData = { raw: row.event_data }; }
  }
  return {
    id: row.id,
    seq: row.seq,
    event_type: row.event_type,
    event_data: parsedData,
    prev_hash: row.prev_hash,
    hash: row.hash,
    timestamp: row.timestamp,
    user: row.user,
    host: row.host,
    app_version: row.app_version,
  };
}

/**
 * Get recent entries (most recent first). Pass limit=0 for all.
 */
export function getEntries(limit: number = 100): AuditEntry[] {
  try {
    const db = getDatabase();
    const sql = limit > 0
      ? 'SELECT * FROM audit_log ORDER BY seq DESC LIMIT ?'
      : 'SELECT * FROM audit_log ORDER BY seq DESC';
    const rows = limit > 0
      ? (db.prepare(sql).all(limit) as RawRow[])
      : (db.prepare(sql).all() as RawRow[]);
    return rows.map(parseRow);
  } catch (err) {
    console.error('[auditLog] getEntries failed:', err);
    return [];
  }
}

export function getCount(): number {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) AS n FROM audit_log').get() as { n: number } | undefined;
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Walk the entire chain and recompute each hash. Returns the first break
 * (if any) along with the count of valid entries.
 */
export function verifyChain(): { valid: boolean; totalEntries: number; firstBreakSeq?: number; reason?: string } {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all() as RawRow[];

    let expectedPrevHash: string | null = null;
    let expectedSeq = 1;

    for (const row of rows) {
      if (row.seq !== expectedSeq) {
        return {
          valid: false,
          totalEntries: rows.length,
          firstBreakSeq: row.seq,
          reason: `Sequence break: expected ${expectedSeq}, got ${row.seq}`,
        };
      }
      if ((row.prev_hash || null) !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: rows.length,
          firstBreakSeq: row.seq,
          reason: `prev_hash mismatch at seq ${row.seq}`,
        };
      }
      const recomputed = hashEntry(
        row.prev_hash,
        row.seq,
        row.event_type,
        row.event_data || '{}',
        row.timestamp,
      );
      if (recomputed !== row.hash) {
        return {
          valid: false,
          totalEntries: rows.length,
          firstBreakSeq: row.seq,
          reason: `Hash mismatch at seq ${row.seq} — entry was modified`,
        };
      }
      expectedPrevHash = row.hash;
      expectedSeq += 1;
    }

    return { valid: true, totalEntries: rows.length };
  } catch (err: any) {
    return { valid: false, totalEntries: 0, reason: err?.message ?? 'unknown error' };
  }
}

/**
 * Export the full chain as JSONL (one JSON object per line).
 * Returns absolute path of the written file.
 */
export function exportJsonl(): { success: boolean; filePath?: string; error?: string } {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all() as RawRow[];
    const entries = rows.map(parseRow);

    const exportDir = path.join(getUserDataPath(), 'audit-exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(exportDir, `audit-log-${ts}.jsonl`);

    const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(filePath, lines, 'utf8');

    // Audit the export itself
    logEvent('audit_export', { file: filePath, entry_count: entries.length });

    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'export failed' };
  }
}
