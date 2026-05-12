/**
 * Snapchat Warrant Parser — TypeScript port of VIPER's snapchat-warrant-parser.js
 *
 * Snapchat law-enforcement warrant return parser.
 * Productions contain one or more "part" folders, named like:
 *   {username}-{caseId}-{requestId}-{partNum}-{date}/
 *
 * Each part may contain:
 *   conversations.csv         — message log
 *   geo_locations.csv         — lat/lon/timestamp
 *   memories.csv              — saved memory snaps
 *   device_advertising_id.csv — device IDs
 *   subscriber_info.csv       — account/registration info (single record)
 *   login_history.csv         — login events with IPs
 *   friends.csv               — friend list
 *   snap_history.csv          — snap activity
 *   {anything-else}.csv       — generic fallback
 *   chat~media_v4~...~v4.{jpeg|mp4|webp|png|jpg|gif}  — chat media
 *
 * CSVs have a multi-line preamble before the actual header row;
 * the preamble ends with a "===" separator line.
 */

import * as path from 'path';
import * as fs from 'fs';
import AdmZip = require('adm-zip');

// ─── Types ──────────────────────────────────────────────────────────────

export interface SnapHeaderInfo {
  targetUsername: string | null;
  email: string | null;
  userId: string | null;
  dateRange: string | null;
}

export interface SnapConversationRow {
  conversation_id?: string;
  message_id?: string;
  timestamp?: string;
  sender_user_id?: string;
  sender_username?: string;
  content_type?: string;
  message_type?: string;
  recipients?: string;
  media_id?: string;
  _mediaFile?: string;
  [k: string]: string | undefined;
}

export interface SnapGeoLocation {
  latitude: number | null;
  longitude: number | null;
  latitudeAccuracy: number | null;
  longitudeAccuracy: number | null;
  timestamp: string | null;
  _raw: Record<string, string>;
}

export interface SnapGenericRow {
  [k: string]: string | undefined;
}

export interface SnapMediaMeta {
  sender: string | null;
  recipient: string | null;
  timestamp: string | null;
  savedFlag: string | null;
  mediaIdToken: string | null;
}

export interface SnapMediaFile extends SnapMediaMeta {
  diskPath: string;
  partFolder: string;
  size: number;
  mimeType: string;
  // also original archive entry name for lazy re-read if needed
  originalPath?: string;
}

export interface SnapPart {
  partFolder: string;
  partNum: number | null;
  header: SnapHeaderInfo | null;
  conversations: SnapConversationRow[];
  geoLocations: SnapGeoLocation[];
  memories: SnapGenericRow[];
  deviceAdvertisingIds: SnapGenericRow[];
  subscriberInfo: SnapGenericRow | SnapGenericRow[] | null;
  loginHistory: SnapGenericRow[];
  friends: SnapGenericRow[];
  snapHistory: SnapGenericRow[];
  otherCsvs: Record<string, { headers: string[]; rows: SnapGenericRow[] }>;
}

export interface SnapStats {
  partCount: number;
  mediaCount: number;
  conversationCount: number;
  geoLocationCount: number;
  memoryCount: number;
}

export interface SnapWarrantResult {
  parts: SnapPart[];
  mergedHeader: SnapHeaderInfo | null;
  conversations: SnapConversationRow[];
  geoLocations: SnapGeoLocation[];
  memories: SnapGenericRow[];
  deviceAdvertisingIds: SnapGenericRow[];
  subscriberInfo: SnapGenericRow | SnapGenericRow[] | null;
  loginHistory: SnapGenericRow[];
  friends: SnapGenericRow[];
  snapHistory: SnapGenericRow[];
  otherCsvs: Record<string, { headers: string[]; rows: SnapGenericRow[] }>;
  mediaFiles: Record<string, SnapMediaFile>;
  stats: SnapStats;
}

export interface SnapParseOptions {
  extractDir?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const KNOWN_CSVS = new Set([
  'conversations.csv',
  'geo_locations.csv',
  'memories.csv',
  'device_advertising_id.csv',
  'subscriber_info.csv',
  'login_history.csv',
  'friends.csv',
  'snap_history.csv',
]);

const MEDIA_EXTS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.mp4', '.webp', '.webm', '.mov']);

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

// ─── Parser ─────────────────────────────────────────────────────────────

type CsvEntry = { entryName: string; _zipEntry?: AdmZip.IZipEntry; _diskPath?: string };
type MediaEntry = CsvEntry;
type Bucket = { csvEntries: CsvEntry[]; mediaEntries: MediaEntry[] };

export class SnapWarrantParser {
  // ─── Detection ────────────────────────────────────────────────────────

  static isSnapchatWarrantZip(zipBufferOrPath: Buffer | string): boolean {
    try {
      const zip = new AdmZip(zipBufferOrPath as any);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const lower = entry.entryName.toLowerCase();
        if (lower.endsWith('/conversations.csv') || lower === 'conversations.csv') {
          try {
            const head = zip.readAsText(entry).slice(0, 800);
            if (/Target username/i.test(head) || /User ID/i.test(head)) return true;
          } catch {
            /* keep looking */
          }
        }
      }
      // Fallback: filename pattern in part folders
      for (const entry of entries) {
        const segs = entry.entryName.split('/');
        if (segs.length >= 2 && /^[\w.-]+-\d+-\d+-\d+-\d+\/?$/.test(segs[0] + '/')) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static isSnapchatWarrantFolder(folderPath: string): boolean {
    try {
      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return false;

      const checkConv = (dir: string): boolean => {
        const conv = path.join(dir, 'conversations.csv');
        if (!fs.existsSync(conv)) return false;
        try {
          const head = fs.readFileSync(conv, 'utf8').slice(0, 800);
          return /Target username/i.test(head) || /User ID/i.test(head);
        } catch {
          return false;
        }
      };

      if (checkConv(folderPath)) return true;

      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && checkConv(path.join(folderPath, e.name))) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static isSnapchatWarrantFile(filePath: string): boolean {
    if (!filePath) return false;
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.zip')) {
      try {
        return SnapWarrantParser.isSnapchatWarrantZip(filePath);
      } catch {
        return false;
      }
    }
    return false;
  }

  // ─── Public Entry Points ──────────────────────────────────────────────

  async parseZip(zipBuffer: Buffer, options: SnapParseOptions = {}): Promise<SnapWarrantResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const partMap = new Map<string, Bucket>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const segs = entry.entryName.split('/');
      const partFolder = segs.length >= 2 ? segs[0] : '__root__';
      if (!partMap.has(partFolder)) partMap.set(partFolder, { csvEntries: [], mediaEntries: [] });
      const bucket = partMap.get(partFolder)!;
      const lower = entry.entryName.toLowerCase();
      const ce: CsvEntry = { entryName: entry.entryName, _zipEntry: entry };
      if (lower.endsWith('.csv')) bucket.csvEntries.push(ce);
      else {
        const ext = path.extname(lower);
        if (MEDIA_EXTS.has(ext)) bucket.mediaEntries.push(ce);
      }
    }

    return this._parsePartMap({
      partMap,
      readCsv: (e) => zip.readAsText(e._zipEntry!),
      readBinary: (e) => e._zipEntry!.getData(),
      options,
    });
  }

  async parseFolder(folderPath: string, options: SnapParseOptions = {}): Promise<SnapWarrantResult> {
    const partMap = new Map<string, Bucket>();

    const collectFromDir = (dir: string, partFolder: string) => {
      if (!partMap.has(partFolder)) partMap.set(partFolder, { csvEntries: [], mediaEntries: [] });
      const bucket = partMap.get(partFolder)!;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const full = path.join(dir, it.name);
        if (it.isFile()) {
          const lower = it.name.toLowerCase();
          if (lower.endsWith('.csv')) {
            bucket.csvEntries.push({ entryName: it.name, _diskPath: full });
          } else {
            const ext = path.extname(lower);
            if (MEDIA_EXTS.has(ext)) bucket.mediaEntries.push({ entryName: it.name, _diskPath: full });
          }
        } else if (it.isDirectory()) {
          // Nested directory — flatten media (CSVs only at top level of part)
          const subItems = fs.readdirSync(full, { withFileTypes: true });
          for (const sub of subItems) {
            if (sub.isFile()) {
              const subFull = path.join(full, sub.name);
              const ext = path.extname(sub.name.toLowerCase());
              if (MEDIA_EXTS.has(ext)) {
                bucket.mediaEntries.push({ entryName: sub.name, _diskPath: subFull });
              }
            }
          }
        }
      }
    };

    const topConv = path.join(folderPath, 'conversations.csv');
    if (fs.existsSync(topConv)) {
      collectFromDir(folderPath, path.basename(folderPath));
    } else {
      const subs = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const s of subs) {
        if (!s.isDirectory()) continue;
        const subPath = path.join(folderPath, s.name);
        const subConv = path.join(subPath, 'conversations.csv');
        if (fs.existsSync(subConv)) collectFromDir(subPath, s.name);
      }
    }

    return this._parsePartMap({
      partMap,
      readCsv: (e) => fs.readFileSync(e._diskPath!, 'utf8'),
      readBinary: (e) => fs.readFileSync(e._diskPath!),
      options,
    });
  }

  // ─── Core ─────────────────────────────────────────────────────────────

  private async _parsePartMap(ctx: {
    partMap: Map<string, Bucket>;
    readCsv: (e: CsvEntry) => string;
    readBinary: (e: MediaEntry) => Buffer;
    options: SnapParseOptions;
  }): Promise<SnapWarrantResult> {
    const { partMap, readCsv, readBinary, options } = ctx;
    const { extractDir } = options || {};

    const parts: SnapPart[] = [];
    const mediaFiles: Record<string, SnapMediaFile> = {};

    const sortedPartKeys = Array.from(partMap.keys()).sort((a, b) => {
      const na = this._extractPartNum(a);
      const nb = this._extractPartNum(b);
      if (na !== null && nb !== null) return na - nb;
      return a.localeCompare(b);
    });

    for (const partFolder of sortedPartKeys) {
      const bucket = partMap.get(partFolder)!;
      const part = this._parseOnePart(partFolder, bucket, { readCsv, readBinary, extractDir, mediaFiles });
      parts.push(part);
    }

    const merged = this._mergeParts(parts);
    const mediaIndex = this._buildMediaIndex(Object.keys(mediaFiles));

    // Link media to conversation rows
    for (const conv of merged.conversations) {
      if (conv.media_id) {
        const matched = this._findMediaFileForId(conv.media_id, mediaIndex);
        if (matched) conv._mediaFile = matched;
      }
    }

    return {
      parts,
      mergedHeader: merged.header,
      conversations: merged.conversations,
      geoLocations: merged.geoLocations,
      memories: merged.memories,
      deviceAdvertisingIds: merged.deviceAdvertisingIds,
      subscriberInfo: merged.subscriberInfo,
      loginHistory: merged.loginHistory,
      friends: merged.friends,
      snapHistory: merged.snapHistory,
      otherCsvs: merged.otherCsvs,
      mediaFiles,
      stats: {
        partCount: parts.length,
        mediaCount: Object.keys(mediaFiles).length,
        conversationCount: merged.conversations.length,
        geoLocationCount: merged.geoLocations.length,
        memoryCount: merged.memories.length,
      },
    };
  }

  private _parseOnePart(
    partFolder: string,
    bucket: Bucket,
    ctx: {
      readCsv: (e: CsvEntry) => string;
      readBinary: (e: MediaEntry) => Buffer;
      extractDir?: string;
      mediaFiles: Record<string, SnapMediaFile>;
    }
  ): SnapPart {
    const { readCsv, readBinary, extractDir, mediaFiles } = ctx;

    const part: SnapPart = {
      partFolder,
      partNum: this._extractPartNum(partFolder),
      header: null,
      conversations: [],
      geoLocations: [],
      memories: [],
      deviceAdvertisingIds: [],
      subscriberInfo: null,
      loginHistory: [],
      friends: [],
      snapHistory: [],
      otherCsvs: {},
    };

    // ─── CSVs ───
    for (const entry of bucket.csvEntries) {
      const baseName = path.basename(entry.entryName).toLowerCase();
      let text: string;
      try {
        text = readCsv(entry);
      } catch {
        continue;
      }

      const { header, headers, rows } = this._parseSnapchatCsv(text);
      if (header && !part.header) part.header = header;

      switch (baseName) {
        case 'conversations.csv':
          part.conversations = rows;
          break;
        case 'geo_locations.csv':
          part.geoLocations = rows
            .map((r) => ({
              latitude: this._parseLatLon(r.latitude),
              longitude: this._parseLatLon(r.longitude),
              latitudeAccuracy: this._parseAccuracy(r.latitude),
              longitudeAccuracy: this._parseAccuracy(r.longitude),
              timestamp: r.timestamp || null,
              _raw: r as Record<string, string>,
            }))
            .filter((g) => g.latitude !== null && g.longitude !== null);
          break;
        case 'memories.csv':
          part.memories = rows;
          break;
        case 'device_advertising_id.csv':
          part.deviceAdvertisingIds = rows;
          break;
        case 'subscriber_info.csv':
          part.subscriberInfo = rows.length === 1 ? rows[0] : rows.length > 1 ? rows : null;
          break;
        case 'login_history.csv':
          part.loginHistory = rows;
          break;
        case 'friends.csv':
          part.friends = rows;
          break;
        case 'snap_history.csv':
          part.snapHistory = rows;
          break;
        default:
          if (!KNOWN_CSVS.has(baseName)) {
            part.otherCsvs[baseName] = { headers, rows };
          }
          break;
      }
    }

    // ─── Media — always index (read bytes only if we need to know size or extract) ───
    if (bucket.mediaEntries.length > 0) {
      const doExtract = !!extractDir;
      const partExtractDir = doExtract ? path.join(extractDir!, partFolder) : '';
      if (doExtract && !fs.existsSync(partExtractDir)) fs.mkdirSync(partExtractDir, { recursive: true });

      for (const entry of bucket.mediaEntries) {
        const fileName = path.basename(entry.entryName);
        try {
          let size = 0;
          let diskPath = '';
          if (doExtract) {
            const buf = readBinary(entry);
            diskPath = path.join(partExtractDir, fileName);
            fs.writeFileSync(diskPath, buf);
            size = buf.length;
          } else if (entry._diskPath) {
            // Already on disk — record path + size, no copy
            try {
              size = fs.statSync(entry._diskPath).size;
              diskPath = entry._diskPath;
            } catch { /* ignore */ }
          } else if (entry._zipEntry) {
            // Inside a ZIP — record the header size without extracting bytes
            size = (entry._zipEntry as any).header?.size ?? 0;
          }

          const meta = this._parseMediaFilename(fileName);
          mediaFiles[fileName] = {
            diskPath,
            partFolder,
            size,
            mimeType: this._mimeFromExt(path.extname(fileName)),
            originalPath: entry.entryName,
            ...meta,
          };
        } catch {
          /* skip individual file failures */
        }
      }
    }

    return part;
  }

  private _mergeParts(parts: SnapPart[]): Omit<SnapWarrantResult, 'parts' | 'mediaFiles' | 'stats' | 'mergedHeader'> & {
    header: SnapHeaderInfo | null;
  } {
    const merged = {
      header: null as SnapHeaderInfo | null,
      conversations: [] as SnapConversationRow[],
      geoLocations: [] as SnapGeoLocation[],
      memories: [] as SnapGenericRow[],
      deviceAdvertisingIds: [] as SnapGenericRow[],
      subscriberInfo: null as SnapGenericRow | SnapGenericRow[] | null,
      loginHistory: [] as SnapGenericRow[],
      friends: [] as SnapGenericRow[],
      snapHistory: [] as SnapGenericRow[],
      otherCsvs: {} as Record<string, { headers: string[]; rows: SnapGenericRow[] }>,
    };

    for (const p of parts) {
      if (!merged.header && p.header) merged.header = p.header;
      merged.conversations.push(...p.conversations);
      merged.geoLocations.push(...p.geoLocations);
      merged.memories.push(...p.memories);
      merged.deviceAdvertisingIds.push(...p.deviceAdvertisingIds);
      if (!merged.subscriberInfo && p.subscriberInfo) merged.subscriberInfo = p.subscriberInfo;
      merged.loginHistory.push(...p.loginHistory);
      merged.friends.push(...p.friends);
      merged.snapHistory.push(...p.snapHistory);
      for (const [k, v] of Object.entries(p.otherCsvs || {})) {
        if (!merged.otherCsvs[k]) merged.otherCsvs[k] = { headers: v.headers, rows: [] };
        merged.otherCsvs[k].rows.push(...v.rows);
      }
    }

    // Dedup conversations
    const seen = new Set<string>();
    merged.conversations = merged.conversations.filter((m) => {
      const key = `${m.conversation_id || ''}::${m.message_id || ''}::${m.timestamp || ''}::${m.sender_user_id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    merged.conversations.sort((a, b) => this._parseSnapTimestamp(a.timestamp) - this._parseSnapTimestamp(b.timestamp));
    merged.geoLocations.sort(
      (a, b) => this._parseSnapTimestamp(a.timestamp || undefined) - this._parseSnapTimestamp(b.timestamp || undefined)
    );

    return merged;
  }

  // ─── Snapchat CSV with preamble ───────────────────────────────────────

  private _parseSnapchatCsv(text: string): { header: SnapHeaderInfo | null; headers: string[]; rows: SnapGenericRow[] } {
    if (!text) return { header: null, headers: [], rows: [] };

    const allRows = this._parseCsv(text);
    if (allRows.length === 0) return { header: null, headers: [], rows: [] };

    let headerIdx = -1;
    let lastSeparatorIdx = -1;
    let preambleRows: string[][] = [];

    for (let i = 0; i < allRows.length; i++) {
      const first = (allRows[i][0] || '').trim();
      if (/^=+$/.test(first)) lastSeparatorIdx = i;
    }

    if (lastSeparatorIdx >= 0) {
      for (let j = lastSeparatorIdx + 1; j < allRows.length; j++) {
        const r = allRows[j];
        if (r.length > 0 && r.some((c) => c && c.length)) {
          headerIdx = j;
          break;
        }
      }
      preambleRows = allRows.slice(0, lastSeparatorIdx);
    } else {
      // Heuristic fallback
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (row.length === 0) {
          preambleRows.push(row);
          continue;
        }
        const first = (row[0] || '').trim();
        if (/^-+$/.test(first)) {
          preambleRows.push(row);
          continue;
        }
        const knownHeaderHits = row.filter((c) =>
          /^(content_type|message_type|conversation_id|message_id|latitude|longitude|timestamp|id|media_id|encrypted|source_type|duration|device id|device_id|device_type|os|os_version|id type|advertising_id|version|ip|login_time|country|carrier|username|user_id|display_name|email|phone|created|time recorded|is hms\?)$/i.test(
            (c || '').trim()
          )
        ).length;
        if (knownHeaderHits >= 2) {
          headerIdx = i;
          break;
        }
        preambleRows.push(row);
      }
    }

    if (headerIdx === -1) {
      return { header: this._extractHeaderInfo(preambleRows), headers: [], rows: [] };
    }

    const headers = allRows[headerIdx].map((h) => (h || '').trim());
    const dataRows = allRows
      .slice(headerIdx + 1)
      .filter((r) => r.length > 0 && r.some((c) => c && c.length));

    const rows: SnapGenericRow[] = dataRows.map((r) => {
      const obj: SnapGenericRow = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i];
        if (!key) continue;
        obj[key] = r[i] !== undefined ? r[i] : '';
      }
      return obj;
    });

    return { header: this._extractHeaderInfo(preambleRows), headers, rows };
  }

  private _extractHeaderInfo(preambleRows: string[][]): SnapHeaderInfo | null {
    const info: SnapHeaderInfo = { targetUsername: null, email: null, userId: null, dateRange: null };
    for (const row of preambleRows) {
      const text = row[0] || '';
      const userMatch = text.match(/Target username\s+["']?([^"']+)["']?/i);
      if (userMatch && !info.targetUsername) info.targetUsername = userMatch[1].trim();
      const emailMatch = text.match(/email\s+["']?([^"'\s]+@[^"'\s]+)["']?/i);
      if (emailMatch && !info.email) info.email = emailMatch[1].trim();
      const uidMatch = text.match(/User ID\s+["']?([0-9a-f-]{8,})["']?/i);
      if (uidMatch && !info.userId) info.userId = uidMatch[1].trim();
      const dateMatch = text.match(/Date range searched:?\s*(.+)/i);
      if (dateMatch && !info.dateRange) info.dateRange = dateMatch[1].trim();
    }
    return info.targetUsername || info.email || info.userId || info.dateRange ? info : null;
  }

  // ─── Generic CSV ──────────────────────────────────────────────────────

  private _parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (ch === '\r') {
        if (i + 1 < len && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      field += ch;
      i++;
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  // ─── Media filename parsing & linking ─────────────────────────────────

  private _parseMediaFilename(fileName: string): SnapMediaMeta {
    const meta: SnapMediaMeta = {
      sender: null,
      recipient: null,
      timestamp: null,
      savedFlag: null,
      mediaIdToken: null,
    };
    try {
      const parts = fileName.split('~');
      // [chat, media_v4, YYYY-MM-DD-HH-MM-SSUTC, sender, recipient, saved|unsaved, b, <token>, v4.ext]
      if (parts.length >= 8) {
        meta.timestamp = parts[2] || null;
        meta.sender = parts[3] || null;
        meta.recipient = parts[4] || null;
        meta.savedFlag = parts[5] || null;
        if (parts[6] === 'b' && parts[7]) meta.mediaIdToken = parts[7];
      }
    } catch {
      /* ignore */
    }
    return meta;
  }

  private _buildMediaIndex(filenames: string[]): Map<string, string> {
    const idx = new Map<string, string>();
    for (const f of filenames) {
      const meta = this._parseMediaFilename(f);
      if (meta.mediaIdToken) {
        idx.set(meta.mediaIdToken, f);
        if (meta.mediaIdToken.length > 24) idx.set(meta.mediaIdToken.slice(-24), f);
      }
    }
    return idx;
  }

  private _findMediaFileForId(mediaId: string, mediaIndex: Map<string, string>): string | null {
    if (!mediaId || !mediaIndex || mediaIndex.size === 0) return null;
    let token = mediaId.startsWith('b~') ? mediaId.slice(2) : mediaId;
    if (mediaIndex.has(token)) return mediaIndex.get(token)!;
    if (token.length > 24) {
      const suffix = token.slice(-24);
      if (mediaIndex.has(suffix)) return mediaIndex.get(suffix)!;
    }
    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private _extractPartNum(partFolder: string): number | null {
    const m = partFolder.match(/-(\d+)-\d{8,}/);
    if (m) return parseInt(m[1], 10);
    const m2 = partFolder.match(/-(\d+)-/);
    if (m2) return parseInt(m2[1], 10);
    return null;
  }

  private _parseLatLon(cell: string | undefined): number | null {
    if (!cell) return null;
    const m = String(cell).match(/-?\d+\.?\d*/);
    if (!m) return null;
    const n = parseFloat(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  private _parseAccuracy(cell: string | undefined): number | null {
    if (!cell) return null;
    const m = String(cell).match(/±\s*(\d+\.?\d*)/);
    return m ? parseFloat(m[1]) : null;
  }

  private _parseSnapTimestamp(ts: string | undefined): number {
    if (!ts) return 0;
    const t = Date.parse(ts);
    return Number.isFinite(t) ? t : 0;
  }

  private _mimeFromExt(ext: string): string {
    return MIME_MAP[(ext || '').toLowerCase()] || 'application/octet-stream';
  }
}

export default SnapWarrantParser;
