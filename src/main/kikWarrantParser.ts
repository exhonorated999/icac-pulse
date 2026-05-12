/**
 * KIK Warrant Parser — TypeScript port of VIPER's kik-warrant-parser.js
 *
 * KIK Messenger law enforcement warrant return parser.
 * Productions contain a nested ZIP-of-ZIP structure:
 *   Outer ZIP → KIK-{caseNum}-completed-documents/
 *     Inner ZIP → {username}_case{num}.zip
 *       {username}/logs/  — TAB-delimited text files (no headers)
 *
 * Log files (TSV, no headers, 13-digit ms timestamps):
 *   bind.txt, friend_added.txt, block_user.txt,
 *   chat_sent.txt, chat_sent_received.txt,
 *   chat_platform_sent.txt, chat_platform_sent_received.txt,
 *   group_send_msg.txt, group_receive_msg.txt,
 *   group_send_msg_platform.txt, group_receive_msg_platform.txt
 *
 * Media files live under {username}/content/ alongside logs/.
 */

import * as path from 'path';
import * as fs from 'fs';
import AdmZip = require('adm-zip');

// ─── Types ──────────────────────────────────────────────────────────────

export interface KikBind {
  timestamp: number;
  username: string;
  ip: string;
  port: string;
  datetime: string;
  country: string;
}

export interface KikFriend {
  timestamp: number;
  user: string;
  friend: string;
  datetime: string;
}

export interface KikBlockedUser {
  timestamp: number;
  user: string;
  blocked: string;
  datetime: string;
}

export interface KikChatRecord {
  timestamp: number;
  sender: string;
  recipient: string;
  msgCount: number;
  ip: string;
  datetime: string;
}

export interface KikChatMediaRecord {
  timestamp: number;
  sender: string;
  recipient: string;
  mediaType: string;
  mediaUuid: string;
  ip: string;
  datetime: string;
}

export interface KikGroupRecord {
  timestamp: number;
  sender: string;
  groupId: string;
  recipient: string;
  msgCount: number;
  ip: string;
  datetime: string;
}

export interface KikGroupMediaRecord {
  timestamp: number;
  sender: string;
  groupId: string;
  recipient: string;
  mediaType: string;
  mediaUuid: string;
  ip: string;
  datetime: string;
}

export interface KikContentFileInfo {
  size: number;
  mimeType: string;
}

export interface KikStats {
  totalRecords: number;
  uniqueContacts: number;
  uniqueFriends: number;
  uniqueGroups: number;
  uniqueIps: number;
  dateRange: { start: string | null; end: string | null };
  counts: {
    binds: number;
    friends: number;
    blocked: number;
    contentFiles: number;
    dmTextSent: number;
    dmTextReceived: number;
    dmMediaSent: number;
    dmMediaReceived: number;
    groupTextSent: number;
    groupTextReceived: number;
    groupMediaSent: number;
    groupMediaReceived: number;
  };
}

export interface KikWarrantResult {
  accountUsername: string;
  caseNumber: string | null;
  contentFiles: Record<string, KikContentFileInfo>;
  binds: KikBind[];
  friends: KikFriend[];
  blockedUsers: KikBlockedUser[];
  chatSent: KikChatRecord[];
  chatSentReceived: KikChatRecord[];
  chatPlatformSent: KikChatMediaRecord[];
  chatPlatformSentReceived: KikChatMediaRecord[];
  groupSendMsg: KikGroupRecord[];
  groupReceiveMsg: KikGroupRecord[];
  groupSendMsgPlatform: KikGroupMediaRecord[];
  groupReceiveMsgPlatform: KikGroupMediaRecord[];
  stats: KikStats;
}

export interface KikMediaFile {
  filename: string;
  size: number;
  mimeType: string;
  originalPath: string;  // path inside the inner zip — used for lazy re-read
}

export interface KikParseResult {
  records: KikWarrantResult[]; // single account → single record (kept as array for symmetry)
  mediaFiles: Record<string, KikMediaFile>;
}

// ─── Parser ─────────────────────────────────────────────────────────────

export class KikWarrantParser {

  // ─── Detection ────────────────────────────────────────────────────────

  /** Quick heuristic: does this ZIP look like a Kik warrant return? */
  static isKikWarrantZip(zipBuffer: Buffer): boolean {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      let hasKikLogs = false;
      let hasInnerZip = false;

      for (const entry of entries) {
        const name = entry.entryName.toLowerCase();
        if (name.endsWith('/logs/bind.txt') ||
            name.endsWith('/logs/chat_sent.txt') ||
            name.endsWith('/logs/friend_added.txt')) {
          hasKikLogs = true;
        }
        if (!entry.isDirectory && name.endsWith('.zip') && /_case\d+/i.test(name)) {
          hasInnerZip = true;
        }
      }

      if (hasKikLogs) return true;

      // Try opening inner ZIP to check for Kik logs
      if (hasInnerZip) {
        for (const entry of entries) {
          if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.zip')) continue;
          if (!/_case\d+/i.test(entry.entryName)) continue;
          try {
            const innerBuf = entry.getData();
            const innerZip = new AdmZip(innerBuf);
            for (const innerEntry of innerZip.getEntries()) {
              const inName = innerEntry.entryName.toLowerCase();
              if (inName.endsWith('/logs/bind.txt') ||
                  inName.endsWith('/logs/chat_sent.txt') ||
                  inName.endsWith('/logs/friend_added.txt')) {
                return true;
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* not a valid zip */ }
    return false;
  }

  /** Path-based detection — reads the file from disk. */
  static isKikWarrantFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.zip') return false;
      const buf = fs.readFileSync(filePath);
      return this.isKikWarrantZip(buf);
    } catch {
      return false;
    }
  }

  // ─── Main Parse ───────────────────────────────────────────────────────

  /**
   * Parse a Kik warrant ZIP buffer. Handles nested ZIP-of-ZIP structure.
   * Returns a single-record KikParseResult (one account per production).
   * Media files are registered with metadata only — actual bytes re-read on demand.
   */
  async parseZip(zipBuffer: Buffer): Promise<KikParseResult> {
    const zip = new AdmZip(zipBuffer);
    let entries = zip.getEntries();
    let contentSourceEntries: AdmZip.IZipEntry[] | null = null;

    // Check if we need to unwrap an inner ZIP
    let logsPrefix = this._findLogsPrefix(entries);

    if (!logsPrefix) {
      // Look for inner ZIP (Kik nested structure)
      const innerZipEntry = this._findInnerZip(entries);
      if (innerZipEntry) {
        const innerBuf = innerZipEntry.getData();
        const innerZip = new AdmZip(innerBuf);
        entries = innerZip.getEntries();
        contentSourceEntries = entries;
        logsPrefix = this._findLogsPrefix(entries);
      }
    } else {
      // Logs found directly — check if content/ exists at sibling path
      const testContentPrefix = logsPrefix.replace(/logs\/$/, 'content/');
      const hasDirectContent = entries.some(e =>
        !e.isDirectory && !e.entryName.startsWith('__MACOSX') &&
        e.entryName.startsWith(testContentPrefix));
      if (hasDirectContent) {
        contentSourceEntries = entries;
      } else {
        // Content only in inner ZIP — open it now
        const innerZipEntry = this._findInnerZip(zip.getEntries());
        if (innerZipEntry) {
          try {
            const innerBuf = innerZipEntry.getData();
            const innerZip = new AdmZip(innerBuf);
            contentSourceEntries = innerZip.getEntries();
          } catch { /* ignore */ }
        }
      }
    }

    if (!logsPrefix) {
      throw new Error('Could not find Kik logs directory in ZIP');
    }

    // Extract account username from path
    const pathParts = logsPrefix.replace(/\/$/, '').split('/');
    const logsIdx = pathParts.lastIndexOf('logs');
    const accountUsername = logsIdx > 0 ? pathParts[logsIdx - 1] : 'unknown';

    // Extract case number from ZIP entry names
    let caseNumber: string | null = null;
    for (const entry of entries) {
      const match = entry.entryName.match(/_case(\d+)/i);
      if (match) { caseNumber = match[1]; break; }
    }

    // Build file map for logs
    const fileMap: Record<string, AdmZip.IZipEntry> = {};
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName.startsWith(logsPrefix)) {
        const fileName = entry.entryName.substring(logsPrefix.length);
        if (fileName && !fileName.includes('/')) {
          fileMap[fileName.toLowerCase()] = entry;
        }
      }
    }

    // Catalog content/ files (media). We DO NOT read bytes — just metadata.
    // Renderer can request bytes later via an IPC channel that re-reads from source.
    const contentFiles: Record<string, KikContentFileInfo> = {};
    const mediaFiles: Record<string, KikMediaFile> = {};
    if (contentSourceEntries) {
      const csLogsPrefix = this._findLogsPrefix(contentSourceEntries) || logsPrefix;
      const contentPrefix = csLogsPrefix.replace(/logs\/$/, 'content/');

      for (const entry of contentSourceEntries) {
        if (entry.isDirectory) continue;
        if (entry.entryName.startsWith('__MACOSX')) continue;
        if (!entry.entryName.startsWith(contentPrefix)) continue;

        const fileName = entry.entryName.substring(contentPrefix.length);
        if (!fileName || fileName.includes('/')) continue;

        const mimeType = this._detectMimeType(fileName, entry);
        const size = entry.header.size;
        contentFiles[fileName] = { size, mimeType };
        mediaFiles[fileName] = {
          filename: fileName,
          size,
          mimeType,
          originalPath: entry.entryName,
        };
      }
    }

    // Parse each log file
    const readText = (name: string): string => {
      const entry = fileMap[name];
      if (!entry) return '';
      try { return entry.getData().toString('utf-8'); } catch { return ''; }
    };

    const result: KikWarrantResult = {
      accountUsername,
      caseNumber,
      contentFiles,
      binds: this._parseBind(readText('bind.txt')),
      friends: this._parseFriendAdded(readText('friend_added.txt')),
      blockedUsers: this._parseBlockUser(readText('block_user.txt')),
      chatSent: this._parseChatSent(readText('chat_sent.txt')),
      chatSentReceived: this._parseChatSentReceived(readText('chat_sent_received.txt')),
      chatPlatformSent: this._parseChatPlatformSent(readText('chat_platform_sent.txt')),
      chatPlatformSentReceived: this._parseChatPlatformSentReceived(readText('chat_platform_sent_received.txt')),
      groupSendMsg: this._parseGroupSendMsg(readText('group_send_msg.txt')),
      groupReceiveMsg: this._parseGroupReceiveMsg(readText('group_receive_msg.txt')),
      groupSendMsgPlatform: this._parseGroupSendMsgPlatform(readText('group_send_msg_platform.txt')),
      groupReceiveMsgPlatform: this._parseGroupReceiveMsgPlatform(readText('group_receive_msg_platform.txt')),
      stats: this._emptyStats(),
    };

    result.stats = this._computeStats(result);

    return { records: [result], mediaFiles };
  }

  /** Detect MIME type from filename extension or magic bytes. */
  _detectMimeType(fileName: string, entry: AdmZip.IZipEntry): string {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webp') return 'image/webp';
    // No extension — peek magic bytes
    try {
      const header = entry.getData().slice(0, 12);
      if (header[0] === 0xFF && header[1] === 0xD8) return 'image/jpeg';
      if (header[0] === 0x89 && header[1] === 0x50) return 'image/png';
      if (header.length > 7 && header[4] === 0x66 && header[5] === 0x74 &&
          header[6] === 0x79 && header[7] === 0x70) return 'video/mp4';
      if (header.length > 5 && header[0] === 0x47 && header[1] === 0x49 &&
          header[2] === 0x46 && header[3] === 0x38) return 'image/gif';
    } catch { /* keep default */ }
    return 'application/octet-stream';
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  _findLogsPrefix(entries: AdmZip.IZipEntry[]): string | null {
    for (const entry of entries) {
      const name = entry.entryName;
      const match = name.match(/^(.+\/logs\/)(?:bind|chat_sent|friend_added)\.txt$/i);
      if (match) return match[1];
    }
    return null;
  }

  _findInnerZip(entries: AdmZip.IZipEntry[]): AdmZip.IZipEntry | null {
    // Prefer *_case*.zip pattern
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.zip') &&
          /_case\d+/i.test(entry.entryName)) {
        return entry;
      }
    }
    // Fallback: any .zip
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.zip')) {
        return entry;
      }
    }
    return null;
  }

  _parseLines(text: string): string[][] {
    if (!text || !text.trim()) return [];
    return text.split('\n')
      .map(l => l.replace(/\r$/, ''))
      .filter(l => l.length > 0)
      .map(l => l.split('\t'));
  }

  // ─── File Parsers ───────────────────────────────────────────────────

  /** bind.txt: ts_ms, username, IP, port, datetime, country */
  _parseBind(text: string): KikBind[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      username: f[1] || '',
      ip: f[2] || '',
      port: f[3] || '',
      datetime: f[4] || '',
      country: f[5] || '',
    }));
  }

  /** friend_added.txt: ts_ms, user, friend_username, datetime */
  _parseFriendAdded(text: string): KikFriend[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      user: f[1] || '',
      friend: f[2] || '',
      datetime: f[3] || '',
    }));
  }

  /** block_user.txt */
  _parseBlockUser(text: string): KikBlockedUser[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      user: f[1] || '',
      blocked: f[2] || '',
      datetime: f[3] || '',
    }));
  }

  /** chat_sent.txt: ts_ms, sender, recipient, msg_count, IP, datetime */
  _parseChatSent(text: string): KikChatRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      recipient: f[2] || '',
      msgCount: parseInt(f[3]) || 0,
      ip: f[4] || '',
      datetime: f[5] || '',
    }));
  }

  /** chat_sent_received.txt: ts_ms, sender, recipient, msg_count, REDACTED, datetime */
  _parseChatSentReceived(text: string): KikChatRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      recipient: f[2] || '',
      msgCount: parseInt(f[3]) || 0,
      ip: f[4] || '',
      datetime: f[5] || '',
    }));
  }

  /** chat_platform_sent.txt: ts_ms, sender, recipient, mediaType, media_uuid, IP, datetime */
  _parseChatPlatformSent(text: string): KikChatMediaRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      recipient: f[2] || '',
      mediaType: f[3] || '',
      mediaUuid: f[4] || '',
      ip: f[5] || '',
      datetime: f[6] || '',
    }));
  }

  /** chat_platform_sent_received.txt: ts_ms, sender, recipient, mediaType, media_uuid, REDACTED, datetime */
  _parseChatPlatformSentReceived(text: string): KikChatMediaRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      recipient: f[2] || '',
      mediaType: f[3] || '',
      mediaUuid: f[4] || '',
      ip: f[5] || '',
      datetime: f[6] || '',
    }));
  }

  /** group_send_msg.txt: ts_ms, sender, group_id, recipient, msg_count, IP, datetime */
  _parseGroupSendMsg(text: string): KikGroupRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      groupId: f[2] || '',
      recipient: f[3] || '',
      msgCount: parseInt(f[4]) || 0,
      ip: f[5] || '',
      datetime: f[6] || '',
    }));
  }

  /** group_receive_msg.txt: ts_ms, sender, group_id, recipient, msg_count, REDACTED, datetime */
  _parseGroupReceiveMsg(text: string): KikGroupRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      groupId: f[2] || '',
      recipient: f[3] || '',
      msgCount: parseInt(f[4]) || 0,
      ip: f[5] || '',
      datetime: f[6] || '',
    }));
  }

  /** group_send_msg_platform.txt: ts_ms, sender, group_id, recipient, mediaType, media_uuid, IP, datetime */
  _parseGroupSendMsgPlatform(text: string): KikGroupMediaRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      groupId: f[2] || '',
      recipient: f[3] || '',
      mediaType: f[4] || '',
      mediaUuid: f[5] || '',
      ip: f[6] || '',
      datetime: f[7] || '',
    }));
  }

  /** group_receive_msg_platform.txt: ts_ms, sender, group_id, recipient, mediaType, media_uuid, REDACTED, datetime */
  _parseGroupReceiveMsgPlatform(text: string): KikGroupMediaRecord[] {
    return this._parseLines(text).map(f => ({
      timestamp: parseInt(f[0]) || 0,
      sender: f[1] || '',
      groupId: f[2] || '',
      recipient: f[3] || '',
      mediaType: f[4] || '',
      mediaUuid: f[5] || '',
      ip: f[6] || '',
      datetime: f[7] || '',
    }));
  }

  // ─── Stats ──────────────────────────────────────────────────────────

  _emptyStats(): KikStats {
    return {
      totalRecords: 0,
      uniqueContacts: 0,
      uniqueFriends: 0,
      uniqueGroups: 0,
      uniqueIps: 0,
      dateRange: { start: null, end: null },
      counts: {
        binds: 0, friends: 0, blocked: 0, contentFiles: 0,
        dmTextSent: 0, dmTextReceived: 0, dmMediaSent: 0, dmMediaReceived: 0,
        groupTextSent: 0, groupTextReceived: 0, groupMediaSent: 0, groupMediaReceived: 0,
      },
    };
  }

  _computeStats(data: KikWarrantResult): KikStats {
    // Unique contacts from all DM files
    const dmContacts = new Set<string>();
    for (const r of data.chatSent) { dmContacts.add(r.recipient); }
    for (const r of data.chatSentReceived) { dmContacts.add(r.sender); }
    for (const r of data.chatPlatformSent) { dmContacts.add(r.recipient); }
    for (const r of data.chatPlatformSentReceived) { dmContacts.add(r.sender); }
    dmContacts.delete(data.accountUsername);

    // Unique groups
    const groups = new Set<string>();
    for (const r of data.groupSendMsg) { groups.add(r.groupId); }
    for (const r of data.groupReceiveMsg) { groups.add(r.groupId); }
    for (const r of data.groupSendMsgPlatform) { groups.add(r.groupId); }
    for (const r of data.groupReceiveMsgPlatform) { groups.add(r.groupId); }

    // Unique IPs from binds
    const ips = new Set<string>();
    for (const b of data.binds) { if (b.ip) ips.add(b.ip); }

    // Total records
    const totalRecords =
      data.binds.length + data.friends.length + data.blockedUsers.length +
      data.chatSent.length + data.chatSentReceived.length +
      data.chatPlatformSent.length + data.chatPlatformSentReceived.length +
      data.groupSendMsg.length + data.groupReceiveMsg.length +
      data.groupSendMsgPlatform.length + data.groupReceiveMsgPlatform.length;

    // Date range from all timestamps
    const allTimestamps: number[] = [];
    const addTs = (arr: { timestamp: number }[]) => {
      for (const r of arr) { if (r.timestamp) allTimestamps.push(r.timestamp); }
    };
    addTs(data.binds); addTs(data.friends);
    addTs(data.chatSent); addTs(data.chatSentReceived);
    addTs(data.chatPlatformSent); addTs(data.chatPlatformSentReceived);
    addTs(data.groupSendMsg); addTs(data.groupReceiveMsg);
    addTs(data.groupSendMsgPlatform); addTs(data.groupReceiveMsgPlatform);

    const minTs = allTimestamps.length ? Math.min(...allTimestamps) : 0;
    const maxTs = allTimestamps.length ? Math.max(...allTimestamps) : 0;

    return {
      totalRecords,
      uniqueContacts: dmContacts.size,
      uniqueFriends: data.friends.length,
      uniqueGroups: groups.size,
      uniqueIps: ips.size,
      dateRange: {
        start: minTs ? new Date(minTs).toISOString() : null,
        end: maxTs ? new Date(maxTs).toISOString() : null,
      },
      counts: {
        binds: data.binds.length,
        friends: data.friends.length,
        blocked: data.blockedUsers.length,
        contentFiles: Object.keys(data.contentFiles).length,
        dmTextSent: data.chatSent.length,
        dmTextReceived: data.chatSentReceived.length,
        dmMediaSent: data.chatPlatformSent.length,
        dmMediaReceived: data.chatPlatformSentReceived.length,
        groupTextSent: data.groupSendMsg.length,
        groupTextReceived: data.groupReceiveMsg.length,
        groupMediaSent: data.groupSendMsgPlatform.length,
        groupMediaReceived: data.groupReceiveMsgPlatform.length,
      },
    };
  }
}
