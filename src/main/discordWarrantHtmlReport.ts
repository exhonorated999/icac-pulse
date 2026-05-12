/**
 * Discord Warrant HTML Report Generator
 *
 * Produces a single self-contained HTML document of a Discord Data Package
 * warrant return, ready for DA review.  Flagged-only mode contains only
 * items the officer flagged; full mode contains everything with flagged
 * items highlighted.
 */

import type {
  DiscordWarrantResult,
  DiscordMessage,
  DiscordChannel,
  DiscordServer,
  DiscordIpRow,
  DiscordDeviceRow,
  DiscordActivityEvent,
} from './discordWarrantParser';

export interface DiscordBuildReportArgs {
  caseNumber: string;
  caseId: number;
  officer?: string;
  importLabel: string;
  importedAt: string;
  generatedAt: string;
  record: DiscordWarrantResult;
  /** Composite flag keys in the form `${section}|${flagKey}` */
  flagKeys: Set<string>;
  mode: 'flagged-only' | 'full';
}

// ─── Stable flag-key generators (MUST MATCH DiscordWarrantTab.FlagKey) ────

export const DiscordFlagKey = {
  message:    (m: DiscordMessage) => String(m.id || ''),
  server:     (s: DiscordServer) => String(s.id || ''),
  ip:         (r: DiscordIpRow) => String(r.ip || ''),
  device:     (r: DiscordDeviceRow) => String(r.device_vendor_id || r.key || ''),
  activity:   (ev: DiscordActivityEvent) =>
    `${ev.timestamp || ''}|${ev.event_type || ''}|${ev.ip || ''}|${ev.session || ''}`,
};

// ─── Utilities ────────────────────────────────────────────────────────────

function esc(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s: string, max = 600): string {
  if (!s) return '';
  return s.length > max ? s.substring(0, max) + '…' : s;
}

function isFlagged(flags: Set<string>, section: string, key: string): boolean {
  return flags.has(`${section}|${key}`);
}

function fmtList(arr: any[] | undefined | null, sep = ', '): string {
  if (!arr || !arr.length) return '';
  return arr.filter((x) => x != null && x !== '').join(sep);
}

// ─── Counts ───────────────────────────────────────────────────────────────

interface SectionCounts {
  messageTotal: number; messageFlagged: number;
  serverTotal: number; serverFlagged: number;
  ipTotal: number; ipFlagged: number;
  deviceTotal: number; deviceFlagged: number;
  activityTotal: number; activityFlagged: number;
}

function allActivityEvents(rec: DiscordWarrantResult): DiscordActivityEvent[] {
  const a = rec.activity || ({} as any);
  return [
    ...(a.sessionStarts || []),
    ...(a.sessionEnds || []),
    ...(a.appOpens || []),
    ...(a.logins || []),
    ...(a.registers || []),
    ...(a.otherImportant || []),
  ];
}

function buildCounts(rec: DiscordWarrantResult, flags: Set<string>): SectionCounts {
  const c: SectionCounts = {
    messageTotal: 0, messageFlagged: 0,
    serverTotal: 0, serverFlagged: 0,
    ipTotal: 0, ipFlagged: 0,
    deviceTotal: 0, deviceFlagged: 0,
    activityTotal: 0, activityFlagged: 0,
  };
  for (const ch of (rec.channels || [])) {
    for (const m of (ch.messages || [])) {
      c.messageTotal++;
      if (isFlagged(flags, 'messages', DiscordFlagKey.message(m))) c.messageFlagged++;
    }
  }
  for (const s of (rec.servers || [])) {
    c.serverTotal++;
    if (isFlagged(flags, 'servers', DiscordFlagKey.server(s))) c.serverFlagged++;
  }
  for (const r of (rec.ipActivity || [])) {
    c.ipTotal++;
    if (isFlagged(flags, 'ips', DiscordFlagKey.ip(r))) c.ipFlagged++;
  }
  for (const r of (rec.devices || [])) {
    c.deviceTotal++;
    if (isFlagged(flags, 'devices', DiscordFlagKey.device(r))) c.deviceFlagged++;
  }
  for (const ev of allActivityEvents(rec)) {
    c.activityTotal++;
    if (isFlagged(flags, 'activity', DiscordFlagKey.activity(ev))) c.activityFlagged++;
  }
  return c;
}

// ─── Header ───────────────────────────────────────────────────────────────

function buildHeader(args: DiscordBuildReportArgs, counts: SectionCounts): string {
  const rec = args.record;
  const sub = rec.subscriber || ({} as any);
  const total = args.flagKeys.size;
  return `
<header class="dwr-header">
  <div class="dwr-header-top">
    <div>
      <div class="dwr-brand-title">ICAC P.U.L.S.E. — Discord Warrant Return</div>
      <div class="dwr-brand-sub">${esc(args.mode === 'flagged-only' ? 'Flagged-Items Bundle (DA Review)' : 'Full Production Bundle')}</div>
    </div>
    <div class="dwr-stamp">
      <div>Case <strong>${esc(args.caseNumber)}</strong></div>
      <div>Generated <strong>${esc(args.generatedAt)}</strong></div>
      ${args.officer ? `<div>Officer <strong>${esc(args.officer)}</strong></div>` : ''}
    </div>
  </div>

  <table class="dwr-meta">
    <tr><th>Target Account</th>
        <td>${esc(sub.username || '—')}${sub.discriminator ? `<span class="dwr-faint">#${esc(sub.discriminator)}</span>` : ''}${sub.global_name ? ` <span class="dwr-faint">(${esc(sub.global_name)})</span>` : ''}</td>
        <th>User ID</th><td class="dwr-mono">${esc(sub.id || '—')}</td></tr>
    <tr><th>Email</th><td>${esc(sub.email || '—')}</td>
        <th>Phone</th><td>${esc(sub.phone || '—')}</td></tr>
    <tr><th>Last Known IP</th><td class="dwr-mono">${esc(sub.ip || '—')}</td>
        <th>Verified</th><td>${sub.verified ? 'Yes' : 'No'}</td></tr>
    <tr><th>Production File</th>
        <td colspan="3">${esc(args.importLabel)} <span class="dwr-faint">(imported ${esc(args.importedAt)})</span></td></tr>
    <tr><th>Totals</th>
        <td colspan="3">${rec.stats?.channelCount ?? 0} channels · ${rec.stats?.messageCount ?? 0} messages · ${rec.stats?.serverCount ?? 0} servers · ${rec.stats?.ipCount ?? 0} IPs · ${rec.stats?.deviceCount ?? 0} devices · ${rec.stats?.eventCount ?? 0} activity events</td></tr>
  </table>

  <div class="dwr-summary">
    <div class="dwr-summary-title">Bundle Summary</div>
    <table class="dwr-summary-table">
      <thead><tr><th>Section</th><th>Total</th><th>Flagged</th></tr></thead>
      <tbody>
        <tr><td>Messages</td>    <td>${counts.messageTotal}</td>  <td>${counts.messageFlagged}</td></tr>
        <tr><td>Servers</td>     <td>${counts.serverTotal}</td>   <td>${counts.serverFlagged}</td></tr>
        <tr><td>IP Activity</td> <td>${counts.ipTotal}</td>       <td>${counts.ipFlagged}</td></tr>
        <tr><td>Devices</td>     <td>${counts.deviceTotal}</td>   <td>${counts.deviceFlagged}</td></tr>
        <tr><td>Activity Events</td><td>${counts.activityTotal}</td><td>${counts.activityFlagged}</td></tr>
        <tr class="dwr-summary-total"><td>TOTAL FLAGS</td><td colspan="2">${total}</td></tr>
      </tbody>
    </table>
  </div>
</header>`;
}

// ─── Subscriber Info ─────────────────────────────────────────────────────

function buildSubscriberInfo(rec: DiscordWarrantResult): string {
  const sub = rec.subscriber;
  if (!sub) return '';
  const sessions = sub.sessions || [];
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">👤 Subscriber Info</h2>
  <table class="dwr-table">
    <tbody>
      <tr><th style="width:200px;">Username</th><td>${esc(sub.username || '')}${sub.discriminator ? `#${esc(sub.discriminator)}` : ''}</td></tr>
      <tr><th>Global Name</th><td>${esc(sub.global_name || '')}</td></tr>
      <tr><th>User ID</th><td class="dwr-mono">${esc(sub.id || '')}</td></tr>
      <tr><th>Email</th><td>${esc(sub.email || '')}</td></tr>
      <tr><th>Phone</th><td>${esc(sub.phone || '')}</td></tr>
      <tr><th>Last Known IP</th><td class="dwr-mono">${esc(sub.ip || '')}</td></tr>
      <tr><th>Verified</th><td>${sub.verified ? 'Yes' : 'No'}</td></tr>
      <tr><th>Has Mobile</th><td>${sub.has_mobile ? 'Yes' : 'No'}</td></tr>
      <tr><th>Premium Until</th><td>${esc(sub.premium_until || '')}</td></tr>
      <tr><th>Avatar Hash</th><td class="dwr-mono">${esc(sub.avatar_hash || '')}</td></tr>
      <tr><th>Flags</th><td>${esc(fmtList(sub.flags))}</td></tr>
      <tr><th>Sessions</th><td>${sessions.length}</td></tr>
      <tr><th>Connections</th><td>${(sub.connections || []).length}</td></tr>
      <tr><th>Relationships</th><td>${(sub.relationships || []).length}</td></tr>
    </tbody>
  </table>
  ${sessions.length > 0 ? `
  <h3 class="dwr-subsection-title">User Sessions (${sessions.length})</h3>
  <table class="dwr-table">
    <thead><tr><th>IP</th><th>OS</th><th>Platform</th><th>Created</th><th>Last Used</th><th>Expires</th><th>MFA</th></tr></thead>
    <tbody>
      ${sessions.map((s) => `<tr>
        <td class="dwr-mono">${esc(s.ip || '')}</td>
        <td>${esc(s.os || '')}</td>
        <td>${esc(s.platform || '')}</td>
        <td>${esc(s.creation_time || '')}</td>
        <td>${esc(s.last_used || '')}</td>
        <td>${esc(s.expiration_time || '')}</td>
        <td>${s.is_mfa ? '✓' : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}
</section>`;
}

// ─── Messages ─────────────────────────────────────────────────────────────

function buildMessages(
  rec: DiscordWarrantResult,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
): string {
  const channels = rec.channels || [];
  if (channels.length === 0) return '';

  // Filter channels to those containing any visible message
  const channelBlocks: string[] = [];
  let visibleChannels = 0;
  let visibleMessages = 0;
  for (const ch of channels) {
    const msgs = ch.messages || [];
    const visible = msgs.filter((m) => mode === 'full' || isFlagged(flags, 'messages', DiscordFlagKey.message(m)));
    if (visible.length === 0) continue;
    visibleChannels++;
    visibleMessages += visible.length;
    const channelLabel = ch.guildName ? `${ch.guildName} · ${ch.channelName || ch.channelId}` : (ch.channelName || ch.channelId);
    channelBlocks.push(`
      <div class="dwr-channel-block">
        <h3 class="dwr-subsection-title">💬 ${esc(channelLabel)} <span class="dwr-faint">(${visible.length} msg${mode === 'full' ? '' : ' flagged'})</span></h3>
        <table class="dwr-table">
          <thead><tr><th style="width:70px;">Flag</th><th style="width:180px;">Time</th><th style="width:180px;">Msg ID</th><th>Contents</th><th>Attachments</th></tr></thead>
          <tbody>
            ${visible.map((m) => {
              const flagged = isFlagged(flags, 'messages', DiscordFlagKey.message(m));
              return `<tr class="${flagged ? 'dwr-row-flagged' : ''}">
                <td>${flagged ? '<span class="dwr-flag-tag">FLAG</span>' : ''}</td>
                <td>${esc(m.timestamp || '')}</td>
                <td class="dwr-mono">${esc(m.id || '')}</td>
                <td>${esc(truncate(String(m.contents || ''), 600))}</td>
                <td class="dwr-faint">${esc(truncate(String(m.attachments || ''), 200))}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`);
  }

  if (channelBlocks.length === 0) return '';
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">💬 Messages (${visibleMessages} across ${visibleChannels} channel${visibleChannels === 1 ? '' : 's'})</h2>
  ${channelBlocks.join('')}
</section>`;
}

// ─── Servers ──────────────────────────────────────────────────────────────

function buildServers(rec: DiscordWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.servers || [];
  if (items.length === 0) return '';
  const visible = items.filter((s) => mode === 'full' || isFlagged(flags, 'servers', DiscordFlagKey.server(s)));
  if (visible.length === 0) return '';
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">🏛️ Servers / Guilds (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  ${visible.map((s) => {
    const flagged = isFlagged(flags, 'servers', DiscordFlagKey.server(s));
    const auditCount = (s.auditLog || []).length;
    return `<div class="dwr-card${flagged ? ' dwr-card-flagged' : ''}">
      ${flagged ? '<span class="dwr-flag-tag">FLAGGED</span>' : ''}
      <table class="dwr-table">
        <tbody>
          <tr><th style="width:160px;">Server ID</th><td class="dwr-mono">${esc(s.id || '')}</td></tr>
          <tr><th>Name</th><td>${esc(s.name || '')}</td></tr>
          <tr><th>Audit Log Entries</th><td>${auditCount}</td></tr>
        </tbody>
      </table>
      ${auditCount > 0 ? `<pre class="dwr-pre">${esc(JSON.stringify(s.auditLog, null, 2).slice(0, 4000))}</pre>` : ''}
    </div>`;
  }).join('')}
</section>`;
}

// ─── IP Activity ──────────────────────────────────────────────────────────

function buildIpActivity(rec: DiscordWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.ipActivity || [];
  if (items.length === 0) return '';
  const visible = items.filter((r) => mode === 'full' || isFlagged(flags, 'ips', DiscordFlagKey.ip(r)));
  if (visible.length === 0) return '';
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">🌐 IP Activity (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="dwr-table">
    <thead><tr>
      <th>IP</th><th>Hits</th><th>Locations</th><th>ISP</th>
      <th>Browsers</th><th>OS</th><th>First Seen</th><th>Last Seen</th><th>Sources</th>
    </tr></thead>
    <tbody>
      ${visible.map((r) => {
        const flagged = isFlagged(flags, 'ips', DiscordFlagKey.ip(r));
        return `<tr class="${flagged ? 'dwr-row-flagged' : ''}">
          <td class="dwr-mono">${esc(r.ip)}</td>
          <td>${r.count}</td>
          <td>${esc(truncate(fmtList(r.locations, '; '), 200))}</td>
          <td>${esc(fmtList(r.isps))}</td>
          <td>${esc(fmtList(r.browsers))}</td>
          <td>${esc(fmtList(r.oses))}</td>
          <td>${esc(r.firstSeen || '')}</td>
          <td>${esc(r.lastSeen || '')}</td>
          <td class="dwr-faint">${esc(fmtList(r.sources))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

// ─── Devices ──────────────────────────────────────────────────────────────

function buildDevices(rec: DiscordWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.devices || [];
  if (items.length === 0) return '';
  const visible = items.filter((r) => mode === 'full' || isFlagged(flags, 'devices', DiscordFlagKey.device(r)));
  if (visible.length === 0) return '';
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">📱 Devices (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="dwr-table">
    <thead><tr>
      <th>Device Vendor ID</th><th>Device</th><th>OS</th><th>Browser</th>
      <th>Client Ver.</th><th>Hits</th><th>IPs</th><th>First Seen</th><th>Last Seen</th>
    </tr></thead>
    <tbody>
      ${visible.map((r) => {
        const flagged = isFlagged(flags, 'devices', DiscordFlagKey.device(r));
        return `<tr class="${flagged ? 'dwr-row-flagged' : ''}">
          <td class="dwr-mono">${esc(r.device_vendor_id || r.key)}</td>
          <td>${esc(r.device || '')}</td>
          <td>${esc([r.os, r.os_version].filter(Boolean).join(' '))}</td>
          <td>${esc(r.browser || '')}</td>
          <td class="dwr-mono">${esc(r.client_version || '')}</td>
          <td>${r.count}</td>
          <td class="dwr-mono">${esc(truncate(fmtList(r.ips), 160))}</td>
          <td>${esc(r.firstSeen || '')}</td>
          <td>${esc(r.lastSeen || '')}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

// ─── Activity Events ──────────────────────────────────────────────────────

function buildActivity(rec: DiscordWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const all = allActivityEvents(rec);
  if (all.length === 0) return '';
  const visible = all.filter((ev) => mode === 'full' || isFlagged(flags, 'activity', DiscordFlagKey.activity(ev)));
  if (visible.length === 0) return '';

  const MAX_ROWS = 1000;
  const overflow = Math.max(0, visible.length - MAX_ROWS);
  const rows = visible.slice(0, MAX_ROWS);

  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">📊 Activity Events (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="dwr-table">
    <thead><tr>
      <th>Time</th><th>Event</th><th>Cat</th><th>IP</th><th>Location</th>
      <th>Device/Browser</th><th>OS</th><th>Client Ver.</th><th>Session</th>
    </tr></thead>
    <tbody>
      ${rows.map((ev) => {
        const flagged = isFlagged(flags, 'activity', DiscordFlagKey.activity(ev));
        const loc = [ev.city, ev.region_code, ev.country_code].filter(Boolean).join(', ');
        return `<tr class="${flagged ? 'dwr-row-flagged' : ''}">
          <td>${esc(ev.timestamp || '')}</td>
          <td>${esc(ev.event_type || '')}</td>
          <td class="dwr-faint">${esc(ev.category || '')}</td>
          <td class="dwr-mono">${esc(ev.ip || '')}</td>
          <td>${esc(loc)}</td>
          <td>${esc(ev.device || ev.browser || '')}</td>
          <td>${esc([ev.os, ev.os_version].filter(Boolean).join(' '))}</td>
          <td class="dwr-mono">${esc(ev.client_version || '')}</td>
          <td class="dwr-mono">${esc(truncate(String(ev.session || ''), 24))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ${overflow > 0 ? `<div class="dwr-faint" style="margin-top:8px;">… and ${overflow} more event(s) omitted from this bundle.</div>` : ''}
</section>`;
}

// ─── Billing / DSAR / Promotions / Store ──────────────────────────────────

function buildBilling(rec: DiscordWarrantResult): string {
  const blocks: string[] = [];
  const sect = (title: string, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const keys = new Set<string>();
    for (const r of rows) if (r && typeof r === 'object') for (const k of Object.keys(r)) keys.add(k);
    const cols = Array.from(keys).slice(0, 10);
    blocks.push(`
      <h3 class="dwr-subsection-title">${esc(title)} <span class="dwr-faint">(${rows.length})</span></h3>
      <table class="dwr-table">
        <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.slice(0, 200).map((r) => `<tr>${cols.map((c) => `<td>${esc(truncate(String((r && r[c] != null) ? r[c] : ''), 200))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      ${rows.length > 200 ? `<div class="dwr-faint">… and ${rows.length - 200} more.</div>` : ''}`);
  };

  sect('Billing Profile', rec.billing?.billingProfile || []);
  sect('Payment Sources', rec.billing?.paymentSources || []);
  sect('Payments', rec.billing?.payments || []);
  sect('Entitlements', rec.billing?.entitlements || []);
  sect('DSAR Requests', rec.dsar || []);
  sect('Promotions — Quests', rec.promotions?.quests || []);
  sect('Promotions — Drops', rec.promotions?.drops || []);
  sect('Store Wishlist', rec.store?.wishlist || []);
  sect('Virtual Currency — Accounts', rec.virtualCurrency?.accounts || []);
  sect('Virtual Currency — Transactions', rec.virtualCurrency?.transactions || []);

  if (blocks.length === 0) return '';
  return `
<section class="dwr-section">
  <h2 class="dwr-section-title">💳 Billing & DSAR</h2>
  ${blocks.join('')}
</section>`;
}

// ─── CSS ──────────────────────────────────────────────────────────────────

const REPORT_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #1f2937;
  background: #f3f4f6;
  padding: 24px;
}
.dwr-doc { max-width: 1100px; margin: 0 auto; background: #ffffff; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

.dwr-header { border-bottom: 2px solid #5865F2; padding-bottom: 16px; margin-bottom: 24px; }
.dwr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.dwr-brand-title { font-size: 18px; font-weight: 700; color: #404EED; }
.dwr-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.dwr-stamp { text-align: right; font-size: 12px; color: #374151; }
.dwr-stamp div { margin-bottom: 2px; }

.dwr-meta { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.dwr-meta th { text-align: left; padding: 4px 8px; width: 130px; color: #6b7280; font-weight: 600; background: #f9fafb; border: 1px solid #e5e7eb; }
.dwr-meta td { padding: 4px 8px; border: 1px solid #e5e7eb; }

.dwr-summary { margin-top: 16px; }
.dwr-summary-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.dwr-summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dwr-summary-table th { background: #5865F2; color: white; padding: 6px 8px; text-align: left; }
.dwr-summary-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.dwr-summary-total td { font-weight: 700; color: #404EED; background: #eef0ff; }

.dwr-section { margin: 28px 0; }
.dwr-section-title { font-size: 16px; font-weight: 700; color: #404EED; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
.dwr-subsection-title { font-size: 13px; font-weight: 700; color: #4f46e5; margin: 18px 0 6px; }
.dwr-channel-block { margin-bottom: 18px; }

.dwr-card { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px; position: relative; }
.dwr-card-flagged { border-color: #5865F2; background: #eef0ff; }
.dwr-flag-tag { background: #5865F2; color: white; padding: 2px 8px; font-size: 10px; border-radius: 3px; font-weight: 700; }

.dwr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dwr-table th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
.dwr-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.dwr-row-flagged { background: #e0e7ff !important; }

.dwr-pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; overflow: auto; max-height: 400px; white-space: pre-wrap; word-break: break-word; }

.dwr-faint { color: #9ca3af; font-size: 11px; }
.dwr-mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; }

@media print {
  body { background: white; padding: 0; }
  .dwr-doc { box-shadow: none; padding: 0; max-width: none; }
  .dwr-section { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

// ─── Public Entry ─────────────────────────────────────────────────────────

export function buildDiscordWarrantReport(args: DiscordBuildReportArgs): string {
  const rec = args.record;
  if (!rec) {
    return `<!DOCTYPE html><html><body><h1>Empty Discord Warrant Bundle</h1><p>No record found in import.</p></body></html>`;
  }

  const counts = buildCounts(rec, args.flagKeys);
  const sections: string[] = [];
  sections.push(buildHeader(args, counts));
  sections.push(buildSubscriberInfo(rec));
  sections.push(buildMessages(rec, args.flagKeys, args.mode));
  sections.push(buildServers(rec, args.flagKeys, args.mode));
  sections.push(buildIpActivity(rec, args.flagKeys, args.mode));
  sections.push(buildDevices(rec, args.flagKeys, args.mode));
  sections.push(buildActivity(rec, args.flagKeys, args.mode));
  if (args.mode === 'full') {
    sections.push(buildBilling(rec));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Discord Warrant Return — Case ${esc(args.caseNumber)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
  <div class="dwr-doc">
    ${sections.filter(Boolean).join('\n')}
    <footer style="margin-top:40px;border-top:1px solid #e5e7eb;padding-top:14px;font-size:11px;color:#9ca3af;">
      Generated by ICAC P.U.L.S.E. — Discord Warrant module.
      Source: ${esc(args.importLabel)} · Mode: ${esc(args.mode)} · Flags: ${args.flagKeys.size}
    </footer>
  </div>
</body>
</html>`;
}
