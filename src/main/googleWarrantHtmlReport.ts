/**
 * Google Warrant HTML Report Generator
 *
 * Produces a single self-contained HTML document of a Google warrant return,
 * ready for DA review. Flagged-only mode contains only items the officer
 * flagged; full mode contains everything with flagged items highlighted.
 *
 * Drive binary attachments are embedded as base64 data URLs only when flagged
 * (or in full mode when reasonable). Large MBOX/email bodies are truncated.
 */

import AdmZip from 'adm-zip';
import type {
  GoogleWarrantResult,
  GoogleSubscriberInfo,
  GoogleChangeRecord,
  GoogleEmail,
  GoogleLocationRecord,
  GoogleSemanticLocation,
  GoogleDevice,
  GoogleInstall,
  GoogleLibraryEntry,
  GoogleUserActivity,
  GoogleAccessLog,
  GoogleIpActivity,
} from './googleWarrantParser';

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

export interface GoogleBuildReportArgs {
  caseNumber: string;
  caseId: number;
  officer?: string;
  importLabel: string;
  importedAt: string;
  generatedAt: string;
  record: GoogleWarrantResult;
  mediaIndex: Record<string, MediaIndexEntry>;
  /** Composite flag keys in the form `${section}|${flagKey}` */
  flagKeys: Set<string>;
  zip: AdmZip;
  mode: 'flagged-only' | 'full';
}

// ─── Stable flag-key generators (must match GoogleWarrantTab.FlagKey) ───────

export const GoogleFlagKey = {
  ipActivity:      (ip: GoogleIpActivity) => `${ip.timestamp || ''}|${ip.ip || ''}`,
  changeHistory:   (c: GoogleChangeRecord) => `${c.timestamp || ''}|${c.ip || ''}|${c.changeType || ''}`,
  email:           (e: GoogleEmail) => e.id || `${e.subject || ''}|${e.date || ''}|${e.from || ''}`.substring(0, 200),
  locationRecord:  (l: GoogleLocationRecord) => `${l.timestamp || ''}|${l.lat ?? ''}|${l.lng ?? ''}`,
  semanticLoc:     (s: GoogleSemanticLocation) => `${s.type}|${s.placeId || s.activityType || ''}|${s.startTime || ''}`,
  device:          (d: GoogleDevice) => d.androidId || `${d.manufacturer || ''}|${d.model || ''}|${d.registrationTime || ''}`,
  install:         (i: GoogleInstall) => `${i.packageName || ''}|${i.installTime || ''}`,
  libraryEntry:    (l: GoogleLibraryEntry) => `${l.packageName || ''}|${l.acquisitionTime || ''}`,
  userActivity:    (a: GoogleUserActivity) => `${a.timestamp || ''}|${(a.action || '').substring(0, 60)}`,
  accessLog:       (a: GoogleAccessLog) => `${a.timestamp || ''}|${(a.activity || '').substring(0, 60)}`,
  chatMessage:     (m: any) => `${m.creator?.userId || m.creator?.name || ''}|${m.createdDate || m.timestamp || ''}|${(m.textBody || m.text || '').substring(0, 60)}`,
  payTransaction:  (t: any) => `${t['transaction id'] || t.transactionId || ''}|${t.date || t.timestamp || ''}|${t.amount || ''}`,
  driveFile:       (f: any) => `${f.name || ''}|${f.path || ''}`,
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

function readMediaAsDataUrl(zip: AdmZip, mediaIndex: Record<string, MediaIndexEntry>, fileName: string | null): string | null {
  if (!fileName) return null;
  const entry = mediaIndex[fileName];
  if (!entry) return null;
  try {
    const ze = zip.getEntry(entry.originalPath);
    if (!ze) return null;
    const buf = ze.getData();
    return `data:${entry.mimeType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── Counts ─────────────────────────────────────────────────────────────────

interface SectionCounts {
  ipTotal: number; ipFlagged: number;
  changeTotal: number; changeFlagged: number;
  emailTotal: number; emailFlagged: number;
  locTotal: number; locFlagged: number;
  semanticTotal: number; semanticFlagged: number;
  deviceTotal: number; deviceFlagged: number;
  installTotal: number; installFlagged: number;
  libraryTotal: number; libraryFlagged: number;
  userActTotal: number; userActFlagged: number;
  chatTotal: number; chatFlagged: number;
  accessLogTotal: number; accessLogFlagged: number;
  payTxTotal: number; payTxFlagged: number;
  driveTotal: number; driveFlagged: number;
}

function buildCounts(rec: GoogleWarrantResult, flags: Set<string>): SectionCounts {
  const c: SectionCounts = {
    ipTotal: 0, ipFlagged: 0,
    changeTotal: 0, changeFlagged: 0,
    emailTotal: 0, emailFlagged: 0,
    locTotal: 0, locFlagged: 0,
    semanticTotal: 0, semanticFlagged: 0,
    deviceTotal: 0, deviceFlagged: 0,
    installTotal: 0, installFlagged: 0,
    libraryTotal: 0, libraryFlagged: 0,
    userActTotal: 0, userActFlagged: 0,
    chatTotal: 0, chatFlagged: 0,
    accessLogTotal: 0, accessLogFlagged: 0,
    payTxTotal: 0, payTxFlagged: 0,
    driveTotal: 0, driveFlagged: 0,
  };
  for (const ip of (rec.ipActivity || [])) {
    c.ipTotal++; if (isFlagged(flags, 'ipActivity', GoogleFlagKey.ipActivity(ip))) c.ipFlagged++;
  }
  for (const ch of (rec.changeHistory || [])) {
    c.changeTotal++; if (isFlagged(flags, 'changeHistory', GoogleFlagKey.changeHistory(ch))) c.changeFlagged++;
  }
  for (const e of (rec.emails || [])) {
    c.emailTotal++; if (isFlagged(flags, 'emails', GoogleFlagKey.email(e))) c.emailFlagged++;
  }
  for (const l of (rec.locationRecords || [])) {
    c.locTotal++; if (isFlagged(flags, 'locationRecords', GoogleFlagKey.locationRecord(l))) c.locFlagged++;
  }
  for (const s of (rec.semanticLocations || [])) {
    c.semanticTotal++; if (isFlagged(flags, 'semanticLocations', GoogleFlagKey.semanticLoc(s))) c.semanticFlagged++;
  }
  for (const d of (rec.devices || [])) {
    c.deviceTotal++; if (isFlagged(flags, 'devices', GoogleFlagKey.device(d))) c.deviceFlagged++;
  }
  for (const i of (rec.installs || [])) {
    c.installTotal++; if (isFlagged(flags, 'installs', GoogleFlagKey.install(i))) c.installFlagged++;
  }
  for (const l of (rec.library || [])) {
    c.libraryTotal++; if (isFlagged(flags, 'library', GoogleFlagKey.libraryEntry(l))) c.libraryFlagged++;
  }
  for (const a of (rec.userActivity || [])) {
    c.userActTotal++; if (isFlagged(flags, 'userActivity', GoogleFlagKey.userActivity(a))) c.userActFlagged++;
  }
  for (const m of (rec.chatMessages || [])) {
    c.chatTotal++; if (isFlagged(flags, 'chatMessages', GoogleFlagKey.chatMessage(m))) c.chatFlagged++;
  }
  for (const a of (rec.accessLogActivity || [])) {
    c.accessLogTotal++; if (isFlagged(flags, 'accessLog', GoogleFlagKey.accessLog(a))) c.accessLogFlagged++;
  }
  for (const t of (rec.googlePay?.transactions || [])) {
    c.payTxTotal++; if (isFlagged(flags, 'payTransactions', GoogleFlagKey.payTransaction(t))) c.payTxFlagged++;
  }
  for (const f of (rec.driveFiles || [])) {
    c.driveTotal++; if (isFlagged(flags, 'driveFiles', GoogleFlagKey.driveFile(f))) c.driveFlagged++;
  }
  return c;
}

// ─── Header ─────────────────────────────────────────────────────────────────

function buildHeader(args: GoogleBuildReportArgs, counts: SectionCounts): string {
  const rec = args.record;
  const total = args.flagKeys.size;
  return `
<header class="gwr-header">
  <div class="gwr-header-top">
    <div>
      <div class="gwr-brand-title">ICAC P.U.L.S.E. — Google Warrant Return</div>
      <div class="gwr-brand-sub">${esc(args.mode === 'flagged-only' ? 'Flagged-Items Bundle (DA Review)' : 'Full Production Bundle')}</div>
    </div>
    <div class="gwr-stamp">
      <div>Case <strong>${esc(args.caseNumber)}</strong></div>
      <div>Generated <strong>${esc(args.generatedAt)}</strong></div>
      ${args.officer ? `<div>Officer <strong>${esc(args.officer)}</strong></div>` : ''}
    </div>
  </div>

  <table class="gwr-meta">
    <tr><th>Account Email</th><td>${esc(rec.accountEmail || '—')}</td>
        <th>Account ID</th><td>${esc(rec.accountId || '—')}</td></tr>
    <tr><th>Date Range</th>
        <td colspan="3">${esc(rec.dateRange?.start || '—')} → ${esc(rec.dateRange?.end || '—')}</td></tr>
    <tr><th>Production File</th>
        <td colspan="3">${esc(args.importLabel)} <span class="gwr-faint">(imported ${esc(args.importedAt)})</span></td></tr>
    <tr><th>Categories</th>
        <td colspan="3">${esc((rec.categories || []).join(', ') || '—')}</td></tr>
  </table>

  <div class="gwr-summary">
    <div class="gwr-summary-title">Bundle Summary</div>
    <table class="gwr-summary-table">
      <thead><tr><th>Section</th><th>Total</th><th>Flagged</th></tr></thead>
      <tbody>
        <tr><td>IP Activity</td>           <td>${counts.ipTotal}</td>        <td>${counts.ipFlagged}</td></tr>
        <tr><td>Change History</td>        <td>${counts.changeTotal}</td>    <td>${counts.changeFlagged}</td></tr>
        <tr><td>Emails (MBOX)</td>         <td>${counts.emailTotal}</td>     <td>${counts.emailFlagged}</td></tr>
        <tr><td>Location Records</td>      <td>${counts.locTotal}</td>       <td>${counts.locFlagged}</td></tr>
        <tr><td>Semantic Locations</td>    <td>${counts.semanticTotal}</td>  <td>${counts.semanticFlagged}</td></tr>
        <tr><td>Devices</td>               <td>${counts.deviceTotal}</td>    <td>${counts.deviceFlagged}</td></tr>
        <tr><td>Installs</td>              <td>${counts.installTotal}</td>   <td>${counts.installFlagged}</td></tr>
        <tr><td>Library</td>               <td>${counts.libraryTotal}</td>   <td>${counts.libraryFlagged}</td></tr>
        <tr><td>User Activity</td>         <td>${counts.userActTotal}</td>   <td>${counts.userActFlagged}</td></tr>
        <tr><td>Chat Messages</td>         <td>${counts.chatTotal}</td>      <td>${counts.chatFlagged}</td></tr>
        <tr><td>Access Log Activity</td>   <td>${counts.accessLogTotal}</td> <td>${counts.accessLogFlagged}</td></tr>
        <tr><td>Pay Transactions</td>      <td>${counts.payTxTotal}</td>     <td>${counts.payTxFlagged}</td></tr>
        <tr><td>Drive Files</td>           <td>${counts.driveTotal}</td>     <td>${counts.driveFlagged}</td></tr>
        <tr class="gwr-summary-total"><td>TOTAL FLAGS</td><td colspan="2">${total}</td></tr>
      </tbody>
    </table>
  </div>
</header>`;
}

// ─── Section builders ───────────────────────────────────────────────────────

function buildSubscriber(rec: GoogleWarrantResult): string {
  const s: GoogleSubscriberInfo | null = rec.subscriber;
  if (!s) return '';
  const kv = (label: string, value: any) =>
    value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : '';

  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">👤 Subscriber Info</h2>
  <div class="gwr-grid-2">
    <div class="gwr-card">
      <h3>Identity</h3>
      <table class="gwr-kv">
        ${kv('Name', s.name)}
        ${kv('Given Name', s.givenName)}
        ${kv('Family Name', s.familyName)}
        ${kv('Email', s.email)}
        ${kv('Alternate Emails', s.alternateEmails)}
        ${kv('Account ID', s.accountId)}
        ${kv('Birthday', s.birthday)}
      </table>
    </div>
    <div class="gwr-card">
      <h3>Account Status</h3>
      <table class="gwr-kv">
        ${kv('Created On', s.createdOn)}
        ${kv('Status', s.status)}
        ${kv('Last Updated', s.lastUpdated)}
        ${kv('Deletion Date', s.deletionDate)}
        ${kv('Services', s.services)}
        ${kv('ToS IP', s.tosIp)}
        ${kv('ToS Language', s.tosLanguage)}
      </table>
    </div>
    <div class="gwr-card">
      <h3>Recovery</h3>
      <table class="gwr-kv">
        ${kv('Contact Email', s.recovery?.contactEmail)}
        ${kv('Recovery Email', s.recovery?.recoveryEmail)}
        ${kv('Recovery SMS', s.recovery?.recoverySms)}
        ${kv('User Phone Numbers', s.phoneNumbers?.user)}
        ${kv('2-Step Phone Numbers', s.phoneNumbers?.twoStep)}
      </table>
    </div>
    <div class="gwr-card">
      <h3>Last Logins</h3>
      <div class="gwr-mono" style="font-size: 11px; line-height: 1.6;">
        ${(s.lastLogins || []).slice(0, 30).map(l => esc(l)).join('<br>') || '<span class="gwr-faint">none</span>'}
      </div>
    </div>
  </div>
</section>`;
}

function buildIpActivity(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.ipActivity || [];
  if (items.length === 0) return '';
  const rows = items.filter(ip =>
    mode === 'full' || isFlagged(flags, 'ipActivity', GoogleFlagKey.ipActivity(ip))
  );
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">🌐 IP Activity (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Timestamp</th><th>IP</th><th>Activity</th><th>Android ID</th><th>Apple IDFV</th><th>User Agent</th>
    </tr></thead>
    <tbody>
      ${rows.map(ip => {
        const flagged = isFlagged(flags, 'ipActivity', GoogleFlagKey.ipActivity(ip));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(ip.timestamp)}</td>
          <td class="gwr-mono">${esc(ip.ip)}</td>
          <td>${esc(ip.activityType)}</td>
          <td class="gwr-mono">${esc(ip.androidId)}</td>
          <td class="gwr-mono">${esc(ip.appleIdfv)}</td>
          <td class="gwr-faint">${esc(truncate(ip.userAgent, 80))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildChangeHistory(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.changeHistory || [];
  if (items.length === 0) return '';
  const rows = items.filter(c => mode === 'full' || isFlagged(flags, 'changeHistory', GoogleFlagKey.changeHistory(c)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">🔄 Change History (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Timestamp</th><th>IP</th><th>Change Type</th><th>Old Value</th><th>New Value</th>
    </tr></thead>
    <tbody>
      ${rows.map(c => {
        const flagged = isFlagged(flags, 'changeHistory', GoogleFlagKey.changeHistory(c));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(c.timestamp)}</td>
          <td class="gwr-mono">${esc(c.ip)}</td>
          <td>${esc(c.changeType)}</td>
          <td class="gwr-faint">${esc(truncate(c.oldValue, 100))}</td>
          <td>${esc(truncate(c.newValue, 100))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildEmails(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.emails || [];
  if (items.length === 0) return '';
  const rows = items.filter(e => mode === 'full' || isFlagged(flags, 'emails', GoogleFlagKey.email(e)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">✉️ Emails (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  ${rows.map(e => {
    const flagged = isFlagged(flags, 'emails', GoogleFlagKey.email(e));
    return `
    <div class="gwr-post ${flagged ? 'gwr-flagged' : ''}">
      <div class="gwr-post-head">
        <strong>${esc(e.subject || '(no subject)')}</strong>
        <span class="gwr-time">${esc(e.date)}</span>
        ${flagged ? '<span class="gwr-flag-badge">FLAGGED</span>' : ''}
      </div>
      <div class="gwr-post-extra">
        <div><strong>From:</strong> ${esc(e.from)}</div>
        <div><strong>To:</strong> ${esc(e.to)}</div>
        ${e.cc ? `<div><strong>CC:</strong> ${esc(e.cc)}</div>` : ''}
        ${e.labels ? `<div><strong>Labels:</strong> ${esc(e.labels)}</div>` : ''}
      </div>
      <div class="gwr-post-body">${esc(truncate(e.textBody || '', 2000))}</div>
      ${(e.attachments || []).length > 0 ? `
      <div class="gwr-post-extra">
        📎 ${e.attachments.length} attachment(s):
        ${e.attachments.slice(0, 8).map(a => `<span class="gwr-chip">${esc(a.filename || 'unnamed')}</span>`).join(' ')}
      </div>` : ''}
    </div>`;
  }).join('')}
</section>`;
}

function buildLocationRecords(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.locationRecords || [];
  if (items.length === 0) return '';
  let rows = items.filter(l => mode === 'full' || isFlagged(flags, 'locationRecords', GoogleFlagKey.locationRecord(l)));
  if (rows.length === 0) return '';
  // Cap in full mode to prevent 100MB reports
  const capped = mode === 'full' && rows.length > 500;
  if (capped) rows = rows.slice(0, 500);
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">📍 Location Records (${rows.length}${mode === 'full' ? '' : ' flagged'}${capped ? ' — capped at 500 of ' + items.length : ''})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Timestamp</th><th>Lat</th><th>Lng</th><th>Acc (m)</th><th>Source</th><th>Activity</th>
    </tr></thead>
    <tbody>
      ${rows.map(l => {
        const flagged = isFlagged(flags, 'locationRecords', GoogleFlagKey.locationRecord(l));
        const actStr = l.activity ? JSON.stringify(l.activity).substring(0, 60) : '';
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(l.timestamp)}</td>
          <td class="gwr-mono">${esc(l.lat?.toFixed(6))}</td>
          <td class="gwr-mono">${esc(l.lng?.toFixed(6))}</td>
          <td>${esc(l.accuracy)}</td>
          <td>${esc(l.source)}</td>
          <td class="gwr-faint">${esc(actStr)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildSemanticLocations(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.semanticLocations || [];
  if (items.length === 0) return '';
  const rows = items.filter(s => mode === 'full' || isFlagged(flags, 'semanticLocations', GoogleFlagKey.semanticLoc(s)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">🗺️ Semantic Locations (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Type</th><th>Name / Activity</th><th>Address</th><th>Lat / Lng</th><th>Start</th><th>End</th>
    </tr></thead>
    <tbody>
      ${rows.map(s => {
        const flagged = isFlagged(flags, 'semanticLocations', GoogleFlagKey.semanticLoc(s));
        const latLng = s.type === 'placeVisit'
          ? `${s.lat?.toFixed(5) ?? ''}, ${s.lng?.toFixed(5) ?? ''}`
          : `${s.startLat?.toFixed(5) ?? ''}, ${s.startLng?.toFixed(5) ?? ''} → ${s.endLat?.toFixed(5) ?? ''}, ${s.endLng?.toFixed(5) ?? ''}`;
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td><span class="gwr-chip">${esc(s.type)}</span></td>
          <td>${esc(s.name || s.activityType || '—')}</td>
          <td>${esc(s.address || '—')}</td>
          <td class="gwr-mono">${esc(latLng)}</td>
          <td class="gwr-mono">${esc(s.startTime)}</td>
          <td class="gwr-mono">${esc(s.endTime)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildDevices(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.devices || [];
  if (items.length === 0) return '';
  const rows = items.filter(d => mode === 'full' || isFlagged(flags, 'devices', GoogleFlagKey.device(d)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">📱 Devices (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Android ID</th><th>Manufacturer</th><th>Model</th><th>Carrier</th><th>Country</th><th>Registered</th><th>Last Active</th>
    </tr></thead>
    <tbody>
      ${rows.map(d => {
        const flagged = isFlagged(flags, 'devices', GoogleFlagKey.device(d));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(d.androidId)}</td>
          <td>${esc(d.manufacturer)}</td>
          <td>${esc(d.model)}</td>
          <td>${esc(d.carrier)}</td>
          <td>${esc(d.country)}</td>
          <td class="gwr-mono">${esc(d.registrationTime)}</td>
          <td class="gwr-mono">${esc(d.lastActive)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildInstalls(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.installs || [];
  if (items.length === 0) return '';
  const rows = items.filter(i => mode === 'full' || isFlagged(flags, 'installs', GoogleFlagKey.install(i)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">⬇️ App Installs (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Package</th><th>Title</th><th>Installed</th><th>Last Update</th><th>State</th><th>Device</th>
    </tr></thead>
    <tbody>
      ${rows.map(i => {
        const flagged = isFlagged(flags, 'installs', GoogleFlagKey.install(i));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(i.packageName)}</td>
          <td>${esc(i.title)}</td>
          <td class="gwr-mono">${esc(i.installTime)}</td>
          <td class="gwr-mono">${esc(i.lastUpdate)}</td>
          <td>${esc(i.state)}</td>
          <td>${esc(i.deviceManufacturer)} ${esc(i.deviceModel)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildLibrary(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.library || [];
  if (items.length === 0) return '';
  const rows = items.filter(l => mode === 'full' || isFlagged(flags, 'library', GoogleFlagKey.libraryEntry(l)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">📚 Play Store Library (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Package / Doc ID</th><th>Title</th><th>Type</th><th>Acquired</th><th>Hidden</th>
    </tr></thead>
    <tbody>
      ${rows.map(l => {
        const flagged = isFlagged(flags, 'library', GoogleFlagKey.libraryEntry(l));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(l.packageName)}</td>
          <td>${esc(l.title)}</td>
          <td>${esc(l.type)}</td>
          <td class="gwr-mono">${esc(l.acquisitionTime)}</td>
          <td>${l.hidden ? '✓' : ''}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildUserActivity(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.userActivity || [];
  if (items.length === 0) return '';
  const rows = items.filter(a => mode === 'full' || isFlagged(flags, 'userActivity', GoogleFlagKey.userActivity(a)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">📋 User Activity (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <div>
    ${rows.map(a => {
      const flagged = isFlagged(flags, 'userActivity', GoogleFlagKey.userActivity(a));
      return `<div class="gwr-post ${flagged ? 'gwr-flagged' : ''}">
        <div class="gwr-post-head">
          <span class="gwr-time">${esc(a.timestamp)}</span>
          ${flagged ? '<span class="gwr-flag-badge">FLAGGED</span>' : ''}
        </div>
        <div class="gwr-post-body">${esc(a.action)}</div>
        ${a.link ? `<div class="gwr-share-url">${esc(a.link)}</div>` : ''}
      </div>`;
    }).join('')}
  </div>
</section>`;
}

function buildChatMessages(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.chatMessages || [];
  if (items.length === 0) return '';
  const rows = items.filter(m => mode === 'full' || isFlagged(flags, 'chatMessages', GoogleFlagKey.chatMessage(m)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">💬 Chat Messages (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <div class="gwr-msg-list">
    ${rows.slice(0, 1000).map(m => {
      const flagged = isFlagged(flags, 'chatMessages', GoogleFlagKey.chatMessage(m));
      const author = m.creator?.userId || m.creator?.name || m.author || '(unknown)';
      const ts = m.createdDate || m.timestamp || m.sent || '';
      const body = m.text || m.textBody || (m.type === 'html' ? '(HTML chat content omitted)' : JSON.stringify(m).substring(0, 300));
      return `<div class="gwr-msg ${flagged ? 'gwr-flagged' : ''}">
        <div class="gwr-msg-head"><strong>${esc(author)}</strong><span class="gwr-time">${esc(ts)}</span>${flagged ? '<span class="gwr-flag-badge">FLAGGED</span>' : ''}</div>
        <div class="gwr-msg-body">${esc(truncate(body, 800))}</div>
      </div>`;
    }).join('')}
  </div>
</section>`;
}

function buildAccessLog(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const items = rec.accessLogActivity || [];
  if (items.length === 0) return '';
  const rows = items.filter(a => mode === 'full' || isFlagged(flags, 'accessLog', GoogleFlagKey.accessLog(a)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">🔐 Access Log Activity (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <table class="gwr-table">
    <thead><tr>
      <th>Timestamp</th><th>Activity</th><th>IP</th><th>Details</th>
    </tr></thead>
    <tbody>
      ${rows.map(a => {
        const flagged = isFlagged(flags, 'accessLog', GoogleFlagKey.accessLog(a));
        return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">
          <td class="gwr-mono">${esc(a.timestamp)}</td>
          <td>${esc(a.activity)}</td>
          <td class="gwr-mono">${esc(a.ip)}</td>
          <td class="gwr-faint">${esc(truncate(a.details, 120))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</section>`;
}

function buildPay(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const pay = rec.googlePay;
  if (!pay) return '';
  const txns = pay.transactions || [];
  const inst = pay.instruments || [];
  const addrs = pay.addresses || [];
  if (txns.length === 0 && inst.length === 0 && addrs.length === 0) return '';

  const txnRows = txns.filter(t => mode === 'full' || isFlagged(flags, 'payTransactions', GoogleFlagKey.payTransaction(t)));
  if (mode === 'flagged-only' && txnRows.length === 0 && inst.length === 0) return '';

  const colsFrom = (rows: any[]): string[] => {
    const cols = new Set<string>();
    for (const r of rows.slice(0, 5)) for (const k of Object.keys(r)) cols.add(k);
    return Array.from(cols).slice(0, 6);
  };

  const tableOf = (label: string, rows: any[], section: string | null): string => {
    if (rows.length === 0) return '';
    const cols = colsFrom(rows);
    return `<h3>${esc(label)} (${rows.length})</h3>
    <table class="gwr-table">
      <thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.slice(0, 200).map(r => {
          const flagged = section ? isFlagged(flags, section, GoogleFlagKey.payTransaction(r)) : false;
          return `<tr class="${flagged ? 'gwr-row-flagged' : ''}">${cols.map(c => `<td>${esc(truncate(String(r[c] ?? ''), 80))}</td>`).join('')}</tr>`;
        }).join('')}
      </tbody>
    </table>`;
  };

  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">💳 Google Pay</h2>
  ${tableOf('Transactions', txnRows, 'payTransactions')}
  ${mode === 'full' ? tableOf('Payment Instruments', inst, null) : ''}
  ${mode === 'full' ? tableOf('Addresses', addrs, null) : ''}
</section>`;
}

function buildDriveFiles(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full', zip: AdmZip, mediaIndex: Record<string, MediaIndexEntry>): string {
  const items = rec.driveFiles || [];
  if (items.length === 0) return '';
  const rows = items.filter(f => mode === 'full' || isFlagged(flags, 'driveFiles', GoogleFlagKey.driveFile(f)));
  if (rows.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">📂 Drive Files (${rows.length}${mode === 'full' ? '' : ' flagged'})</h2>
  <div class="gwr-photo-grid">
    ${rows.slice(0, 200).map(f => {
      const flagged = isFlagged(flags, 'driveFiles', GoogleFlagKey.driveFile(f));
      const isFile = !!f._isFile;
      const isImage = isFile && f.mimeType && f.mimeType.startsWith('image/');
      const dataUrl = (isImage && (flagged || mode === 'full')) ? readMediaAsDataUrl(zip, mediaIndex, f.name) : null;
      return `<div class="gwr-photo ${flagged ? 'gwr-flagged' : ''}">
        ${flagged ? '<span class="gwr-photo-badge">FLAGGED</span>' : ''}
        ${dataUrl ? `<img src="${dataUrl}" alt="${esc(f.name)}">` :
          `<div class="gwr-photo-placeholder">${isImage ? '🖼️' : '📄'}</div>`}
        <div class="gwr-photo-meta">
          <div class="gwr-photo-title">${esc(f.name || '(unnamed)')}</div>
          <div class="gwr-faint">${esc(f.mimeType || '')} · ${esc(f.size != null ? `${(f.size / 1024).toFixed(1)} KB` : '')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>
</section>`;
}

function buildNoRecords(rec: GoogleWarrantResult): string {
  const nr = rec.noRecordCategories || [];
  if (nr.length === 0) return '';
  return `
<section class="gwr-section">
  <h2 class="gwr-section-title">∅ No-Record Categories (${nr.length})</h2>
  <div class="gwr-card">
    <div class="gwr-chip-row">
      ${nr.map(c => `<span class="gwr-chip">${esc(c)}</span>`).join('')}
    </div>
  </div>
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
.gwr-doc { max-width: 1100px; margin: 0 auto; background: #ffffff; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

.gwr-header { border-bottom: 2px solid #15803d; padding-bottom: 16px; margin-bottom: 24px; }
.gwr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.gwr-brand-title { font-size: 18px; font-weight: 700; color: #14532d; }
.gwr-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.gwr-stamp { text-align: right; font-size: 12px; color: #374151; }
.gwr-stamp div { margin-bottom: 2px; }

.gwr-meta { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.gwr-meta th { text-align: left; padding: 4px 8px; width: 110px; color: #6b7280; font-weight: 600; background: #f9fafb; border: 1px solid #e5e7eb; }
.gwr-meta td { padding: 4px 8px; border: 1px solid #e5e7eb; }

.gwr-summary { margin-top: 16px; }
.gwr-summary-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.gwr-summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.gwr-summary-table th { background: #15803d; color: white; padding: 6px 8px; text-align: left; }
.gwr-summary-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.gwr-summary-total td { font-weight: 700; color: #14532d; background: #ecfdf5; }

.gwr-section { margin: 28px 0; }
.gwr-section-title { font-size: 16px; font-weight: 700; color: #14532d; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
.gwr-card { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px; }
.gwr-card h3 { font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 10px 0; }
.gwr-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.gwr-kv { width: 100%; border-collapse: collapse; font-size: 12px; }
.gwr-kv th { text-align: left; padding: 3px 8px; color: #6b7280; font-weight: 600; vertical-align: top; width: 140px; }
.gwr-kv td { padding: 3px 8px; vertical-align: top; }

.gwr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.gwr-table th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
.gwr-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.gwr-row-flagged { background: #fef3c7 !important; }

.gwr-post { border-left: 3px solid #d1d5db; padding: 8px 10px; margin-bottom: 8px; background: white; }
.gwr-post.gwr-flagged { border-left-color: #d97706; background: #fffbeb; }
.gwr-post-head { font-size: 11px; color: #6b7280; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gwr-post-body { font-size: 13px; color: #1f2937; white-space: pre-wrap; }
.gwr-post-extra { font-size: 11px; color: #6b7280; margin-top: 4px; }
.gwr-share-url { color: #2563eb; font-size: 11px; margin-top: 4px; word-break: break-all; }
.gwr-time { color: #9ca3af; }

.gwr-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.gwr-photo { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: white; position: relative; }
.gwr-photo.gwr-flagged { border-color: #d97706; box-shadow: 0 0 0 2px #fde68a; }
.gwr-photo img { width: 100%; height: 180px; object-fit: cover; display: block; }
.gwr-photo-placeholder { width: 100%; height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 24px; }
.gwr-photo-meta { padding: 8px; font-size: 11px; }
.gwr-photo-title { font-weight: 600; color: #374151; margin-bottom: 2px; font-size: 12px; }
.gwr-photo-badge { position: absolute; top: 6px; right: 6px; background: #d97706; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; font-weight: 700; z-index: 2; }

.gwr-msg-list { display: flex; flex-direction: column; gap: 6px; }
.gwr-msg { background: white; border: 1px solid #e5e7eb; border-left: 3px solid #d1d5db; padding: 8px 10px; border-radius: 3px; }
.gwr-msg.gwr-flagged { border-left-color: #d97706; background: #fffbeb; }
.gwr-msg-head { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; margin-bottom: 4px; flex-wrap: wrap; }
.gwr-msg-head strong { color: #374151; }
.gwr-msg-body { font-size: 13px; white-space: pre-wrap; }

.gwr-chip { display: inline-block; background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.gwr-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.gwr-flag-badge { background: #d97706; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; margin-left: auto; }
.gwr-faint { color: #9ca3af; font-size: 11px; }
.gwr-mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; }

@media print {
  body { background: white; padding: 0; }
  .gwr-doc { box-shadow: none; padding: 0; max-width: none; }
  .gwr-section { page-break-inside: avoid; }
  .gwr-card { page-break-inside: avoid; }
  .gwr-photo { page-break-inside: avoid; }
  .gwr-msg { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

// ─── Public entry ──────────────────────────────────────────────────────────

export function buildGoogleWarrantReport(args: GoogleBuildReportArgs): string {
  const rec = args.record;
  if (!rec) {
    return `<!DOCTYPE html><html><body><h1>Empty Google Warrant Bundle</h1><p>No record found in import.</p></body></html>`;
  }

  const counts = buildCounts(rec, args.flagKeys);
  const sections: string[] = [];
  sections.push(buildHeader(args, counts));

  if (args.mode === 'full') {
    sections.push(buildSubscriber(rec));
  }
  const fns: Array<(rec: GoogleWarrantResult, flags: Set<string>, mode: 'flagged-only' | 'full') => string> = [
    buildIpActivity,
    buildChangeHistory,
    buildEmails,
    buildLocationRecords,
    buildSemanticLocations,
    buildDevices,
    buildInstalls,
    buildLibrary,
    buildUserActivity,
    buildChatMessages,
    buildAccessLog,
    buildPay,
  ];
  for (const fn of fns) {
    const html = fn(rec, args.flagKeys, args.mode);
    if (html) sections.push(html);
  }

  // Drive (needs zip+mediaIndex)
  const drive = buildDriveFiles(rec, args.flagKeys, args.mode, args.zip, args.mediaIndex);
  if (drive) sections.push(drive);

  if (args.mode === 'full') {
    const nr = buildNoRecords(rec);
    if (nr) sections.push(nr);
  }

  const footer = `
<footer class="gwr-footer">
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
  <div class="gwr-faint" style="text-align: center; padding-top: 12px;">
    Generated by ICAC P.U.L.S.E. — Google Warrant Bundle (${esc(args.mode)})<br>
    Case ${esc(args.caseNumber)} · ${esc(args.generatedAt)}
  </div>
</footer>`;
  sections.push(footer);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Google Warrant Bundle — Case ${esc(args.caseNumber)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="gwr-doc">
${sections.join('\n')}
</div>
</body>
</html>`;
}

export default buildGoogleWarrantReport;
