/**
 * Snapchat Warrant HTML Report Generator
 *
 * Produces a single self-contained HTML document of a Snapchat warrant
 * return, ready for DA review. Flagged-only mode contains only items the
 * officer flagged; full mode contains everything with flagged items highlighted.
 *
 * Media files are embedded as base64 data URLs when flagged.
 */

import AdmZip from 'adm-zip';
import type {
  SnapWarrantResult,
  SnapConversationRow,
  SnapGeoLocation,
  SnapGenericRow,
  SnapHeaderInfo,
} from './snapWarrantParser';

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

export interface SnapBuildReportArgs {
  caseNumber: string;
  caseId: number;
  officer?: string;
  importLabel: string;
  importedAt: string;
  generatedAt: string;
  record: SnapWarrantResult;
  mediaIndex: Record<string, MediaIndexEntry>;
  /** Composite flag keys in the form `${section}|${flagKey}` */
  flagKeys: Set<string>;
  zip: AdmZip;
  mode: 'flagged-only' | 'full';
}

// ─── Stable flag-key generators (MUST MATCH SnapWarrantTab.FlagKey) ────────

export const SnapFlagKey = {
  conversation: (c: SnapConversationRow) =>
    `${c.conversation_id || ''}|${c.message_id || ''}|${c.timestamp || ''}|${c.sender_user_id || c.sender_username || ''}`,
  geo:          (g: SnapGeoLocation) => `${g.timestamp || ''}|${g.latitude ?? ''}|${g.longitude ?? ''}`,
  memory:       (r: SnapGenericRow) => `${r.timestamp || r['Date'] || r['date'] || ''}|${r.media_id || r['id'] || r['memory_id'] || ''}`,
  device:       (r: SnapGenericRow) => `${r.advertising_id || r['advertising id'] || r['device_id'] || r['device id'] || ''}|${r['os'] || r['device_type'] || ''}`,
  subscriber:   (r: SnapGenericRow, idx: number) => `subscriber|${idx}|${r.username || r.user_id || r['Username'] || ''}`,
  login:        (r: SnapGenericRow) => `${r.login_time || r['Login Time'] || r.timestamp || ''}|${r.ip || r['IP'] || ''}`,
  friend:       (r: SnapGenericRow) => `${r.username || r['Username'] || r['Friend Username'] || ''}|${r.user_id || r['User ID'] || ''}`,
  snapHistory:  (r: SnapGenericRow) => `${r.timestamp || r['Date'] || r['Created'] || ''}|${r.id || r.media_id || r['Snap ID'] || ''}|${r.sender || r.recipient || ''}`,
  mediaFile:    (filename: string) => filename,
};

// ─── Utilities ─────────────────────────────────────────────────────────────

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
  } catch { /* skip */ }
  return null;
}

// ─── Counts ────────────────────────────────────────────────────────────────

interface SectionCounts {
  subscriberTotal: number; subscriberFlagged: number;
  loginTotal: number; loginFlagged: number;
  friendTotal: number; friendFlagged: number;
  conversationTotal: number; conversationFlagged: number;
  geoTotal: number; geoFlagged: number;
  memoryTotal: number; memoryFlagged: number;
  deviceTotal: number; deviceFlagged: number;
  snapHistoryTotal: number; snapHistoryFlagged: number;
  mediaTotal: number; mediaFlagged: number;
}

function getSubscriberRows(rec: SnapWarrantResult): SnapGenericRow[] {
  const si = rec.subscriberInfo;
  if (!si) return [];
  return Array.isArray(si) ? si : [si];
}

function buildCounts(rec: SnapWarrantResult, flags: Set<string>): SectionCounts {
  const c: SectionCounts = {
    subscriberTotal: 0, subscriberFlagged: 0,
    loginTotal: 0, loginFlagged: 0,
    friendTotal: 0, friendFlagged: 0,
    conversationTotal: 0, conversationFlagged: 0,
    geoTotal: 0, geoFlagged: 0,
    memoryTotal: 0, memoryFlagged: 0,
    deviceTotal: 0, deviceFlagged: 0,
    snapHistoryTotal: 0, snapHistoryFlagged: 0,
    mediaTotal: 0, mediaFlagged: 0,
  };
  const subs = getSubscriberRows(rec);
  subs.forEach((r, i) => {
    c.subscriberTotal++;
    if (isFlagged(flags, 'subscriber', SnapFlagKey.subscriber(r, i))) c.subscriberFlagged++;
  });
  for (const r of (rec.loginHistory || [])) {
    c.loginTotal++;
    if (isFlagged(flags, 'login', SnapFlagKey.login(r))) c.loginFlagged++;
  }
  for (const r of (rec.friends || [])) {
    c.friendTotal++;
    if (isFlagged(flags, 'friends', SnapFlagKey.friend(r))) c.friendFlagged++;
  }
  for (const r of (rec.conversations || [])) {
    c.conversationTotal++;
    if (isFlagged(flags, 'conversations', SnapFlagKey.conversation(r))) c.conversationFlagged++;
  }
  for (const r of (rec.geoLocations || [])) {
    c.geoTotal++;
    if (isFlagged(flags, 'geo', SnapFlagKey.geo(r))) c.geoFlagged++;
  }
  for (const r of (rec.memories || [])) {
    c.memoryTotal++;
    if (isFlagged(flags, 'memories', SnapFlagKey.memory(r))) c.memoryFlagged++;
  }
  for (const r of (rec.deviceAdvertisingIds || [])) {
    c.deviceTotal++;
    if (isFlagged(flags, 'devices', SnapFlagKey.device(r))) c.deviceFlagged++;
  }
  for (const r of (rec.snapHistory || [])) {
    c.snapHistoryTotal++;
    if (isFlagged(flags, 'snapHistory', SnapFlagKey.snapHistory(r))) c.snapHistoryFlagged++;
  }
  for (const fn of Object.keys(rec.mediaFiles || {})) {
    c.mediaTotal++;
    if (isFlagged(flags, 'media', SnapFlagKey.mediaFile(fn))) c.mediaFlagged++;
  }
  return c;
}

// ─── Header ────────────────────────────────────────────────────────────────

function fmtHeaderInfo(h: SnapHeaderInfo | null): string {
  if (!h) return '—';
  const parts: string[] = [];
  if (h.targetUsername) parts.push(`<strong>${esc(h.targetUsername)}</strong>`);
  if (h.email) parts.push(esc(h.email));
  if (h.userId) parts.push(`<span class="swr-mono">${esc(h.userId)}</span>`);
  return parts.length ? parts.join(' · ') : '—';
}

function buildHeader(args: SnapBuildReportArgs, counts: SectionCounts): string {
  const rec = args.record;
  const total = args.flagKeys.size;
  return `
<header class="swr-header">
  <div class="swr-header-top">
    <div>
      <div class="swr-brand-title">ICAC P.U.L.S.E. — Snapchat Warrant Return</div>
      <div class="swr-brand-sub">${esc(args.mode === 'flagged-only' ? 'Flagged-Items Bundle (DA Review)' : 'Full Production Bundle')}</div>
    </div>
    <div class="swr-stamp">
      <div>Case <strong>${esc(args.caseNumber)}</strong></div>
      <div>Generated <strong>${esc(args.generatedAt)}</strong></div>
      ${args.officer ? `<div>Officer <strong>${esc(args.officer)}</strong></div>` : ''}
    </div>
  </div>

  <table class="swr-meta">
    <tr><th>Target Account</th><td colspan="3">${fmtHeaderInfo(rec.mergedHeader)}</td></tr>
    <tr><th>Date Range</th>
        <td colspan="3">${esc(rec.mergedHeader?.dateRange || '—')}</td></tr>
    <tr><th>Production File</th>
        <td colspan="3">${esc(args.importLabel)} <span class="swr-faint">(imported ${esc(args.importedAt)})</span></td></tr>
    <tr><th>Parts</th><td>${rec.stats?.partCount ?? 0}</td>
        <th>Media Files</th><td>${rec.stats?.mediaCount ?? 0}</td></tr>
    <tr><th>Totals</th>
        <td colspan="3">${rec.stats?.conversationCount ?? 0} conversations · ${rec.stats?.geoLocationCount ?? 0} geo points · ${rec.stats?.memoryCount ?? 0} memories</td></tr>
  </table>

  <div class="swr-summary">
    <div class="swr-summary-title">Bundle Summary</div>
    <table class="swr-summary-table">
      <thead><tr><th>Section</th><th>Total</th><th>Flagged</th></tr></thead>
      <tbody>
        <tr><td>Subscriber Info</td>      <td>${counts.subscriberTotal}</td>   <td>${counts.subscriberFlagged}</td></tr>
        <tr><td>Login History (IPs)</td>  <td>${counts.loginTotal}</td>        <td>${counts.loginFlagged}</td></tr>
        <tr><td>Friends</td>              <td>${counts.friendTotal}</td>       <td>${counts.friendFlagged}</td></tr>
        <tr><td>Conversations</td>        <td>${counts.conversationTotal}</td> <td>${counts.conversationFlagged}</td></tr>
        <tr><td>Geo Locations</td>        <td>${counts.geoTotal}</td>          <td>${counts.geoFlagged}</td></tr>
        <tr><td>Memories</td>             <td>${counts.memoryTotal}</td>       <td>${counts.memoryFlagged}</td></tr>
        <tr><td>Device Advertising IDs</td><td>${counts.deviceTotal}</td>      <td>${counts.deviceFlagged}</td></tr>
        <tr><td>Snap History</td>         <td>${counts.snapHistoryTotal}</td>  <td>${counts.snapHistoryFlagged}</td></tr>
        <tr><td>Media Files</td>          <td>${counts.mediaTotal}</td>        <td>${counts.mediaFlagged}</td></tr>
        <tr class="swr-summary-total"><td>TOTAL FLAGS</td><td colspan="2">${total}</td></tr>
      </tbody>
    </table>
  </div>
</header>`;
}

// ─── Generic key/value table for a single row ─────────────────────────────

function buildKvTable(row: SnapGenericRow): string {
  const keys = Object.keys(row);
  if (keys.length === 0) return '';
  return `
<table class="swr-table">
  <tbody>
    ${keys.map(k => `<tr><th style="width:200px;">${esc(k)}</th><td>${esc(truncate(String(row[k] ?? ''), 800))}</td></tr>`).join('')}
  </tbody>
</table>`;
}

// ─── Subscriber Info ──────────────────────────────────────────────────────

function buildSubscriberInfo(rec: SnapWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const subs = getSubscriberRows(rec);
  if (subs.length === 0) return '';
  const visible = subs.map((r, i) => ({ r, i }))
    .filter(({ r, i }) => mode === 'full' || isFlagged(flags, 'subscriber', SnapFlagKey.subscriber(r, i)));
  if (visible.length === 0) return '';
  return `
<section class="swr-section">
  <h2 class="swr-section-title">👤 Subscriber Info (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  ${visible.map(({ r, i }) => {
    const flagged = isFlagged(flags, 'subscriber', SnapFlagKey.subscriber(r, i));
    return `<div class="swr-card${flagged ? ' swr-card-flagged' : ''}">${flagged ? '<span class="swr-flag-tag">FLAGGED</span>' : ''}${buildKvTable(r)}</div>`;
  }).join('')}
</section>`;
}

// ─── Generic table section ────────────────────────────────────────────────

function buildGenericTableSection(
  title: string,
  rows: SnapGenericRow[],
  section: string,
  keyFn: (r: SnapGenericRow) => string,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  preferredCols?: string[],
): string {
  if (!rows || rows.length === 0) return '';
  const visible = rows.filter(r => mode === 'full' || isFlagged(flags, section, keyFn(r)));
  if (visible.length === 0) return '';

  // Resolve columns: preferred ones present in any row, then leftover keys (unique, capped)
  const presentCols = new Set<string>();
  for (const r of visible) for (const k of Object.keys(r)) presentCols.add(k);
  const cols: string[] = [];
  if (preferredCols) for (const c of preferredCols) if (presentCols.has(c)) cols.push(c);
  for (const c of presentCols) if (!cols.includes(c)) cols.push(c);
  const displayCols = cols.slice(0, 10);

  return `
<section class="swr-section">
  <h2 class="swr-section-title">${esc(title)} (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="swr-table">
    <thead><tr>${displayCols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${visible.map(r => {
        const flagged = isFlagged(flags, section, keyFn(r));
        return `<tr class="${flagged ? 'swr-row-flagged' : ''}">${displayCols.map(c => `<td>${esc(truncate(String(r[c] ?? ''), 400))}</td>`).join('')}</tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

// ─── Conversations (with media linkage) ───────────────────────────────────

function buildConversations(
  rec: SnapWarrantResult,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
): string {
  const items = rec.conversations || [];
  if (items.length === 0) return '';
  const visible = items.filter(c => mode === 'full' || isFlagged(flags, 'conversations', SnapFlagKey.conversation(c)));
  if (visible.length === 0) return '';

  const cols = ['timestamp', 'conversation_id', 'sender_username', 'recipients', 'content_type', 'message_type', 'message_id', 'media_id'];
  const presentCols = new Set<string>();
  for (const r of visible) for (const k of Object.keys(r)) presentCols.add(k);
  const displayCols = cols.filter(c => presentCols.has(c));

  return `
<section class="swr-section">
  <h2 class="swr-section-title">💬 Conversations (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="swr-table">
    <thead><tr>${displayCols.map(c => `<th>${esc(c)}</th>`).join('')}<th>Media</th></tr></thead>
    <tbody>
      ${visible.map(c => {
        const flagged = isFlagged(flags, 'conversations', SnapFlagKey.conversation(c));
        const fn = c._mediaFile || null;
        const isImage = fn && /\.(jpe?g|png|gif|webp)$/i.test(fn);
        const isVideo = fn && /\.(mp4|webm|mov)$/i.test(fn);
        let mediaCell = '';
        if (fn) {
          const shouldEmbed = mode === 'full' || flagged || isFlagged(flags, 'media', SnapFlagKey.mediaFile(fn));
          const dataUrl = shouldEmbed ? readMediaAsDataUrl(zip, mediaIndex, fn) : null;
          if (dataUrl && isImage) {
            mediaCell = `<img src="${dataUrl}" alt="${esc(fn)}" style="max-width:120px;max-height:80px;object-fit:cover;border-radius:3px;">`;
          } else if (isVideo) {
            mediaCell = `<span class="swr-faint">▶️ ${esc(truncate(fn, 30))}</span>`;
          } else {
            mediaCell = `<span class="swr-faint">${esc(truncate(fn, 30))}</span>`;
          }
        }
        return `<tr class="${flagged ? 'swr-row-flagged' : ''}">${displayCols.map(col => `<td>${esc(truncate(String(c[col] ?? ''), 200))}</td>`).join('')}<td>${mediaCell}</td></tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

// ─── Geo Locations ────────────────────────────────────────────────────────

function buildGeoLocations(rec: SnapWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.geoLocations || [];
  if (items.length === 0) return '';
  const visible = items.filter(g => mode === 'full' || isFlagged(flags, 'geo', SnapFlagKey.geo(g)));
  if (visible.length === 0) return '';
  return `
<section class="swr-section">
  <h2 class="swr-section-title">📍 Geo Locations (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="swr-table">
    <thead><tr><th>Timestamp</th><th>Latitude</th><th>Longitude</th><th>± (lat/lon)</th><th>Map</th></tr></thead>
    <tbody>
      ${visible.map(g => {
        const flagged = isFlagged(flags, 'geo', SnapFlagKey.geo(g));
        const mapUrl = g.latitude != null && g.longitude != null
          ? `https://www.google.com/maps?q=${g.latitude},${g.longitude}`
          : null;
        return `<tr class="${flagged ? 'swr-row-flagged' : ''}">
          <td>${esc(g.timestamp || '')}</td>
          <td class="swr-mono">${g.latitude ?? ''}</td>
          <td class="swr-mono">${g.longitude ?? ''}</td>
          <td class="swr-faint">${g.latitudeAccuracy != null ? `±${g.latitudeAccuracy}` : ''} / ${g.longitudeAccuracy != null ? `±${g.longitudeAccuracy}` : ''}</td>
          <td>${mapUrl ? `<a href="${esc(mapUrl)}" target="_blank">view</a>` : ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

// ─── Media Gallery ────────────────────────────────────────────────────────

function buildMediaGallery(
  rec: SnapWarrantResult,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
): string {
  const all = Object.entries(rec.mediaFiles || {});
  if (all.length === 0) return '';
  const visible = all.filter(([fn]) => mode === 'full' || isFlagged(flags, 'media', SnapFlagKey.mediaFile(fn)));
  if (visible.length === 0) return '';

  const MAX_EMBED = 200;
  const overflow = Math.max(0, visible.length - MAX_EMBED);
  const items = visible.slice(0, MAX_EMBED);

  return `
<section class="swr-section">
  <h2 class="swr-section-title">🖼️ Media Files (${visible.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <div class="swr-photo-grid">
    ${items.map(([fn, info]) => {
      const flagged = isFlagged(flags, 'media', SnapFlagKey.mediaFile(fn));
      const isImage = /^image\//.test(info.mimeType);
      const isVideo = /^video\//.test(info.mimeType);
      const dataUrl = isImage ? readMediaAsDataUrl(zip, mediaIndex, fn) : null;
      return `<div class="swr-photo${flagged ? ' swr-flagged' : ''}">
        ${flagged ? '<div class="swr-photo-badge">FLAG</div>' : ''}
        ${isImage
          ? (dataUrl ? `<img src="${dataUrl}" alt="${esc(fn)}">` : `<div class="swr-photo-placeholder">🖼️</div>`)
          : isVideo
            ? `<div class="swr-photo-placeholder">▶️</div>`
            : `<div class="swr-photo-placeholder">📄</div>`}
        <div class="swr-photo-meta">
          <div class="swr-photo-title">${esc(truncate(fn, 40))}</div>
          <div class="swr-faint">${esc(info.mimeType || '')} · ${esc(info.size != null ? `${(info.size / 1024).toFixed(1)} KB` : '')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>
  ${overflow > 0 ? `<div class="swr-faint" style="margin-top:8px;">… and ${overflow} more file(s) omitted from this bundle.</div>` : ''}
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
.swr-doc { max-width: 1100px; margin: 0 auto; background: #ffffff; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

.swr-header { border-bottom: 2px solid #ca8a04; padding-bottom: 16px; margin-bottom: 24px; }
.swr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.swr-brand-title { font-size: 18px; font-weight: 700; color: #854d0e; }
.swr-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.swr-stamp { text-align: right; font-size: 12px; color: #374151; }
.swr-stamp div { margin-bottom: 2px; }

.swr-meta { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.swr-meta th { text-align: left; padding: 4px 8px; width: 130px; color: #6b7280; font-weight: 600; background: #f9fafb; border: 1px solid #e5e7eb; }
.swr-meta td { padding: 4px 8px; border: 1px solid #e5e7eb; }

.swr-summary { margin-top: 16px; }
.swr-summary-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.swr-summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.swr-summary-table th { background: #ca8a04; color: white; padding: 6px 8px; text-align: left; }
.swr-summary-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.swr-summary-total td { font-weight: 700; color: #854d0e; background: #fefce8; }

.swr-section { margin: 28px 0; }
.swr-section-title { font-size: 16px; font-weight: 700; color: #854d0e; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
.swr-card { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px; position: relative; }
.swr-card-flagged { border-color: #ca8a04; background: #fefce8; }
.swr-flag-tag { position: absolute; top: 8px; right: 10px; background: #ca8a04; color: white; padding: 2px 8px; font-size: 10px; border-radius: 3px; font-weight: 700; }

.swr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.swr-table th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
.swr-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.swr-row-flagged { background: #fef9c3 !important; }

.swr-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.swr-photo { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: white; position: relative; }
.swr-photo.swr-flagged { border-color: #ca8a04; box-shadow: 0 0 0 2px #fde68a; }
.swr-photo img { width: 100%; height: 180px; object-fit: cover; display: block; }
.swr-photo-placeholder { width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 24px; }
.swr-photo-meta { padding: 8px; font-size: 11px; }
.swr-photo-title { font-weight: 600; color: #374151; margin-bottom: 2px; font-size: 12px; }
.swr-photo-badge { position: absolute; top: 6px; right: 6px; background: #ca8a04; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; font-weight: 700; z-index: 2; }

.swr-faint { color: #9ca3af; font-size: 11px; }
.swr-mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; }

@media print {
  body { background: white; padding: 0; }
  .swr-doc { box-shadow: none; padding: 0; max-width: none; }
  .swr-section { page-break-inside: avoid; }
  .swr-photo { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

// ─── Public Entry ─────────────────────────────────────────────────────────

export function buildSnapWarrantReport(args: SnapBuildReportArgs): string {
  const rec = args.record;
  if (!rec) {
    return `<!DOCTYPE html><html><body><h1>Empty Snapchat Warrant Bundle</h1><p>No record found in import.</p></body></html>`;
  }

  const counts = buildCounts(rec, args.flagKeys);
  const sections: string[] = [];
  sections.push(buildHeader(args, counts));

  sections.push(buildSubscriberInfo(rec, args.flagKeys, args.mode));
  sections.push(buildGenericTableSection(
    '🔐 Login History',
    rec.loginHistory || [],
    'login',
    SnapFlagKey.login,
    args.flagKeys,
    args.mode,
    ['login_time', 'Login Time', 'timestamp', 'ip', 'IP', 'country', 'carrier', 'device_type', 'os']
  ));
  sections.push(buildGenericTableSection(
    '👥 Friends',
    rec.friends || [],
    'friends',
    SnapFlagKey.friend,
    args.flagKeys,
    args.mode,
    ['username', 'Username', 'display_name', 'user_id', 'User ID', 'created', 'Created']
  ));
  sections.push(buildConversations(rec, args.flagKeys, args.mode, args.zip, args.mediaIndex));
  sections.push(buildGeoLocations(rec, args.flagKeys, args.mode));
  sections.push(buildGenericTableSection(
    '🎞️ Memories',
    rec.memories || [],
    'memories',
    SnapFlagKey.memory,
    args.flagKeys,
    args.mode,
    ['timestamp', 'Date', 'media_id', 'id', 'memory_id', 'media_type', 'caption']
  ));
  sections.push(buildGenericTableSection(
    '📱 Device Advertising IDs',
    rec.deviceAdvertisingIds || [],
    'devices',
    SnapFlagKey.device,
    args.flagKeys,
    args.mode,
    ['advertising_id', 'device_id', 'device id', 'device_type', 'os', 'os_version', 'time recorded']
  ));
  sections.push(buildGenericTableSection(
    '👻 Snap History',
    rec.snapHistory || [],
    'snapHistory',
    SnapFlagKey.snapHistory,
    args.flagKeys,
    args.mode,
    ['timestamp', 'Date', 'sender', 'recipient', 'id', 'Snap ID', 'media_id', 'media_type', 'source_type']
  ));
  sections.push(buildMediaGallery(rec, args.flagKeys, args.mode, args.zip, args.mediaIndex));

  const footer = `
<footer class="swr-footer">
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
  <div class="swr-faint" style="text-align: center; padding-top: 12px;">
    Generated by ICAC P.U.L.S.E. — Snapchat Warrant Bundle (${esc(args.mode)})<br>
    Case ${esc(args.caseNumber)} · ${esc(args.generatedAt)}
  </div>
</footer>`;
  sections.push(footer);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Snapchat Warrant Bundle — Case ${esc(args.caseNumber)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="swr-doc">
${sections.filter(s => !!s).join('\n')}
</div>
</body>
</html>`;
}

export default buildSnapWarrantReport;
