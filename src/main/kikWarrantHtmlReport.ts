/**
 * Kik Warrant HTML Report Generator
 *
 * Produces a single self-contained HTML document of a Kik warrant return,
 * ready for DA review. Flagged-only mode contains only items the officer
 * flagged; full mode contains everything with flagged items highlighted.
 *
 * Media content files are embedded as base64 data URLs when flagged.
 */

import AdmZip from 'adm-zip';
import type {
  KikWarrantResult,
  KikBind,
  KikFriend,
  KikBlockedUser,
  KikChatRecord,
  KikChatMediaRecord,
  KikGroupRecord,
  KikGroupMediaRecord,
} from './kikWarrantParser';

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

export interface KikBuildReportArgs {
  caseNumber: string;
  caseId: number;
  officer?: string;
  importLabel: string;
  importedAt: string;
  generatedAt: string;
  record: KikWarrantResult;
  mediaIndex: Record<string, MediaIndexEntry>;
  /** Composite flag keys in the form `${section}|${flagKey}` */
  flagKeys: Set<string>;
  zip: AdmZip;
  mode: 'flagged-only' | 'full';
}

// ─── Stable flag-key generators (must match KikWarrantTab.FlagKey) ──────────

export const KikFlagKey = {
  bind:           (b: KikBind) => `${b.timestamp || ''}|${b.ip || ''}|${b.port || ''}`,
  friend:         (f: KikFriend) => `${f.timestamp || ''}|${f.friend || ''}`,
  blockedUser:    (b: KikBlockedUser) => `${b.timestamp || ''}|${b.blocked || ''}`,
  chatRecord:     (c: KikChatRecord) => `${c.timestamp || ''}|${c.sender || ''}|${c.recipient || ''}`,
  chatMedia:      (c: KikChatMediaRecord) => `${c.timestamp || ''}|${c.mediaUuid || ''}`,
  groupRecord:    (g: KikGroupRecord) => `${g.timestamp || ''}|${g.groupId || ''}|${g.sender || ''}|${g.recipient || ''}`,
  groupMedia:     (g: KikGroupMediaRecord) => `${g.timestamp || ''}|${g.groupId || ''}|${g.mediaUuid || ''}`,
  contentFile:    (filename: string) => filename,
};

// ─── Utilities ──────────────────────────────────────────────────────────────

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

function fmtMs(ts: number): string {
  if (!ts) return '';
  try { return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'); }
  catch { return String(ts); }
}

function readMediaAsDataUrl(
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
  fileName: string | null,
): string | null {
  if (!fileName) return null;
  const entry = mediaIndex[fileName];
  if (!entry) return null;
  try {
    const ze = zip.getEntry(entry.originalPath);
    if (ze) {
      const buf = ze.getData();
      return `data:${entry.mimeType};base64,${buf.toString('base64')}`;
    }
    // Try inner zips (nested structure)
    for (const candidate of zip.getEntries()) {
      if (candidate.isDirectory) continue;
      if (!candidate.entryName.toLowerCase().endsWith('.zip')) continue;
      try {
        const inner = new AdmZip(candidate.getData());
        const ie = inner.getEntry(entry.originalPath);
        if (ie) {
          const buf = ie.getData();
          return `data:${entry.mimeType};base64,${buf.toString('base64')}`;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return null;
}

// ─── Counts ─────────────────────────────────────────────────────────────────

interface SectionCounts {
  bindTotal: number; bindFlagged: number;
  friendTotal: number; friendFlagged: number;
  blockedTotal: number; blockedFlagged: number;
  dmTextSentTotal: number; dmTextSentFlagged: number;
  dmTextRecvTotal: number; dmTextRecvFlagged: number;
  dmMediaSentTotal: number; dmMediaSentFlagged: number;
  dmMediaRecvTotal: number; dmMediaRecvFlagged: number;
  groupTextSentTotal: number; groupTextSentFlagged: number;
  groupTextRecvTotal: number; groupTextRecvFlagged: number;
  groupMediaSentTotal: number; groupMediaSentFlagged: number;
  groupMediaRecvTotal: number; groupMediaRecvFlagged: number;
  contentTotal: number; contentFlagged: number;
}

function buildCounts(rec: KikWarrantResult, flags: Set<string>): SectionCounts {
  const c: SectionCounts = {
    bindTotal: 0, bindFlagged: 0,
    friendTotal: 0, friendFlagged: 0,
    blockedTotal: 0, blockedFlagged: 0,
    dmTextSentTotal: 0, dmTextSentFlagged: 0,
    dmTextRecvTotal: 0, dmTextRecvFlagged: 0,
    dmMediaSentTotal: 0, dmMediaSentFlagged: 0,
    dmMediaRecvTotal: 0, dmMediaRecvFlagged: 0,
    groupTextSentTotal: 0, groupTextSentFlagged: 0,
    groupTextRecvTotal: 0, groupTextRecvFlagged: 0,
    groupMediaSentTotal: 0, groupMediaSentFlagged: 0,
    groupMediaRecvTotal: 0, groupMediaRecvFlagged: 0,
    contentTotal: 0, contentFlagged: 0,
  };
  for (const b of (rec.binds || [])) {
    c.bindTotal++; if (isFlagged(flags, 'binds', KikFlagKey.bind(b))) c.bindFlagged++;
  }
  for (const f of (rec.friends || [])) {
    c.friendTotal++; if (isFlagged(flags, 'friends', KikFlagKey.friend(f))) c.friendFlagged++;
  }
  for (const b of (rec.blockedUsers || [])) {
    c.blockedTotal++; if (isFlagged(flags, 'blocked', KikFlagKey.blockedUser(b))) c.blockedFlagged++;
  }
  for (const r of (rec.chatSent || [])) {
    c.dmTextSentTotal++; if (isFlagged(flags, 'dmTextSent', KikFlagKey.chatRecord(r))) c.dmTextSentFlagged++;
  }
  for (const r of (rec.chatSentReceived || [])) {
    c.dmTextRecvTotal++; if (isFlagged(flags, 'dmTextReceived', KikFlagKey.chatRecord(r))) c.dmTextRecvFlagged++;
  }
  for (const r of (rec.chatPlatformSent || [])) {
    c.dmMediaSentTotal++; if (isFlagged(flags, 'dmMediaSent', KikFlagKey.chatMedia(r))) c.dmMediaSentFlagged++;
  }
  for (const r of (rec.chatPlatformSentReceived || [])) {
    c.dmMediaRecvTotal++; if (isFlagged(flags, 'dmMediaReceived', KikFlagKey.chatMedia(r))) c.dmMediaRecvFlagged++;
  }
  for (const r of (rec.groupSendMsg || [])) {
    c.groupTextSentTotal++; if (isFlagged(flags, 'groupTextSent', KikFlagKey.groupRecord(r))) c.groupTextSentFlagged++;
  }
  for (const r of (rec.groupReceiveMsg || [])) {
    c.groupTextRecvTotal++; if (isFlagged(flags, 'groupTextReceived', KikFlagKey.groupRecord(r))) c.groupTextRecvFlagged++;
  }
  for (const r of (rec.groupSendMsgPlatform || [])) {
    c.groupMediaSentTotal++; if (isFlagged(flags, 'groupMediaSent', KikFlagKey.groupMedia(r))) c.groupMediaSentFlagged++;
  }
  for (const r of (rec.groupReceiveMsgPlatform || [])) {
    c.groupMediaRecvTotal++; if (isFlagged(flags, 'groupMediaReceived', KikFlagKey.groupMedia(r))) c.groupMediaRecvFlagged++;
  }
  for (const fn of Object.keys(rec.contentFiles || {})) {
    c.contentTotal++; if (isFlagged(flags, 'content', KikFlagKey.contentFile(fn))) c.contentFlagged++;
  }
  return c;
}

// ─── Header ─────────────────────────────────────────────────────────────────

function buildHeader(args: KikBuildReportArgs, counts: SectionCounts): string {
  const rec = args.record;
  const total = args.flagKeys.size;
  const dr = rec.stats?.dateRange;
  return `
<header class="kwr-header">
  <div class="kwr-header-top">
    <div>
      <div class="kwr-brand-title">ICAC P.U.L.S.E. — Kik Warrant Return</div>
      <div class="kwr-brand-sub">${esc(args.mode === 'flagged-only' ? 'Flagged-Items Bundle (DA Review)' : 'Full Production Bundle')}</div>
    </div>
    <div class="kwr-stamp">
      <div>Case <strong>${esc(args.caseNumber)}</strong></div>
      <div>Generated <strong>${esc(args.generatedAt)}</strong></div>
      ${args.officer ? `<div>Officer <strong>${esc(args.officer)}</strong></div>` : ''}
    </div>
  </div>

  <table class="kwr-meta">
    <tr><th>Account Username</th><td>${esc(rec.accountUsername || '—')}</td>
        <th>Kik Case #</th><td>${esc(rec.caseNumber || '—')}</td></tr>
    <tr><th>Date Range</th>
        <td colspan="3">${esc(dr?.start || '—')} → ${esc(dr?.end || '—')}</td></tr>
    <tr><th>Production File</th>
        <td colspan="3">${esc(args.importLabel)} <span class="kwr-faint">(imported ${esc(args.importedAt)})</span></td></tr>
    <tr><th>Totals</th>
        <td colspan="3">${esc(rec.stats?.totalRecords ?? 0)} records · ${esc(rec.stats?.uniqueContacts ?? 0)} DM contacts · ${esc(rec.stats?.uniqueGroups ?? 0)} groups · ${esc(rec.stats?.uniqueIps ?? 0)} IPs · ${esc(rec.stats?.counts?.contentFiles ?? 0)} media</td></tr>
  </table>

  <div class="kwr-summary">
    <div class="kwr-summary-title">Bundle Summary</div>
    <table class="kwr-summary-table">
      <thead><tr><th>Section</th><th>Total</th><th>Flagged</th></tr></thead>
      <tbody>
        <tr><td>IP / Bind Events</td>     <td>${counts.bindTotal}</td>           <td>${counts.bindFlagged}</td></tr>
        <tr><td>Friends Added</td>        <td>${counts.friendTotal}</td>         <td>${counts.friendFlagged}</td></tr>
        <tr><td>Blocked Users</td>        <td>${counts.blockedTotal}</td>        <td>${counts.blockedFlagged}</td></tr>
        <tr><td>DM Text (Sent)</td>       <td>${counts.dmTextSentTotal}</td>     <td>${counts.dmTextSentFlagged}</td></tr>
        <tr><td>DM Text (Received)</td>   <td>${counts.dmTextRecvTotal}</td>     <td>${counts.dmTextRecvFlagged}</td></tr>
        <tr><td>DM Media (Sent)</td>      <td>${counts.dmMediaSentTotal}</td>    <td>${counts.dmMediaSentFlagged}</td></tr>
        <tr><td>DM Media (Received)</td>  <td>${counts.dmMediaRecvTotal}</td>    <td>${counts.dmMediaRecvFlagged}</td></tr>
        <tr><td>Group Text (Sent)</td>    <td>${counts.groupTextSentTotal}</td>  <td>${counts.groupTextSentFlagged}</td></tr>
        <tr><td>Group Text (Received)</td><td>${counts.groupTextRecvTotal}</td>  <td>${counts.groupTextRecvFlagged}</td></tr>
        <tr><td>Group Media (Sent)</td>   <td>${counts.groupMediaSentTotal}</td> <td>${counts.groupMediaSentFlagged}</td></tr>
        <tr><td>Group Media (Recv)</td>   <td>${counts.groupMediaRecvTotal}</td> <td>${counts.groupMediaRecvFlagged}</td></tr>
        <tr><td>Content Files (Media)</td><td>${counts.contentTotal}</td>        <td>${counts.contentFlagged}</td></tr>
        <tr class="kwr-summary-total"><td>TOTAL FLAGS</td><td colspan="2">${total}</td></tr>
      </tbody>
    </table>
  </div>
</header>`;
}

// ─── Section builders ───────────────────────────────────────────────────────

function buildBinds(rec: KikWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.binds || [];
  if (items.length === 0) return '';
  const rows = items.filter(b => mode === 'full' || isFlagged(flags, 'binds', KikFlagKey.bind(b)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">🌐 IP / Bind Events (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>Username</th><th>IP</th><th>Port</th><th>Country</th></tr></thead>
    <tbody>
      ${rows.map(b => {
        const flagged = isFlagged(flags, 'binds', KikFlagKey.bind(b));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(b.timestamp))}</td>
          <td class="kwr-mono">${esc(b.datetime)}</td>
          <td>${esc(b.username)}</td>
          <td class="kwr-mono">${esc(b.ip)}</td>
          <td>${esc(b.port)}</td>
          <td>${esc(b.country)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildFriends(rec: KikWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.friends || [];
  if (items.length === 0) return '';
  const rows = items.filter(f => mode === 'full' || isFlagged(flags, 'friends', KikFlagKey.friend(f)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">👥 Friends Added (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>User</th><th>Friend</th></tr></thead>
    <tbody>
      ${rows.map(f => {
        const flagged = isFlagged(flags, 'friends', KikFlagKey.friend(f));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(f.timestamp))}</td>
          <td class="kwr-mono">${esc(f.datetime)}</td>
          <td>${esc(f.user)}</td>
          <td>${esc(f.friend)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildBlocked(rec: KikWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.blockedUsers || [];
  if (items.length === 0) return '';
  const rows = items.filter(b => mode === 'full' || isFlagged(flags, 'blocked', KikFlagKey.blockedUser(b)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">🚫 Blocked Users (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>User</th><th>Blocked</th></tr></thead>
    <tbody>
      ${rows.map(b => {
        const flagged = isFlagged(flags, 'blocked', KikFlagKey.blockedUser(b));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(b.timestamp))}</td>
          <td class="kwr-mono">${esc(b.datetime)}</td>
          <td>${esc(b.user)}</td>
          <td>${esc(b.blocked)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildChatTextSection(
  title: string,
  items: KikChatRecord[],
  section: string,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
): string {
  if (items.length === 0) return '';
  const rows = items.filter(r => mode === 'full' || isFlagged(flags, section, KikFlagKey.chatRecord(r)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">${esc(title)} (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>Sender</th><th>Recipient</th><th>Msg Count</th><th>IP</th></tr></thead>
    <tbody>
      ${rows.map(r => {
        const flagged = isFlagged(flags, section, KikFlagKey.chatRecord(r));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(r.timestamp))}</td>
          <td class="kwr-mono">${esc(r.datetime)}</td>
          <td>${esc(r.sender)}</td>
          <td>${esc(r.recipient)}</td>
          <td>${esc(r.msgCount)}</td>
          <td class="kwr-mono">${esc(r.ip)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildChatMediaSection(
  title: string,
  items: KikChatMediaRecord[],
  section: string,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
): string {
  if (items.length === 0) return '';
  const rows = items.filter(r => mode === 'full' || isFlagged(flags, section, KikFlagKey.chatMedia(r)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">${esc(title)} (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>Sender</th><th>Recipient</th><th>Media Type</th><th>Media UUID</th><th>IP</th></tr></thead>
    <tbody>
      ${rows.map(r => {
        const flagged = isFlagged(flags, section, KikFlagKey.chatMedia(r));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(r.timestamp))}</td>
          <td class="kwr-mono">${esc(r.datetime)}</td>
          <td>${esc(r.sender)}</td>
          <td>${esc(r.recipient)}</td>
          <td>${esc(r.mediaType)}</td>
          <td class="kwr-mono">${esc(truncate(r.mediaUuid, 50))}</td>
          <td class="kwr-mono">${esc(r.ip)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildGroupTextSection(
  title: string,
  items: KikGroupRecord[],
  section: string,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
): string {
  if (items.length === 0) return '';
  const rows = items.filter(r => mode === 'full' || isFlagged(flags, section, KikFlagKey.groupRecord(r)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">${esc(title)} (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>Sender</th><th>Group</th><th>Recipient</th><th>Msg Count</th><th>IP</th></tr></thead>
    <tbody>
      ${rows.map(r => {
        const flagged = isFlagged(flags, section, KikFlagKey.groupRecord(r));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(r.timestamp))}</td>
          <td class="kwr-mono">${esc(r.datetime)}</td>
          <td>${esc(r.sender)}</td>
          <td class="kwr-mono">${esc(truncate(r.groupId, 40))}</td>
          <td>${esc(r.recipient)}</td>
          <td>${esc(r.msgCount)}</td>
          <td class="kwr-mono">${esc(r.ip)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildGroupMediaSection(
  title: string,
  items: KikGroupMediaRecord[],
  section: string,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
): string {
  if (items.length === 0) return '';
  const rows = items.filter(r => mode === 'full' || isFlagged(flags, section, KikFlagKey.groupMedia(r)));
  if (rows.length === 0) return '';
  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">${esc(title)} (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="kwr-table">
    <thead><tr><th>Timestamp</th><th>Datetime</th><th>Sender</th><th>Group</th><th>Recipient</th><th>Media Type</th><th>Media UUID</th><th>IP</th></tr></thead>
    <tbody>
      ${rows.map(r => {
        const flagged = isFlagged(flags, section, KikFlagKey.groupMedia(r));
        return `<tr class="${flagged ? 'kwr-row-flagged' : ''}">
          <td class="kwr-mono">${esc(fmtMs(r.timestamp))}</td>
          <td class="kwr-mono">${esc(r.datetime)}</td>
          <td>${esc(r.sender)}</td>
          <td class="kwr-mono">${esc(truncate(r.groupId, 40))}</td>
          <td>${esc(r.recipient)}</td>
          <td>${esc(r.mediaType)}</td>
          <td class="kwr-mono">${esc(truncate(r.mediaUuid, 50))}</td>
          <td class="kwr-mono">${esc(r.ip)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildContentFiles(
  rec: KikWarrantResult,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
): string {
  const files = Object.entries(rec.contentFiles || {});
  if (files.length === 0) return '';
  const rows = files.filter(([fn]) => mode === 'full' || isFlagged(flags, 'content', KikFlagKey.contentFile(fn)));
  if (rows.length === 0) return '';

  // Cap full-mode embeds at 300 to keep file size sane
  const maxEmbed = mode === 'full' ? 300 : rows.length;
  const display = rows.slice(0, maxEmbed);
  const overflow = rows.length - display.length;

  return `
<section class="kwr-section">
  <h2 class="kwr-section-title">📎 Content / Media Files (${rows.length}${mode === 'full' ? '' : ' flagged'})${overflow > 0 ? ` <span class="kwr-faint">— first ${display.length}</span>` : ''}</h2>
  <div class="kwr-photo-grid">
    ${display.map(([fn, info]) => {
      const flagged = isFlagged(flags, 'content', KikFlagKey.contentFile(fn));
      const isImage = (info.mimeType || '').startsWith('image/');
      // Only embed flagged items or images (videos can blow up file size)
      const shouldEmbed = flagged || isImage;
      const dataUrl = shouldEmbed ? readMediaAsDataUrl(zip, mediaIndex, fn) : null;
      return `
      <div class="kwr-photo ${flagged ? 'kwr-flagged' : ''}">
        ${flagged ? '<span class="kwr-photo-badge">FLAGGED</span>' : ''}
        ${dataUrl
          ? (isImage
            ? `<img src="${dataUrl}" alt="${esc(fn)}">`
            : `<div class="kwr-photo-placeholder">▶️</div>`)
          : `<div class="kwr-photo-placeholder">${isImage ? '🖼️' : '📄'}</div>`}
        <div class="kwr-photo-meta">
          <div class="kwr-photo-title">${esc(truncate(fn, 40))}</div>
          <div class="kwr-faint">${esc(info.mimeType || '')} · ${esc(info.size != null ? `${(info.size / 1024).toFixed(1)} KB` : '')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>
  ${overflow > 0 ? `<div class="kwr-faint" style="margin-top:8px;">… and ${overflow} more file(s) omitted from this bundle.</div>` : ''}
</section>`;
}

// ─── CSS ────────────────────────────────────────────────────────────────────

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
.kwr-doc { max-width: 1100px; margin: 0 auto; background: #ffffff; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

.kwr-header { border-bottom: 2px solid #be123c; padding-bottom: 16px; margin-bottom: 24px; }
.kwr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.kwr-brand-title { font-size: 18px; font-weight: 700; color: #881337; }
.kwr-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.kwr-stamp { text-align: right; font-size: 12px; color: #374151; }
.kwr-stamp div { margin-bottom: 2px; }

.kwr-meta { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.kwr-meta th { text-align: left; padding: 4px 8px; width: 130px; color: #6b7280; font-weight: 600; background: #f9fafb; border: 1px solid #e5e7eb; }
.kwr-meta td { padding: 4px 8px; border: 1px solid #e5e7eb; }

.kwr-summary { margin-top: 16px; }
.kwr-summary-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.kwr-summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.kwr-summary-table th { background: #be123c; color: white; padding: 6px 8px; text-align: left; }
.kwr-summary-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.kwr-summary-total td { font-weight: 700; color: #881337; background: #fff1f2; }

.kwr-section { margin: 28px 0; }
.kwr-section-title { font-size: 16px; font-weight: 700; color: #881337; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
.kwr-card { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px; }

.kwr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.kwr-table th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
.kwr-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.kwr-row-flagged { background: #fef3c7 !important; }

.kwr-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.kwr-photo { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: white; position: relative; }
.kwr-photo.kwr-flagged { border-color: #d97706; box-shadow: 0 0 0 2px #fde68a; }
.kwr-photo img { width: 100%; height: 180px; object-fit: cover; display: block; }
.kwr-photo-placeholder { width: 100%; height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 24px; }
.kwr-photo-meta { padding: 8px; font-size: 11px; }
.kwr-photo-title { font-weight: 600; color: #374151; margin-bottom: 2px; font-size: 12px; }
.kwr-photo-badge { position: absolute; top: 6px; right: 6px; background: #d97706; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; font-weight: 700; z-index: 2; }

.kwr-faint { color: #9ca3af; font-size: 11px; }
.kwr-mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; }

@media print {
  body { background: white; padding: 0; }
  .kwr-doc { box-shadow: none; padding: 0; max-width: none; }
  .kwr-section { page-break-inside: avoid; }
  .kwr-photo { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

// ─── Public entry ──────────────────────────────────────────────────────────

export function buildKikWarrantReport(args: KikBuildReportArgs): string {
  const rec = args.record;
  if (!rec) {
    return `<!DOCTYPE html><html><body><h1>Empty Kik Warrant Bundle</h1><p>No record found in import.</p></body></html>`;
  }

  const counts = buildCounts(rec, args.flagKeys);
  const sections: string[] = [];
  sections.push(buildHeader(args, counts));

  sections.push(buildBinds(rec, args.flagKeys, args.mode));
  sections.push(buildFriends(rec, args.flagKeys, args.mode));
  sections.push(buildBlocked(rec, args.flagKeys, args.mode));
  sections.push(buildChatTextSection('💬 DM Text — Sent', rec.chatSent, 'dmTextSent', args.flagKeys, args.mode));
  sections.push(buildChatTextSection('💬 DM Text — Received', rec.chatSentReceived, 'dmTextReceived', args.flagKeys, args.mode));
  sections.push(buildChatMediaSection('🖼️ DM Media — Sent', rec.chatPlatformSent, 'dmMediaSent', args.flagKeys, args.mode));
  sections.push(buildChatMediaSection('🖼️ DM Media — Received', rec.chatPlatformSentReceived, 'dmMediaReceived', args.flagKeys, args.mode));
  sections.push(buildGroupTextSection('👥 Group Text — Sent', rec.groupSendMsg, 'groupTextSent', args.flagKeys, args.mode));
  sections.push(buildGroupTextSection('👥 Group Text — Received', rec.groupReceiveMsg, 'groupTextReceived', args.flagKeys, args.mode));
  sections.push(buildGroupMediaSection('🖼️ Group Media — Sent', rec.groupSendMsgPlatform, 'groupMediaSent', args.flagKeys, args.mode));
  sections.push(buildGroupMediaSection('🖼️ Group Media — Received', rec.groupReceiveMsgPlatform, 'groupMediaReceived', args.flagKeys, args.mode));
  sections.push(buildContentFiles(rec, args.flagKeys, args.mode, args.zip, args.mediaIndex));

  const footer = `
<footer class="kwr-footer">
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
  <div class="kwr-faint" style="text-align: center; padding-top: 12px;">
    Generated by ICAC P.U.L.S.E. — Kik Warrant Bundle (${esc(args.mode)})<br>
    Case ${esc(args.caseNumber)} · ${esc(args.generatedAt)}
  </div>
</footer>`;
  sections.push(footer);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Kik Warrant Bundle — Case ${esc(args.caseNumber)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="kwr-doc">
${sections.filter(s => !!s).join('\n')}
</div>
</body>
</html>`;
}

export default buildKikWarrantReport;
