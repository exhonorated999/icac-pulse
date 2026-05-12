/**
 * Discord Warrant Parser — TypeScript port of VIPER's discord-warrant-parser.js
 *
 * Parses Discord law-enforcement warrant return ZIP archives or unzipped folders.
 * Discord serves warrant returns as Discord Data Packages — same format as
 * a user's "Request All My Data" export.  Parser handles both.
 *
 * Discord Data Package layout:
 *   README.txt
 *   Account/
 *     user.json
 *     avatar.jpeg
 *     recent_avatars/*.jpeg
 *     user_data_exports/
 *       discord_billing/{billing_profile,payment_sources,payments,entitlements}.json
 *       discord_harvests/data_subject_access_requests.json
 *       discord_promotions/*.json
 *       discord_store/*.json
 *       discord_virtual_currency/*.json
 *   Messages/
 *     index.json
 *     c{channelId}/{channel,messages}.json
 *   Servers/
 *     index.json
 *     {guildId}/{guild,audit-log}.json
 *   Activity/{analytics,tns,reporting,modeling}/events-*.json   (JSONL)
 */

import * as path from 'path';
import * as fs from 'fs';
import AdmZip = require('adm-zip');

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiscordSession {
  ip: string | null;
  os: string | null;
  platform: string | null;
  creation_time: string | null;
  expiration_time: string | null;
  last_used: string | null;
  is_mfa: boolean;
  is_bot: boolean;
  binding_token: string | null;
  is_soft_deleted: boolean;
}

export interface DiscordSubscriber {
  id: string | null;
  username: string | null;
  discriminator: any;
  global_name: string | null;
  email: string | null;
  phone: string | null;
  ip: string | null;
  verified: boolean;
  has_mobile: boolean;
  premium_until: string | null;
  avatar_hash: string | null;
  flags: any[];
  connections: any[];
  relationships: any[];
  external_friends_lists: any[];
  sessions: DiscordSession[];
  user_profile_metadata: any;
  current_orbs_balance: number;
}

export interface DiscordMessage {
  id: string;
  timestamp: string;
  contents: string;
  attachments: string;
}

export interface DiscordChannel {
  channelId: string;
  channelName: string;
  channelType: any;
  guildId: string | null;
  guildName: string | null;
  indexLabel: string | null;
  recipients: any;
  messageCount: number;
  messages: DiscordMessage[];
}

export interface DiscordServer {
  id: string;
  name: string;
  auditLog: any[];
}

export interface DiscordActivityEvent {
  category: string;
  event_type: string;
  timestamp: string | null;
  client_send_timestamp: string | null;
  ip: string | null;
  city: string | null;
  region_code: string | null;
  country_code: string | null;
  time_zone: string | null;
  isp: string | null;
  browser: string | null;
  browser_user_agent: string | null;
  device: string | null;
  device_vendor_id: string | null;
  os: string | null;
  os_version: string | null;
  client_version: string | null;
  session: string | null;
  session_type: string | null;
  opened_from: string | null;
  load_id: string | null;
  user_id: string | null;
  event_id: string | null;
}

export interface DiscordActivity {
  sessionStarts: DiscordActivityEvent[];
  sessionEnds: DiscordActivityEvent[];
  appOpens: DiscordActivityEvent[];
  logins: DiscordActivityEvent[];
  registers: DiscordActivityEvent[];
  otherImportant: DiscordActivityEvent[];
  eventCounts: Record<string, number>;
  totalEventCount: number;
}

export interface DiscordIpRow {
  ip: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  locations: string[];
  browsers: string[];
  oses: string[];
  devices: string[];
  isps: string[];
  sources: string[];
}

export interface DiscordDeviceRow {
  key: string;
  device_vendor_id: string | null;
  device: string | null;
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_user_agent: string | null;
  client_version: string | null;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  ips: string[];
}

export interface DiscordContentFile {
  diskPath: string;
  size: number;
  mimeType: string;
  kind: string;
  original: string;
  originalPath?: string;
}

export interface DiscordStats {
  messageCount: number;
  channelCount: number;
  serverCount: number;
  sessionCount: number;
  ipCount: number;
  deviceCount: number;
  eventCount: number;
  mediaCount: number;
}

export interface DiscordWarrantResult {
  subscriber: DiscordSubscriber | null;
  avatarFile: { diskPath?: string; mimeType?: string; original?: string; originalPath?: string } | null;
  recentAvatarFiles: { diskPath?: string; mimeType?: string; original?: string; originalPath?: string }[];
  channels: DiscordChannel[];
  servers: DiscordServer[];
  billing: {
    billingProfile: any[];
    paymentSources: any[];
    payments: any[];
    entitlements: any[];
  };
  dsar: any[];
  promotions: {
    quests: any[];
    drops: any[];
  };
  store: {
    wishlist: any[];
  };
  virtualCurrency: {
    accounts: any[];
    transactions: any[];
  };
  activity: DiscordActivity;
  ipActivity: DiscordIpRow[];
  devices: DiscordDeviceRow[];
  contentFiles: Record<string, DiscordContentFile>;
  stats: DiscordStats;
}

export interface DiscordParseOptions {
  extractDir?: string;
}

// IP-bearing event types we surface in IP Activity table.
const IP_EVENT_TYPES = new Set<string>([
  'session_start_success',
  'session_end',
  'app_opened',
  'login_attempted',
  'login_succeeded',
  'login_failed',
  'register',
  'register_succeeded',
  'logout',
]);

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

// ────────────────────────────────────────────────────────────────────────

interface SourceAdapter {
  entryNames: string[];
  readText: (name: string) => string | null;
  readBinary: (name: string) => Buffer | null;
}

export class DiscordWarrantParser {
  // ─── Detection ──────────────────────────────────────────────────────

  /**
   * Detect a single leading folder prefix shared by Discord warrant entries.
   * Returns the prefix INCLUDING a trailing slash (e.g. "package/"), or "" if
   * the Discord layout is already at the root.
   */
  private static _detectRootPrefix(entryNames: string[]): string {
    const markers = ['Account/user.json', 'Messages/index.json', 'README.txt'];
    const norm = entryNames.map(n => n.replace(/\\/g, '/'));
    for (const m of markers) {
      if (norm.includes(m)) return '';
    }
    for (const n of norm) {
      for (const m of markers) {
        if (n.endsWith('/' + m)) {
          const prefix = n.slice(0, n.length - m.length);
          if (prefix && (prefix.match(/\//g) || []).length === 1) return prefix;
        }
      }
    }
    return '';
  }

  static isDiscordWarrantZip(zipBufferOrPath: Buffer | string): boolean {
    try {
      const zip = new AdmZip(zipBufferOrPath as any);
      const entries = zip.getEntries();
      const names: string[] = [];
      let readme: string | null = null;
      for (const e of entries) {
        const n = e.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
        names.push(n);
        if (!readme && /(^|\/)README\.txt$/i.test(n)) {
          try { readme = zip.readAsText(e).slice(0, 800); } catch { /* ignore */ }
        }
      }
      if (readme && /Discord Data Package/i.test(readme)) return true;
      const prefix = DiscordWarrantParser._detectRootPrefix(names);
      const has = (rel: string) => names.includes(prefix + rel);
      if (has('Account/user.json') && has('Messages/index.json')) return true;
      if (has('Account/user.json')) {
        for (const n of names) {
          if (n.startsWith(prefix + 'Activity/')) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  static isDiscordWarrantFolder(folderPath: string): boolean {
    try {
      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return false;

      const checkRoot = (root: string): boolean => {
        const readmePath = path.join(root, 'README.txt');
        if (fs.existsSync(readmePath)) {
          try {
            const head = fs.readFileSync(readmePath, 'utf8').slice(0, 800);
            if (/Discord Data Package/i.test(head)) return true;
          } catch { /* ignore */ }
        }
        const userJson = path.join(root, 'Account', 'user.json');
        const messagesIndex = path.join(root, 'Messages', 'index.json');
        if (fs.existsSync(userJson) && fs.existsSync(messagesIndex)) return true;
        if (fs.existsSync(userJson) && fs.existsSync(path.join(root, 'Activity'))) return true;
        return false;
      };

      if (checkRoot(folderPath)) return true;
      // Try one level deeper (e.g. unzipped package/ container)
      try {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });
        const dirs = items.filter(i => i.isDirectory());
        for (const d of dirs) {
          if (checkRoot(path.join(folderPath, d.name))) return true;
        }
      } catch { /* ignore */ }
      return false;
    } catch {
      return false;
    }
  }

  static isDiscordWarrantFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const st = fs.statSync(filePath);
      if (st.isDirectory()) return DiscordWarrantParser.isDiscordWarrantFolder(filePath);
      if (!/\.zip$/i.test(filePath)) return false;
      return DiscordWarrantParser.isDiscordWarrantZip(filePath);
    } catch {
      return false;
    }
  }

  // ─── Public Parse Entry Points ──────────────────────────────────────

  async parseZip(zipBufferOrPath: Buffer | string, options: DiscordParseOptions = {}): Promise<DiscordWarrantResult> {
    const zip = new AdmZip(zipBufferOrPath as any);
    const entries = zip.getEntries();
    const rawMap = new Map<string, any>();
    for (const e of entries) rawMap.set(e.entryName.replace(/\\/g, '/').replace(/^\/+/, ''), e);

    const prefix = DiscordWarrantParser._detectRootPrefix(Array.from(rawMap.keys()));
    const entryMap = new Map<string, any>();
    for (const [name, e] of rawMap) {
      const stripped = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name;
      if (stripped) entryMap.set(stripped, e);
    }

    return this._parseSources({
      entryNames: Array.from(entryMap.keys()),
      readText: (name) => {
        const e = entryMap.get(name);
        return e ? zip.readAsText(e) : null;
      },
      readBinary: (name) => {
        const e = entryMap.get(name);
        return e ? e.getData() : null;
      },
    }, options);
  }

  async parseFolder(folderPath: string, options: DiscordParseOptions = {}): Promise<DiscordWarrantResult> {
    const collect = (root: string): string[] => {
      const out: string[] = [];
      const walk = (dir: string, rel: string): void => {
        let items: fs.Dirent[];
        try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const it of items) {
          const full = path.join(dir, it.name);
          const r = rel ? rel + '/' + it.name : it.name;
          if (it.isFile()) out.push(r);
          else if (it.isDirectory()) walk(full, r);
        }
      };
      walk(root, '');
      return out;
    };

    let effectiveRoot = folderPath;
    let allFiles = collect(folderPath);
    const prefix = DiscordWarrantParser._detectRootPrefix(allFiles);
    if (prefix) {
      const trimmed = prefix.replace(/\/$/, '');
      effectiveRoot = path.join(folderPath, trimmed);
      allFiles = collect(effectiveRoot);
    }

    return this._parseSources({
      entryNames: allFiles,
      readText: (name) => {
        const fp = path.join(effectiveRoot, name);
        if (!fs.existsSync(fp)) return null;
        try { return fs.readFileSync(fp, 'utf8'); } catch { return null; }
      },
      readBinary: (name) => {
        const fp = path.join(effectiveRoot, name);
        if (!fs.existsSync(fp)) return null;
        try { return fs.readFileSync(fp); } catch { return null; }
      },
    }, options);
  }

  // ─── Core ────────────────────────────────────────────────────────────

  private async _parseSources(src: SourceAdapter, options: DiscordParseOptions): Promise<DiscordWarrantResult> {
    const { entryNames, readText, readBinary } = src;
    const { extractDir } = options || {};

    // 1) Subscriber
    const subscriber = this._parseUser(readText('Account/user.json'));

    // 2) Avatars (extract to disk if extractDir provided; otherwise record originalPath only)
    const contentFiles: Record<string, DiscordContentFile> = {};
    let avatarFile: DiscordWarrantResult['avatarFile'] = null;
    const recentAvatarFiles: DiscordWarrantResult['recentAvatarFiles'] = [];

    const recordContent = (originalName: string, buf: Buffer | null, kind: string): { diskPath?: string; mimeType: string; original: string; originalPath?: string } | null => {
      if (!buf) return null;
      const safeName = originalName.replace(/[\\/]/g, '_');
      const ext = path.extname(originalName).toLowerCase();
      const mimeType = this._mimeFromExt(ext);

      let diskPath: string | undefined;
      if (extractDir) {
        try { fs.mkdirSync(extractDir, { recursive: true }); } catch { /* ignore */ }
        const out = path.join(extractDir, safeName);
        try {
          fs.writeFileSync(out, buf);
          diskPath = out;
        } catch { /* ignore */ }
      }
      contentFiles[safeName] = {
        diskPath: diskPath || '',
        size: buf.length,
        mimeType,
        kind: kind || 'avatar',
        original: originalName,
        originalPath: originalName,
      };
      return { diskPath, mimeType, original: originalName, originalPath: originalName };
    };

    for (const n of entryNames) {
      const norm = n.replace(/\\/g, '/');
      if (norm === 'Account/avatar.jpeg' || norm === 'Account/avatar.png' || norm === 'Account/avatar.gif' || norm === 'Account/avatar.webp') {
        const buf = readBinary(n);
        const rec = recordContent(path.basename(norm), buf, 'avatar');
        if (rec) avatarFile = rec;
      } else if (norm.startsWith('Account/recent_avatars/')) {
        const buf = readBinary(n);
        const rec = recordContent('recent_' + path.basename(norm), buf, 'avatar');
        if (rec) recentAvatarFiles.push(rec);
      }
    }

    // 3) Messages
    const messagesIndex = (this._parseJson(readText('Messages/index.json')) as Record<string, string>) || {};
    const channelIds = new Set<string>();
    for (const n of entryNames) {
      const norm = n.replace(/\\/g, '/');
      const m = norm.match(/^Messages\/c(\d+)\/(channel|messages)\.json$/);
      if (m) channelIds.add(m[1]);
    }
    const channels: DiscordChannel[] = [];
    for (const cid of channelIds) {
      const channelMeta: any = this._parseJson(readText(`Messages/c${cid}/channel.json`)) || {};
      const msgs: any = this._parseJson(readText(`Messages/c${cid}/messages.json`)) || [];
      channels.push({
        channelId: channelMeta.id || cid,
        channelName: channelMeta.name || messagesIndex[cid] || `c${cid}`,
        channelType: channelMeta.type ?? null,
        guildId: channelMeta.guild?.id || null,
        guildName: channelMeta.guild?.name || null,
        indexLabel: messagesIndex[cid] || null,
        recipients: channelMeta.recipients || null,
        messageCount: Array.isArray(msgs) ? msgs.length : 0,
        messages: Array.isArray(msgs)
          ? msgs.map((m: any) => ({
              id: m.ID || m.id,
              timestamp: m.Timestamp || m.timestamp,
              contents: m.Contents || m.contents || '',
              attachments: m.Attachments || m.attachments || '',
            }))
          : [],
      });
    }

    // 4) Servers
    const serversIndex = (this._parseJson(readText('Servers/index.json')) as Record<string, string>) || {};
    const guildIds = new Set<string>();
    for (const n of entryNames) {
      const norm = n.replace(/\\/g, '/');
      const m = norm.match(/^Servers\/(\d+)\/(guild|audit-log)\.json$/);
      if (m) guildIds.add(m[1]);
    }
    const servers: DiscordServer[] = [];
    for (const gid of guildIds) {
      const guildMeta: any = this._parseJson(readText(`Servers/${gid}/guild.json`)) || {};
      const auditLog: any = this._parseJson(readText(`Servers/${gid}/audit-log.json`)) || [];
      servers.push({
        id: guildMeta.id || gid,
        name: guildMeta.name || serversIndex[gid] || `Server ${gid}`,
        auditLog: Array.isArray(auditLog) ? auditLog : [],
      });
    }

    // 5) Billing / DSAR / Promotions / Store / VirtualCurrency
    const billing = {
      billingProfile: this._readSectionRecords(readText, 'Account/user_data_exports/discord_billing/billing_profile.json'),
      paymentSources: this._readSectionRecords(readText, 'Account/user_data_exports/discord_billing/payment_sources.json'),
      payments: this._readSectionRecords(readText, 'Account/user_data_exports/discord_billing/payments.json'),
      entitlements: this._readSectionRecords(readText, 'Account/user_data_exports/discord_billing/entitlements.json'),
    };
    const dsar = this._readSectionRecords(readText, 'Account/user_data_exports/discord_harvests/data_subject_access_requests.json');
    const promotions = {
      quests: this._readSectionRecords(readText, 'Account/user_data_exports/discord_promotions/quests_reward_codes.json'),
      drops: this._readSectionRecords(readText, 'Account/user_data_exports/discord_promotions/drops_reward_codes.json'),
    };
    const store = {
      wishlist: this._readSectionRecords(readText, 'Account/user_data_exports/discord_store/wishlist_items.json'),
    };
    const virtualCurrency = {
      accounts: this._readSectionRecords(readText, 'Account/user_data_exports/discord_virtual_currency/coin_accounts.json'),
      transactions: this._readSectionRecords(readText, 'Account/user_data_exports/discord_virtual_currency/coin_transactions.json'),
    };

    // 6) Activity
    const activity = this._parseActivity(entryNames, readText);

    // 7) Aggregate IPs/devices
    const { ipActivity, devices } = this._aggregateIpAndDevices(subscriber, activity);

    const stats: DiscordStats = {
      messageCount: channels.reduce((s, c) => s + c.messageCount, 0),
      channelCount: channels.length,
      serverCount: servers.length,
      sessionCount: subscriber?.sessions?.length || 0,
      ipCount: ipActivity.length,
      deviceCount: devices.length,
      eventCount: activity.totalEventCount,
      mediaCount: Object.keys(contentFiles).length,
    };

    return {
      subscriber,
      avatarFile,
      recentAvatarFiles,
      channels,
      servers,
      billing,
      dsar,
      promotions,
      store,
      virtualCurrency,
      activity,
      ipActivity,
      devices,
      contentFiles,
      stats,
    };
  }

  // ─── Section parsers ────────────────────────────────────────────────

  private _readSectionRecords(readText: (n: string) => string | null, name: string): any[] {
    const txt = readText(name);
    if (!txt) return [];
    try {
      const obj = JSON.parse(txt);
      if (Array.isArray(obj)) return obj;
      if (obj && Array.isArray(obj.records)) return obj.records;
      return [];
    } catch {
      return [];
    }
  }

  private _parseJson(txt: string | null): any {
    if (!txt) return null;
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  private _parseUser(txt: string | null): DiscordSubscriber | null {
    const u = this._parseJson(txt);
    if (!u) return null;

    const sessions: DiscordSession[] = ((u.user_sessions as any[]) || []).map((s: any) => {
      const ud = s.user_data || s;
      return {
        ip: ud.client_info?.ip || null,
        os: ud.client_info?.os || null,
        platform: ud.client_info?.platform || null,
        creation_time: ud.creation_time || null,
        expiration_time: ud.expiration_time || null,
        last_used: ud.approx_last_used_time || null,
        is_mfa: !!ud.is_mfa,
        is_bot: !!ud.is_bot,
        binding_token: ud.extra_tokens?.binding_token?.binding_token || null,
        is_soft_deleted: !!s.is_soft_deleted,
      };
    });

    return {
      id: u.id || null,
      username: u.username || null,
      discriminator: u.discriminator,
      global_name: u.global_name || null,
      email: u.email || null,
      phone: u.phone || null,
      ip: u.ip || null,
      verified: !!u.verified,
      has_mobile: !!u.has_mobile,
      premium_until: u.premium_until || null,
      avatar_hash: u.avatar_hash || null,
      flags: u.flags || [],
      connections: u.connections || [],
      relationships: u.relationships || [],
      external_friends_lists: u.external_friends_lists || [],
      sessions,
      user_profile_metadata: u.user_profile_metadata || null,
      current_orbs_balance: u.current_orbs_balance || 0,
    };
  }

  private _parseActivity(entryNames: string[], readText: (n: string) => string | null): DiscordActivity {
    const sessionStarts: DiscordActivityEvent[] = [];
    const sessionEnds: DiscordActivityEvent[] = [];
    const appOpens: DiscordActivityEvent[] = [];
    const logins: DiscordActivityEvent[] = [];
    const registers: DiscordActivityEvent[] = [];
    const otherImportant: DiscordActivityEvent[] = [];
    const eventCounts: Record<string, number> = {};
    let totalEventCount = 0;

    const categories = ['analytics', 'tns', 'reporting', 'modeling'];
    const norm = (ts: any): string | null => {
      if (!ts) return null;
      const s = String(ts).replace(/^"+|"+$/g, '');
      return s === 'null' ? null : s;
    };

    for (const cat of categories) {
      for (const n of entryNames) {
        const en = n.replace(/\\/g, '/');
        if (!en.startsWith(`Activity/${cat}/`)) continue;
        if (!en.endsWith('.json')) continue;
        const txt = readText(n);
        if (!txt) continue;
        const lines = txt.split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          totalEventCount++;
          const t = ev.event_type || 'unknown';
          const k = `${cat}/${t}`;
          eventCounts[k] = (eventCounts[k] || 0) + 1;
          if (!IP_EVENT_TYPES.has(t)) continue;

          const row: DiscordActivityEvent = {
            category: cat,
            event_type: t,
            timestamp: norm(ev.timestamp),
            client_send_timestamp: norm(ev.client_send_timestamp),
            ip: ev.ip || null,
            city: ev.city || null,
            region_code: ev.region_code || null,
            country_code: ev.country_code || null,
            time_zone: ev.time_zone || null,
            isp: ev.isp || null,
            browser: ev.browser || null,
            browser_user_agent: ev.browser_user_agent || null,
            device: ev.device || null,
            device_vendor_id: ev.device_vendor_id || null,
            os: ev.os || null,
            os_version: ev.os_version || null,
            client_version: ev.client_version || null,
            session: ev.session || null,
            session_type: ev.session_type || null,
            opened_from: ev.opened_from || null,
            load_id: ev.load_id || null,
            user_id: ev.user_id || null,
            event_id: ev.event_id || null,
          };

          if (t === 'session_start_success') sessionStarts.push(row);
          else if (t === 'session_end') sessionEnds.push(row);
          else if (t === 'app_opened') appOpens.push(row);
          else if (String(t).startsWith('login')) logins.push(row);
          else if (String(t).startsWith('register')) registers.push(row);
          else otherImportant.push(row);
        }
      }
    }

    const sortDesc = (a: DiscordActivityEvent, b: DiscordActivityEvent): number => {
      const ta = Date.parse(a.timestamp || '') || 0;
      const tb = Date.parse(b.timestamp || '') || 0;
      return tb - ta;
    };
    sessionStarts.sort(sortDesc);
    sessionEnds.sort(sortDesc);
    appOpens.sort(sortDesc);
    logins.sort(sortDesc);
    registers.sort(sortDesc);
    otherImportant.sort(sortDesc);

    return {
      sessionStarts,
      sessionEnds,
      appOpens,
      logins,
      registers,
      otherImportant,
      eventCounts,
      totalEventCount,
    };
  }

  private _aggregateIpAndDevices(
    subscriber: DiscordSubscriber | null,
    activity: DiscordActivity
  ): { ipActivity: DiscordIpRow[]; devices: DiscordDeviceRow[] } {
    interface IpAccum {
      ip: string;
      count: number;
      firstSeen: string | null;
      firstSeenT: number;
      lastSeen: string | null;
      lastSeenT: number;
      locations: Set<string>;
      browsers: Set<string>;
      oses: Set<string>;
      devices: Set<string>;
      isps: Set<string>;
      sources: Set<string>;
    }
    interface DevAccum {
      key: string;
      device_vendor_id: string | null;
      device: string | null;
      os: string | null;
      os_version: string | null;
      browser: string | null;
      browser_user_agent: string | null;
      client_version: string | null;
      count: number;
      firstSeen: string | null;
      firstSeenT: number;
      lastSeen: string | null;
      lastSeenT: number;
      ips: Set<string>;
    }

    const ipMap = new Map<string, IpAccum>();
    const devMap = new Map<string, DevAccum>();

    const trackIp = (ip: string | null | undefined, ts: string | null | undefined, fields: any, source: string | null) => {
      if (!ip) return;
      const t = Date.parse(ts || '') || 0;
      let row = ipMap.get(ip);
      if (!row) {
        row = {
          ip,
          count: 0,
          firstSeen: null,
          firstSeenT: Number.POSITIVE_INFINITY,
          lastSeen: null,
          lastSeenT: 0,
          locations: new Set<string>(),
          browsers: new Set<string>(),
          oses: new Set<string>(),
          devices: new Set<string>(),
          isps: new Set<string>(),
          sources: new Set<string>(),
        };
        ipMap.set(ip, row);
      }
      row.count++;
      if (t && t < row.firstSeenT) {
        row.firstSeenT = t;
        row.firstSeen = ts || null;
      }
      if (t && t > row.lastSeenT) {
        row.lastSeenT = t;
        row.lastSeen = ts || null;
      }
      if (fields.city || fields.region_code || fields.country_code) {
        row.locations.add([fields.city, fields.region_code, fields.country_code].filter(Boolean).join(', '));
      }
      if (fields.browser) row.browsers.add(fields.browser);
      if (fields.os) row.oses.add(fields.os + (fields.os_version ? ` ${fields.os_version}` : ''));
      if (fields.device) row.devices.add(fields.device);
      if (fields.isp) row.isps.add(fields.isp);
      if (source) row.sources.add(source);
    };

    const trackDevice = (key: string | null | undefined, ts: string | null | undefined, fields: any) => {
      if (!key) return;
      const t = Date.parse(ts || '') || 0;
      let row = devMap.get(key);
      if (!row) {
        row = {
          key,
          device_vendor_id: fields.device_vendor_id || null,
          device: fields.device || null,
          os: fields.os || null,
          os_version: fields.os_version || null,
          browser: fields.browser || null,
          browser_user_agent: fields.browser_user_agent || null,
          client_version: fields.client_version || null,
          count: 0,
          firstSeen: null,
          firstSeenT: Number.POSITIVE_INFINITY,
          lastSeen: null,
          lastSeenT: 0,
          ips: new Set<string>(),
        };
        devMap.set(key, row);
      }
      row.count++;
      if (t && t < row.firstSeenT) {
        row.firstSeenT = t;
        row.firstSeen = ts || null;
      }
      if (t && t > row.lastSeenT) {
        row.lastSeenT = t;
        row.lastSeen = ts || null;
      }
      if (fields.ip) row.ips.add(fields.ip);
      for (const f of ['device_vendor_id', 'device', 'os', 'os_version', 'browser', 'browser_user_agent', 'client_version'] as (keyof DevAccum)[]) {
        if (!(row as any)[f] && (fields as any)[f]) (row as any)[f] = (fields as any)[f];
      }
    };

    // Subscriber sessions
    const subSessions = subscriber?.sessions || [];
    for (const s of subSessions) {
      trackIp(s.ip, s.last_used || s.creation_time, { os: s.os, browser: s.platform }, 'user_sessions');
      trackDevice(`${s.os || '?'}|${s.platform || '?'}`, s.last_used || s.creation_time, {
        ip: s.ip,
        os: s.os,
        browser: s.platform,
      });
    }
    if (subscriber?.ip) {
      trackIp(subscriber.ip, null, {}, 'account');
    }

    const allEvents = [
      ...(activity?.sessionStarts || []),
      ...(activity?.sessionEnds || []),
      ...(activity?.appOpens || []),
      ...(activity?.logins || []),
      ...(activity?.registers || []),
      ...(activity?.otherImportant || []),
    ];
    for (const ev of allEvents) {
      trackIp(ev.ip, ev.timestamp, ev, ev.event_type);
      const devKey =
        ev.device_vendor_id || (ev.device ? `${ev.device}|${ev.os}` : ev.browser ? `${ev.browser}|${ev.os}` : null);
      if (devKey) trackDevice(devKey, ev.timestamp, ev);
    }

    const ipActivity: DiscordIpRow[] = Array.from(ipMap.values())
      .map((r) => ({
        ip: r.ip,
        count: r.count,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        locations: Array.from(r.locations),
        browsers: Array.from(r.browsers),
        oses: Array.from(r.oses),
        devices: Array.from(r.devices),
        isps: Array.from(r.isps),
        sources: Array.from(r.sources),
      }))
      .sort((a, b) => b.count - a.count);

    const devices: DiscordDeviceRow[] = Array.from(devMap.values())
      .map((r) => ({
        key: r.key,
        device_vendor_id: r.device_vendor_id,
        device: r.device,
        os: r.os,
        os_version: r.os_version,
        browser: r.browser,
        browser_user_agent: r.browser_user_agent,
        client_version: r.client_version,
        count: r.count,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        ips: Array.from(r.ips),
      }))
      .sort((a, b) => b.count - a.count);

    return { ipActivity, devices };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private _mimeFromExt(ext: string): string {
    return MIME_MAP[(ext || '').toLowerCase()] || 'application/octet-stream';
  }
}
