import { useState, useEffect } from 'react';

interface SnapWarrantTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Types (mirror parser output) ───────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

interface SnapHeaderInfo {
  targetUsername: string | null;
  email: string | null;
  userId: string | null;
  dateRange: string | null;
}

interface SnapConversationRow {
  conversation_id?: string;
  message_id?: string;
  timestamp?: string;
  sender_user_id?: string;
  sender_username?: string;
  content_type?: string;
  message_type?: string;
  recipients?: string;
  media_id?: string;
  _mediaFile?: string;
  [k: string]: string | undefined;
}

interface SnapGeoLocation {
  latitude: number | null;
  longitude: number | null;
  latitudeAccuracy: number | null;
  longitudeAccuracy: number | null;
  timestamp: string | null;
  _raw: Record<string, string>;
}

interface SnapGenericRow { [k: string]: string | undefined }

interface SnapStats {
  partCount: number;
  mediaCount: number;
  conversationCount: number;
  geoLocationCount: number;
  memoryCount: number;
}

interface SnapMediaFile {
  diskPath: string;
  partFolder: string;
  size: number;
  mimeType: string;
  originalPath?: string;
  sender: string | null;
  recipient: string | null;
  timestamp: string | null;
  savedFlag: string | null;
  mediaIdToken: string | null;
}

interface SnapResult {
  parts: any[];
  mergedHeader: SnapHeaderInfo | null;
  conversations: SnapConversationRow[];
  geoLocations: SnapGeoLocation[];
  memories: SnapGenericRow[];
  deviceAdvertisingIds: SnapGenericRow[];
  subscriberInfo: SnapGenericRow | SnapGenericRow[] | null;
  loginHistory: SnapGenericRow[];
  friends: SnapGenericRow[];
  snapHistory: SnapGenericRow[];
  otherCsvs: Record<string, { headers: string[]; rows: SnapGenericRow[] }>;
  mediaFiles: Record<string, SnapMediaFile>;
  stats: SnapStats;
}

interface SnapImportHeader {
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

interface SnapImportFull extends SnapImportHeader {
  result: SnapResult;
  mediaIndex: Record<string, MediaIndexEntry>;
}

interface ScanCandidate {
  filePath: string;
  sourceKind: 'warrant' | 'evidence';
  sourceRefId: number;
  hint?: string;
  size: number;
  isFolder?: boolean;
}

type SectionId =
  | 'overview' | 'subscriber' | 'logins' | 'friends'
  | 'conversations' | 'geo' | 'memories'
  | 'devices' | 'snapHistory' | 'media';

// ─── Stable flag-key generators (MUST MATCH snapWarrantHtmlReport.SnapFlagKey) ──

const FlagKey = {
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatSize = (n: number): string => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const baseName = (p: string): string => {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
};

const truncate = (s: string | undefined | null, max = 200): string => {
  if (!s) return '';
  return s.length > max ? s.substring(0, max) + '…' : s;
};

const getSubscriberRows = (res: SnapResult): SnapGenericRow[] => {
  const si = res.subscriberInfo;
  if (!si) return [];
  return Array.isArray(si) ? si : [si];
};

// ─── FlagButton ─────────────────────────────────────────────────────────────

function FlagButton({ active, onClick, size = 'sm' }: { active: boolean; onClick: () => void; size?: 'sm' | 'xs' }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`${size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} rounded shrink-0 ${
        active
          ? 'bg-amber-500 text-white hover:bg-amber-400'
          : 'border border-gray-600 text-gray-400 hover:border-amber-400 hover:text-amber-300'
      }`}
      title={active ? 'Unflag' : 'Flag for warrant return'}
    >
      {active ? '⚑ Flagged' : '⚐ Flag'}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SnapWarrantTab({ caseId, caseNumber }: SnapWarrantTabProps) {
  const [imports, setImports] = useState<SnapImportHeader[]>([]);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [activeImport, setActiveImport] = useState<SnapImportFull | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [pushingEvidence, setPushingEvidence] = useState(false);

  const refreshImports = async () => {
    try {
      const r = await window.electronAPI.snapWarrantListImports(caseId);
      if (r.success) setImports(r.imports);
      else setError(r.error || 'Failed to load imports');
    } catch (e: any) { setError(e.message); }
  };

  const refreshScan = async () => {
    setScanning(true);
    try {
      const r = await window.electronAPI.snapWarrantScan(caseId);
      if (r.success) setCandidates(r.candidates);
    } catch { /* non-fatal */ }
    setScanning(false);
  };

  const loadImport = async (id: number) => {
    try {
      const r = await window.electronAPI.snapWarrantGetImport(id);
      if (r.success && r.import) {
        setActiveImport(r.import as SnapImportFull);
        setActiveSection('overview');
        const f = await window.electronAPI.warrantFlagList({ caseId, provider: 'snap', importId: id });
        if (f.success) {
          const set = new Set<string>(f.flags.map((fl: any) => `${fl.section}|${fl.flagKey}`));
          setFlags(set);
        }
      } else {
        setError(r.error || 'Failed to load import');
      }
    } catch (e: any) { setError(e.message); }
  };

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

  const handleImportCandidate = async (c: ScanCandidate) => {
    setImporting(true);
    setError(null);
    try {
      const r = await window.electronAPI.snapWarrantImport({
        caseId, filePath: c.filePath, sourceKind: c.sourceKind, sourceRefId: c.sourceRefId,
      });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      const s = r.summary;
      setToast({
        msg: s
          ? `Imported · ${s.partCount} part${s.partCount === 1 ? '' : 's'} · ${s.conversationCount} conv · ${s.geoLocationCount} geo · ${s.memoryCount} memories · ${s.mediaCount} media`
          : 'Imported',
        type: 'success',
      });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handlePickAndImport = async () => {
    setError(null);
    try {
      const p = await window.electronAPI.snapWarrantPickFile();
      if (p.canceled) return;
      if (!p.success || !p.filePath) { setError(p.error || 'File selection failed'); return; }
      setImporting(true);
      const r = await window.electronAPI.snapWarrantImport({ caseId, filePath: p.filePath, sourceKind: 'picker' });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: 'Import complete', type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handleDeleteImport = async (imp: SnapImportHeader) => {
    if (!window.confirm(`Delete "${imp.label}" and all its flags? This cannot be undone.`)) return;
    try {
      const r = await window.electronAPI.snapWarrantDeleteImport(imp.id);
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
        caseId, provider: 'snap', importId: activeImport.id, section, flagKey,
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
      const r = await window.electronAPI.warrantFlagClear({ caseId, provider: 'snap', importId: activeImport.id });
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
      : `Build a Full bundle of this Snapchat production and add it to the Evidence module?\n\nNote: full bundles can be large if the production has many records.`;
    if (!window.confirm(confirmMsg)) return;

    setPushingEvidence(true);
    try {
      const r = await window.electronAPI.snapWarrantExportBundle({ importId: activeImport.id, mode });
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
    return <div className="p-6 text-gray-400">Loading Snapchat warrant data…</div>;
  }

  if (!activeImportId || !activeImport) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Snapchat Warrant Parser</h2>
            <p className="text-sm text-gray-400 mt-1">
              Snapchat warrant return parser (Conversations, Geo, Memories, IPs, Media) — Case {caseNumber}
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
              className="px-3 py-1.5 text-sm rounded bg-yellow-600 hover:bg-yellow-500 text-black font-medium disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import ZIP / Folder…'}
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
          <section className="rounded-lg border border-yellow-500/40 bg-yellow-500/5">
            <header className="px-4 py-2 border-b border-yellow-500/30 text-sm font-medium text-yellow-200">
              Detected in Warrants / Evidence — {candidates.length} ready to parse
            </header>
            <ul className="divide-y divide-gray-700/60">
              {candidates.map((c, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{baseName(c.filePath)}{c.isFolder ? ' (folder)' : ''}</div>
                    <div className="text-xs text-gray-400 truncate">
                      From {c.sourceKind === 'warrant' ? 'Warrants' : 'Evidence'}
                      {c.hint ? ` — ${c.hint}` : ''}{c.size ? ` · ${formatSize(c.size)}` : ''}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">{c.filePath}</div>
                  </div>
                  <button
                    onClick={() => handleImportCandidate(c)}
                    disabled={importing}
                    className="ml-4 shrink-0 px-3 py-1.5 text-xs rounded bg-yellow-600 hover:bg-yellow-500 text-black font-medium disabled:opacity-50"
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
              No Snapchat warrant returns imported yet. Click <strong>Import ZIP / Folder…</strong> to select a production,
              or attach the return to the Warrants/Evidence module first and rescan.
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

  // ─── Render: detail view ──────────────────────────────────────────────────

  const res = activeImport.result;
  const subs = getSubscriberRows(res);
  const convCount = res.conversations?.length || 0;
  const geoCount = res.geoLocations?.length || 0;
  const memCount = res.memories?.length || 0;
  const loginCount = res.loginHistory?.length || 0;
  const friendCount = res.friends?.length || 0;
  const deviceCount = res.deviceAdvertisingIds?.length || 0;
  const snapHistCount = res.snapHistory?.length || 0;
  const mediaCount = Object.keys(res.mediaFiles || {}).length;

  const navSections: { id: SectionId; label: string; icon: string; count?: number; show: boolean }[] = [
    { id: 'overview',      label: 'Overview',         icon: '👤', show: true },
    { id: 'subscriber',    label: 'Subscriber Info',  icon: '📇', count: subs.length, show: subs.length > 0 },
    { id: 'logins',        label: 'Login History',    icon: '🔐', count: loginCount, show: loginCount > 0 },
    { id: 'friends',       label: 'Friends',          icon: '👥', count: friendCount, show: friendCount > 0 },
    { id: 'conversations', label: 'Conversations',    icon: '💬', count: convCount, show: convCount > 0 },
    { id: 'geo',           label: 'Geo Locations',    icon: '📍', count: geoCount, show: geoCount > 0 },
    { id: 'memories',      label: 'Memories',         icon: '🎞️', count: memCount, show: memCount > 0 },
    { id: 'devices',       label: 'Devices / Ad IDs', icon: '📱', count: deviceCount, show: deviceCount > 0 },
    { id: 'snapHistory',   label: 'Snap History',     icon: '👻', count: snapHistCount, show: snapHistCount > 0 },
    { id: 'media',         label: 'Media Files',      icon: '🖼️', count: mediaCount, show: mediaCount > 0 },
  ];

  const h = res.mergedHeader;

  return (
    <div>
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-700/60">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setActiveImportId(null)}
            className="text-yellow-400 hover:text-yellow-300"
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

      <div className="px-6 py-3 bg-gray-800/30 border-b border-gray-700/60 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-200 space-x-4">
          <span><span className="text-gray-500">Target:</span> <strong>{h?.targetUsername || '—'}</strong></span>
          {h?.email && <span><span className="text-gray-500">Email:</span> {h.email}</span>}
          {h?.userId && <span><span className="text-gray-500">User ID:</span> <code className="text-xs text-gray-300">{h.userId}</code></span>}
          <span><span className="text-gray-500">Date Range:</span> {h?.dateRange || '—'}</span>
          <span><span className="text-gray-500">Parts:</span> {res.stats?.partCount ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{flags.size} flagged</span>
          <button
            onClick={clearAllFlags}
            disabled={flags.size === 0}
            className="px-2 py-1 text-xs rounded border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={() => pushToEvidence('flagged-only')}
            disabled={pushingEvidence || flags.size === 0}
            className="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
          >
            {pushingEvidence ? 'Building…' : 'Push Flagged → Evidence'}
          </button>
          <button
            onClick={() => pushToEvidence('full')}
            disabled={pushingEvidence}
            className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 text-black font-medium disabled:opacity-40"
          >
            Push Full → Evidence
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-300 text-sm flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-200 hover:text-white">✕</button>
        </div>
      )}
      {toast && (
        <div className={`mx-6 mt-3 rounded border px-4 py-2 text-sm ${
          toast.type === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-300' :
          toast.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
          'border-blue-500/40 bg-blue-500/10 text-blue-300'
        }`}>{toast.msg}</div>
      )}

      <div className="flex" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <aside className="w-56 border-r border-gray-700/60 bg-gray-900/40 p-2 space-y-1 shrink-0">
          {navSections.filter(s => s.show).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                activeSection === s.id
                  ? 'bg-yellow-600/30 text-yellow-200 border border-yellow-600/40'
                  : 'text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              <span>{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              {s.count != null && s.count > 0 && (
                <span className="text-xs text-gray-500">{s.count}</span>
              )}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          {activeSection === 'overview'      && <OverviewView res={res} />}
          {activeSection === 'subscriber'    && <SubscriberView subs={subs} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'logins'        && <GenericTableView rows={res.loginHistory || []} section="login" keyFn={FlagKey.login} preferredCols={['login_time', 'Login Time', 'timestamp', 'ip', 'IP', 'country', 'carrier', 'device_type', 'os']} isFlagged={isFlagged} toggleFlag={toggleFlag} title="Login History" />}
          {activeSection === 'friends'       && <GenericTableView rows={res.friends || []} section="friends" keyFn={FlagKey.friend} preferredCols={['username', 'Username', 'display_name', 'user_id', 'User ID', 'created', 'Created']} isFlagged={isFlagged} toggleFlag={toggleFlag} title="Friends" />}
          {activeSection === 'conversations' && <ConversationsView res={res} importId={activeImport.id} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'geo'           && <GeoView res={res} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'memories'      && <GenericTableView rows={res.memories || []} section="memories" keyFn={FlagKey.memory} preferredCols={['timestamp', 'Date', 'media_id', 'id', 'memory_id', 'media_type', 'caption']} isFlagged={isFlagged} toggleFlag={toggleFlag} title="Memories" />}
          {activeSection === 'devices'       && <GenericTableView rows={res.deviceAdvertisingIds || []} section="devices" keyFn={FlagKey.device} preferredCols={['advertising_id', 'device_id', 'device id', 'device_type', 'os', 'os_version', 'time recorded']} isFlagged={isFlagged} toggleFlag={toggleFlag} title="Device Advertising IDs" />}
          {activeSection === 'snapHistory'   && <GenericTableView rows={res.snapHistory || []} section="snapHistory" keyFn={FlagKey.snapHistory} preferredCols={['timestamp', 'Date', 'sender', 'recipient', 'id', 'Snap ID', 'media_id', 'media_type', 'source_type']} isFlagged={isFlagged} toggleFlag={toggleFlag} title="Snap History" />}
          {activeSection === 'media'         && <MediaView res={res} importId={activeImport.id} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
        </main>
      </div>
    </div>
  );
}

// ─── Section Views ──────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 py-1 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-100 break-words">{String(value)}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4 mb-4">
      {title && <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>}
      {children}
    </div>
  );
}

type FlagFn = (section: string, key: string) => boolean;
type ToggleFn = (section: string, key: string) => void;

function OverviewView({ res }: { res: SnapResult }) {
  const s = res.stats;
  const h = res.mergedHeader;
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Account Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Account">
          <KV label="Target Username" value={h?.targetUsername} />
          <KV label="Email" value={h?.email} />
          <KV label="User ID" value={h?.userId} />
          <KV label="Date Range" value={h?.dateRange} />
        </Card>
        <Card title="Production Totals">
          <KV label="Parts" value={s?.partCount} />
          <KV label="Conversations" value={s?.conversationCount} />
          <KV label="Geo Locations" value={s?.geoLocationCount} />
          <KV label="Memories" value={s?.memoryCount} />
          <KV label="Media Files" value={s?.mediaCount} />
        </Card>
        <Card title="Per-Category Counts">
          <KV label="Subscriber Records" value={getSubscriberRows(res).length} />
          <KV label="Login Events" value={res.loginHistory?.length ?? 0} />
          <KV label="Friends" value={res.friends?.length ?? 0} />
          <KV label="Device Advertising IDs" value={res.deviceAdvertisingIds?.length ?? 0} />
          <KV label="Snap History Entries" value={res.snapHistory?.length ?? 0} />
        </Card>
        {res.parts && res.parts.length > 0 && (
          <Card title={`Parts (${res.parts.length})`}>
            <div className="space-y-1 text-xs">
              {res.parts.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-gray-700/40 py-1">
                  <code className="text-gray-300 truncate" title={p.partFolder}>{truncate(p.partFolder, 50)}</code>
                  <span className="text-gray-500 shrink-0 ml-2">#{p.partNum ?? '—'} · {p.conversations?.length || 0} conv</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SubscriberView({ subs, isFlagged, toggleFlag }: { subs: SnapGenericRow[]; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Subscriber Info ({subs.length})</h2>
      {subs.map((r, i) => {
        const key = FlagKey.subscriber(r, i);
        const flagged = isFlagged('subscriber', key);
        return (
          <Card key={i} title="">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">Record #{i + 1}</span>
              <FlagButton active={flagged} onClick={() => toggleFlag('subscriber', key)} />
            </div>
            <div className="space-y-0.5">
              {Object.entries(r).map(([k, v]) => (
                <KV key={k} label={k} value={truncate(String(v ?? ''), 600)} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function GenericTableView({
  rows, section, keyFn, preferredCols, isFlagged, toggleFlag, title,
}: {
  rows: SnapGenericRow[];
  section: string;
  keyFn: (r: SnapGenericRow) => string;
  preferredCols?: string[];
  isFlagged: FlagFn;
  toggleFlag: ToggleFn;
  title: string;
}) {
  const cap = 500;
  const display = rows.slice(0, cap);

  // Build column list
  const presentCols = new Set<string>();
  for (const r of display) for (const k of Object.keys(r)) presentCols.add(k);
  const cols: string[] = [];
  if (preferredCols) for (const c of preferredCols) if (presentCols.has(c)) cols.push(c);
  for (const c of presentCols) if (!cols.includes(c)) cols.push(c);
  const displayCols = cols.slice(0, 8);

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">{title} ({rows.length})</h2>
      {rows.length > cap && (
        <div className="text-xs text-amber-300 mb-2">Showing first {cap} of {rows.length}. Export to see all.</div>
      )}
      <Card title="">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                {displayCols.map(c => <th key={c} className="text-left p-2 whitespace-nowrap">{c}</th>)}
                <th className="text-left p-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, i) => {
                const key = keyFn(r);
                const flagged = isFlagged(section, key);
                return (
                  <tr key={i} className={flagged ? 'bg-amber-500/10' : 'hover:bg-gray-800/40'}>
                    {displayCols.map(c => (
                      <td key={c} className="p-2 text-gray-200 align-top max-w-[280px] truncate" title={String(r[c] ?? '')}>
                        {truncate(String(r[c] ?? ''), 120)}
                      </td>
                    ))}
                    <td className="p-2">
                      <FlagButton active={flagged} onClick={() => toggleFlag(section, key)} size="xs" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ConversationsView({
  res, importId, isFlagged, toggleFlag,
}: { res: SnapResult; importId: number; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const rows = res.conversations || [];
  const cap = 500;
  const display = rows.slice(0, cap);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const cols = ['timestamp', 'sender_username', 'recipients', 'content_type', 'message_type'];
  const presentCols = new Set<string>();
  for (const r of display) for (const k of Object.keys(r)) presentCols.add(k);
  const displayCols = cols.filter(c => presentCols.has(c));

  const openPreview = async (fn: string) => {
    setPreviewFile(fn);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const r = await window.electronAPI.snapWarrantReadMedia({ importId, fileName: fn });
      if (r.success && r.dataUrl) setPreviewUrl(r.dataUrl);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Conversations ({rows.length})</h2>
      {rows.length > cap && (
        <div className="text-xs text-amber-300 mb-2">Showing first {cap} of {rows.length}. Export to see all.</div>
      )}
      <Card title="">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                {displayCols.map(c => <th key={c} className="text-left p-2 whitespace-nowrap">{c}</th>)}
                <th className="text-left p-2">Media</th>
                <th className="text-left p-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {display.map((c, i) => {
                const key = FlagKey.conversation(c);
                const flagged = isFlagged('conversations', key);
                const fn = c._mediaFile || null;
                return (
                  <tr key={i} className={flagged ? 'bg-amber-500/10' : 'hover:bg-gray-800/40'}>
                    {displayCols.map(col => (
                      <td key={col} className="p-2 text-gray-200 align-top max-w-[260px] truncate" title={String(c[col] ?? '')}>
                        {truncate(String(c[col] ?? ''), 120)}
                      </td>
                    ))}
                    <td className="p-2">
                      {fn ? (
                        <button
                          onClick={() => openPreview(fn)}
                          className="text-yellow-300 hover:text-yellow-200 underline text-[11px]"
                          title={fn}
                        >
                          {truncate(fn, 24)}
                        </button>
                      ) : ''}
                    </td>
                    <td className="p-2">
                      <FlagButton active={flagged} onClick={() => toggleFlag('conversations', key)} size="xs" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {previewFile && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <span className="text-sm text-gray-200 truncate" title={previewFile}>{previewFile}</span>
              <button onClick={() => { setPreviewFile(null); setPreviewUrl(null); }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4">
              {previewLoading && <div className="text-gray-400">Loading…</div>}
              {!previewLoading && previewUrl && /\.(jpe?g|png|gif|webp)$/i.test(previewFile) && (
                <img src={previewUrl} alt={previewFile} className="max-w-full max-h-[75vh]" />
              )}
              {!previewLoading && previewUrl && /\.(mp4|webm|mov)$/i.test(previewFile) && (
                <video src={previewUrl} controls className="max-w-full max-h-[75vh]" />
              )}
              {!previewLoading && !previewUrl && <div className="text-red-300">Could not load preview.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeoView({ res, isFlagged, toggleFlag }: { res: SnapResult; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const rows = res.geoLocations || [];
  const cap = 500;
  const display = rows.slice(0, cap);
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Geo Locations ({rows.length})</h2>
      {rows.length > cap && (
        <div className="text-xs text-amber-300 mb-2">Showing first {cap} of {rows.length}. Export to see all.</div>
      )}
      <Card title="">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left p-2">Timestamp</th>
                <th className="text-left p-2">Latitude</th>
                <th className="text-left p-2">Longitude</th>
                <th className="text-left p-2">± (lat/lon)</th>
                <th className="text-left p-2">Map</th>
                <th className="text-left p-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {display.map((g, i) => {
                const key = FlagKey.geo(g);
                const flagged = isFlagged('geo', key);
                const mapUrl = g.latitude != null && g.longitude != null
                  ? `https://www.google.com/maps?q=${g.latitude},${g.longitude}`
                  : null;
                return (
                  <tr key={i} className={flagged ? 'bg-amber-500/10' : 'hover:bg-gray-800/40'}>
                    <td className="p-2 text-gray-200">{g.timestamp || ''}</td>
                    <td className="p-2 text-gray-200 font-mono">{g.latitude ?? ''}</td>
                    <td className="p-2 text-gray-200 font-mono">{g.longitude ?? ''}</td>
                    <td className="p-2 text-gray-500 text-[10px]">
                      {g.latitudeAccuracy != null ? `±${g.latitudeAccuracy}` : ''} / {g.longitudeAccuracy != null ? `±${g.longitudeAccuracy}` : ''}
                    </td>
                    <td className="p-2">
                      {mapUrl && (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="text-yellow-300 hover:text-yellow-200 underline text-[11px]">
                          view
                        </a>
                      )}
                    </td>
                    <td className="p-2">
                      <FlagButton active={flagged} onClick={() => toggleFlag('geo', key)} size="xs" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MediaView({
  res, importId, isFlagged, toggleFlag,
}: { res: SnapResult; importId: number; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const entries = Object.entries(res.mediaFiles || {});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'flagged'>('all');

  const filtered = entries.filter(([fn, info]) => {
    if (filter === 'image') return /^image\//.test(info.mimeType);
    if (filter === 'video') return /^video\//.test(info.mimeType);
    if (filter === 'flagged') return isFlagged('media', FlagKey.mediaFile(fn));
    return true;
  });

  const loadPreview = async (fn: string) => {
    if (previews[fn] || loadingSet.has(fn)) return;
    setLoadingSet(prev => new Set(prev).add(fn));
    try {
      const r = await window.electronAPI.snapWarrantReadMedia({ importId, fileName: fn });
      if (r.success && r.dataUrl) {
        setPreviews(prev => ({ ...prev, [fn]: r.dataUrl! }));
      }
    } finally {
      setLoadingSet(prev => { const next = new Set(prev); next.delete(fn); return next; });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Media Files ({entries.length})</h2>
        <div className="flex gap-1 text-xs">
          {(['all', 'image', 'video', 'flagged'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded ${filter === f ? 'bg-yellow-600 text-black' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'}`}
            >
              {f === 'all' ? 'All' : f === 'image' ? 'Images' : f === 'video' ? 'Videos' : 'Flagged'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-gray-400">No media matches the current filter.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(([fn, info]) => {
          const key = FlagKey.mediaFile(fn);
          const flagged = isFlagged('media', key);
          const isImage = /^image\//.test(info.mimeType);
          const isVideo = /^video\//.test(info.mimeType);
          const url = previews[fn];
          const loading = loadingSet.has(fn);
          return (
            <div
              key={fn}
              className={`rounded border bg-gray-800/40 overflow-hidden ${flagged ? 'border-yellow-500' : 'border-gray-700'}`}
            >
              <div className="aspect-square bg-black flex items-center justify-center relative">
                {flagged && (
                  <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded font-bold z-10">
                    FLAG
                  </div>
                )}
                {isImage && url && (
                  <img src={url} alt={fn} className="w-full h-full object-cover" />
                )}
                {isImage && !url && (
                  <button
                    onClick={() => loadPreview(fn)}
                    disabled={loading}
                    className="text-gray-400 hover:text-gray-200 text-xs"
                  >
                    {loading ? 'Loading…' : '🖼️ Load preview'}
                  </button>
                )}
                {isVideo && (
                  <div className="text-gray-400 text-2xl">▶️</div>
                )}
                {!isImage && !isVideo && (
                  <div className="text-gray-400 text-2xl">📄</div>
                )}
              </div>
              <div className="p-2 space-y-1">
                <div className="text-[10px] text-gray-300 truncate font-mono" title={fn}>{truncate(fn, 40)}</div>
                <div className="text-[10px] text-gray-500">{info.mimeType} · {formatSize(info.size)}</div>
                <div className="flex items-center justify-between gap-1">
                  <FlagButton active={flagged} onClick={() => toggleFlag('media', key)} size="xs" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SnapWarrantTab;
