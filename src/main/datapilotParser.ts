/**
 * Datapilot Parser (ICAC P.U.L.S.E.) — main-process module
 *
 * Detects + previews Datapilot mobile-extraction folders in two formats:
 *   - CSV  (legacy "Datapilot CSV"):  signature = Summary_CaseAndAcquisitionInformation.csv
 *   - DPX  (Datapilot 10, SQLite):    signature = dptData.db  (read-only)
 *
 * This is the SCAN/IMPORT surface used by the Evidence module. Heavy table
 * extraction (contacts/messages/media tables) is left to a follow-on viewer.
 *
 * Adapted from VIPER modules/datapilot/datapilot-parser.js. VIPER uses
 * better-sqlite3; ICAC uses sql.js so the DPX path goes through a thin
 * sql.js wrapper here.
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import initSqlJs, { SqlJsStatic, Database as SqlJsDatabase } from 'sql.js';

export type DatapilotFormat = 'csv' | 'dpx';

export interface DatapilotDeviceInfo {
  make: string;
  model: string;
  phoneNumber: string;
  carrier: string;
  serial: string;
  firmware: string;
  clockUtc: string;
  timeZone: string;
}

export interface DatapilotPreview {
  folderPath: string;
  format: DatapilotFormat;
  scannedAt: string;
  deviceInfo: DatapilotDeviceInfo | null;
  counts: {
    contacts: number;
    apps: number;
    messages: number;
    calls: number;
    files: number;
    media: number;
    photos: number;
    videos: number;
  };
  signatures: {
    summaryCsvSize?: number;
    dptDataDbSize?: number;
  };
  totalBytes: number;
  warnings: string[];
}

// ─── sql.js singleton ──────────────────────────────────────────────────

let _SQL: SqlJsStatic | null = null;
async function loadSqlJs(): Promise<SqlJsStatic> {
  if (_SQL) return _SQL;
  _SQL = await initSqlJs();
  return _SQL;
}

// ─── Detection ─────────────────────────────────────────────────────────

export function isDpxFolder(folderPath: string): boolean {
  try {
    const sig = path.join(folderPath, 'dptData.db');
    if (!fs.existsSync(sig)) return false;
    // empty schema-mirror dpData.db is tiny; real dptData.db is >32KB
    const st = fs.statSync(sig);
    return st.size > 32 * 1024;
  } catch {
    return false;
  }
}

export function isCsvFolder(folderPath: string): boolean {
  try {
    return fs.existsSync(path.join(folderPath, 'Summary_CaseAndAcquisitionInformation.csv'));
  } catch {
    return false;
  }
}

export function detectFormat(folderPath: string): DatapilotFormat | null {
  if (!folderPath) return null;
  try {
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  if (isDpxFolder(folderPath)) return 'dpx';
  if (isCsvFolder(folderPath)) return 'csv';
  return null;
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.cache',
  'HtmlPreview', 'FileSystem', 'PhotoExif', 'AppData', 'DeletedData',
  'Contacts', 'MailAttachments', 'Icons', 'DPData',
]);

/**
 * Recursively scan a directory tree for Datapilot folders.
 * Does not recurse into a hit.
 */
export function scanForDatapilotFolders(
  rootPath: string,
  maxDepth = 6,
): Array<{ folderPath: string; format: DatapilotFormat }> {
  const results: Array<{ folderPath: string; format: DatapilotFormat }> = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const fmt = detectFormat(dir);
    if (fmt) {
      results.push({ folderPath: dir, format: fmt });
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  }

  walk(rootPath, 0);
  return results;
}

// ─── CSV preview ───────────────────────────────────────────────────────

function readCsvSafe(filePath: string): string[][] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return (parsed.data as string[][]).filter(r => Array.isArray(r));
  } catch {
    return [];
  }
}

function rowsToKeyedObject(rows: string[][]): Record<string, string> {
  // Datapilot summary CSVs use two-column key/value rows after the header.
  const out: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const k = (r[0] || '').trim();
    if (!k) continue;
    out[k] = (r[1] || '').trim();
  }
  return out;
}

function countCsvRows(filePath: string): number {
  const rows = readCsvSafe(filePath);
  if (rows.length < 2) return 0;
  // header + footer (often "Total Records") — be conservative and just count data rows
  let n = rows.length - 1;
  // Strip trailing "Total" / empty rows
  for (let i = rows.length - 1; i > 0; i--) {
    const r = rows[i];
    const first = (r[0] || '').toLowerCase();
    if (!r.join('').trim() || first.startsWith('total')) {
      n--;
    } else {
      break;
    }
  }
  return Math.max(0, n);
}

function previewCsv(folderPath: string): DatapilotPreview {
  const warnings: string[] = [];

  const summary = readCsvSafe(path.join(folderPath, 'Summary_CaseAndAcquisitionInformation.csv'));
  const summaryObj = rowsToKeyedObject(summary);

  const deviceRows = readCsvSafe(path.join(folderPath, 'DeviceInfo.csv'));
  const deviceObj = rowsToKeyedObject(deviceRows);
  const deviceInfo: DatapilotDeviceInfo | null = deviceRows.length
    ? {
        make: deviceObj['Make'] || '',
        model: deviceObj['Model'] || '',
        phoneNumber: deviceObj['Phone Number'] || '',
        carrier: deviceObj['Wireless Carrier'] || '',
        serial: deviceObj['Serial Number'] || '',
        firmware: deviceObj['Firmware Version'] || '',
        clockUtc: deviceObj['Clock (UTC)'] || '',
        timeZone: deviceObj['Time Zone'] || '',
      }
    : null;

  const contacts = countCsvRows(path.join(folderPath, 'Contacts.csv'));
  const apps = countCsvRows(path.join(folderPath, 'Applications.csv'));
  const photos = ['OtherImageFiles1.csv', 'ThumbnailImageFiles1.csv'].reduce(
    (s, name) => s + countCsvRows(path.join(folderPath, name)),
    0,
  );
  const videos = countCsvRows(path.join(folderPath, 'VideoFiles1.csv'));
  const audio = countCsvRows(path.join(folderPath, 'AudioFiles1.csv'));
  const otherFiles = ['Files1.csv', 'DatabaseFiles1.csv', 'TextFiles1.csv', 'CompressedFiles1.csv'].reduce(
    (s, name) => s + countCsvRows(path.join(folderPath, name)),
    0,
  );

  // Messages CSV under AppData (may or may not exist)
  let messages = 0;
  try {
    const appDataDir = path.join(folderPath, 'AppData');
    if (fs.existsSync(appDataDir)) {
      const entries = fs.readdirSync(appDataDir);
      const msgFile = entries.find(n => /_Correspondence\.csv$/i.test(n));
      if (msgFile) messages = countCsvRows(path.join(appDataDir, msgFile));
    }
  } catch {
    /* ignore */
  }

  // Calls — DeletedData/calllog_db.csv
  let calls = 0;
  try {
    const callFile = path.join(folderPath, 'DeletedData', 'calllog_db.csv');
    if (fs.existsSync(callFile)) calls = countCsvRows(callFile);
  } catch {
    /* ignore */
  }

  if (!summaryObj || Object.keys(summaryObj).length === 0) {
    warnings.push('Summary_CaseAndAcquisitionInformation.csv was unreadable or empty.');
  }

  return {
    folderPath,
    format: 'csv',
    scannedAt: new Date().toISOString(),
    deviceInfo,
    counts: {
      contacts,
      apps,
      messages,
      calls,
      files: otherFiles + audio,
      media: photos + videos,
      photos,
      videos,
    },
    signatures: {
      summaryCsvSize: safeSize(path.join(folderPath, 'Summary_CaseAndAcquisitionInformation.csv')),
    },
    totalBytes: getFolderSize(folderPath),
    warnings,
  };
}

// ─── DPX preview ───────────────────────────────────────────────────────

interface SqlJsResult {
  columns: string[];
  values: any[][];
}

function execAll(db: SqlJsDatabase, sql: string): Record<string, any>[] {
  try {
    const res: SqlJsResult[] = db.exec(sql) as any;
    if (!res || !res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((c, i) => {
        obj[c] = row[i];
      });
      return obj;
    });
  } catch {
    return [];
  }
}

function execOne(db: SqlJsDatabase, sql: string): Record<string, any> | null {
  const rows = execAll(db, sql);
  return rows[0] || null;
}

function safeJson<T = unknown>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function findCaseInfoDb(folderPath: string): string | null {
  // Search up to 3 parents for dpCaseInfo.db
  let cur = folderPath;
  for (let i = 0; i < 3; i++) {
    cur = path.dirname(cur);
    if (!cur || cur === path.dirname(cur)) break;
    const candidate = path.join(cur, 'dpCaseInfo.db');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function previewDpx(folderPath: string): Promise<DatapilotPreview> {
  const warnings: string[] = [];
  const dbPath = path.join(folderPath, 'dptData.db');

  const SQL = await loadSqlJs();
  let db: SqlJsDatabase | null = null;
  let deviceInfo: DatapilotDeviceInfo | null = null;
  const counts = {
    contacts: 0,
    apps: 0,
    messages: 0,
    calls: 0,
    files: 0,
    media: 0,
    photos: 0,
    videos: 0,
  };

  try {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(buf));

    // Device info
    const devRow = execOne(db, `SELECT DeviceInfo, ExternalDeviceInfo FROM DeviceInfoSummary LIMIT 1`);
    let devObj: any = devRow ? safeJson<any>(devRow.DeviceInfo, null) : null;
    if (Array.isArray(devObj)) devObj = devObj[0] || {};
    if (devObj && typeof devObj === 'object') {
      const get = (...keys: string[]): string => {
        for (const k of keys) {
          const v = devObj[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
        }
        return '';
      };
      deviceInfo = {
        make: get('Make', 'Manufacturer', 'Vendor', 'Brand'),
        model: get('Model', 'DeviceModel', 'ModelName', 'Product'),
        phoneNumber: get('PhoneNumber', 'Phone Number', 'MSISDN'),
        carrier: get('Carrier', 'WirelessCarrier', 'Wireless Carrier', 'Operator'),
        serial: get('Serial', 'SerialNumber', 'Serial Number', 'IMEI'),
        firmware: get('Firmware', 'FirmwareVersion', 'Firmware Version', 'OS', 'OSVersion', 'AndroidVersion'),
        clockUtc: get('ClockUtc', 'Clock', 'Clock (UTC)', 'CurrentTime'),
        timeZone: get('TimeZone', 'Time Zone'),
      };
    }

    // Fallback device info from dpCaseInfo.db
    if (!deviceInfo || (!deviceInfo.make && !deviceInfo.model)) {
      const caseDbPath = findCaseInfoDb(folderPath);
      if (caseDbPath) {
        try {
          const cbuf = fs.readFileSync(caseDbPath);
          const cdb = new SQL.Database(new Uint8Array(cbuf));
          const r = execOne(cdb, `SELECT * FROM DeviceInfo LIMIT 1`);
          if (r) {
            deviceInfo = deviceInfo || {
              make: '', model: '', phoneNumber: '', carrier: '',
              serial: '', firmware: '', clockUtc: '', timeZone: '',
            };
            deviceInfo.make ||= String(r.Make || r.Vendor || '');
            deviceInfo.model ||= String(r.Model || '');
            deviceInfo.phoneNumber ||= String(r.PhoneNumber || '');
            deviceInfo.serial ||= String(r.Serial || r.IMEI || '');
          }
          try { cdb.close(); } catch { /* ignore */ }
        } catch {
          warnings.push('Could not read sibling dpCaseInfo.db');
        }
      }
    }

    // Counts — best-effort, each table may or may not exist
    counts.contacts = countTable(db, 'Contacts');
    counts.apps = countTable(db, 'Applications');
    counts.messages = countTable(db, 'Messages');
    counts.calls = countTable(db, 'Calls');

    // Files table has FileType column — split by Image/Video/Audio vs others
    const fileBreakdown = execAll(
      db,
      `SELECT FileType AS ft, COUNT(*) AS n FROM Files GROUP BY FileType`,
    );
    for (const row of fileBreakdown) {
      const ft = String(row.ft || '').toLowerCase();
      const n = Number(row.n) || 0;
      if (ft === 'image' || ft === 'photo') counts.photos += n;
      else if (ft === 'video') counts.videos += n;
      else if (ft === 'audio') counts.files += n;
      else counts.files += n;
    }
    counts.media = counts.photos + counts.videos;
  } catch (e: any) {
    warnings.push(`Failed to open dptData.db: ${e?.message || e}`);
  } finally {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
    }
  }

  return {
    folderPath,
    format: 'dpx',
    scannedAt: new Date().toISOString(),
    deviceInfo,
    counts,
    signatures: {
      dptDataDbSize: safeSize(dbPath),
    },
    totalBytes: getFolderSize(folderPath),
    warnings,
  };
}

function countTable(db: SqlJsDatabase, tableName: string): number {
  try {
    const r = execOne(db, `SELECT COUNT(*) AS n FROM "${tableName}"`);
    return r ? Number(r.n) || 0 : 0;
  } catch {
    return 0;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function safeSize(p: string): number | undefined {
  try {
    return fs.statSync(p).size;
  } catch {
    return undefined;
  }
}

function getFolderSize(dir: string, maxFiles = 50_000): number {
  let total = 0;
  let count = 0;
  function walk(d: string) {
    if (count > maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        count++;
        try {
          total += fs.statSync(full).size;
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(dir);
  return total;
}

// ─── Public entry ──────────────────────────────────────────────────────

/**
 * Scan a folder and return a preview (format + device info + counts).
 * Throws if the folder is not a recognised Datapilot extraction.
 */
export async function scanFolder(folderPath: string): Promise<DatapilotPreview> {
  const fmt = detectFormat(folderPath);
  if (!fmt) {
    throw new Error(
      'Not a Datapilot folder (no Summary_CaseAndAcquisitionInformation.csv or dptData.db found)',
    );
  }
  if (fmt === 'dpx') return previewDpx(folderPath);
  return previewCsv(folderPath);
}
