/**
 * Google Warrant Parser (TypeScript port from Project VIPER)
 * ----------------------------------------------------------
 * Parses Google warrant return ZIP-of-ZIPs archives. Each inner ZIP is named
 *   <email>.<accountId>.<Service>.<Resource>_<seq>.zip
 * and contains an ExportSummary.txt plus payload files (HTML, JSON, CSV, MBOX,
 * binary attachments). The outer ZIP may also contain a cover-letter PDF and
 * loose MBOX files that were too large to be inner-zipped.
 *
 * Runs in Electron main process (Node.js) — uses adm-zip, node-html-parser,
 * and mailparser (newly added dependency).
 *
 * IDENTICAL data shape to VIPER's google-warrant-parser.js so the downstream
 * UI / flag / export pipeline can be ported 1:1.
 */

import AdmZip from 'adm-zip';
import { parse as parseHTML, HTMLElement } from 'node-html-parser';
import { simpleParser } from 'mailparser';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────

export interface GoogleDateRange {
  start: string | null;
  end: string | null;
}

export interface GoogleSubscriberInfo {
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  alternateEmails: string | null;
  accountId: string | null;
  createdOn: string | null;
  tosIp: string | null;
  tosLanguage: string | null;
  birthday: string | null;
  services: string | null;
  status: string | null;
  lastUpdated: string | null;
  lastLogins: string[];
  deletionDate: string | null;
  recovery: {
    contactEmail: string | null;
    recoveryEmail: string | null;
    recoverySms: string | null;
  };
  phoneNumbers: { user: string | null; twoStep: string | null };
  devices: any;
  ipActivity: GoogleIpActivity[];
}

export interface GoogleIpActivity {
  timestamp: string;
  ip: string;
  activityType: string;
  androidId: string;
  appleIdfv: string;
  userAgent: string;
}

export interface GoogleChangeRecord {
  timestamp: string;
  ip: string;
  changeType: string;
  oldValue: string;
  newValue: string;
}

export interface GoogleEmail {
  id: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  labels: string;
  threadId: string;
  textBody: string;
  htmlBody: string;
  attachments: { filename?: string; contentType?: string; size?: number }[];
}

export interface GoogleEmailMetadata {
  messageId: string | null;
  threadId: string | null;
  creationTime: string | null;
  lastModified: string | null;
  readTime: string | null;
}

export interface GoogleLocationRecord {
  timestamp: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  source: string | null;
  deviceTag: any;
  activity: any;
}

export interface GoogleSemanticLocation {
  type: 'placeVisit' | 'activitySegment';
  name?: string | null;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  confidence?: any;
  activityType?: string | null;
  distance?: number | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}

export interface GoogleDevice {
  androidId: string | null;
  registrationTime: string | null;
  lastActive: string | null;
  manufacturer: string | null;
  model: string | null;
  deviceName: string | null;
  brand: string | null;
  carrier: string | null;
  country: string | null;
  locale: string | null;
  sdkVersion: string | null;
  buildFingerprint: string | null;
  totalMemory: string | null;
  platform: string | null;
}

export interface GoogleInstall {
  packageName: string | null;
  title: string | null;
  installTime: string | null;
  lastUpdate: string | null;
  state: string | null;
  installSource: string | null;
  isSystemApp: boolean;
  deviceModel: string | null;
  deviceManufacturer: string | null;
}

export interface GoogleLibraryEntry {
  packageName: string | null;
  title: string | null;
  type: string | null;
  url: string | null;
  acquisitionTime: string | null;
  hidden: boolean;
}

export interface GoogleUserActivity {
  action: string;
  timestamp: string;
  link: string | null;
}

export interface GoogleAccessLog {
  timestamp: string;
  activity: string;
  ip: string;
  details: string;
}

export interface GoogleDriveFile {
  // JSON / CSV-derived rows are spread in; binary files use the _isFile shape.
  _isFile?: boolean;
  name?: string;
  path?: string;
  mimeType?: string;
  size?: number;
  data?: string; // base64
  [k: string]: any;
}

export interface GoogleWarrantResult {
  accountEmail: string | null;
  accountId: string | null;
  dateRange: GoogleDateRange;
  coverLetter: { name: string; size: number } | null;
  categories: string[];
  subscriber: GoogleSubscriberInfo | null;
  changeHistory: GoogleChangeRecord[];
  emails: GoogleEmail[];
  emailMetadata: GoogleEmailMetadata[];
  locationRecords: GoogleLocationRecord[];
  semanticLocations: GoogleSemanticLocation[];
  devices: GoogleDevice[];
  installs: GoogleInstall[];
  library: GoogleLibraryEntry[];
  userActivity: GoogleUserActivity[];
  chatMessages: any[];
  chatUserInfo: string | null;
  chatGroupInfo: any[];
  hangoutsInfo: Record<string, string> | null;
  googlePay: {
    instruments: any[];
    transactions: any[];
    addresses: any[];
  };
  driveFiles: GoogleDriveFile[];
  accessLogActivity: GoogleAccessLog[];
  ipActivity: GoogleIpActivity[];
  playStorePreferences: any[];
  noRecordCategories: string[];
}

export interface GoogleMediaFile {
  data: string;       // base64
  size: number;
  mimeType: string;
  originalPath: string;
}

export interface GoogleParseResult {
  records: GoogleWarrantResult[]; // single account → single record (kept as array for symmetry w/ Meta)
  mediaFiles: Record<string, GoogleMediaFile>;
}

// ─── Parser ─────────────────────────────────────────────────────────────

export class GoogleWarrantParser {

  // ─── Detection ────────────────────────────────────────────────────────

  /** Quick heuristic: does this ZIP look like a Google warrant return? */
  static isGoogleWarrantZip(zipBuffer: Buffer): boolean {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const name = entry.entryName;
        if (name.includes('ExportSummary.txt')) return true;
        if (/\.\d+\.(GoogleAccount|GooglePlayStore|Mail|LocationHistory|GoogleChat|Hangouts|GooglePay|Drive)\./i.test(name)) {
          return true;
        }
      }
    } catch { /* not a valid zip */ }
    return false;
  }

  /** Path-based detection — reads the file from disk. */
  static isGoogleWarrantFile(filePath: string): boolean {
    try {
      const fs = require('fs') as typeof import('fs');
      if (!fs.existsSync(filePath)) return false;
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.zip') return false;
      const buf = fs.readFileSync(filePath);
      return this.isGoogleWarrantZip(buf);
    } catch {
      return false;
    }
  }

  // ─── Main Parse ───────────────────────────────────────────────────────

  /**
   * Parse the outer Google warrant ZIP file.
   * Returns a single-record GoogleParseResult (Google productions cover one
   * account per warrant; we keep records[] for symmetry with MetaParseResult).
   */
  async parseZip(zipBuffer: Buffer): Promise<GoogleParseResult> {
    const result: GoogleWarrantResult = {
      accountEmail: null,
      accountId: null,
      dateRange: { start: null, end: null },
      coverLetter: null,
      categories: [],
      subscriber: null,
      changeHistory: [],
      emails: [],
      emailMetadata: [],
      locationRecords: [],
      semanticLocations: [],
      devices: [],
      installs: [],
      library: [],
      userActivity: [],
      chatMessages: [],
      chatUserInfo: null,
      chatGroupInfo: [],
      hangoutsInfo: null,
      googlePay: { instruments: [], transactions: [], addresses: [] },
      driveFiles: [],
      accessLogActivity: [],
      ipActivity: [],
      playStorePreferences: [],
      noRecordCategories: [],
    };
    const mediaFiles: Record<string, GoogleMediaFile> = {};

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Categorize outer-zip entries
    const innerZips: AdmZip.IZipEntry[] = [];
    const looseOther: AdmZip.IZipEntry[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;
      const lower = name.toLowerCase();
      if (lower.endsWith('.zip')) {
        innerZips.push(entry);
      } else if (lower.endsWith('.pdf')) {
        result.coverLetter = { name: path.basename(name), size: entry.header.size };
      } else if (lower.endsWith('.mbox')) {
        looseOther.push(entry);
      }
    }

    // Process inner ZIPs
    for (const zipEntry of innerZips) {
      const fileName = path.basename(zipEntry.entryName);

      // Skip the master bundle (numeric-date-seq pattern)
      if (/^\d+-\d{8}-\d+\.zip$/i.test(fileName)) continue;

      // Parse service.resource from filename: <email>.<accountId>.<Service>.<Resource>_<seq>.zip
      const svcMatch = fileName.match(/\.(\w+)\.(\w+)_\d+\.zip$/i);
      if (!svcMatch) continue;
      const service = svcMatch[1];
      const resource = svcMatch[2];
      const category = `${service}.${resource}`;

      // Capture email + account id once
      if (!result.accountEmail) {
        const idMatch = fileName.match(/^(.+?)\.(\d+)\./);
        if (idMatch) {
          result.accountEmail = idMatch[1];
          result.accountId = idMatch[2];
        }
      }

      try {
        const innerBuf = zipEntry.getData();
        const innerZip = new AdmZip(innerBuf);
        const innerEntries = innerZip.getEntries();

        const hasNoRecords = innerEntries.some(e => e.entryName.toLowerCase().includes('norecords'));
        if (hasNoRecords) {
          result.noRecordCategories.push(category);
          const summary = innerEntries.find(e => e.entryName.includes('ExportSummary'));
          if (summary) {
            const meta = this.parseExportSummary(summary.getData().toString('utf-8'));
            if (meta.dateRange.start || meta.dateRange.end) {
              if (meta.dateRange.start) result.dateRange.start = meta.dateRange.start;
              if (meta.dateRange.end) result.dateRange.end = meta.dateRange.end;
            }
          }
          continue;
        }

        result.categories.push(category);

        const summary = innerEntries.find(e => e.entryName.includes('ExportSummary'));
        if (summary) {
          const meta = this.parseExportSummary(summary.getData().toString('utf-8'));
          if (meta.dateRange.end) result.dateRange.end = meta.dateRange.end;
          if (meta.dateRange.start && !result.dateRange.start) result.dateRange.start = meta.dateRange.start;
        }

        await this._parseCategory(service, resource, innerEntries, result, mediaFiles);
      } catch (err: any) {
        console.error(`[GoogleWarrantParser] error parsing ${category}:`, err?.message || err);
      }
    }

    // Loose MBOX files (extracted from inner zips that were too large)
    for (const entry of looseOther) {
      if (entry.entryName.toLowerCase().endsWith('.mbox')) {
        try {
          const emails = await this.parseMbox(entry.getData());
          result.emails.push(...emails);
        } catch (err: any) {
          console.error('[GoogleWarrantParser] error parsing loose mbox:', err?.message || err);
        }
      }
    }

    return { records: [result], mediaFiles };
  }

  // ─── Category Dispatcher ───────────────────────────────────────────────

  private async _parseCategory(
    service: string,
    resource: string,
    innerEntries: AdmZip.IZipEntry[],
    result: GoogleWarrantResult,
    mediaFiles: Record<string, GoogleMediaFile>,
  ): Promise<void> {
    const key = `${service}.${resource}`;

    switch (key) {
      case 'GoogleAccount.SubscriberInfo':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.html')) {
            const parsed = this.parseSubscriberInfo(e.getData().toString('utf-8'));
            result.subscriber = parsed;
            result.ipActivity = parsed.ipActivity || [];
          }
        }
        break;

      case 'GoogleAccount.ChangeHistory':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.html')) {
            result.changeHistory = this.parseChangeHistory(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'Mail.MessageContent':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.mbox')) {
            const emails = await this.parseMbox(e.getData());
            result.emails.push(...emails);
          }
        }
        break;

      case 'Mail.MessageInformation':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.json')) {
            try {
              const meta = this.parseMailMetadata(e.getData().toString('utf-8'));
              result.emailMetadata.push(meta);
            } catch { /* skip bad JSON */ }
          }
        }
        break;

      case 'LocationHistory.Records':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.json') && !e.entryName.includes('ExportSummary')) {
            const locs = this.parseLocationRecords(e.getData().toString('utf-8'));
            result.locationRecords.push(...locs);
          }
        }
        break;

      case 'LocationHistory.SemanticLocationHistory':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.json') && !e.entryName.includes('ExportSummary')) {
            const sem = this.parseSemanticLocation(e.getData().toString('utf-8'));
            result.semanticLocations.push(...sem);
          }
        }
        break;

      case 'GooglePlayStore.Devices':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.csv')) {
            result.devices = this.parseDevicesCsv(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'GooglePlayStore.Installs':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.csv')) {
            result.installs = this.parseInstallsCsv(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'GooglePlayStore.Library':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.csv')) {
            result.library = this.parseLibraryCsv(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'GooglePlayStore.UserActivity':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.html')) {
            result.userActivity = this.parseUserActivityHtml(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'GooglePlayStore.UserPreferences':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.csv')) {
            result.playStorePreferences = this.csvToObjects(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'GoogleChat.Messages':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.json') && !e.entryName.includes('ExportSummary')) {
            try { result.chatMessages.push(JSON.parse(e.getData().toString('utf-8'))); }
            catch { /* skip */ }
          } else if (e.entryName.endsWith('.html')) {
            result.chatMessages.push({ type: 'html', content: e.getData().toString('utf-8') });
          }
        }
        break;

      case 'GoogleChat.UserInfo':
        for (const e of innerEntries) {
          if (!e.entryName.includes('ExportSummary') && !e.entryName.includes('NoRecords')) {
            result.chatUserInfo = e.getData().toString('utf-8');
          }
        }
        break;

      case 'GoogleChat.GroupInfo':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.json') && !e.entryName.includes('ExportSummary')) {
            try { result.chatGroupInfo.push(JSON.parse(e.getData().toString('utf-8'))); }
            catch { /* skip */ }
          }
        }
        break;

      case 'Hangouts.ContentAndMetadata':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.txt') && !e.entryName.includes('ExportSummary')) {
            result.hangoutsInfo = this.parseHangoutsUserInfo(e.getData().toString('utf-8'));
          }
        }
        break;

      case 'AccessLogActivity.Activity':
        for (const e of innerEntries) {
          if (e.entryName.endsWith('.html')) {
            result.accessLogActivity = this.parseAccessLogHtml(e.getData().toString('utf-8'));
          }
        }
        break;

      // Google Pay (label varies)
      case 'GooglePay.Transactions':
      case 'GooglePay.PaymentMethods':
      case 'GooglePay.PaymentInstruments':
      case 'Google Pay.Transactions':
        for (const e of innerEntries) {
          if (e.entryName.toLowerCase().endsWith('.csv')) {
            const rows = this.csvToObjects(e.getData().toString('utf-8'));
            if (resource.toLowerCase().includes('transaction')) {
              result.googlePay.transactions.push(...rows);
            } else {
              result.googlePay.instruments.push(...rows);
            }
          } else if (e.entryName.endsWith('.html') && !e.entryName.includes('ExportSummary')) {
            const parsed = this.parseGooglePayHtml(e.getData().toString('utf-8'));
            if (parsed.transactions) result.googlePay.transactions.push(...parsed.transactions);
            if (parsed.instruments) result.googlePay.instruments.push(...parsed.instruments);
            if (parsed.addresses) result.googlePay.addresses.push(...parsed.addresses);
          }
        }
        break;

      // Drive — handles files (binary attachments are surfaced via mediaFiles)
      case 'Drive.Files':
      case 'Drive.DriveMetadata':
      case 'Drive.FileContentAndMetadata':
      case 'Drive.DriveFileContent':
        for (const e of innerEntries) {
          if (e.isDirectory) continue;
          const lastSlash = e.entryName.lastIndexOf('/');
          const name = lastSlash >= 0 ? e.entryName.substring(lastSlash + 1) : e.entryName;
          if (!name) continue;
          const lower = name.toLowerCase();

          if (lower.endsWith('.json') && !lower.includes('exportsummary')) {
            try { result.driveFiles.push(JSON.parse(e.getData().toString('utf-8'))); }
            catch { /* skip */ }
          } else if (lower.endsWith('.csv')) {
            result.driveFiles.push(...this.csvToObjects(e.getData().toString('utf-8')));
          } else {
            // Binary file — record metadata in driveFiles and index in mediaFiles
            const ext = lower.indexOf('.') >= 0 ? lower.substring(lower.lastIndexOf('.')) : '';
            const mimeType = GOOGLE_MIME_MAP[ext] || 'application/octet-stream';
            const buf = e.getData();
            const sizeBytes = buf.length;
            result.driveFiles.push({
              _isFile: true,
              name,
              path: e.entryName,
              mimeType,
              size: sizeBytes,
            });
            mediaFiles[name] = {
              data: '', // intentionally empty — re-read on demand from source zip
              size: sizeBytes,
              mimeType,
              originalPath: e.entryName,
            };
          }
        }
        break;

      default:
        // Unknown category — log only.
        console.log(`[GoogleWarrantParser] Unknown category: ${key}`);
        break;
    }
  }

  // ─── Export Summary ────────────────────────────────────────────────────

  parseExportSummary(text: string): {
    email: string | null;
    accountId: string | null;
    service: string | null;
    resource: string | null;
    dateRange: GoogleDateRange;
  } {
    const result = {
      email: null as string | null,
      accountId: null as string | null,
      service: null as string | null,
      resource: null as string | null,
      dateRange: { start: null as string | null, end: null as string | null },
    };
    const lines = text.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('Originating Identifier:')) {
        const m = t.match(/:\s*(.+?)\s*\[/);
        if (m) result.email = m[1];
      }
      if (t.startsWith('Resolved Identifier:')) {
        const m = t.match(/:\s*(\d+)/);
        if (m) result.accountId = m[1];
      }
      if (t.startsWith('Service:')) result.service = t.replace('Service:', '').trim();
      if (t.startsWith('Resource:')) result.resource = t.replace('Resource:', '').trim();
      if (t.startsWith('Start of date range:')) {
        const v = t.replace('Start of date range:', '').trim();
        if (v !== 'Not Specified.') result.dateRange.start = v;
      }
      if (t.startsWith('End of date range:')) {
        const v = t.replace('End of date range:', '').trim();
        if (v !== 'Not Specified.') result.dateRange.end = v;
      }
    }
    return result;
  }

  // ─── Subscriber Info ───────────────────────────────────────────────────

  parseSubscriberInfo(html: string): GoogleSubscriberInfo {
    const root = parseHTML(html);
    const result: GoogleSubscriberInfo = {
      name: null, givenName: null, familyName: null,
      email: null, alternateEmails: null,
      accountId: null, createdOn: null, tosIp: null,
      tosLanguage: null, birthday: null,
      services: null, status: null, lastUpdated: null,
      lastLogins: [], deletionDate: null,
      recovery: { contactEmail: null, recoveryEmail: null, recoverySms: null },
      phoneNumbers: { user: null, twoStep: null },
      devices: null,
      ipActivity: [],
    };

    const items = root.querySelectorAll('li');
    for (const li of items) {
      const text = li.text.trim();
      this._matchField(text, 'Google Account ID:', v => result.accountId = v);
      this._matchField(text, 'Name:', v => result.name = v);
      this._matchField(text, 'Given Name:', v => result.givenName = v);
      this._matchField(text, 'Family Name:', v => result.familyName = v);
      this._matchField(text, 'e-Mail:', v => result.email = v);
      this._matchField(text, 'Alternate e-Mails:', v => result.alternateEmails = v || null);
      this._matchField(text, 'Created on:', v => result.createdOn = v);
      this._matchField(text, 'Terms of Service IP:', v => result.tosIp = v);
      this._matchField(text, 'Terms of Service Language:', v => result.tosLanguage = v);
      this._matchField(text, 'Birthday (Month Day, Year):', v => result.birthday = v);
      this._matchField(text, 'Services:', v => result.services = v);
      this._matchField(text, 'Status:', v => result.status = v);
      this._matchField(text, 'Last Updated Date:', v => result.lastUpdated = v);
      this._matchField(text, 'Last Logins:', v => result.lastLogins = v.split(',').map(s => s.trim()).filter(Boolean));
      this._matchField(text, 'Deletion Date:', v => result.deletionDate = v || null);
      this._matchField(text, 'Contact e-Mail:', v => result.recovery.contactEmail = v);
      this._matchField(text, 'Recovery e-Mail:', v => result.recovery.recoveryEmail = v || null);
      this._matchField(text, 'Recovery SMS:', v => result.recovery.recoverySms = v || null);
      this._matchField(text, 'User Phone Numbers:', v => result.phoneNumbers.user = v || null);
      this._matchField(text, '2-Step Verification Phone Numbers:', v => result.phoneNumbers.twoStep = v || null);
    }

    // IP Activity table (skip header row)
    const rows = root.querySelectorAll('table tr');
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        result.ipActivity.push({
          timestamp: cells[0]?.text?.trim() || '',
          ip: cells[1]?.text?.trim() || '',
          activityType: cells[2]?.text?.trim() || '',
          androidId: cells[3]?.text?.trim() || '',
          appleIdfv: cells[4]?.text?.trim() || '',
          userAgent: cells[5]?.text?.trim() || '',
        });
      }
    }

    return result;
  }

  private _matchField(text: string, label: string, setter: (v: string) => void): void {
    if (text.startsWith(label)) {
      setter(text.substring(label.length).trim());
    }
  }

  // ─── Change History ────────────────────────────────────────────────────

  parseChangeHistory(html: string): GoogleChangeRecord[] {
    const root = parseHTML(html);
    const rows = root.querySelectorAll('table tr');
    const out: GoogleChangeRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 5) {
        out.push({
          timestamp: cells[0]?.text?.trim() || '',
          ip: cells[1]?.text?.trim() || '',
          changeType: cells[2]?.text?.trim() || '',
          oldValue: cells[3]?.text?.trim() || '',
          newValue: cells[4]?.text?.trim() || '',
        });
      }
    }
    return out;
  }

  // ─── MBOX ──────────────────────────────────────────────────────────────

  async parseMbox(buffer: Buffer): Promise<GoogleEmail[]> {
    const text = buffer.toString('utf-8');
    const emails: GoogleEmail[] = [];
    const parts = text.split(/^From \S+/m);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part || part.length < 20) continue;
      try {
        const parsed = await simpleParser(Buffer.from(part, 'utf-8'));
        emails.push({
          id: (parsed as any).messageId || `msg-${i}`,
          from: (parsed.from as any)?.text || '',
          to: (parsed.to as any)?.text || '',
          cc: (parsed.cc as any)?.text || '',
          subject: parsed.subject || '(no subject)',
          date: parsed.date?.toISOString() || '',
          labels: (parsed.headers?.get('x-gmail-labels') as string) || '',
          threadId: (parsed.headers?.get('x-gm-thrid') as string) || '',
          textBody: parsed.text || '',
          htmlBody: (parsed.html as string) || '',
          attachments: (parsed.attachments || []).map((a: any) => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
        });
      } catch (err: any) {
        console.warn('[GoogleWarrantParser] failed to parse email part:', err?.message || err);
      }
    }
    return emails;
  }

  // ─── Mail Metadata ─────────────────────────────────────────────────────

  parseMailMetadata(jsonStr: string): GoogleEmailMetadata {
    const data = JSON.parse(jsonStr);
    const item = data.item || data;
    return {
      messageId: item.item_key?.server_id?.toString() || null,
      threadId: item.thread_key?.server_id?.toString() || null,
      creationTime: item.creation_time_microseconds
        ? new Date(item.creation_time_microseconds / 1000).toISOString()
        : null,
      lastModified: item.last_modification_time_us
        ? new Date(item.last_modification_time_us / 1000).toISOString()
        : null,
      readTime: item.read_ts
        ? new Date(item.read_ts / 1000).toISOString()
        : null,
    };
  }

  // ─── Location History ──────────────────────────────────────────────────

  parseLocationRecords(jsonStr: string): GoogleLocationRecord[] {
    const data = JSON.parse(jsonStr);
    const locations = data.locations || [];
    return locations.map((loc: any) => ({
      timestamp: loc.timestamp || (loc.timestampMs ? new Date(parseInt(loc.timestampMs)).toISOString() : null),
      lat: loc.latitudeE7 ? loc.latitudeE7 / 1e7 : null,
      lng: loc.longitudeE7 ? loc.longitudeE7 / 1e7 : null,
      accuracy: loc.accuracy || null,
      altitude: loc.altitude || null,
      velocity: loc.velocity || null,
      heading: loc.heading || null,
      source: loc.source || null,
      deviceTag: loc.deviceTag || null,
      activity: loc.activity || null,
    }));
  }

  parseSemanticLocation(jsonStr: string): GoogleSemanticLocation[] {
    const data = JSON.parse(jsonStr);
    const items = data.timelineObjects || [];
    return items.map((obj: any): GoogleSemanticLocation | null => {
      if (obj.placeVisit) {
        const pv = obj.placeVisit;
        return {
          type: 'placeVisit',
          name: pv.location?.name || null,
          address: pv.location?.address || null,
          placeId: pv.location?.placeId || null,
          lat: pv.location?.latitudeE7 ? pv.location.latitudeE7 / 1e7 : null,
          lng: pv.location?.longitudeE7 ? pv.location.longitudeE7 / 1e7 : null,
          startTime: pv.duration?.startTimestamp || null,
          endTime: pv.duration?.endTimestamp || null,
          confidence: pv.location?.locationConfidence || null,
        };
      } else if (obj.activitySegment) {
        const as = obj.activitySegment;
        return {
          type: 'activitySegment',
          activityType: as.activityType || null,
          confidence: as.confidence || null,
          distance: as.distance || null,
          startLat: as.startLocation?.latitudeE7 ? as.startLocation.latitudeE7 / 1e7 : null,
          startLng: as.startLocation?.longitudeE7 ? as.startLocation.longitudeE7 / 1e7 : null,
          endLat: as.endLocation?.latitudeE7 ? as.endLocation.latitudeE7 / 1e7 : null,
          endLng: as.endLocation?.longitudeE7 ? as.endLocation.longitudeE7 / 1e7 : null,
          startTime: as.duration?.startTimestamp || null,
          endTime: as.duration?.endTimestamp || null,
        };
      }
      return null;
    }).filter(Boolean) as GoogleSemanticLocation[];
  }

  // ─── Google Play Store ────────────────────────────────────────────────

  parseDevicesCsv(csvStr: string): GoogleDevice[] {
    const rows = this.csvToObjects(csvStr);
    return rows.map(row => {
      const recentData = row['Most Recent Data'] || row['Data At Time Of User Play Activity'] || '';
      const extract = (key: string): string | null => {
        const m = recentData.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`));
        return m ? m[1].trim() : null;
      };
      return {
        androidId: row['Android Id'] || null,
        registrationTime: row['Device Registration Time'] || null,
        lastActive: row['Last Time Device Active'] || null,
        manufacturer: extract('manufacturer'),
        model: extract('model_name'),
        deviceName: extract('device_name'),
        brand: extract('retail_brand'),
        carrier: extract('carrier_name'),
        country: extract('device_ip_country'),
        locale: extract('user_locale'),
        sdkVersion: extract('android_sdk_version'),
        buildFingerprint: extract('build_fingerprint'),
        totalMemory: extract('total_memory_bytes'),
        platform: extract('native_platform'),
      };
    });
  }

  parseInstallsCsv(csvStr: string): GoogleInstall[] {
    const rows = this.csvToObjects(csvStr);
    return rows.map(row => ({
      packageName: row['Doc Package Name'] || row['Package Name'] || null,
      title: row['Doc Title'] || null,
      installTime: row['First Installation Time'] || null,
      lastUpdate: row['Last Update Time'] || null,
      state: row['State'] || null,
      installSource: row['Install Source'] || null,
      isSystemApp: row['Is System App'] === 'true',
      deviceModel: row['Device Attribute Model'] || null,
      deviceManufacturer: row['Device Attribute Manufacturer'] || null,
    }));
  }

  parseLibraryCsv(csvStr: string): GoogleLibraryEntry[] {
    const rows = this.csvToObjects(csvStr);
    return rows.map(row => ({
      packageName: row['Doc Backend Docid'] || null,
      title: row['Doc Title'] || null,
      type: row['Doc Document Type'] || null,
      url: row['Doc Url'] || null,
      acquisitionTime: row['Acquisition Time'] || null,
      hidden: row['Hidden'] === 'true',
    }));
  }

  parseUserActivityHtml(html: string): GoogleUserActivity[] {
    const root = parseHTML(html);
    const out: GoogleUserActivity[] = [];
    const cards = root.querySelectorAll('.outer-cell');
    for (const card of cards) {
      const bodyEl = card.querySelector('.content-cell.mdl-typography--body-1');
      if (!bodyEl) continue;

      const bodyHtml = bodyEl.innerHTML;
      const bodyText = bodyEl.text.trim();
      const parts = bodyHtml.split(/<br\s*\/?>/i);
      const action = parts[0] ? parts[0].replace(/<[^>]+>/g, '').trim() : bodyText;
      const timestamp = parts[1] ? parts[1].replace(/<[^>]+>/g, '').trim() : '';
      const linkEl = bodyEl.querySelector('a');
      const link = linkEl ? linkEl.getAttribute('href') : null;
      out.push({ action, timestamp, link: link || null });
    }
    return out;
  }

  // ─── Hangouts ──────────────────────────────────────────────────────────

  parseHangoutsUserInfo(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('#') || !t.includes(':')) continue;
      const colonIdx = t.indexOf(':');
      const key = t.substring(0, colonIdx).trim();
      const val = t.substring(colonIdx + 1).trim();
      if (key && val) result[key] = val;
    }
    return result;
  }

  // ─── Access Log ────────────────────────────────────────────────────────

  parseAccessLogHtml(html: string): GoogleAccessLog[] {
    const root = parseHTML(html);
    const rows = root.querySelectorAll('table tr');
    const out: GoogleAccessLog[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 2) {
        out.push({
          timestamp: cells[0]?.text?.trim() || '',
          activity: cells[1]?.text?.trim() || '',
          ip: cells[2]?.text?.trim() || '',
          details: cells[3]?.text?.trim() || '',
        });
      }
    }
    return out;
  }

  // ─── Google Pay ────────────────────────────────────────────────────────

  parseGooglePayHtml(html: string): { transactions: any[]; instruments: any[]; addresses: any[] } {
    const root = parseHTML(html);
    const result = { transactions: [] as any[], instruments: [] as any[], addresses: [] as any[] };

    const tables = root.querySelectorAll('table');
    for (const table of tables) {
      const headers = table.querySelectorAll('th');
      const headerTexts = Array.from(headers).map(h => h.text.trim().toLowerCase());
      const rows = table.querySelectorAll('tr');
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const obj: Record<string, string> = {};
        cells.forEach((cell, idx) => {
          const key = headerTexts[idx] || `col${idx}`;
          obj[key] = cell.text.trim();
        });
        if (headerTexts.some(h => h.includes('transaction') || h.includes('amount'))) {
          result.transactions.push(obj);
        } else if (headerTexts.some(h => h.includes('card') || h.includes('instrument') || h.includes('payment'))) {
          result.instruments.push(obj);
        } else if (headerTexts.some(h => h.includes('address') || h.includes('billing') || h.includes('shipping'))) {
          result.addresses.push(obj);
        }
      }
    }

    const sections = root.querySelectorAll('.section, div');
    for (const section of sections) {
      const bold = section.querySelector('b');
      if (bold) {
        const title = bold.text.toLowerCase();
        if (title.includes('payment') || title.includes('card') || title.includes('billing')) {
          const items = section.querySelectorAll('li');
          const obj: Record<string, string> = {};
          items.forEach(li => {
            const t = li.text.trim();
            const c = t.indexOf(':');
            if (c > 0) obj[t.substring(0, c).trim()] = t.substring(c + 1).trim();
          });
          if (Object.keys(obj).length > 0) result.instruments.push(obj);
        }
      }
    }

    return result;
  }

  // ─── CSV ───────────────────────────────────────────────────────────────

  csvToObjects(csvStr: string): Record<string, string>[] {
    const records = this._parseCsvFull(csvStr);
    if (records.length < 2) return [];
    const headers = records[0];
    const out: Record<string, string>[] = [];
    for (let i = 1; i < records.length; i++) {
      const values = records[i];
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (values[idx] || '').trim();
      });
      out.push(obj);
    }
    return out;
  }

  /** Full CSV parser handling multi-line quoted fields. */
  private _parseCsvFull(csvStr: string): string[][] {
    const records: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvStr.length) {
      const ch = csvStr[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < csvStr.length && csvStr[i + 1] === '"') {
            field += '"'; i += 2;
          } else {
            inQuotes = false; i++;
          }
        } else {
          field += ch; i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true; i++;
        } else if (ch === ',') {
          current.push(field); field = ''; i++;
        } else if (ch === '\n' || (ch === '\r' && i + 1 < csvStr.length && csvStr[i + 1] === '\n')) {
          current.push(field); field = '';
          if (current.some(f => f.trim())) records.push(current);
          current = [];
          i += (ch === '\r') ? 2 : 1;
        } else if (ch === '\r') {
          current.push(field); field = '';
          if (current.some(f => f.trim())) records.push(current);
          current = []; i++;
        } else {
          field += ch; i++;
        }
      }
    }
    if (field || current.length > 0) {
      current.push(field);
      if (current.some(f => f.trim())) records.push(current);
    }
    return records;
  }
}

// MIME map for Drive binary attachments — module-scoped to avoid recompile per call
const GOOGLE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.3gp': 'video/3gpp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain', '.html': 'text/html', '.htm': 'text/html',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

export default GoogleWarrantParser;
