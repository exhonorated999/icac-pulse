import { useState, useEffect } from 'react';

interface KikWarrantTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Types (mirror parser output) ───────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

interface KikBind {
  timestamp: number;
  username: string;
  ip: string;
  port: string;
  datetime: string;
  country: string;
}

interface KikFriend {
  timestamp: number;
  user: string;
  friend: string;
  datetime: string;
}

interface KikBlockedUser {
  timestamp: number;
  user: string;
  blocked: string;
  datetime: string;
}

interface KikChatRecord {
  timestamp: number;
  sender: string;
  recipient: string;
  msgCount: number;
  ip: string;
  datetime: string;
}

interface KikChatMediaRecord {
  timestamp: number;
  sender: string;
  recipient: string;
  mediaType: string;
  mediaUuid: string;
  ip: string;
  datetime: string;
}

interface KikGroupRecord {
  timestamp: number;
  sender: string;
  groupId: string;
  recipient: string;
  msgCount: number;
  ip: string;
  datetime: string;
}

interface KikGroupMediaRecord {
  timestamp: number;
  sender: string;
  groupId: string;
  recipient: string;
  mediaType: string;
  mediaUuid: string;
  ip: string;
  datetime: string;
}

interface KikContentFileInfo {
  size: number;
  mimeType: string;
}

interface KikStats {
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

interface KikRecord {
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

interface KikImportHeader {
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

interface KikImportFull extends KikImportHeader {
  records: KikRecord[];
  mediaIndex: Record<string, MediaIndexEntry>;
}

interface ScanCandidate {
  filePath: string;
  sourceKind: 'warrant' | 'evidence';
  sourceRefId: number;
  hint?: string;
  size: number;
}

type SectionId = 'overview' | 'ip' | 'social' | 'dm' | 'group' | 'content';

// ─── Stable flag-key generators (must match kikWarrantHtmlReport.KikFlagKey) ──

const FlagKey = {
  bind:        (b: KikBind) => `${b.timestamp || ''}|${b.ip || ''}|${b.port || ''}`,
  friend:      (f: KikFriend) => `${f.timestamp || ''}|${f.friend || ''}`,
  blockedUser: (b: KikBlockedUser) => `${b.timestamp || ''}|${b.blocked || ''}`,
  chatRecord:  (c: KikChatRecord) => `${c.timestamp || ''}|${c.sender || ''}|${c.recipient || ''}`,
  chatMedia:   (c: KikChatMediaRecord) => `${c.timestamp || ''}|${c.mediaUuid || ''}`,
  groupRecord: (g: KikGroupRecord) => `${g.timestamp || ''}|${g.groupId || ''}|${g.sender || ''}|${g.recipient || ''}`,
  groupMedia:  (g: KikGroupMediaRecord) => `${g.timestamp || ''}|${g.groupId || ''}|${g.mediaUuid || ''}`,
  contentFile: (filename: string) => filename,
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

const truncate = (s: string | undefined | null, max = 200): string => {
  if (!s) return '';
  return s.length > max ? s.substring(0, max) + '…' : s;
};

const fmtMs = (ts: number): string => {
  if (!ts) return '';
  try { return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''); }
  catch { return String(ts); }
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

export function KikWarrantTab({ caseId, caseNumber }: KikWarrantTabProps) {
  const [imports, setImports] = useState<KikImportHeader[]>([]);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [activeImport, setActiveImport] = useState<KikImportFull | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [pushingEvidence, setPushingEvidence] = useState(false);

  const refreshImports = async () => {
    try {
      const r = await window.electronAPI.kikWarrantListImports(caseId);
      if (r.success) setImports(r.imports);
      else setError(r.error || 'Failed to load imports');
    } catch (e: any) { setError(e.message); }
  };

  const refreshScan = async () => {
    setScanning(true);
    try {
      const r = await window.electronAPI.kikWarrantScan(caseId);
      if (r.success) setCandidates(r.candidates);
    } catch { /* non-fatal */ }
    setScanning(false);
  };

  const loadImport = async (id: number) => {
    try {
      const r = await window.electronAPI.kikWarrantGetImport(id);
      if (r.success && r.import) {
        setActiveImport(r.import as KikImportFull);
        setActiveSection('overview');
        const f = await window.electronAPI.warrantFlagList({ caseId, provider: 'kik', importId: id });
        if (f.success) {
          const set = new Set<string>(f.flags.map(fl => `${fl.section}|${fl.flagKey}`));
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
      const r = await window.electronAPI.kikWarrantImport({
        caseId, filePath: c.filePath, sourceKind: c.sourceKind, sourceRefId: c.sourceRefId,
      });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      const s = r.summary;
      setToast({
        msg: s
          ? `Imported · ${s.totalRecords} records · ${s.uniqueContacts} contacts · ${s.uniqueGroups} groups · ${s.contentFiles} media`
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
      const p = await window.electronAPI.kikWarrantPickFile();
      if (p.canceled) return;
      if (!p.success || !p.filePath) { setError(p.error || 'File selection failed'); return; }
      setImporting(true);
      const r = await window.electronAPI.kikWarrantImport({ caseId, filePath: p.filePath, sourceKind: 'picker' });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: 'Import complete', type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handleDeleteImport = async (imp: KikImportHeader) => {
    if (!window.confirm(`Delete "${imp.label}" and all its flags? This cannot be undone.`)) return;
    try {
      const r = await window.electronAPI.kikWarrantDeleteImport(imp.id);
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
        caseId, provider: 'kik', importId: activeImport.id, section, flagKey,
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
      const r = await window.electronAPI.warrantFlagClear({ caseId, provider: 'kik', importId: activeImport.id });
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
      : `Build a Full bundle of this Kik production and add it to the Evidence module?\n\nNote: full bundles can be large if the production has many records.`;
    if (!window.confirm(confirmMsg)) return;

    setPushingEvidence(true);
    try {
      const r = await window.electronAPI.kikWarrantExportBundle({ importId: activeImport.id, mode });
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
    return <div className="p-6 text-gray-400">Loading Kik warrant data…</div>;
  }

  if (!activeImportId || !activeImport) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Kik Warrant Parser</h2>
            <p className="text-sm text-gray-400 mt-1">
              Kik Messenger warrant return parser (Binds, Friends, DM, Groups, Media) — Case {caseNumber}
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
              className="px-3 py-1.5 text-sm rounded bg-rose-700 hover:bg-rose-600 text-white disabled:opacity-50"
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
              No Kik warrant returns imported yet. Click <strong>Import ZIP…</strong> to select a production,
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

  // ─── Render: detail view ──────────────────────────────────────────────────

  const rec = activeImport.records[0];
  const dmCount = (rec.chatSent?.length || 0) + (rec.chatSentReceived?.length || 0) +
                  (rec.chatPlatformSent?.length || 0) + (rec.chatPlatformSentReceived?.length || 0);
  const groupCount = (rec.groupSendMsg?.length || 0) + (rec.groupReceiveMsg?.length || 0) +
                     (rec.groupSendMsgPlatform?.length || 0) + (rec.groupReceiveMsgPlatform?.length || 0);
  const socialCount = (rec.friends?.length || 0) + (rec.blockedUsers?.length || 0);
  const contentCount = Object.keys(rec.contentFiles || {}).length;

  const navSections: { id: SectionId; label: string; icon: string; count?: number; show: boolean }[] = [
    { id: 'overview', label: 'Overview',          icon: '👤', show: true },
    { id: 'ip',       label: 'IP / Bind',         icon: '🌐', count: rec.binds?.length || 0, show: (rec.binds?.length || 0) > 0 },
    { id: 'social',   label: 'Friends / Blocked', icon: '👥', count: socialCount, show: socialCount > 0 },
    { id: 'dm',       label: 'Direct Messages',   icon: '💬', count: dmCount, show: dmCount > 0 },
    { id: 'group',    label: 'Group Messages',    icon: '👥', count: groupCount, show: groupCount > 0 },
    { id: 'content',  label: 'Media / Content',   icon: '📎', count: contentCount, show: contentCount > 0 },
  ];

  return (
    <div>
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-700/60">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setActiveImportId(null)}
            className="text-rose-400 hover:text-rose-300"
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
          <span><span className="text-gray-500">Account:</span> <strong>{rec.accountUsername || '—'}</strong></span>
          <span><span className="text-gray-500">Kik Case:</span> <code className="text-xs text-gray-300">{rec.caseNumber || '—'}</code></span>
          <span><span className="text-gray-500">Range:</span> {rec.stats?.dateRange?.start || '—'} → {rec.stats?.dateRange?.end || '—'}</span>
          <span><span className="text-gray-500">Records:</span> {rec.stats?.totalRecords ?? 0}</span>
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
            className="px-3 py-1 text-xs rounded bg-rose-700 hover:bg-rose-600 text-white disabled:opacity-40"
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
                  ? 'bg-rose-700/40 text-rose-200 border border-rose-600/40'
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
          {activeSection === 'overview' && <OverviewView rec={rec} />}
          {activeSection === 'ip'       && <IpBindView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'social'   && <SocialView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'dm'       && <DmView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'group'    && <GroupView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'content'  && <ContentView rec={rec} importId={activeImport.id} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
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
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}

type FlagFn = (section: string, key: string) => boolean;
type ToggleFn = (section: string, key: string) => void;

function OverviewView({ rec }: { rec: KikRecord }) {
  const s = rec.stats;
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Account Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Account">
          <KV label="Username" value={rec.accountUsername} />
          <KV label="Kik Case #" value={rec.caseNumber} />
          <KV label="Date Range Start" value={s?.dateRange?.start} />
          <KV label="Date Range End" value={s?.dateRange?.end} />
        </Card>
        <Card title="Totals">
          <KV label="Total Records" value={s?.totalRecords} />
          <KV label="Unique DM Contacts" value={s?.uniqueContacts} />
          <KV label="Friends Added" value={s?.uniqueFriends} />
          <KV label="Unique Groups" value={s?.uniqueGroups} />
          <KV label="Unique IPs" value={s?.uniqueIps} />
          <KV label="Media Files" value={s?.counts?.contentFiles} />
        </Card>
        <Card title="Record Counts">
          <KV label="IP / Bind Events" value={s?.counts?.binds} />
          <KV label="Friends Added" value={s?.counts?.friends} />
          <KV label="Blocked Users" value={s?.counts?.blocked} />
        </Card>
        <Card title="Message Counts">
          <KV label="DM Text — Sent" value={s?.counts?.dmTextSent} />
          <KV label="DM Text — Received" value={s?.counts?.dmTextReceived} />
          <KV label="DM Media — Sent" value={s?.counts?.dmMediaSent} />
          <KV label="DM Media — Received" value={s?.counts?.dmMediaReceived} />
          <KV label="Group Text — Sent" value={s?.counts?.groupTextSent} />
          <KV label="Group Text — Received" value={s?.counts?.groupTextReceived} />
          <KV label="Group Media — Sent" value={s?.counts?.groupMediaSent} />
          <KV label="Group Media — Received" value={s?.counts?.groupMediaReceived} />
        </Card>
      </div>
    </div>
  );
}

function IpBindView({ rec, isFlagged, toggleFlag }: { rec: KikRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const items = rec.binds || [];
  const cap = 500;
  const display = items.slice(0, cap);
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">IP / Bind Events ({items.length})</h2>
      {items.length > cap && (
        <div className="text-xs text-amber-300 mb-2">Showing first {cap} of {items.length}. Export to see all.</div>
      )}
      <Card title="">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left p-2">Datetime</th>
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">IP</th>
                <th className="text-left p-2">Port</th>
                <th className="text-left p-2">Country</th>
                <th className="text-left p-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {display.map((b, i) => {
                const key = FlagKey.bind(b);
                const flagged = isFlagged('binds', key);
                return (
                  <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                    <td className="p-2 font-mono text-gray-300">{b.datetime || fmtMs(b.timestamp)}</td>
                    <td className="p-2 text-gray-200">{b.username}</td>
                    <td className="p-2 font-mono text-gray-200">{b.ip}</td>
                    <td className="p-2 text-gray-300">{b.port}</td>
                    <td className="p-2 text-gray-300">{b.country}</td>
                    <td className="p-2">
                      <FlagButton size="xs" active={flagged} onClick={() => toggleFlag('binds', key)} />
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

function SocialView({ rec, isFlagged, toggleFlag }: { rec: KikRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const friends = rec.friends || [];
  const blocked = rec.blockedUsers || [];
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Friends &amp; Blocked Users</h2>

      {friends.length > 0 && (
        <Card title={`Friends Added (${friends.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left p-2">Datetime</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Friend</th>
                  <th className="text-left p-2">Flag</th>
                </tr>
              </thead>
              <tbody>
                {friends.slice(0, 500).map((f, i) => {
                  const key = FlagKey.friend(f);
                  const flagged = isFlagged('friends', key);
                  return (
                    <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="p-2 font-mono text-gray-300">{f.datetime || fmtMs(f.timestamp)}</td>
                      <td className="p-2 text-gray-200">{f.user}</td>
                      <td className="p-2 text-gray-200">{f.friend}</td>
                      <td className="p-2">
                        <FlagButton size="xs" active={flagged} onClick={() => toggleFlag('friends', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {blocked.length > 0 && (
        <Card title={`Blocked Users (${blocked.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left p-2">Datetime</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Blocked</th>
                  <th className="text-left p-2">Flag</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((b, i) => {
                  const key = FlagKey.blockedUser(b);
                  const flagged = isFlagged('blocked', key);
                  return (
                    <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="p-2 font-mono text-gray-300">{b.datetime || fmtMs(b.timestamp)}</td>
                      <td className="p-2 text-gray-200">{b.user}</td>
                      <td className="p-2 text-gray-200">{b.blocked}</td>
                      <td className="p-2">
                        <FlagButton size="xs" active={flagged} onClick={() => toggleFlag('blocked', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ChatTextTable({
  title, items, section, isFlagged, toggleFlag,
}: { title: string; items: KikChatRecord[]; section: string; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  if (items.length === 0) return null;
  const cap = 500;
  const display = items.slice(0, cap);
  return (
    <Card title={`${title} (${items.length})${items.length > cap ? ` — first ${cap}` : ''}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left p-2">Datetime</th>
              <th className="text-left p-2">Sender</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Count</th>
              <th className="text-left p-2">IP</th>
              <th className="text-left p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {display.map((c, i) => {
              const key = FlagKey.chatRecord(c);
              const flagged = isFlagged(section, key);
              return (
                <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                  <td className="p-2 font-mono text-gray-300">{c.datetime || fmtMs(c.timestamp)}</td>
                  <td className="p-2 text-gray-200">{c.sender}</td>
                  <td className="p-2 text-gray-200">{c.recipient}</td>
                  <td className="p-2 text-gray-300">{c.msgCount}</td>
                  <td className="p-2 font-mono text-gray-300">{c.ip}</td>
                  <td className="p-2">
                    <FlagButton size="xs" active={flagged} onClick={() => toggleFlag(section, key)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ChatMediaTable({
  title, items, section, isFlagged, toggleFlag,
}: { title: string; items: KikChatMediaRecord[]; section: string; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  if (items.length === 0) return null;
  const cap = 500;
  const display = items.slice(0, cap);
  return (
    <Card title={`${title} (${items.length})${items.length > cap ? ` — first ${cap}` : ''}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left p-2">Datetime</th>
              <th className="text-left p-2">Sender</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Media Type</th>
              <th className="text-left p-2">Media UUID</th>
              <th className="text-left p-2">IP</th>
              <th className="text-left p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {display.map((c, i) => {
              const key = FlagKey.chatMedia(c);
              const flagged = isFlagged(section, key);
              return (
                <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                  <td className="p-2 font-mono text-gray-300">{c.datetime || fmtMs(c.timestamp)}</td>
                  <td className="p-2 text-gray-200">{c.sender}</td>
                  <td className="p-2 text-gray-200">{c.recipient}</td>
                  <td className="p-2 text-gray-300">{c.mediaType}</td>
                  <td className="p-2 font-mono text-gray-300" title={c.mediaUuid}>{truncate(c.mediaUuid, 40)}</td>
                  <td className="p-2 font-mono text-gray-300">{c.ip}</td>
                  <td className="p-2">
                    <FlagButton size="xs" active={flagged} onClick={() => toggleFlag(section, key)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DmView({ rec, isFlagged, toggleFlag }: { rec: KikRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Direct Messages</h2>
      <ChatTextTable title="DM Text — Sent"      items={rec.chatSent}                  section="dmTextSent"     isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <ChatTextTable title="DM Text — Received"  items={rec.chatSentReceived}          section="dmTextReceived" isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <ChatMediaTable title="DM Media — Sent"     items={rec.chatPlatformSent}          section="dmMediaSent"    isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <ChatMediaTable title="DM Media — Received" items={rec.chatPlatformSentReceived}  section="dmMediaReceived" isFlagged={isFlagged} toggleFlag={toggleFlag} />
    </div>
  );
}

function GroupTextTable({
  title, items, section, isFlagged, toggleFlag,
}: { title: string; items: KikGroupRecord[]; section: string; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  if (items.length === 0) return null;
  const cap = 500;
  const display = items.slice(0, cap);
  return (
    <Card title={`${title} (${items.length})${items.length > cap ? ` — first ${cap}` : ''}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left p-2">Datetime</th>
              <th className="text-left p-2">Sender</th>
              <th className="text-left p-2">Group</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Count</th>
              <th className="text-left p-2">IP</th>
              <th className="text-left p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {display.map((g, i) => {
              const key = FlagKey.groupRecord(g);
              const flagged = isFlagged(section, key);
              return (
                <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                  <td className="p-2 font-mono text-gray-300">{g.datetime || fmtMs(g.timestamp)}</td>
                  <td className="p-2 text-gray-200">{g.sender}</td>
                  <td className="p-2 font-mono text-gray-300" title={g.groupId}>{truncate(g.groupId, 30)}</td>
                  <td className="p-2 text-gray-200">{g.recipient}</td>
                  <td className="p-2 text-gray-300">{g.msgCount}</td>
                  <td className="p-2 font-mono text-gray-300">{g.ip}</td>
                  <td className="p-2">
                    <FlagButton size="xs" active={flagged} onClick={() => toggleFlag(section, key)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GroupMediaTable({
  title, items, section, isFlagged, toggleFlag,
}: { title: string; items: KikGroupMediaRecord[]; section: string; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  if (items.length === 0) return null;
  const cap = 500;
  const display = items.slice(0, cap);
  return (
    <Card title={`${title} (${items.length})${items.length > cap ? ` — first ${cap}` : ''}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="text-left p-2">Datetime</th>
              <th className="text-left p-2">Sender</th>
              <th className="text-left p-2">Group</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Media Type</th>
              <th className="text-left p-2">Media UUID</th>
              <th className="text-left p-2">IP</th>
              <th className="text-left p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {display.map((g, i) => {
              const key = FlagKey.groupMedia(g);
              const flagged = isFlagged(section, key);
              return (
                <tr key={i} className={`border-b border-gray-700/60 ${flagged ? 'bg-amber-500/10' : ''}`}>
                  <td className="p-2 font-mono text-gray-300">{g.datetime || fmtMs(g.timestamp)}</td>
                  <td className="p-2 text-gray-200">{g.sender}</td>
                  <td className="p-2 font-mono text-gray-300" title={g.groupId}>{truncate(g.groupId, 30)}</td>
                  <td className="p-2 text-gray-200">{g.recipient}</td>
                  <td className="p-2 text-gray-300">{g.mediaType}</td>
                  <td className="p-2 font-mono text-gray-300" title={g.mediaUuid}>{truncate(g.mediaUuid, 40)}</td>
                  <td className="p-2 font-mono text-gray-300">{g.ip}</td>
                  <td className="p-2">
                    <FlagButton size="xs" active={flagged} onClick={() => toggleFlag(section, key)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GroupView({ rec, isFlagged, toggleFlag }: { rec: KikRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Group Messages</h2>
      <GroupTextTable  title="Group Text — Sent"      items={rec.groupSendMsg}              section="groupTextSent"      isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <GroupTextTable  title="Group Text — Received"  items={rec.groupReceiveMsg}           section="groupTextReceived"  isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <GroupMediaTable title="Group Media — Sent"     items={rec.groupSendMsgPlatform}      section="groupMediaSent"     isFlagged={isFlagged} toggleFlag={toggleFlag} />
      <GroupMediaTable title="Group Media — Received" items={rec.groupReceiveMsgPlatform}   section="groupMediaReceived" isFlagged={isFlagged} toggleFlag={toggleFlag} />
    </div>
  );
}

function ContentView({
  rec, importId, isFlagged, toggleFlag,
}: { rec: KikRecord; importId: number; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const files = Object.entries(rec.contentFiles || {});
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const cap = 300;
  const display = files.slice(0, cap);

  const loadPreview = async (name: string) => {
    if (previews[name] !== undefined) return;
    try {
      const r = await window.electronAPI.kikWarrantReadMedia({ importId, fileName: name });
      setPreviews(p => ({ ...p, [name]: r.success && r.dataUrl ? r.dataUrl : null }));
    } catch { setPreviews(p => ({ ...p, [name]: null })); }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Media / Content Files ({files.length})</h2>
      {files.length > cap && (
        <div className="text-xs text-amber-300 mb-3">Showing first {cap} of {files.length}. Export to see all.</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {display.map(([name, info]) => {
          const flagged = isFlagged('content', FlagKey.contentFile(name));
          const isImage = (info.mimeType || '').startsWith('image/');
          const preview = previews[name];
          return (
            <div key={name} className={`rounded-lg border ${flagged ? 'border-amber-500/60 bg-amber-500/5' : 'border-gray-700 bg-gray-800/40'} overflow-hidden`}>
              <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                {isImage ? (
                  preview ? (
                    <img src={preview} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <button
                      onClick={() => loadPreview(name)}
                      className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-600"
                    >
                      {previews[name] === null ? 'Preview failed' : 'Load preview'}
                    </button>
                  )
                ) : (
                  <span className="text-3xl text-gray-500">{(info.mimeType || '').startsWith('video/') ? '▶️' : '📄'}</span>
                )}
              </div>
              <div className="p-2 space-y-1">
                <div className="text-xs text-gray-200 truncate" title={name}>{truncate(name, 36)}</div>
                <div className="text-[10px] text-gray-500">{info.mimeType} · {formatSize(info.size)}</div>
                <div className="flex justify-end">
                  <FlagButton size="xs" active={flagged} onClick={() => toggleFlag('content', FlagKey.contentFile(name))} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KikWarrantTab;
