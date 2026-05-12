/**
 * META Warrant Parser (TypeScript port from Project VIPER)
 * ----------------------------------------------------------
 * Parses META (Facebook/Instagram) law enforcement warrant return ZIP archives.
 * Runs in Electron main process (Node.js) — uses adm-zip + node-html-parser.
 *
 * META productions contain:
 *   records.html          — main production (12 data categories)
 *   preservation-*.html   — preservation snapshots (same format)
 *   instructions.txt      — usage guide (ignored)
 *   linked_media/         — photos & message attachments
 *
 * HTML uses nested div.div_table with CSS display:table for key-value pairs.
 *
 * IDENTICAL parsing semantics to Viper's meta-warrant-parser.js so the
 * downstream UI/flag/export pipeline can be ported 1:1.
 */

import AdmZip from 'adm-zip';
import { parse as parseHTML, HTMLElement } from 'node-html-parser';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────

export interface MetaKV {
  key: string;
  value: string;
  html: string;
  images: string[];
}

export interface MetaMessageAttachment {
  description?: string;
  images?: string[];
  type?: string;
  size?: string;
  url?: string;
  linkedMediaFile?: string;
  [k: string]: any;
}

export interface MetaMessage {
  author: string | null;
  sent: string | null;
  body: string | null;
  attachments: MetaMessageAttachment[];
}

export interface MetaThread {
  threadId: string | null;
  participants: string[];
  messages: MetaMessage[];
}

export interface MetaRecord {
  source: string;
  service: string;
  title: string;
  targetId: string | null;
  accountId: string | null;
  dateRange: string | null;
  generated: string | null;
  ncmecReports: any[];
  registrationIp: string | null;
  ipAddresses: { ip: string | null; time: string | null }[];
  aboutMe: string | null;
  wallposts: any[];
  statusUpdates: any[];
  shares: any[];
  photos: any[];
  messages: { threads: MetaThread[] };
  postsToOtherWalls: any[];
  bio: { text: string | null; creationTime: string | null } | null;
}

export interface MetaMediaFile {
  data: string;       // base64
  size: number;
  mimeType: string;
  originalPath: string;
}

export interface MetaParseResult {
  records: MetaRecord[];
  mediaFiles: Record<string, MetaMediaFile>;
}

// ─── Parser ─────────────────────────────────────────────────────────────

export class MetaWarrantParser {

  // ─── Detection ────────────────────────────────────────────────────────

  /** Check if a ZIP buffer is a META warrant production */
  static isMetaWarrantZip(zipBuffer: Buffer): boolean {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      let hasRecordsHtml = false;
      let hasPreservation = false;
      let hasLinkedMedia = false;

      for (const entry of entries) {
        const name = entry.entryName.toLowerCase();
        if (name === 'records.html') hasRecordsHtml = true;
        if (/^preservation-\d+\.html$/i.test(entry.entryName)) hasPreservation = true;
        if (name.startsWith('linked_media/')) hasLinkedMedia = true;
      }

      if (hasRecordsHtml && hasLinkedMedia) return true;
      if (hasRecordsHtml && hasPreservation) return true;

      if (hasRecordsHtml) {
        try {
          const html = zip.readAsText('records.html');
          if (/Facebook Legal Request|Instagram Legal Request|Meta Legal Request/i.test(html.substring(0, 500))) {
            return true;
          }
        } catch { /* ignore */ }
      }

      return false;
    } catch {
      return false;
    }
  }

  /** Detect from a file path on disk (returns false if not a zip or not Meta) */
  static isMetaWarrantFile(filePath: string): boolean {
    try {
      const fs = require('fs');
      if (!fs.existsSync(filePath)) return false;
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.zip') return false;
      const buf = fs.readFileSync(filePath);
      return MetaWarrantParser.isMetaWarrantZip(buf);
    } catch {
      return false;
    }
  }

  // ─── Main Parse ───────────────────────────────────────────────────────

  async parseZip(zipBuffer: Buffer): Promise<MetaParseResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const result: MetaParseResult = { records: [], mediaFiles: {} };

    // Extract media files
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;

      if (name.startsWith('linked_media/') && name !== 'linked_media/') {
        const fileName = path.basename(name);
        const buf = entry.getData();
        const ext = path.extname(fileName).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
          '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.pdf': 'application/pdf'
        };
        result.mediaFiles[fileName] = {
          data: buf.toString('base64'),
          size: buf.length,
          mimeType: mimeMap[ext] || 'application/octet-stream',
          originalPath: name
        };
      }
    }

    // Parse HTML files
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.toLowerCase();

      if (name === 'records.html' || /^preservation-\d+\.html$/i.test(entry.entryName)) {
        try {
          const html = entry.getData().toString('utf-8');
          const parsed = this._parseHtmlFile(html, entry.entryName);
          result.records.push(parsed);
        } catch (e: any) {
          console.error(`[MetaParser] Error parsing ${entry.entryName}:`, e.message);
        }
      }
    }

    return result;
  }

  // ─── HTML File Parser ─────────────────────────────────────────────────

  private _parseHtmlFile(html: string, fileName: string): MetaRecord {
    const root = parseHTML(html);

    const isPreservation = /preservation/i.test(fileName);
    const source = isPreservation ? fileName.replace(/\.html$/i, '') : 'records';

    const titleEl = root.querySelector('title');
    const title = titleEl ? titleEl.text.trim() : '';
    const service = /instagram/i.test(title) ? 'Instagram' : 'Facebook';

    const record: MetaRecord = {
      source, service, title,
      targetId: null, accountId: null, dateRange: null, generated: null,
      ncmecReports: [], registrationIp: null, ipAddresses: [], aboutMe: null,
      wallposts: [], statusUpdates: [], shares: [], photos: [],
      messages: { threads: [] }, postsToOtherWalls: [], bio: null,
    };

    const sectionParsers: Record<string, (el: HTMLElement) => void> = {
      'property-request_parameters':   (el) => this._parseRequestParameters(el, record),
      'property-ncmec_reports':        (el) => { record.ncmecReports = this._parseNcmecReports(el); },
      'property-registration_ip':      (el) => { record.registrationIp = this._parseRegistrationIp(el); },
      'property-ip_addresses':         (el) => { record.ipAddresses = this._parseIpAddresses(el); },
      'property-about_me':             (el) => { record.aboutMe = this._parseAboutMe(el); },
      'property-wallposts':            (el) => { record.wallposts = this._parseWallposts(el); },
      'property-status_updates':       (el) => { record.statusUpdates = this._parseStatusUpdates(el); },
      'property-shares':               (el) => { record.shares = this._parseShares(el); },
      'property-photos':               (el) => { record.photos = this._parsePhotos(el); },
      'property-unified_messages':     (el) => { record.messages = this._parseUnifiedMessages(el); },
      'property-posts_to_other_walls': (el) => { record.postsToOtherWalls = this._parsePostsToOtherWalls(el); },
      'property-bio':                  (el) => { record.bio = this._parseBio(el); },
    };

    for (const [id, parser] of Object.entries(sectionParsers)) {
      const section = root.querySelector('#' + id) as HTMLElement | null;
      if (section) {
        try {
          parser(section);
        } catch (e: any) {
          console.error(`[MetaParser] Error parsing section ${id}:`, e.message);
        }
      }
    }

    return record;
  }

  // ─── Generic Helpers ──────────────────────────────────────────────────

  /**
   * Extract KV pairs from META's nested div_table pattern.
   *   div.div_table[bold] > div.div_table[display:table] >
   *     TEXT = key
   *     div[display:table-cell] > div > content
   */
  private _extractKVPairs(containerEl: HTMLElement): MetaKV[] {
    const pairs: MetaKV[] = [];
    const divTables = containerEl.querySelectorAll('.div_table[style*="display:table"]');

    for (const dt of divTables) {
      let key = '';
      for (const child of (dt as any).childNodes) {
        if (child.nodeType === 3) {
          const t = (child.text || '').trim();
          if (t) { key = t; break; }
        }
      }
      if (!key) continue;

      const cell = dt.querySelector('[style*="display:table-cell"]');
      if (!cell) continue;
      const contentDiv = cell.querySelector('div');
      if (!contentDiv) continue;

      const value = contentDiv.text.trim();
      const images = contentDiv.querySelectorAll('img')
        .map((img: any) => img.getAttribute('src'))
        .filter((s: any): s is string => !!s);

      pairs.push({ key, value, html: contentDiv.innerHTML, images });
    }

    return pairs;
  }

  /** Get data-bearing div_tables from a section, skipping the Definition sub-section. */
  private _getDataDivs(sectionEl: HTMLElement): HTMLElement[] {
    const topDivs = sectionEl.querySelectorAll(':scope > .div_table') as unknown as HTMLElement[];
    return (topDivs as HTMLElement[]).filter((td) => {
      const inner = td.querySelector('.div_table[style*="display:table"]');
      if (!inner) return false;
      const firstText = this._getFirstText(inner as HTMLElement);
      return !firstText.includes('Definition');
    });
  }

  /** First text content from element's direct children */
  private _getFirstText(el: HTMLElement): string {
    for (const child of (el as any).childNodes) {
      if (child.nodeType === 3) {
        const t = (child.text || '').trim();
        if (t) return t;
      }
    }
    return '';
  }

  /** Split KV pairs into records by detecting repeated start-of-record key */
  private _splitRecordsFromKV(kvPairs: MetaKV[], recordKeys: string[]): MetaKV[][] {
    if (kvPairs.length === 0) return [];
    const records: MetaKV[][] = [];
    let current: MetaKV[] = [];
    for (const kv of kvPairs) {
      if (recordKeys.includes(kv.key) && current.length > 0) {
        records.push(current);
        current = [];
      }
      current.push(kv);
    }
    if (current.length > 0) records.push(current);
    return records;
  }

  /** Convert KV pairs to object, first-occurrence wins, attaches images at <key>Images */
  private _kvToObject(kvPairs: MetaKV[]): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const kv of kvPairs) {
      const camelKey = this._toCamelCase(kv.key);
      if (obj[camelKey] === undefined) {
        obj[camelKey] = kv.value;
        if (kv.images.length > 0) obj[camelKey + 'Images'] = kv.images;
      }
    }
    return obj;
  }

  /** "IP Address" → "ipAddress" */
  private _toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  // ─── Category Parsers ─────────────────────────────────────────────────

  private _parseRequestParameters(sectionEl: HTMLElement, record: MetaRecord): void {
    const dataDivs = this._getDataDivs(sectionEl);
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      for (const kv of kvs) {
        const k = kv.key.toLowerCase();
        if (k === 'target') record.targetId = kv.value;
        else if (k === 'account identifier') record.accountId = kv.value;
        else if (k === 'date range') record.dateRange = kv.value;
        else if (k === 'generated') record.generated = kv.value;
        else if (k === 'service') record.service = kv.value || record.service;
      }
    }
  }

  private _parseNcmecReports(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const reports: any[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['CyberTip ID', 'Cybertip']);
      for (const rec of records) reports.push(this._kvToObject(rec));
    }
    return reports;
  }

  private _parseRegistrationIp(sectionEl: HTMLElement): string | null {
    const dataDivs = this._getDataDivs(sectionEl);
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) return null;
      return kvs[0].value || null;
    }
    return null;
  }

  private _parseIpAddresses(sectionEl: HTMLElement): { ip: string | null; time: string | null }[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const addresses: { ip: string | null; time: string | null }[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['IP Address']);
      for (const rec of records) {
        const obj = this._kvToObject(rec);
        if (!obj.ipAddress) continue;
        addresses.push({ ip: obj.ipAddress || null, time: obj.time || null });
      }
    }
    return addresses;
  }

  private _parseAboutMe(sectionEl: HTMLElement): string | null {
    const dataDivs = this._getDataDivs(sectionEl);
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) return null;
      const text = kvs.map(kv => kv.value).join(' ').trim();
      return text || null;
    }
    return null;
  }

  private _parseWallposts(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const posts: any[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['To', 'Id']);
      for (const rec of records) {
        const obj = this._kvToObject(rec);
        posts.push({
          to: obj.to || null,
          from: obj.from || null,
          id: obj.id || null,
          time: obj.time || null,
          text: obj.text || null,
          attachments: obj.wallpostsAttachments || null
        });
      }
    }
    return posts;
  }

  private _parseStatusUpdates(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const updates: any[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['Posted']);
      for (const rec of records) {
        const obj = this._kvToObject(rec);
        if (!obj.posted) continue;
        updates.push({
          posted: obj.posted || null,
          status: obj.status || null,
          mobile: obj.mobile || null,
          id: obj.id || null,
          author: obj.author || null,
          displayDate: obj.displayDate || null,
          lifeExperience: obj.lifeExperience || null
        });
      }
    }
    return updates;
  }

  private _parseShares(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const shares: any[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['Date Created']);
      for (const rec of records) {
        const obj = this._kvToObject(rec);
        shares.push({
          dateCreated: obj.dateCreated || null,
          link: obj.link || null,
          summary: obj.summary || null,
          text: obj.text || null,
          title: obj.title || null,
          url: obj.url || null,
          imageId: obj.photoId || null,
          imageFile: (obj.imageImages || [])[0] || null
        });
      }
    }
    return shares;
  }

  private _parsePhotos(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const photos: any[] = [];

    for (const dd of dataDivs) {
      const inner = dd.querySelector('.div_table[style*="display:table"]') as HTMLElement | null;
      if (!inner) continue;
      const sectionLabel = this._getFirstText(inner);
      if (sectionLabel.includes('No responsive records')) continue;

      const cell = inner.querySelector('[style*="display:table-cell"]') as HTMLElement | null;
      if (!cell) continue;
      const contentDiv = cell.querySelector('div') as HTMLElement | null;
      if (!contentDiv) continue;

      const photoKvs = this._extractKVPairs(contentDiv);
      if (photoKvs.length === 0) continue;

      const albumMatch = sectionLabel.match(/Album:\s*(.+)/i);
      const albumName = albumMatch ? albumMatch[1].trim() : sectionLabel;

      const photoRecords = this._splitRecordsFromKV(photoKvs, ['Image', 'Linked Media File:']);
      for (const rec of photoRecords) {
        const obj = this._kvToObject(rec);
        const imgFile = (obj.imageImages || [])[0] || obj.linkedMediaFile || null;
        if (!imgFile && !obj.id && !obj.title) continue;
        photos.push({
          album: albumName,
          imageFile: (obj.imageImages || [])[0] || obj.linkedMediaFile || null,
          id: obj.id || null,
          title: obj.title || null,
          link: obj.link || null,
          uploadIp: obj.uploadIp || null,
          albumName: obj.albumName || albumName,
          uploaded: obj.uploaded || null,
          author: obj.author || null,
          tags: obj.tags || null
        });
      }
    }

    return photos;
  }

  private _parseUnifiedMessages(sectionEl: HTMLElement): { threads: MetaThread[] } {
    const result: { threads: MetaThread[] } = { threads: [] };
    const dataDivs = this._getDataDivs(sectionEl);

    for (const dd of dataDivs) {
      const inner = dd.querySelector('.div_table[style*="display:table"]') as HTMLElement | null;
      if (!inner) continue;
      const sectionLabel = this._getFirstText(inner);
      if (!sectionLabel.startsWith('Unified Messages') && !sectionLabel.startsWith('Thread')) continue;

      const cell = inner.querySelector('[style*="display:table-cell"]') as HTMLElement | null;
      if (!cell) continue;
      const contentDiv = cell.querySelector('div') as HTMLElement | null;
      if (!contentDiv) continue;
      if (sectionLabel.includes('No responsive records')) continue;

      this._parseMessageThreads(contentDiv, result);
    }

    return result;
  }

  private _parseMessageThreads(contentDiv: HTMLElement, result: { threads: MetaThread[] }): void {
    const allKvs = this._extractKVPairs(contentDiv);
    if (allKvs.length === 0) return;

    let currentThread: MetaThread | null = null;

    for (const kv of allKvs) {
      const k = kv.key;

      if (k === 'Thread') {
        if (currentThread) result.threads.push(currentThread);
        const idMatch = kv.value.match(/\((\d+)\)/);
        currentThread = {
          threadId: idMatch ? idMatch[1] : null,
          participants: [],
          messages: []
        };
      } else if (k === 'Current Participants' && currentThread) {
        const lines = kv.value.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 1; i < lines.length; i++) {
          if (lines[i]) currentThread.participants.push(lines[i]);
        }
      } else if (k === 'Author' && currentThread) {
        currentThread.messages.push({
          author: kv.value, sent: null, body: null, attachments: []
        });
      } else if (k === 'Sent' && currentThread && currentThread.messages.length > 0) {
        currentThread.messages[currentThread.messages.length - 1].sent = kv.value;
      } else if (k === 'Body' && currentThread && currentThread.messages.length > 0) {
        currentThread.messages[currentThread.messages.length - 1].body = kv.value;
      } else if (k === 'Attachments' && currentThread && currentThread.messages.length > 0) {
        const msg = currentThread.messages[currentThread.messages.length - 1];
        msg.attachments.push({
          description: kv.value,
          images: kv.images || []
        });
      } else if ((k === 'Type' || k === 'Size' || k === 'URL' || k === 'Linked Media File:') &&
                 currentThread && currentThread.messages.length > 0) {
        const msg = currentThread.messages[currentThread.messages.length - 1];
        if (msg.attachments.length > 0) {
          const att = msg.attachments[msg.attachments.length - 1];
          att[this._toCamelCase(k)] = kv.value;
          if (kv.images.length > 0) att.images = [...(att.images || []), ...kv.images];
        }
      }
    }

    if (currentThread) result.threads.push(currentThread);
  }

  private _parsePostsToOtherWalls(sectionEl: HTMLElement): any[] {
    const dataDivs = this._getDataDivs(sectionEl);
    const posts: any[] = [];
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) continue;
      const records = this._splitRecordsFromKV(kvs, ['Id']);
      for (const rec of records) {
        const obj = this._kvToObject(rec);
        if (!obj.id) continue;
        posts.push({
          id: obj.id || null,
          post: obj.post || null,
          time: obj.time || null,
          timelineOwner: obj.timelineOwner || null
        });
      }
    }
    return posts;
  }

  private _parseBio(sectionEl: HTMLElement): { text: string | null; creationTime: string | null } | null {
    const dataDivs = this._getDataDivs(sectionEl);
    for (const dd of dataDivs) {
      const kvs = this._extractKVPairs(dd);
      if (kvs.length === 0 || kvs[0].value.includes('No responsive records')) return null;
      const obj = this._kvToObject(kvs);
      return {
        text: obj.text || null,
        creationTime: obj.creationTime || null
      };
    }
    return null;
  }
}

export default MetaWarrantParser;
