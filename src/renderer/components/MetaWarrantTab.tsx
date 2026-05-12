import { useState, useEffect, useRef } from 'react';
import '../styles/meta-warrant.css';

interface MetaWarrantTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Types (match parser output) ────────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

interface MetaRecord {
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
  messages: { threads: { threadId: string | null; participants: string[]; messages: any[] }[] };
  postsToOtherWalls: any[];
  bio: { text: string | null; creationTime: string | null } | null;
}

interface MetaImportHeader {
  id: number;
  caseId: number;
  label: string;
  sourcePath: string;
  sourceKind: string;
  sourceRefId: number | null;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MetaImportFull extends MetaImportHeader {
  records: MetaRecord[];
  mediaIndex: Record<string, MediaIndexEntry>;
}

interface ScanCandidate {
  filePath: string;
  sourceKind: 'warrant' | 'evidence';
  sourceRefId: number;
  hint?: string;
  size: number;
}

interface WarrantFlag {
  id: number;
  caseId: number;
  provider: string;
  importId: number | null;
  section: string;
  flagKey: string;
  notes: string | null;
  createdAt: string;
}

type SectionId = 'overview' | 'ipActivity' | 'posts' | 'photos' | 'messages' | 'timeline';

// ─── Stable flag-key generators (ported from Viper's WarrantFlagsKey) ───────

const FlagKey = {
  message:      (threadId: string, m: any) => [threadId || '', m.author || '', m.sent || ''].join('|'),
  statusUpdate: (u: any) => [u.posted || '', u.author || '', (u.status || '').substring(0, 40)].join('|'),
  wallpost:     (w: any) => [w.from || '', w.to || '', w.time || ''].join('|'),
  share:        (s: any) => [s.dateCreated || '', s.title || '', (s.url || '').substring(0, 60)].join('|'),
  photo:        (p: any) => [p.album || p.albumName || '', p.uploaded || '', p.title || ''].join('|'),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatSize = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const baseName = (p: string): string => {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
};

// ─── Lazy image (reads from ZIP on demand via IPC) ──────────────────────────

interface LazyImageProps {
  importId: number;
  fileName: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
  cache: Record<string, string>;
}

function LazyImage({ importId, fileName, alt, className, cache }: LazyImageProps) {
  const [src, setSrc] = useState<string | null>(cache[fileName] || null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (cache[fileName]) {
      setSrc(cache[fileName]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await window.electronAPI.metaWarrantReadMedia({ importId, fileName });
        if (cancelled) return;
        if (r.success && r.dataUrl) {
          cache[fileName] = r.dataUrl;
          setSrc(r.dataUrl);
        } else {
          setErrored(true);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    })();
    return () => { cancelled = true; };
  }, [importId, fileName]);

  if (errored) return <div className="mwp-photo-placeholder">📷</div>;
  if (!src) return <div className="mwp-photo-placeholder">…</div>;
  return <img src={src} alt={alt || ''} className={className} loading="lazy" />;
}

// ─── ARIN lookup chip (uses existing project IPC) ───────────────────────────

function ArinButton({ ip }: { ip: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [info, setInfo] = useState<string>('');

  const lookup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'loading') return;
    setState('loading');
    try {
      const r: any = await (window.electronAPI as any).arinLookup(ip);
      if (r.success) {
        const d = r.data || r;
        const parts: string[] = [];
        if (d.provider) parts.push(d.provider);
        else if (d.organization) parts.push(d.organization);
        if (d.network) parts.push(d.network);
        if (d.netRange) parts.push(d.netRange);
        setInfo(parts.join(' · '));
        setState('success');
      } else {
        setInfo(r.error || 'Lookup failed');
        setState('fail');
      }
    } catch (e: any) {
      setInfo(e.message);
      setState('fail');
    }
  };

  return (
    <>
      <button
        className={`mwp-arin-btn ${state === 'success' ? 'mwp-arin-done' : ''} ${state === 'fail' ? 'mwp-arin-fail' : ''}`}
        title={info || 'ARIN WHOIS Lookup'}
        onClick={lookup}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? '⏳' : state === 'success' ? '✓' : state === 'fail' ? '✗' : '🌐'}
      </button>
      {info && state === 'success' && (
        <span className="mwp-arin-result mwp-arin-success" title={info}>{info}</span>
      )}
    </>
  );
}

// ─── Flag button ────────────────────────────────────────────────────────────

interface FlagButtonProps {
  section: string;
  flagKey: string;
  flagged: boolean;
  onToggle: (section: string, flagKey: string) => void;
  label?: string;
}

function FlagButton({ section, flagKey, flagged, onToggle, label }: FlagButtonProps) {
  return (
    <button
      className={`mwp-flag-btn ${flagged ? 'on' : ''}`}
      title={flagged ? 'Unflag' : 'Flag for evidence bundle'}
      onClick={(e) => { e.stopPropagation(); onToggle(section, flagKey); }}
    >
      🚩{label ? <span style={{ marginLeft: 2 }}>{label}</span> : ''}
    </button>
  );
}

// ─── Stat badge / KV row helpers (no escaping needed in JSX) ────────────────

function StatBadge({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <div className={`mwp-stat ${count > 0 ? 'has-data' : ''}`}>
      <span className="mwp-stat-icon">{icon}</span>
      <span className="mwp-stat-count">{count}</span>
      <span className="mwp-stat-label">{label}</span>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="mwp-kv-row">
      <span className="mwp-kv-label">{label}</span>
      <span className="mwp-kv-value">{String(value)}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MetaWarrantTab({ caseId, caseNumber }: MetaWarrantTabProps) {
  // List/scan state
  const [imports, setImports] = useState<MetaImportHeader[]>([]);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Detail-view state
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [activeImport, setActiveImport] = useState<MetaImportFull | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [flags, setFlags] = useState<Set<string>>(new Set()); // key = "section|flagKey"
  const [photoDetail, setPhotoDetail] = useState<any | null>(null);
  const [pushingEvidence, setPushingEvidence] = useState(false);
  const mediaCache = useRef<Record<string, string>>({});

  // ── Refresh helpers ──────────────────────────────────────────────────────

  const refreshImports = async () => {
    try {
      const r = await window.electronAPI.metaWarrantListImports(caseId);
      if (r.success) setImports(r.imports);
      else setError(r.error || 'Failed to load imports');
    } catch (e: any) { setError(e.message); }
  };

  const refreshScan = async () => {
    setScanning(true);
    try {
      const r = await window.electronAPI.metaWarrantScan(caseId);
      if (r.success) setCandidates(r.candidates);
    } catch { /* non-fatal */ }
    setScanning(false);
  };

  const loadImport = async (id: number) => {
    try {
      const r = await window.electronAPI.metaWarrantGetImport(id);
      if (r.success && r.import) {
        setActiveImport(r.import as MetaImportFull);
        // Reset media cache when switching imports
        mediaCache.current = {};
        setActiveSection('overview');
        // Load flags for this import
        const f = await window.electronAPI.warrantFlagList({ caseId, provider: 'meta', importId: id });
        if (f.success) {
          const set = new Set<string>(f.flags.map(fl => `${fl.section}|${fl.flagKey}`));
          setFlags(set);
        }
      } else {
        setError(r.error || 'Failed to load import');
      }
    } catch (e: any) { setError(e.message); }
  };

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshImports();
      await refreshScan();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    if (!activeImportId) { setActiveImport(null); return; }
    loadImport(activeImportId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImportId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleImportCandidate = async (c: ScanCandidate) => {
    setImporting(true);
    setError(null);
    try {
      const r = await window.electronAPI.metaWarrantImport({
        caseId, filePath: c.filePath, sourceKind: c.sourceKind, sourceRefId: c.sourceRefId,
      });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: `Imported ${r.recordsCount ?? 0} record file(s), ${r.mediaCount ?? 0} media`, type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handlePickAndImport = async () => {
    setError(null);
    try {
      const p = await window.electronAPI.metaWarrantPickFile();
      if (p.canceled) return;
      if (!p.success || !p.filePath) { setError(p.error || 'File selection failed'); return; }
      setImporting(true);
      const r = await window.electronAPI.metaWarrantImport({ caseId, filePath: p.filePath, sourceKind: 'picker' });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: `Imported ${r.recordsCount ?? 0} record file(s)`, type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handleDeleteImport = async (imp: MetaImportHeader) => {
    if (!window.confirm(`Delete "${imp.label}" and all its flags? This cannot be undone.`)) return;
    try {
      const r = await window.electronAPI.metaWarrantDeleteImport(imp.id);
      if (!r.success) { setError(r.error || 'Delete failed'); return; }
      if (activeImportId === imp.id) setActiveImportId(null);
      setToast({ msg: 'Import deleted', type: 'success' });
      await refreshImports();
      await refreshScan();
    } catch (e: any) { setError(e.message); }
  };

  const toggleFlag = async (section: string, flagKey: string) => {
    if (!activeImport) return;
    const composite = `${section}|${flagKey}`;
    try {
      const r = await window.electronAPI.warrantFlagToggle({
        caseId, provider: 'meta', importId: activeImport.id, section, flagKey,
      });
      if (!r.success) { setError(r.error || 'Flag toggle failed'); return; }
      setFlags(prev => {
        const next = new Set(prev);
        if (r.flagged) next.add(composite); else next.delete(composite);
        return next;
      });
    } catch (e: any) { setError(e.message); }
  };

  const clearAllFlags = async () => {
    if (!activeImport || flags.size === 0) return;
    if (!window.confirm(`Clear all ${flags.size} flag(s)?`)) return;
    try {
      const r = await window.electronAPI.warrantFlagClear({ caseId, provider: 'meta', importId: activeImport.id });
      if (!r.success) { setError(r.error || 'Clear failed'); return; }
      setFlags(new Set());
      setToast({ msg: 'Flags cleared', type: 'info' });
    } catch (e: any) { setError(e.message); }
  };

  const pushToEvidence = async (mode: 'flagged-only' | 'full') => {
    if (!activeImport) return;
    if (mode === 'flagged-only' && flags.size === 0) {
      setToast({ msg: 'Flag at least one item before pushing a flagged bundle.', type: 'error' });
      return;
    }
    const confirmMsg = mode === 'flagged-only'
      ? `Build a Flagged-Only bundle with ${flags.size} item(s) and add it to the Evidence module?`
      : `Build a Full bundle of this Meta production and add it to the Evidence module?\n\nNote: full bundles can be large if there are many photos/attachments.`;
    if (!window.confirm(confirmMsg)) return;

    setPushingEvidence(true);
    try {
      const r = await window.electronAPI.metaWarrantExportBundle({ importId: activeImport.id, mode });
      if (!r.success) {
        setError(r.error || 'Export failed');
        setToast({ msg: `Export failed: ${r.error || 'unknown error'}`, type: 'error' });
        return;
      }
      const label = mode === 'flagged-only' ? `${r.flaggedCount} flagged item(s)` : 'full production';
      setToast({ msg: `✅ Bundle added to Evidence (${label}). Open the Evidence tab to view.`, type: 'info' });
    } catch (e: any) {
      setError(e.message);
      setToast({ msg: `Export failed: ${e.message}`, type: 'error' });
    } finally {
      setPushingEvidence(false);
    }
  };

  const isFlagged = (section: string, flagKey: string) => flags.has(`${section}|${flagKey}`);

  // ─── Render: empty / list view ────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-gray-400">Loading Meta warrant data…</div>;
  }

  // If no import is currently selected, show the list + scan view
  if (!activeImportId || !activeImport) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Meta Warrant Parser</h2>
            <p className="text-sm text-gray-400 mt-1">
              Facebook / Instagram production parser — Case {caseNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshScan}
              disabled={scanning}
              className="px-3 py-1.5 text-sm rounded border border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : 'Rescan'}
            </button>
            <button
              onClick={handlePickAndImport}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import ZIP…'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-300 text-sm flex items-start justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 text-red-200 hover:text-white">✕</button>
          </div>
        )}

        {toast && (
          <div className={`rounded border px-4 py-2 text-sm ${
            toast.type === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-300' :
            toast.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
            'border-blue-500/40 bg-blue-500/10 text-blue-300'
          }`}>{toast.msg}</div>
        )}

        {candidates.length > 0 && (
          <section className="rounded-lg border border-amber-500/40 bg-amber-500/5">
            <header className="px-4 py-2 border-b border-amber-500/30 text-sm font-medium text-amber-200">
              Detected in Warrants / Evidence — {candidates.length} ready to parse
            </header>
            <ul className="divide-y divide-gray-700/60">
              {candidates.map((c, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{baseName(c.filePath)}</div>
                    <div className="text-xs text-gray-400 truncate">
                      From {c.sourceKind === 'warrant' ? 'Warrants' : 'Evidence'}
                      {c.hint ? ` — ${c.hint}` : ''} · {formatSize(c.size)}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">{c.filePath}</div>
                  </div>
                  <button
                    onClick={() => handleImportCandidate(c)}
                    disabled={importing}
                    className="ml-4 shrink-0 px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                  >
                    Parse & Import
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-gray-700 bg-gray-800/40">
          <header className="px-4 py-2 border-b border-gray-700 text-sm font-medium text-gray-200">
            Imported productions {imports.length > 0 && <span className="text-gray-500">({imports.length})</span>}
          </header>
          {imports.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">
              No Meta warrant returns imported yet. Click <strong>Import ZIP…</strong> to select a production,
              or drop the ZIP into the Warrants/Evidence module first and rescan.
            </div>
          ) : (
            <ul className="divide-y divide-gray-700/60">
              {imports.map((imp) => (
                <li
                  key={imp.id}
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-700/30"
                  onClick={() => setActiveImportId(imp.id)}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{imp.label}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {imp.sourceKind === 'warrant' ? 'From Warrants' :
                       imp.sourceKind === 'evidence' ? 'From Evidence' : 'Picker'}
                      {' · '}{imp.mediaCount} media · Imported {new Date(imp.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImport(imp); }}
                    className="ml-4 shrink-0 px-2 py-1 text-xs rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // ─── Render: detail view (Viper-style layout) ─────────────────────────────

  const rec = activeImport.records.find(r => r.source === 'records') || activeImport.records[0];
  const pres = activeImport.records.find(r => r.source !== 'records') || null;
  const totalMessages = rec.messages?.threads?.reduce((s, t) => s + (t.messages?.length || 0), 0) || 0;
  const totalPosts = (rec.statusUpdates?.length || 0) + (rec.wallposts?.length || 0) +
                     (rec.postsToOtherWalls?.length || 0) + (rec.shares?.length || 0);

  const navSections: { id: SectionId; label: string; icon: string; count?: number; show: boolean }[] = [
    { id: 'overview',   label: 'Account Overview', icon: '👤', show: true },
    { id: 'ipActivity', label: 'IP Activity',      icon: '🌐', count: rec.ipAddresses?.length, show: (rec.ipAddresses?.length || 0) > 0 },
    { id: 'posts',      label: 'Posts & Activity', icon: '📝', count: totalPosts, show: totalPosts > 0 },
    { id: 'photos',     label: 'Photos',           icon: '📷', count: rec.photos?.length, show: (rec.photos?.length || 0) > 0 },
    { id: 'messages',   label: 'Messages',         icon: '💬', count: totalMessages, show: (rec.messages?.threads?.length || 0) > 0 },
    { id: 'timeline',   label: 'Timeline',         icon: '🕐', show: true },
  ];

  return (
    <div>
      {/* Top bar with back/breadcrumb + delete */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-700/60">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setActiveImportId(null)}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Imports
          </button>
          <span className="text-gray-500">/</span>
          <span className="text-white">{activeImport.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDeleteImport(activeImport)}
            className="px-2 py-1 text-xs rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
          >
            Delete import
          </button>
        </div>
      </div>

      {error && (
        <div className="m-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-300 text-sm flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-200 hover:text-white">✕</button>
        </div>
      )}
      {toast && (
        <div className={`m-6 rounded border px-4 py-2 text-sm ${
          toast.type === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-300' :
          toast.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
          'border-blue-500/40 bg-blue-500/10 text-blue-300'
        }`}>{toast.msg}</div>
      )}

      <div className="mwp-layout">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="mwp-sidebar">
          {/* Flag toolbar */}
          <div className="mwp-flag-toolbar">
            <button
              className="mwp-flag-header-btn"
              title="Flagged item count — click to clear all flags"
              onClick={clearAllFlags}
            >
              🚩 Flags
              <span className="mwp-flag-count-pill">{flags.size.toLocaleString()}</span>
            </button>
            <div className="mwp-flag-toolbar-spacer" />
            <button
              className="mwp-push-btn"
              disabled={flags.size === 0 || pushingEvidence}
              onClick={() => pushToEvidence('flagged-only')}
              title="Build an HTML bundle of just the flagged items and add it to the Evidence module (DA-ready)"
            >
              {pushingEvidence ? '⏳ Building…' : `📥 Push Flagged (${flags.size})`}
            </button>
            <button
              className="mwp-btn-sm"
              disabled={pushingEvidence}
              onClick={() => pushToEvidence('full')}
              title="Build an HTML bundle of the FULL Meta production and add it to the Evidence module"
              style={{ marginLeft: 6 }}
            >
              📦 Full Bundle
            </button>
          </div>

          {/* Nav */}
          <nav className="mwp-nav">
            {navSections.filter(s => s.show).map(s => (
              <button
                key={s.id}
                className={`mwp-nav-item ${s.id === activeSection ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span className="mwp-nav-icon">{s.icon}</span>
                <span className="mwp-nav-label">{s.label}</span>
                {s.count ? <span className="mwp-nav-count">{s.count}</span> : null}
              </button>
            ))}
          </nav>
          <div className="mwp-nav-actions">
            <button className="mwp-btn-sm" onClick={handlePickAndImport}>+ Import ZIP</button>
            <button className="mwp-btn-sm danger" onClick={() => handleDeleteImport(activeImport)}>🗑️ Delete</button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="mwp-content">
          {activeSection === 'overview'   && renderOverview(rec, pres, activeImport, totalMessages)}
          {activeSection === 'ipActivity' && renderIpActivity(rec, isFlagged, toggleFlag)}
          {activeSection === 'posts'      && renderPosts(rec, isFlagged, toggleFlag)}
          {activeSection === 'photos'     && renderPhotos(rec, activeImport, isFlagged, toggleFlag, setPhotoDetail, mediaCache.current)}
          {activeSection === 'messages'   && renderMessages(rec, activeImport, isFlagged, toggleFlag, mediaCache.current)}
          {activeSection === 'timeline'   && renderTimeline(rec)}
        </div>
      </div>

      {/* Photo lightbox */}
      {photoDetail && (
        <div
          className="mwp-lightbox"
          onClick={(e) => { if (e.target === e.currentTarget) setPhotoDetail(null); }}
        >
          <div className="mwp-lightbox-content">
            <button className="mwp-lightbox-close" onClick={() => setPhotoDetail(null)}>✕</button>
            {(() => {
              const fn = photoDetail.imageFile ? photoDetail.imageFile.replace('linked_media/', '') : null;
              const hasFile = fn && activeImport.mediaIndex[fn];
              return hasFile
                ? <LazyImage importId={activeImport.id} fileName={fn!} className="mwp-lightbox-img" cache={mediaCache.current} />
                : <div className="mwp-photo-placeholder" style={{ width: 400, height: 300 }}>📷 No image data</div>;
            })()}
            <div className="mwp-lightbox-details">
              {photoDetail.title && <h3>{photoDetail.title}</h3>}
              <div className="mwp-kv-list">
                <KvRow label="Album"     value={photoDetail.album} />
                <KvRow label="ID"        value={photoDetail.id} />
                <KvRow label="Uploaded"  value={photoDetail.uploaded} />
                <KvRow label="Upload IP" value={photoDetail.uploadIp} />
                <KvRow label="Author"    value={photoDetail.author} />
                <KvRow label="Tags"      value={photoDetail.tags} />
                <KvRow label="Link"      value={photoDetail.link} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Section renderers — ported 1:1 from Viper's meta-warrant-ui.js
// ════════════════════════════════════════════════════════════════════════════

function renderOverview(rec: MetaRecord, pres: MetaRecord | null, imp: MetaImportFull, totalMessages: number) {
  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">
        <span className="mwp-meta-logo">{rec.service === 'Instagram' ? '📸' : '📘'}</span>
        {' '}{rec.service} Account — {rec.targetId || 'Unknown'}
      </h2>

      <div className="mwp-card-grid">
        <div className="mwp-card">
          <h3 className="mwp-card-title">📋 Request Parameters</h3>
          <div className="mwp-kv-list">
            <KvRow label="Service"     value={rec.service} />
            <KvRow label="Target ID"   value={rec.targetId} />
            <KvRow label="Account ID"  value={rec.accountId} />
            <KvRow label="Date Range"  value={rec.dateRange} />
            <KvRow label="Generated"   value={rec.generated} />
            <KvRow label="Imported"    value={imp.createdAt ? new Date(imp.createdAt).toLocaleString() : null} />
          </div>
        </div>

        {rec.bio && (
          <div className="mwp-card">
            <h3 className="mwp-card-title">👤 Bio</h3>
            <div className="mwp-kv-list">
              <KvRow label="Text"    value={rec.bio.text} />
              <KvRow label="Created" value={rec.bio.creationTime} />
            </div>
          </div>
        )}

        {rec.aboutMe && (
          <div className="mwp-card">
            <h3 className="mwp-card-title">ℹ️ About Me</h3>
            <p className="mwp-text">{rec.aboutMe}</p>
          </div>
        )}

        {rec.registrationIp && (
          <div className="mwp-card">
            <h3 className="mwp-card-title">🔒 Registration IP</h3>
            <p className="mwp-mono">{rec.registrationIp}</p>
          </div>
        )}

        {rec.ncmecReports.length > 0 && (
          <div className="mwp-card mwp-card-alert">
            <h3 className="mwp-card-title">⚠️ NCMEC Reports ({rec.ncmecReports.length})</h3>
            {rec.ncmecReports.map((r, i) => (
              <div key={i} className="mwp-ncmec-item">
                {Object.entries(r).map(([k, v]) => (
                  <div key={k}><strong>{k}:</strong> {String(v)}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="mwp-card mwp-card-full">
          <h3 className="mwp-card-title">📊 Data Summary</h3>
          <div className="mwp-stats-grid">
            <StatBadge label="IP Addresses"   count={rec.ipAddresses?.length || 0}        icon="🌐" />
            <StatBadge label="Status Updates" count={rec.statusUpdates?.length || 0}      icon="📝" />
            <StatBadge label="Wallposts"      count={rec.wallposts?.length || 0}          icon="📌" />
            <StatBadge label="Shares"         count={rec.shares?.length || 0}             icon="🔗" />
            <StatBadge label="Photos"         count={rec.photos?.length || 0}             icon="📷" />
            <StatBadge label="Messages"       count={totalMessages}                       icon="💬" />
            <StatBadge label="Threads"        count={rec.messages?.threads?.length || 0}  icon="🧵" />
            <StatBadge label="Wall Posts"     count={rec.postsToOtherWalls?.length || 0}  icon="📤" />
          </div>
        </div>

        {pres && (
          <div className="mwp-card mwp-card-full">
            <h3 className="mwp-card-title">📁 Preservation Record</h3>
            <div className="mwp-kv-list">
              <KvRow label="Source"         value={pres.source} />
              <KvRow label="Generated"      value={pres.generated} />
              <KvRow label="Date Range"     value={pres.dateRange} />
              <KvRow label="Status Updates" value={pres.statusUpdates?.length || 0} />
              <KvRow label="Photos"         value={pres.photos?.length || 0} />
              <KvRow label="Messages"       value={pres.messages?.threads?.reduce((s, t) => s + (t.messages?.length || 0), 0) || 0} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderIpActivity(
  rec: MetaRecord,
  isFlagged: (s: string, k: string) => boolean,
  onToggle: (s: string, k: string) => void,
) {
  const ips = rec.ipAddresses || [];
  if (ips.length === 0) return <div className="mwp-empty">No IP address records</div>;

  const ipMap: Record<string, (string | null)[]> = {};
  for (const entry of ips) {
    if (!entry.ip) continue;
    (ipMap[entry.ip] ||= []).push(entry.time);
  }

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">🌐 IP Activity ({ips.length} records)</h2>

      <div className="mwp-card">
        <h3 className="mwp-card-title">Unique IPs ({Object.keys(ipMap).length})</h3>
        <div className="mwp-ip-chips">
          {Object.entries(ipMap).map(([ip, times]) => (
            <span key={ip} className="mwp-ip-chip">
              {ip} <span className="mwp-ip-count">×{times.length}</span>
              <ArinButton ip={ip} />
            </span>
          ))}
        </div>
      </div>

      <div className="mwp-card">
        <h3 className="mwp-card-title">Activity Log</h3>
        <table className="mwp-table">
          <thead><tr><th>IP Address</th><th>ARIN</th><th>Timestamp</th><th>Flag</th></tr></thead>
          <tbody>
            {ips.map((entry, i) => {
              const flagged = isFlagged('ipActivity', entry.ip || '');
              return (
                <tr key={i} className={flagged ? 'mwp-row-flagged' : ''}>
                  <td className="mwp-mono">{entry.ip || '—'}</td>
                  <td>{entry.ip ? <ArinButton ip={entry.ip} /> : '—'}</td>
                  <td>{entry.time || '—'}</td>
                  <td><FlagButton section="ipActivity" flagKey={entry.ip || ''} flagged={flagged} onToggle={onToggle} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderPosts(
  rec: MetaRecord,
  isFlagged: (s: string, k: string) => boolean,
  onToggle: (s: string, k: string) => void,
) {
  const updates = rec.statusUpdates || [];
  const wallposts = rec.wallposts || [];
  const otherWall = rec.postsToOtherWalls || [];
  const shares = rec.shares || [];

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">📝 Posts & Activity</h2>

      {updates.length > 0 && (
        <div className="mwp-card">
          <h3 className="mwp-card-title">Status Updates ({updates.length})</h3>
          <div className="mwp-post-list">
            {updates.map((u, i) => {
              const k = u.id || FlagKey.statusUpdate(u);
              const flagged = isFlagged('statusUpdates', k);
              return (
                <div key={i} className={`mwp-post-item ${flagged ? 'mwp-flagged' : ''}`}>
                  <div className="mwp-post-meta">
                    <span className="mwp-post-author">{u.author || 'Unknown'}</span>
                    <span className="mwp-post-time">{u.posted || ''}</span>
                    {u.mobile === 'true' && <span className="mwp-tag">📱 Mobile</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      <FlagButton section="statusUpdates" flagKey={k} flagged={flagged} onToggle={onToggle} />
                    </span>
                  </div>
                  <div className="mwp-post-body">{u.status || '(no text)'}</div>
                  {u.lifeExperience && <div className="mwp-post-extra">Life Experience: {u.lifeExperience}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wallposts.length > 0 && (
        <div className="mwp-card">
          <h3 className="mwp-card-title">Wallposts ({wallposts.length})</h3>
          <div className="mwp-post-list">
            {wallposts.map((w, i) => {
              const k = w.id || FlagKey.wallpost(w);
              const flagged = isFlagged('wallposts', k);
              return (
                <div key={i} className={`mwp-post-item ${flagged ? 'mwp-flagged' : ''}`}>
                  <div className="mwp-post-meta">
                    <span className="mwp-post-author">{w.from || 'Unknown'} → {w.to || 'Unknown'}</span>
                    <span className="mwp-post-time">{w.time || ''}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <FlagButton section="wallposts" flagKey={k} flagged={flagged} onToggle={onToggle} />
                    </span>
                  </div>
                  <div className="mwp-post-body">{w.text || '(no text)'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {otherWall.length > 0 && (
        <div className="mwp-card">
          <h3 className="mwp-card-title">Posts to Other Walls ({otherWall.length})</h3>
          <div className="mwp-post-list">
            {otherWall.map((p, i) => {
              const flagged = isFlagged('otherWallPosts', p.id || '');
              return (
                <div key={i} className={`mwp-post-item ${flagged ? 'mwp-flagged' : ''}`}>
                  <div className="mwp-post-meta">
                    <span className="mwp-post-author">→ {p.timelineOwner || 'Unknown'}</span>
                    <span className="mwp-post-time">{p.time || ''}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <FlagButton section="otherWallPosts" flagKey={p.id || ''} flagged={flagged} onToggle={onToggle} />
                    </span>
                  </div>
                  <div className="mwp-post-body">{p.post || '(no text)'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shares.length > 0 && (
        <div className="mwp-card">
          <h3 className="mwp-card-title">Shares ({shares.length})</h3>
          <div className="mwp-post-list">
            {shares.map((s, i) => {
              const k = FlagKey.share(s);
              const flagged = isFlagged('shares', k);
              return (
                <div key={i} className={`mwp-post-item ${flagged ? 'mwp-flagged' : ''}`}>
                  <div className="mwp-post-meta">
                    <span className="mwp-post-time">{s.dateCreated || ''}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <FlagButton section="shares" flagKey={k} flagged={flagged} onToggle={onToggle} />
                    </span>
                  </div>
                  {s.title && <div className="mwp-post-title">{s.title}</div>}
                  <div className="mwp-post-body">{s.text || s.summary || '(no text)'}</div>
                  {s.url && <a className="mwp-link" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function renderPhotos(
  rec: MetaRecord,
  imp: MetaImportFull,
  isFlagged: (s: string, k: string) => boolean,
  onToggle: (s: string, k: string) => void,
  onPhotoClick: (p: any) => void,
  cache: Record<string, string>,
) {
  const photos = rec.photos || [];
  if (photos.length === 0) return <div className="mwp-empty">No photos</div>;

  const albums: Record<string, any[]> = {};
  for (const p of photos) {
    const album = p.album || 'Other';
    (albums[album] ||= []).push(p);
  }

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">📷 Photos ({photos.length})</h2>
      {Object.entries(albums).map(([albumName, albumPhotos]) => (
        <div key={albumName} className="mwp-card">
          <h3 className="mwp-card-title">📁 {albumName} ({albumPhotos.length})</h3>
          <div className="mwp-photo-grid">
            {albumPhotos.map((p, i) => {
              const fn = p.imageFile ? p.imageFile.replace('linked_media/', '') : null;
              const inIndex = fn && imp.mediaIndex[fn];
              const k = p.id || FlagKey.photo(p);
              const flagged = isFlagged('photos', k);
              return (
                <div
                  key={i}
                  className={`mwp-photo-card ${flagged ? 'mwp-flagged' : ''}`}
                  onClick={() => onPhotoClick(p)}
                >
                  {inIndex
                    ? <LazyImage importId={imp.id} fileName={fn!} alt={p.title || ''} cache={cache} />
                    : <div className="mwp-photo-placeholder">📷</div>}
                  <div className="mwp-photo-info">
                    {p.title && <div className="mwp-photo-title">{p.title}</div>}
                    <div className="mwp-photo-meta">{p.uploaded || ''}</div>
                    {p.uploadIp && <div className="mwp-photo-ip">{p.uploadIp}</div>}
                  </div>
                  <div className="mwp-photo-flag">
                    <FlagButton section="photos" flagKey={k} flagged={flagged} onToggle={onToggle} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderMessages(
  rec: MetaRecord,
  imp: MetaImportFull,
  isFlagged: (s: string, k: string) => boolean,
  onToggle: (s: string, k: string) => void,
  cache: Record<string, string>,
) {
  const threads = rec.messages?.threads || [];
  if (threads.length === 0) return <div className="mwp-empty">No messages</div>;

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">💬 Messages ({threads.length} thread{threads.length !== 1 ? 's' : ''})</h2>
      {threads.map((thread, ti) => {
        const tid = thread.threadId || '?';
        const msgCount = thread.messages?.length || 0;
        return (
          <ThreadCard key={ti} thread={thread} threadId={tid} msgCount={msgCount}
                      imp={imp} isFlagged={isFlagged} onToggle={onToggle} cache={cache} />
        );
      })}
    </div>
  );
}

function ThreadCard({
  thread, threadId, msgCount, imp, isFlagged, onToggle, cache,
}: {
  thread: any; threadId: string; msgCount: number; imp: MetaImportFull;
  isFlagged: (s: string, k: string) => boolean;
  onToggle: (s: string, k: string) => void;
  cache: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`mwp-card mwp-thread-card ${expanded ? 'expanded' : ''}`}>
      <div className="mwp-thread-header" onClick={() => setExpanded(v => !v)}>
        <div className="mwp-thread-info">
          <span className="mwp-thread-id">Thread {threadId}</span>
          <span className="mwp-thread-count">{msgCount} message{msgCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="mwp-thread-participants">
          {(thread.participants || []).map((p: string, i: number) => (
            <span key={i} className="mwp-participant">{p}</span>
          ))}
        </div>
        <svg className="mwp-thread-chevron w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div className="mwp-thread-messages">
        {(thread.messages || []).map((msg: any, mi: number) => {
          const k = FlagKey.message(threadId, msg);
          const flagged = isFlagged('messages', k);
          return (
            <div key={mi} className={`mwp-message ${flagged ? 'mwp-flagged' : ''}`}>
              <div className="mwp-msg-header">
                <span className="mwp-msg-author">{msg.author || 'Unknown'}</span>
                <span className="mwp-msg-time">{msg.sent || ''}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <FlagButton section="messages" flagKey={k} flagged={flagged} onToggle={onToggle} />
                </span>
              </div>
              <div className="mwp-msg-body">{msg.body || ''}</div>
              {(msg.attachments || []).map((att: any, ai: number) => {
                const fn = (att.images || [])[0]?.replace('linked_media/', '')
                       || att.linkedMediaFile?.replace('linked_media/', '');
                const inIndex = fn && imp.mediaIndex[fn];
                return (
                  <div key={ai} className="mwp-msg-attachment">
                    {inIndex && fn && (
                      <LazyImage importId={imp.id} fileName={fn} className="mwp-msg-img" cache={cache} />
                    )}
                    <div className="mwp-att-meta">
                      {att.type && <span className="mwp-tag">{att.type}</span>}
                      {att.size && <span className="mwp-tag">{(parseInt(att.size) / 1024).toFixed(0)} KB</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderTimeline(rec: MetaRecord) {
  type Ev = { time: string; type: string; icon: string; desc: string; author?: string; extra?: string; thread?: string | null };
  const events: Ev[] = [];

  (rec.ipAddresses || []).forEach(ip => {
    if (ip.time) events.push({ time: ip.time, type: 'ip', icon: '🌐', desc: `IP: ${ip.ip}` });
  });
  (rec.statusUpdates || []).forEach(u => {
    if (u.posted) events.push({ time: u.posted, type: 'status', icon: '📝', desc: u.status || '(status update)', author: u.author });
  });
  (rec.wallposts || []).forEach(w => {
    if (w.time) events.push({ time: w.time, type: 'wallpost', icon: '📌', desc: w.text || '(wallpost)', author: w.from });
  });
  (rec.postsToOtherWalls || []).forEach(p => {
    if (p.time) events.push({ time: p.time, type: 'otherwall', icon: '📤', desc: p.post || '(wall post)', author: p.timelineOwner });
  });
  (rec.shares || []).forEach(s => {
    if (s.dateCreated) events.push({ time: s.dateCreated, type: 'share', icon: '🔗', desc: s.title || s.text || '(shared content)' });
  });
  (rec.photos || []).forEach(p => {
    if (p.uploaded) events.push({ time: p.uploaded, type: 'photo', icon: '📷', desc: p.title || `Photo ${p.id}`, extra: p.album });
  });
  (rec.messages?.threads || []).forEach(t => {
    (t.messages || []).forEach((m: any) => {
      if (m.sent) events.push({ time: m.sent, type: 'message', icon: '💬', desc: m.body || '(message)', author: m.author, thread: t.threadId });
    });
  });
  if (rec.bio?.creationTime) {
    events.push({ time: rec.bio.creationTime, type: 'bio', icon: '👤', desc: `Bio: ${rec.bio.text || ''}` });
  }

  events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (events.length === 0) return <div className="mwp-empty">No timeline events</div>;

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">🕐 Timeline ({events.length} events)</h2>
      <div className="mwp-timeline">
        {events.map((ev, i) => (
          <div key={i} className={`mwp-timeline-event mwp-event-${ev.type}`}>
            <div className="mwp-timeline-dot">{ev.icon}</div>
            <div className="mwp-timeline-content">
              <div className="mwp-timeline-time">{ev.time}</div>
              <div className="mwp-timeline-desc">{ev.desc}</div>
              {ev.author && <div className="mwp-timeline-author">{ev.author}</div>}
              {ev.extra && <div className="mwp-timeline-extra">{ev.extra}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MetaWarrantTab;
