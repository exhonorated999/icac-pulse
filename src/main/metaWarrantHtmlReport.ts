/**
 * Meta Warrant HTML Report Generator
 *
 * Produces a single self-contained HTML document of a Meta (Facebook/Instagram)
 * warrant return, ready for DA review. Flagged-only mode contains only items
 * the officer flagged; full mode contains everything with flagged items
 * highlighted.
 *
 * Images for flagged items (and message attachments in flagged threads) are
 * embedded as base64 data URLs so the file is portable. Non-flagged photos
 * in full mode are rendered as filename placeholders to keep file size sane.
 */

import AdmZip from 'adm-zip';

// ─── Types (mirror parser output) ───────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

interface MetaRecord {
  source: string;
  service: string;
  title: string;
  targetId: string | null;
  accountId: string | null;
  dateRange: string | null;
  generated: string | null;
  requestParameters?: any;
  ncmecReports: any[];
  registrationIp: string | null;
  ipAddresses: { ip: string | null; time: string | null }[];
  aboutMe: string | null;
  wallposts: any[];
  statusUpdates: any[];
  shares: any[];
  photos: any[];
  messages: { threads: { threadId: string | null; participants: string[]; messages: any[] }[] };
  postsToOtherWalls: any[];
  bio: { text: string | null; creationTime: string | null } | null;
}

export interface BuildReportArgs {
  caseNumber: string;
  caseId: number;
  officer?: string;
  importLabel: string;
  importedAt: string;
  generatedAt: string;
  records: MetaRecord[];
  mediaIndex: Record<string, MediaIndexEntry>;
  /** Composite flag keys in the form `${section}|${flagKey}` */
  flagKeys: Set<string>;
  zip: AdmZip;
  mode: 'flagged-only' | 'full';
}

// ─── Flag key generators (must match MetaWarrantTab.FlagKey) ────────────────

const FK = {
  message:      (threadId: string, m: any) => [threadId || '', m.author || '', m.sent || ''].join('|'),
  statusUpdate: (u: any) => [u.posted || '', u.author || '', (u.status || '').substring(0, 40)].join('|'),
  wallpost:     (w: any) => [w.from || '', w.to || '', w.time || ''].join('|'),
  share:        (s: any) => [s.dateCreated || '', s.title || '', (s.url || '').substring(0, 60)].join('|'),
  photo:        (p: any) => [p.album || p.albumName || '', p.uploaded || '', p.title || ''].join('|'),
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

function nl2br(s: string): string {
  return s.replace(/\r?\n/g, '<br>');
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

function isFlagged(flags: Set<string>, section: string, key: string): boolean {
  return flags.has(`${section}|${key}`);
}

// ─── Section builders ───────────────────────────────────────────────────────

function buildHeader(args: BuildReportArgs, mainRec: MetaRecord, counts: SectionCounts): string {
  const rp = mainRec.requestParameters || {};
  const target = esc(rp.target || mainRec.targetId || '(unknown)');
  const service = esc(mainRec.service || 'Meta');
  const totalFlags = args.flagKeys.size;

  return `
<header class="mwr-header">
  <div class="mwr-header-top">
    <div class="mwr-brand">
      <div class="mwr-brand-title">ICAC P.U.L.S.E. — Meta Warrant Return</div>
      <div class="mwr-brand-sub">${esc(args.mode === 'flagged-only' ? 'Flagged-Items Bundle (DA Review)' : 'Full Production Bundle')}</div>
    </div>
    <div class="mwr-stamp">
      <div>Case <strong>${esc(args.caseNumber)}</strong></div>
      <div>Generated <strong>${esc(args.generatedAt)}</strong></div>
      ${args.officer ? `<div>Officer <strong>${esc(args.officer)}</strong></div>` : ''}
    </div>
  </div>

  <table class="mwr-meta">
    <tr><th>Service</th><td>${service}</td>          <th>Target</th><td>${target}</td></tr>
    <tr><th>Account ID</th><td>${esc(mainRec.accountId || '—')}</td>
        <th>Date Range</th><td>${esc(mainRec.dateRange || '—')}</td></tr>
    <tr><th>Production File</th><td colspan="3">${esc(args.importLabel)} <span class="mwr-faint">(imported ${esc(args.importedAt)})</span></td></tr>
  </table>

  <div class="mwr-summary">
    <div class="mwr-summary-title">Bundle Summary</div>
    <table class="mwr-summary-table">
      <thead><tr><th>Section</th><th>Total</th><th>Flagged</th></tr></thead>
      <tbody>
        <tr><td>IP Activity</td>           <td>${counts.ipTotal}</td>      <td>${counts.ipFlagged}</td></tr>
        <tr><td>Status Updates</td>        <td>${counts.statusTotal}</td>  <td>${counts.statusFlagged}</td></tr>
        <tr><td>Wallposts</td>             <td>${counts.wallTotal}</td>    <td>${counts.wallFlagged}</td></tr>
        <tr><td>Posts to Other Walls</td>  <td>${counts.otherTotal}</td>   <td>${counts.otherFlagged}</td></tr>
        <tr><td>Shares</td>                <td>${counts.shareTotal}</td>   <td>${counts.shareFlagged}</td></tr>
        <tr><td>Photos</td>                <td>${counts.photoTotal}</td>   <td>${counts.photoFlagged}</td></tr>
        <tr><td>Messages</td>              <td>${counts.msgTotal}</td>     <td>${counts.msgFlagged}</td></tr>
        <tr class="mwr-summary-total"><td>TOTAL FLAGS</td><td colspan="2">${totalFlags}</td></tr>
      </tbody>
    </table>
  </div>
</header>`;
}

interface SectionCounts {
  ipTotal: number; ipFlagged: number;
  statusTotal: number; statusFlagged: number;
  wallTotal: number; wallFlagged: number;
  otherTotal: number; otherFlagged: number;
  shareTotal: number; shareFlagged: number;
  photoTotal: number; photoFlagged: number;
  msgTotal: number; msgFlagged: number;
}

function buildCounts(records: MetaRecord[], flags: Set<string>): SectionCounts {
  const c: SectionCounts = {
    ipTotal: 0, ipFlagged: 0,
    statusTotal: 0, statusFlagged: 0,
    wallTotal: 0, wallFlagged: 0,
    otherTotal: 0, otherFlagged: 0,
    shareTotal: 0, shareFlagged: 0,
    photoTotal: 0, photoFlagged: 0,
    msgTotal: 0, msgFlagged: 0,
  };
  for (const r of records) {
    for (const ip of (r.ipAddresses || [])) {
      c.ipTotal++;
      if (isFlagged(flags, 'ipActivity', ip.ip || '')) c.ipFlagged++;
    }
    for (const u of (r.statusUpdates || [])) {
      c.statusTotal++;
      if (isFlagged(flags, 'statusUpdates', u.id || FK.statusUpdate(u))) c.statusFlagged++;
    }
    for (const w of (r.wallposts || [])) {
      c.wallTotal++;
      if (isFlagged(flags, 'wallposts', w.id || FK.wallpost(w))) c.wallFlagged++;
    }
    for (const p of (r.postsToOtherWalls || [])) {
      c.otherTotal++;
      if (isFlagged(flags, 'otherWallPosts', p.id || '')) c.otherFlagged++;
    }
    for (const s of (r.shares || [])) {
      c.shareTotal++;
      if (isFlagged(flags, 'shares', FK.share(s))) c.shareFlagged++;
    }
    for (const p of (r.photos || [])) {
      c.photoTotal++;
      if (isFlagged(flags, 'photos', p.id || FK.photo(p))) c.photoFlagged++;
    }
    for (const t of (r.messages?.threads || [])) {
      for (const m of (t.messages || [])) {
        c.msgTotal++;
        if (isFlagged(flags, 'messages', FK.message(t.threadId || '?', m))) c.msgFlagged++;
      }
    }
  }
  return c;
}

function buildOverview(rec: MetaRecord, _flags: Set<string>): string {
  const rp = rec.requestParameters || {};
  const bio = rec.bio;
  const reg = rec.registrationIp;
  const aboutMe = rec.aboutMe;
  const ncmec = rec.ncmecReports || [];

  const kv = (label: string, value: any) =>
    value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : '';

  return `
<section class="mwr-section">
  <h2 class="mwr-section-title">📋 Overview</h2>

  <div class="mwr-grid-2">
    <div class="mwr-card">
      <h3>Request Parameters</h3>
      <table class="mwr-kv">
        ${kv('Target', rp.target)}
        ${kv('Services', rp.services)}
        ${kv('Date Range', rp.dateRange)}
        ${kv('Service', rp.service)}
        ${kv('Generated', rec.generated)}
        ${kv('Account ID', rec.accountId)}
      </table>
    </div>

    <div class="mwr-card">
      <h3>Registration / Bio</h3>
      <table class="mwr-kv">
        ${kv('Registration IP', reg)}
        ${kv('Bio Created', bio?.creationTime)}
        ${bio?.text ? `<tr><th>Bio</th><td>${esc(bio.text)}</td></tr>` : ''}
        ${aboutMe ? `<tr><th>About Me</th><td>${esc(aboutMe)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  ${ncmec.length > 0 ? `
    <div class="mwr-card">
      <h3>NCMEC Reports (${ncmec.length})</h3>
      <table class="mwr-table">
        <thead><tr>
          <th>Report ID</th><th>Date</th><th>Type</th><th>Notes</th>
        </tr></thead>
        <tbody>
          ${ncmec.map(n => `<tr>
            <td>${esc(n.reportId || n.id || '—')}</td>
            <td>${esc(n.dateSubmitted || n.date || '—')}</td>
            <td>${esc(n.industryReportType || n.type || '—')}</td>
            <td>${esc(n.notes || '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
</section>`;
}

function buildIpActivity(rec: MetaRecord, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const ips = rec.ipAddresses || [];
  const rows = mode === 'flagged-only'
    ? ips.filter(ip => isFlagged(flags, 'ipActivity', ip.ip || ''))
    : ips;
  if (rows.length === 0) return '';

  const ipMap: Record<string, number> = {};
  for (const e of ips) if (e.ip) ipMap[e.ip] = (ipMap[e.ip] || 0) + 1;

  return `
<section class="mwr-section">
  <h2 class="mwr-section-title">🌐 IP Activity (${rows.length}${mode === 'full' ? '' : ` of ${ips.length}`})</h2>

  ${mode === 'full' ? `
    <div class="mwr-card">
      <h3>Unique IPs (${Object.keys(ipMap).length})</h3>
      <div class="mwr-chip-row">
        ${Object.entries(ipMap).map(([ip, n]) =>
          `<span class="mwr-chip">${esc(ip)} <span class="mwr-chip-count">×${n}</span></span>`
        ).join('')}
      </div>
    </div>` : ''}

  <div class="mwr-card">
    <table class="mwr-table">
      <thead><tr><th>IP Address</th><th>Timestamp</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(e => {
          const flagged = isFlagged(flags, 'ipActivity', e.ip || '');
          return `<tr class="${flagged ? 'mwr-row-flagged' : ''}">
            <td class="mwr-mono">${esc(e.ip || '—')}</td>
            <td>${esc(e.time || '—')}</td>
            <td>${flagged ? '<span class="mwr-flag-badge">🚩 FLAGGED</span>' : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</section>`;
}

function buildPosts(rec: MetaRecord, flags: Set<string>, mode: 'flagged-only' | 'full'): string {
  const inc = (section: string, k: string) =>
    mode === 'full' || isFlagged(flags, section, k);

  const status = (rec.statusUpdates || []).filter(u => inc('statusUpdates', u.id || FK.statusUpdate(u)));
  const wall   = (rec.wallposts || []).filter(w => inc('wallposts', w.id || FK.wallpost(w)));
  const other  = (rec.postsToOtherWalls || []).filter(p => inc('otherWallPosts', p.id || ''));
  const share  = (rec.shares || []).filter(s => inc('shares', FK.share(s)));

  if (!status.length && !wall.length && !other.length && !share.length) return '';

  const post = (cls: string, headerHtml: string, body: string, flagged: boolean, extras = ''): string =>
    `<div class="mwr-post ${cls} ${flagged ? 'mwr-flagged' : ''}">
       <div class="mwr-post-head">${headerHtml}${flagged ? '<span class="mwr-flag-badge">🚩 FLAGGED</span>' : ''}</div>
       <div class="mwr-post-body">${body}</div>
       ${extras}
     </div>`;

  return `
<section class="mwr-section">
  <h2 class="mwr-section-title">📝 Posts &amp; Activity</h2>

  ${status.length > 0 ? `
    <div class="mwr-card">
      <h3>Status Updates (${status.length})</h3>
      ${status.map(u => post(
        'mwr-status',
        `<strong>${esc(u.author || 'Unknown')}</strong> <span class="mwr-time">${esc(u.posted || '')}</span>`,
        esc(u.status || '(no text)'),
        isFlagged(flags, 'statusUpdates', u.id || FK.statusUpdate(u)),
        u.lifeExperience ? `<div class="mwr-post-extra">Life Experience: ${esc(u.lifeExperience)}</div>` : ''
      )).join('')}
    </div>` : ''}

  ${wall.length > 0 ? `
    <div class="mwr-card">
      <h3>Wallposts (${wall.length})</h3>
      ${wall.map(w => post(
        'mwr-wall',
        `<strong>${esc(w.from || 'Unknown')}</strong> → <strong>${esc(w.to || 'Unknown')}</strong> <span class="mwr-time">${esc(w.time || '')}</span>`,
        esc(w.text || '(no text)'),
        isFlagged(flags, 'wallposts', w.id || FK.wallpost(w))
      )).join('')}
    </div>` : ''}

  ${other.length > 0 ? `
    <div class="mwr-card">
      <h3>Posts to Other Walls (${other.length})</h3>
      ${other.map(p => post(
        'mwr-other',
        `→ <strong>${esc(p.timelineOwner || 'Unknown')}</strong> <span class="mwr-time">${esc(p.time || '')}</span>`,
        esc(p.post || '(no text)'),
        isFlagged(flags, 'otherWallPosts', p.id || '')
      )).join('')}
    </div>` : ''}

  ${share.length > 0 ? `
    <div class="mwr-card">
      <h3>Shares (${share.length})</h3>
      ${share.map(s => post(
        'mwr-share',
        `<span class="mwr-time">${esc(s.dateCreated || '')}</span>`,
        `${s.title ? `<div class="mwr-share-title">${esc(s.title)}</div>` : ''}
         <div>${esc(s.text || s.summary || '(no text)')}</div>
         ${s.url ? `<div class="mwr-share-url">${esc(s.url)}</div>` : ''}`,
        isFlagged(flags, 'shares', FK.share(s))
      )).join('')}
    </div>` : ''}
</section>`;
}

function buildPhotos(
  rec: MetaRecord,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
): string {
  const all = rec.photos || [];
  const photos = mode === 'flagged-only'
    ? all.filter(p => isFlagged(flags, 'photos', p.id || FK.photo(p)))
    : all;
  if (photos.length === 0) return '';

  // Group by album
  const albums: Record<string, any[]> = {};
  for (const p of photos) (albums[p.album || 'Other'] ||= []).push(p);

  const renderPhoto = (p: any): string => {
    const flagged = isFlagged(flags, 'photos', p.id || FK.photo(p));
    const fn = p.imageFile ? p.imageFile.replace('linked_media/', '') : null;
    // Embed flagged photos always; in full mode also embed non-flagged (kept compact via mediaIndex check).
    // For very large bundles in full mode, you may want to gate this — but DA bundles tend to be small.
    const dataUrl = readMediaAsDataUrl(zip, mediaIndex, fn);
    const imgHtml = dataUrl
      ? `<img src="${dataUrl}" alt="${esc(p.title || '')}" />`
      : `<div class="mwr-photo-placeholder">📷<br><span class="mwr-faint">${esc(fn || 'no file')}</span></div>`;
    return `
<div class="mwr-photo ${flagged ? 'mwr-flagged' : ''}">
  ${flagged ? '<div class="mwr-photo-badge">🚩 FLAGGED</div>' : ''}
  ${imgHtml}
  <div class="mwr-photo-meta">
    ${p.title ? `<div class="mwr-photo-title">${esc(p.title)}</div>` : ''}
    <div class="mwr-faint">${esc(p.uploaded || '')}</div>
    ${p.uploadIp ? `<div class="mwr-faint mwr-mono">IP: ${esc(p.uploadIp)}</div>` : ''}
    ${fn ? `<div class="mwr-faint mwr-mono">${esc(fn)}</div>` : ''}
  </div>
</div>`;
  };

  return `
<section class="mwr-section">
  <h2 class="mwr-section-title">📷 Photos (${photos.length}${mode === 'full' ? '' : ` of ${all.length}`})</h2>
  ${Object.entries(albums).map(([name, list]) => `
    <div class="mwr-card">
      <h3>📁 ${esc(name)} (${list.length})</h3>
      <div class="mwr-photo-grid">${list.map(renderPhoto).join('')}</div>
    </div>`).join('')}
</section>`;
}

function buildMessages(
  rec: MetaRecord,
  flags: Set<string>,
  mode: 'flagged-only' | 'full',
  zip: AdmZip,
  mediaIndex: Record<string, MediaIndexEntry>,
): string {
  const threads = rec.messages?.threads || [];
  if (threads.length === 0) return '';

  // Filter: in flagged-only mode keep only threads with at least one flagged message;
  // within a kept thread, only render flagged messages (preserving thread context header).
  const kept = threads.map(t => {
    const tid = t.threadId || '?';
    const msgs = (t.messages || []);
    const flaggedMsgs = msgs.filter(m => isFlagged(flags, 'messages', FK.message(tid, m)));
    if (mode === 'flagged-only') {
      if (flaggedMsgs.length === 0) return null;
      return { ...t, messages: flaggedMsgs, _totalInThread: msgs.length };
    }
    return { ...t, messages: msgs, _totalInThread: msgs.length };
  }).filter(Boolean) as any[];

  if (kept.length === 0) return '';

  const renderAttachment = (att: any): string => {
    const fn = (att.images || [])[0]?.replace('linked_media/', '')
            || att.linkedMediaFile?.replace('linked_media/', '');
    const dataUrl = fn ? readMediaAsDataUrl(zip, mediaIndex, fn) : null;
    const meta: string[] = [];
    if (att.type) meta.push(esc(att.type));
    if (att.size) meta.push(`${(parseInt(att.size) / 1024).toFixed(0)} KB`);
    if (fn) meta.push(`<span class="mwr-mono">${esc(fn)}</span>`);
    return `<div class="mwr-msg-att">
      ${dataUrl ? `<img src="${dataUrl}" alt="attachment" />` : '<div class="mwr-photo-placeholder">📎</div>'}
      <div class="mwr-faint">${meta.join(' · ')}</div>
    </div>`;
  };

  const renderMsg = (tid: string, m: any): string => {
    const flagged = isFlagged(flags, 'messages', FK.message(tid, m));
    return `<div class="mwr-msg ${flagged ? 'mwr-flagged' : ''}">
      <div class="mwr-msg-head">
        <strong>${esc(m.author || 'Unknown')}</strong>
        <span class="mwr-time">${esc(m.sent || '')}</span>
        ${flagged ? '<span class="mwr-flag-badge">🚩 FLAGGED</span>' : ''}
      </div>
      <div class="mwr-msg-body">${nl2br(esc(m.body || ''))}</div>
      ${(m.attachments || []).map(renderAttachment).join('')}
    </div>`;
  };

  return `
<section class="mwr-section">
  <h2 class="mwr-section-title">💬 Messages (${kept.length} thread${kept.length !== 1 ? 's' : ''})</h2>
  ${kept.map(t => {
    const tid = t.threadId || '?';
    return `<div class="mwr-card">
      <h3>Thread ${esc(tid)}
        <span class="mwr-faint">— ${t.messages.length} of ${t._totalInThread} message${t._totalInThread !== 1 ? 's' : ''}</span>
      </h3>
      <div class="mwr-participants">
        ${(t.participants || []).map((p: string) => `<span class="mwr-chip">${esc(p)}</span>`).join('')}
      </div>
      <div class="mwr-msg-list">
        ${t.messages.map((m: any) => renderMsg(tid, m)).join('')}
      </div>
    </div>`;
  }).join('')}
</section>`;
}

// ─── Print-friendly self-contained CSS ──────────────────────────────────────

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
.mwr-doc { max-width: 1100px; margin: 0 auto; background: #ffffff; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

/* Header */
.mwr-header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px; }
.mwr-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.mwr-brand-title { font-size: 18px; font-weight: 700; color: #1e3a8a; }
.mwr-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mwr-stamp { text-align: right; font-size: 12px; color: #374151; }
.mwr-stamp div { margin-bottom: 2px; }

.mwr-meta { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.mwr-meta th { text-align: left; padding: 4px 8px; width: 110px; color: #6b7280; font-weight: 600; background: #f9fafb; border: 1px solid #e5e7eb; }
.mwr-meta td { padding: 4px 8px; border: 1px solid #e5e7eb; }

.mwr-summary { margin-top: 16px; }
.mwr-summary-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.mwr-summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.mwr-summary-table th { background: #1d4ed8; color: white; padding: 6px 8px; text-align: left; }
.mwr-summary-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.mwr-summary-total td { font-weight: 700; color: #1d4ed8; background: #eff6ff; }

/* Section */
.mwr-section { margin: 28px 0; }
.mwr-section-title { font-size: 16px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
.mwr-card { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px; }
.mwr-card h3 { font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 10px 0; }
.mwr-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* KV tables */
.mwr-kv { width: 100%; border-collapse: collapse; font-size: 12px; }
.mwr-kv th { text-align: left; padding: 3px 8px; color: #6b7280; font-weight: 600; vertical-align: top; width: 130px; }
.mwr-kv td { padding: 3px 8px; vertical-align: top; }

/* Data tables */
.mwr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.mwr-table th { background: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
.mwr-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.mwr-row-flagged { background: #fef3c7 !important; }

/* Posts */
.mwr-post { border-left: 3px solid #d1d5db; padding: 8px 10px; margin-bottom: 8px; background: white; }
.mwr-post.mwr-flagged { border-left-color: #d97706; background: #fffbeb; }
.mwr-post-head { font-size: 11px; color: #6b7280; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mwr-post-body { font-size: 13px; color: #1f2937; white-space: pre-wrap; }
.mwr-post-extra { font-size: 11px; color: #6b7280; margin-top: 4px; }
.mwr-share-title { font-weight: 600; margin-bottom: 4px; }
.mwr-share-url { color: #2563eb; font-size: 11px; margin-top: 4px; word-break: break-all; }
.mwr-time { color: #9ca3af; }

/* Photos */
.mwr-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.mwr-photo { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: white; position: relative; }
.mwr-photo.mwr-flagged { border-color: #d97706; box-shadow: 0 0 0 2px #fde68a; }
.mwr-photo img { width: 100%; height: 180px; object-fit: cover; display: block; }
.mwr-photo-placeholder { width: 100%; height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 24px; }
.mwr-photo-meta { padding: 8px; font-size: 11px; }
.mwr-photo-title { font-weight: 600; color: #374151; margin-bottom: 2px; font-size: 12px; }
.mwr-photo-badge { position: absolute; top: 6px; right: 6px; background: #d97706; color: white; padding: 2px 6px; font-size: 10px; border-radius: 3px; font-weight: 700; z-index: 2; }

/* Messages */
.mwr-participants { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
.mwr-chip { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.mwr-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.mwr-chip-count { color: #6b7280; font-size: 10px; margin-left: 4px; }
.mwr-msg-list { display: flex; flex-direction: column; gap: 6px; }
.mwr-msg { background: white; border: 1px solid #e5e7eb; border-left: 3px solid #d1d5db; padding: 8px 10px; border-radius: 3px; }
.mwr-msg.mwr-flagged { border-left-color: #d97706; background: #fffbeb; }
.mwr-msg-head { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; margin-bottom: 4px; flex-wrap: wrap; }
.mwr-msg-head strong { color: #374151; }
.mwr-msg-body { font-size: 13px; white-space: pre-wrap; }
.mwr-msg-att { display: inline-block; margin: 6px 6px 0 0; }
.mwr-msg-att img { max-width: 200px; max-height: 200px; border-radius: 3px; border: 1px solid #e5e7eb; }

/* Misc */
.mwr-flag-badge { background: #d97706; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; margin-left: auto; }
.mwr-faint { color: #9ca3af; font-size: 11px; }
.mwr-mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; }

/* Print */
@media print {
  body { background: white; padding: 0; }
  .mwr-doc { box-shadow: none; padding: 0; max-width: none; }
  .mwr-section { page-break-inside: avoid; }
  .mwr-card { page-break-inside: avoid; }
  .mwr-photo { page-break-inside: avoid; }
  .mwr-msg { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

// ─── Public entry ──────────────────────────────────────────────────────────

export function buildMetaWarrantReport(args: BuildReportArgs): string {
  // Pick the primary (records.html) record as main; preservation sections are appended.
  const mainRec = args.records.find(r => r.source === 'records') || args.records[0];
  if (!mainRec) {
    return `<!DOCTYPE html><html><body><h1>Empty Meta Warrant Bundle</h1><p>No records found in import.</p></body></html>`;
  }

  const counts = buildCounts(args.records, args.flagKeys);

  const sections: string[] = [];
  sections.push(buildHeader(args, mainRec, counts));

  // Build sections (only main record for now; preservation records mirror the same schema and
  // can be added later if needed).
  if (args.mode === 'full') {
    sections.push(buildOverview(mainRec, args.flagKeys));
  }
  const ip   = buildIpActivity(mainRec, args.flagKeys, args.mode);   if (ip) sections.push(ip);
  const pos  = buildPosts(mainRec, args.flagKeys, args.mode);        if (pos) sections.push(pos);
  const pho  = buildPhotos(mainRec, args.flagKeys, args.mode, args.zip, args.mediaIndex); if (pho) sections.push(pho);
  const msg  = buildMessages(mainRec, args.flagKeys, args.mode, args.zip, args.mediaIndex); if (msg) sections.push(msg);

  // Footer
  const footer = `
<footer class="mwr-footer">
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
  <div class="mwr-faint" style="text-align: center; padding-top: 12px;">
    Generated by ICAC P.U.L.S.E. — Meta Warrant Bundle (${esc(args.mode)})<br>
    Case ${esc(args.caseNumber)} · ${esc(args.generatedAt)}
  </div>
</footer>`;
  sections.push(footer);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Meta Warrant Bundle — Case ${esc(args.caseNumber)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="mwr-doc">
${sections.join('\n')}
</div>
</body>
</html>`;
}
