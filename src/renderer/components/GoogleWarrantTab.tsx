import { useState, useEffect } from 'react';

interface GoogleWarrantTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Types (mirror parser output) ───────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string }

interface GoogleSubscriberInfo {
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  alternateEmails: string | null;
  accountId: string | null;
  createdOn: string | null;
  tosIp: string | null;
  tosLanguage: string | null;
  birthday: string | null;
  services: string | null;
  status: string | null;
  lastUpdated: string | null;
  lastLogins: string[];
  deletionDate: string | null;
  recovery: { contactEmail: string | null; recoveryEmail: string | null; recoverySms: string | null };
  phoneNumbers: { user: string | null; twoStep: string | null };
  ipActivity: any[];
}

interface GoogleRecord {
  accountEmail: string | null;
  accountId: string | null;
  dateRange: { start: string | null; end: string | null };
  coverLetter: { name: string; size: number } | null;
  categories: string[];
  subscriber: GoogleSubscriberInfo | null;
  changeHistory: any[];
  emails: any[];
  emailMetadata: any[];
  locationRecords: any[];
  semanticLocations: any[];
  devices: any[];
  installs: any[];
  library: any[];
  userActivity: any[];
  chatMessages: any[];
  chatUserInfo: string | null;
  chatGroupInfo: any[];
  hangoutsInfo: Record<string, string> | null;
  googlePay: { instruments: any[]; transactions: any[]; addresses: any[] };
  driveFiles: any[];
  accessLogActivity: any[];
  ipActivity: any[];
  playStorePreferences: any[];
  noRecordCategories: string[];
}

interface GoogleImportHeader {
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

interface GoogleImportFull extends GoogleImportHeader {
  records: GoogleRecord[];
  mediaIndex: Record<string, MediaIndexEntry>;
}

interface ScanCandidate {
  filePath: string;
  sourceKind: 'warrant' | 'evidence';
  sourceRefId: number;
  hint?: string;
  size: number;
}

type SectionId = 'overview' | 'access' | 'mail' | 'location' | 'play' | 'chat' | 'pay' | 'drive';

// ─── Stable flag-key generators (must match googleWarrantHtmlReport.GoogleFlagKey) ──

const FlagKey = {
  ipActivity:     (ip: any) => `${ip.timestamp || ''}|${ip.ip || ''}`,
  changeHistory:  (c: any) => `${c.timestamp || ''}|${c.ip || ''}|${c.changeType || ''}`,
  email:          (e: any) => e.id || `${e.subject || ''}|${e.date || ''}|${e.from || ''}`.substring(0, 200),
  locationRecord: (l: any) => `${l.timestamp || ''}|${l.lat ?? ''}|${l.lng ?? ''}`,
  semanticLoc:    (s: any) => `${s.type}|${s.placeId || s.activityType || ''}|${s.startTime || ''}`,
  device:         (d: any) => d.androidId || `${d.manufacturer || ''}|${d.model || ''}|${d.registrationTime || ''}`,
  install:        (i: any) => `${i.packageName || ''}|${i.installTime || ''}`,
  libraryEntry:   (l: any) => `${l.packageName || ''}|${l.acquisitionTime || ''}`,
  userActivity:   (a: any) => `${a.timestamp || ''}|${(a.action || '').substring(0, 60)}`,
  accessLog:      (a: any) => `${a.timestamp || ''}|${(a.activity || '').substring(0, 60)}`,
  chatMessage:    (m: any) => `${m.creator?.userId || m.creator?.name || ''}|${m.createdDate || m.timestamp || ''}|${(m.textBody || m.text || '').substring(0, 60)}`,
  payTransaction: (t: any) => `${t['transaction id'] || t.transactionId || ''}|${t.date || t.timestamp || ''}|${t.amount || ''}`,
  driveFile:      (f: any) => `${f.name || ''}|${f.path || ''}`,
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

export function GoogleWarrantTab({ caseId, caseNumber }: GoogleWarrantTabProps) {
  // List/scan state
  const [imports, setImports] = useState<GoogleImportHeader[]>([]);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Detail-view state
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [activeImport, setActiveImport] = useState<GoogleImportFull | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [flags, setFlags] = useState<Set<string>>(new Set()); // key = "section|flagKey"
  const [pushingEvidence, setPushingEvidence] = useState(false);

  // ── Refresh helpers ──────────────────────────────────────────────────────

  const refreshImports = async () => {
    try {
      const r = await window.electronAPI.googleWarrantListImports(caseId);
      if (r.success) setImports(r.imports);
      else setError(r.error || 'Failed to load imports');
    } catch (e: any) { setError(e.message); }
  };

  const refreshScan = async () => {
    setScanning(true);
    try {
      const r = await window.electronAPI.googleWarrantScan(caseId);
      if (r.success) setCandidates(r.candidates);
    } catch { /* non-fatal */ }
    setScanning(false);
  };

  const loadImport = async (id: number) => {
    try {
      const r = await window.electronAPI.googleWarrantGetImport(id);
      if (r.success && r.import) {
        setActiveImport(r.import as GoogleImportFull);
        setActiveSection('overview');
        const f = await window.electronAPI.warrantFlagList({ caseId, provider: 'google', importId: id });
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
      const r = await window.electronAPI.googleWarrantImport({
        caseId, filePath: c.filePath, sourceKind: c.sourceKind, sourceRefId: c.sourceRefId,
      });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      const s = r.summary;
      setToast({
        msg: s
          ? `Imported · ${s.categories} categories · ${s.emails} emails · ${s.locations} locations · ${s.devices} devices`
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
      const p = await window.electronAPI.googleWarrantPickFile();
      if (p.canceled) return;
      if (!p.success || !p.filePath) { setError(p.error || 'File selection failed'); return; }
      setImporting(true);
      const r = await window.electronAPI.googleWarrantImport({ caseId, filePath: p.filePath, sourceKind: 'picker' });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: 'Import complete', type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handleDeleteImport = async (imp: GoogleImportHeader) => {
    if (!window.confirm(`Delete "${imp.label}" and all its flags? This cannot be undone.`)) return;
    try {
      const r = await window.electronAPI.googleWarrantDeleteImport(imp.id);
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
        caseId, provider: 'google', importId: activeImport.id, section, flagKey,
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
      const r = await window.electronAPI.warrantFlagClear({ caseId, provider: 'google', importId: activeImport.id });
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
      : `Build a Full bundle of this Google production and add it to the Evidence module?\n\nNote: full bundles can be large if the production has many records.`;
    if (!window.confirm(confirmMsg)) return;

    setPushingEvidence(true);
    try {
      const r = await window.electronAPI.googleWarrantExportBundle({ importId: activeImport.id, mode });
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
    return <div className="p-6 text-gray-400">Loading Google warrant data…</div>;
  }

  if (!activeImportId || !activeImport) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Google Warrant Parser</h2>
            <p className="text-sm text-gray-400 mt-1">
              Google warrant return parser (Subscriber, Mail, Locations, Play Store, Chat, Pay, Drive) — Case {caseNumber}
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
              className="px-3 py-1.5 text-sm rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
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
              No Google warrant returns imported yet. Click <strong>Import ZIP…</strong> to select a production,
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

  const navSections: { id: SectionId; label: string; icon: string; count?: number; show: boolean }[] = [
    { id: 'overview', label: 'Subscriber',     icon: '👤', show: true },
    { id: 'access',   label: 'Access & IP',    icon: '🌐', count: (rec.ipActivity?.length || 0) + (rec.changeHistory?.length || 0) + (rec.accessLogActivity?.length || 0), show: ((rec.ipActivity?.length || 0) + (rec.changeHistory?.length || 0) + (rec.accessLogActivity?.length || 0)) > 0 },
    { id: 'mail',     label: 'Email (MBOX)',   icon: '✉️', count: rec.emails?.length, show: (rec.emails?.length || 0) > 0 },
    { id: 'location', label: 'Location',       icon: '📍', count: (rec.locationRecords?.length || 0) + (rec.semanticLocations?.length || 0), show: ((rec.locationRecords?.length || 0) + (rec.semanticLocations?.length || 0)) > 0 },
    { id: 'play',     label: 'Play Store',     icon: '🎮', count: (rec.devices?.length || 0) + (rec.installs?.length || 0) + (rec.library?.length || 0) + (rec.userActivity?.length || 0), show: ((rec.devices?.length || 0) + (rec.installs?.length || 0) + (rec.library?.length || 0) + (rec.userActivity?.length || 0)) > 0 },
    { id: 'chat',     label: 'Chat / Hangouts', icon: '💬', count: rec.chatMessages?.length, show: (rec.chatMessages?.length || 0) > 0 || !!rec.hangoutsInfo },
    { id: 'pay',      label: 'Google Pay',     icon: '💳', count: (rec.googlePay?.transactions?.length || 0) + (rec.googlePay?.instruments?.length || 0), show: ((rec.googlePay?.transactions?.length || 0) + (rec.googlePay?.instruments?.length || 0) + (rec.googlePay?.addresses?.length || 0)) > 0 },
    { id: 'drive',    label: 'Drive',          icon: '📂', count: rec.driveFiles?.length, show: (rec.driveFiles?.length || 0) > 0 },
  ];

  return (
    <div>
      {/* Top bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-700/60">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setActiveImportId(null)}
            className="text-green-400 hover:text-green-300"
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

      {/* Header strip — account info + flag tools */}
      <div className="px-6 py-3 bg-gray-800/30 border-b border-gray-700/60 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-200 space-x-4">
          <span><span className="text-gray-500">Account:</span> <strong>{rec.accountEmail || '—'}</strong></span>
          <span><span className="text-gray-500">ID:</span> <code className="text-xs text-gray-300">{rec.accountId || '—'}</code></span>
          <span><span className="text-gray-500">Range:</span> {rec.dateRange?.start || '—'} → {rec.dateRange?.end || '—'}</span>
          <span><span className="text-gray-500">Categories:</span> {(rec.categories || []).length}</span>
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
            className="px-3 py-1 text-xs rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-40"
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

      {/* Body: sidebar nav + content */}
      <div className="flex" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <aside className="w-56 border-r border-gray-700/60 bg-gray-900/40 p-2 space-y-1 shrink-0">
          {navSections.filter(s => s.show).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                activeSection === s.id
                  ? 'bg-green-700/40 text-green-200 border border-green-600/40'
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
          {activeSection === 'overview' && <SubscriberView rec={rec} />}
          {activeSection === 'access' && <AccessView rec={rec} flags={flags} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'mail' && <MailView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'location' && <LocationView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'play' && <PlayStoreView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'chat' && <ChatView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'pay' && <PayView rec={rec} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'drive' && <DriveView rec={rec} importId={activeImport.id} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
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

function SubscriberView({ rec }: { rec: GoogleRecord }) {
  const s = rec.subscriber;
  if (!s) {
    return <div className="text-gray-400">No subscriber info in this production.</div>;
  }
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Subscriber Info</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Identity">
          <KV label="Name" value={s.name} />
          <KV label="Given Name" value={s.givenName} />
          <KV label="Family Name" value={s.familyName} />
          <KV label="Email" value={s.email} />
          <KV label="Alternate Emails" value={s.alternateEmails} />
          <KV label="Account ID" value={s.accountId} />
          <KV label="Birthday" value={s.birthday} />
        </Card>
        <Card title="Account Status">
          <KV label="Created On" value={s.createdOn} />
          <KV label="Status" value={s.status} />
          <KV label="Last Updated" value={s.lastUpdated} />
          <KV label="Deletion Date" value={s.deletionDate} />
          <KV label="Services" value={s.services} />
          <KV label="ToS IP" value={s.tosIp} />
          <KV label="ToS Language" value={s.tosLanguage} />
        </Card>
        <Card title="Recovery">
          <KV label="Contact Email" value={s.recovery?.contactEmail} />
          <KV label="Recovery Email" value={s.recovery?.recoveryEmail} />
          <KV label="Recovery SMS" value={s.recovery?.recoverySms} />
          <KV label="User Phone Numbers" value={s.phoneNumbers?.user} />
          <KV label="2-Step Phone Numbers" value={s.phoneNumbers?.twoStep} />
        </Card>
        <Card title={`Last Logins (${(s.lastLogins || []).length})`}>
          <div className="font-mono text-xs text-gray-300 space-y-0.5 max-h-60 overflow-y-auto">
            {(s.lastLogins || []).slice(0, 50).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {(s.lastLogins || []).length === 0 && <span className="text-gray-500">none</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

type FlagFn = (section: string, key: string) => boolean;
type ToggleFn = (section: string, key: string) => void;

function AccessView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; flags?: Set<string>; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Access & IP</h2>

      {(rec.ipActivity?.length || 0) > 0 && (
        <Card title={`IP Activity (${rec.ipActivity.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Timestamp</th>
                  <th className="text-left px-2 py-1">IP</th>
                  <th className="text-left px-2 py-1">Activity</th>
                  <th className="text-left px-2 py-1">User Agent</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.ipActivity.slice(0, 500).map((ip: any, i: number) => {
                  const key = FlagKey.ipActivity(ip);
                  const flagged = isFlagged('ipActivity', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono text-gray-300">{ip.timestamp}</td>
                      <td className="px-2 py-1 font-mono">{ip.ip}</td>
                      <td className="px-2 py-1">{ip.activityType}</td>
                      <td className="px-2 py-1 text-gray-500 truncate max-w-[300px]">{truncate(ip.userAgent, 60)}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('ipActivity', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rec.ipActivity.length > 500 && (
              <div className="text-xs text-gray-500 mt-2">Showing first 500 of {rec.ipActivity.length}</div>
            )}
          </div>
        </Card>
      )}

      {(rec.changeHistory?.length || 0) > 0 && (
        <Card title={`Change History (${rec.changeHistory.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Timestamp</th>
                  <th className="text-left px-2 py-1">IP</th>
                  <th className="text-left px-2 py-1">Change Type</th>
                  <th className="text-left px-2 py-1">Old → New</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.changeHistory.slice(0, 300).map((c: any, i: number) => {
                  const key = FlagKey.changeHistory(c);
                  const flagged = isFlagged('changeHistory', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono text-gray-300">{c.timestamp}</td>
                      <td className="px-2 py-1 font-mono">{c.ip}</td>
                      <td className="px-2 py-1">{c.changeType}</td>
                      <td className="px-2 py-1 text-gray-400">{truncate(c.oldValue, 40)} → {truncate(c.newValue, 40)}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('changeHistory', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(rec.accessLogActivity?.length || 0) > 0 && (
        <Card title={`Access Log Activity (${rec.accessLogActivity.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Timestamp</th>
                  <th className="text-left px-2 py-1">Activity</th>
                  <th className="text-left px-2 py-1">IP</th>
                  <th className="text-left px-2 py-1">Details</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.accessLogActivity.slice(0, 500).map((a: any, i: number) => {
                  const key = FlagKey.accessLog(a);
                  const flagged = isFlagged('accessLog', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono text-gray-300">{a.timestamp}</td>
                      <td className="px-2 py-1">{a.activity}</td>
                      <td className="px-2 py-1 font-mono">{a.ip}</td>
                      <td className="px-2 py-1 text-gray-500 truncate max-w-[300px]">{truncate(a.details, 80)}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('accessLog', key)} />
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

function MailView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Email ({rec.emails.length})</h2>
      <div className="space-y-2">
        {rec.emails.slice(0, 500).map((e: any, i: number) => {
          const key = FlagKey.email(e);
          const flagged = isFlagged('emails', key);
          return (
            <div key={i} className={`rounded border p-3 ${flagged ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{e.subject || '(no subject)'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    <span className="text-gray-500">From:</span> {e.from} &nbsp;
                    <span className="text-gray-500">To:</span> {e.to}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{e.date}{e.labels ? ` · ${e.labels}` : ''}</div>
                </div>
                <FlagButton active={flagged} onClick={() => toggleFlag('emails', key)} />
              </div>
              {e.textBody && (
                <div className="text-xs text-gray-300 whitespace-pre-wrap font-mono mt-2">
                  {truncate(e.textBody, 600)}
                </div>
              )}
              {(e.attachments?.length || 0) > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  📎 {e.attachments.length} attachment(s): {e.attachments.slice(0, 6).map((a: any) => a.filename || 'unnamed').join(', ')}
                </div>
              )}
            </div>
          );
        })}
        {rec.emails.length > 500 && (
          <div className="text-xs text-gray-500">Showing first 500 of {rec.emails.length}</div>
        )}
      </div>
    </div>
  );
}

function LocationView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Location</h2>
      {(rec.locationRecords?.length || 0) > 0 && (
        <Card title={`Location Records (${rec.locationRecords.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Timestamp</th>
                  <th className="text-left px-2 py-1">Lat</th>
                  <th className="text-left px-2 py-1">Lng</th>
                  <th className="text-left px-2 py-1">Acc (m)</th>
                  <th className="text-left px-2 py-1">Source</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.locationRecords.slice(0, 500).map((l: any, i: number) => {
                  const key = FlagKey.locationRecord(l);
                  const flagged = isFlagged('locationRecords', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono text-gray-300">{l.timestamp}</td>
                      <td className="px-2 py-1 font-mono">{l.lat?.toFixed(6)}</td>
                      <td className="px-2 py-1 font-mono">{l.lng?.toFixed(6)}</td>
                      <td className="px-2 py-1">{l.accuracy}</td>
                      <td className="px-2 py-1">{l.source}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('locationRecords', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rec.locationRecords.length > 500 && (
              <div className="text-xs text-gray-500 mt-2">Showing first 500 of {rec.locationRecords.length}</div>
            )}
          </div>
        </Card>
      )}

      {(rec.semanticLocations?.length || 0) > 0 && (
        <Card title={`Semantic Locations (${rec.semanticLocations.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Type</th>
                  <th className="text-left px-2 py-1">Name / Activity</th>
                  <th className="text-left px-2 py-1">Address</th>
                  <th className="text-left px-2 py-1">Start</th>
                  <th className="text-left px-2 py-1">End</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.semanticLocations.slice(0, 500).map((s: any, i: number) => {
                  const key = FlagKey.semanticLoc(s);
                  const flagged = isFlagged('semanticLocations', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1"><span className="px-1.5 py-0.5 rounded bg-green-700/30 text-green-300 text-[10px]">{s.type}</span></td>
                      <td className="px-2 py-1">{s.name || s.activityType || '—'}</td>
                      <td className="px-2 py-1 text-gray-400">{s.address || '—'}</td>
                      <td className="px-2 py-1 font-mono text-gray-300">{s.startTime}</td>
                      <td className="px-2 py-1 font-mono text-gray-300">{s.endTime}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('semanticLocations', key)} />
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

function PlayStoreView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Play Store</h2>

      {(rec.devices?.length || 0) > 0 && (
        <Card title={`Devices (${rec.devices.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Android ID</th>
                  <th className="text-left px-2 py-1">Manufacturer</th>
                  <th className="text-left px-2 py-1">Model</th>
                  <th className="text-left px-2 py-1">Carrier</th>
                  <th className="text-left px-2 py-1">Country</th>
                  <th className="text-left px-2 py-1">Last Active</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.devices.map((d: any, i: number) => {
                  const key = FlagKey.device(d);
                  const flagged = isFlagged('devices', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono">{d.androidId}</td>
                      <td className="px-2 py-1">{d.manufacturer}</td>
                      <td className="px-2 py-1">{d.model}</td>
                      <td className="px-2 py-1">{d.carrier}</td>
                      <td className="px-2 py-1">{d.country}</td>
                      <td className="px-2 py-1 font-mono text-gray-300">{d.lastActive}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('devices', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(rec.installs?.length || 0) > 0 && (
        <Card title={`App Installs (${rec.installs.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Package</th>
                  <th className="text-left px-2 py-1">Title</th>
                  <th className="text-left px-2 py-1">Installed</th>
                  <th className="text-left px-2 py-1">State</th>
                  <th className="text-left px-2 py-1">Device</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.installs.slice(0, 500).map((inst: any, i: number) => {
                  const key = FlagKey.install(inst);
                  const flagged = isFlagged('installs', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono">{inst.packageName}</td>
                      <td className="px-2 py-1">{inst.title}</td>
                      <td className="px-2 py-1 font-mono text-gray-300">{inst.installTime}</td>
                      <td className="px-2 py-1">{inst.state}</td>
                      <td className="px-2 py-1">{inst.deviceManufacturer} {inst.deviceModel}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('installs', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(rec.library?.length || 0) > 0 && (
        <Card title={`Library (${rec.library.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left px-2 py-1">Package</th>
                  <th className="text-left px-2 py-1">Title</th>
                  <th className="text-left px-2 py-1">Type</th>
                  <th className="text-left px-2 py-1">Acquired</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rec.library.slice(0, 500).map((l: any, i: number) => {
                  const key = FlagKey.libraryEntry(l);
                  const flagged = isFlagged('library', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-2 py-1 font-mono">{l.packageName}</td>
                      <td className="px-2 py-1">{l.title}</td>
                      <td className="px-2 py-1">{l.type}</td>
                      <td className="px-2 py-1 font-mono text-gray-300">{l.acquisitionTime}</td>
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('library', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(rec.userActivity?.length || 0) > 0 && (
        <Card title={`User Activity (${rec.userActivity.length})`}>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {rec.userActivity.slice(0, 500).map((a: any, i: number) => {
              const key = FlagKey.userActivity(a);
              const flagged = isFlagged('userActivity', key);
              return (
                <div key={i} className={`flex items-start justify-between gap-3 rounded px-3 py-2 border ${flagged ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 font-mono">{a.timestamp}</div>
                    <div className="text-sm text-gray-200">{a.action}</div>
                    {a.link && <div className="text-xs text-blue-400 break-all">{a.link}</div>}
                  </div>
                  <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('userActivity', key)} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function ChatView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Chat / Hangouts</h2>

      {rec.hangoutsInfo && (
        <Card title="Hangouts Info">
          {Object.entries(rec.hangoutsInfo).map(([k, v]) => (
            <KV key={k} label={k} value={v} />
          ))}
        </Card>
      )}

      {(rec.chatMessages?.length || 0) > 0 && (
        <Card title={`Chat Messages (${rec.chatMessages.length})`}>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {rec.chatMessages.slice(0, 500).map((m: any, i: number) => {
              const key = FlagKey.chatMessage(m);
              const flagged = isFlagged('chatMessages', key);
              const author = m.creator?.userId || m.creator?.name || m.author || '(unknown)';
              const ts = m.createdDate || m.timestamp || m.sent || '';
              const body = m.text || m.textBody || (m.type === 'html' ? '(HTML chat content)' : JSON.stringify(m).substring(0, 300));
              return (
                <div key={i} className={`rounded border px-3 py-2 ${flagged ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs text-gray-400"><strong className="text-gray-200">{author}</strong> · {ts}</div>
                    <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('chatMessages', key)} />
                  </div>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{truncate(body, 500)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function PayView({ rec, isFlagged, toggleFlag }: { rec: GoogleRecord; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const pay = rec.googlePay;
  const tablize = (rows: any[]): string[] => {
    const cols = new Set<string>();
    for (const r of rows.slice(0, 5)) for (const k of Object.keys(r)) cols.add(k);
    return Array.from(cols).slice(0, 6);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Google Pay</h2>

      {pay.transactions.length > 0 && (
        <Card title={`Transactions (${pay.transactions.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  {tablize(pay.transactions).map(c => <th key={c} className="text-left px-2 py-1">{c}</th>)}
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {pay.transactions.slice(0, 200).map((t: any, i: number) => {
                  const key = FlagKey.payTransaction(t);
                  const flagged = isFlagged('payTransactions', key);
                  return (
                    <tr key={i} className={`border-b border-gray-800 ${flagged ? 'bg-amber-500/10' : ''}`}>
                      {tablize(pay.transactions).map(c => (
                        <td key={c} className="px-2 py-1 text-gray-300">{truncate(String(t[c] ?? ''), 60)}</td>
                      ))}
                      <td className="px-2 py-1 text-right">
                        <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('payTransactions', key)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pay.instruments.length > 0 && (
        <Card title={`Payment Instruments (${pay.instruments.length})`}>
          <div className="space-y-1 text-xs">
            {pay.instruments.slice(0, 50).map((inst: any, i: number) => (
              <pre key={i} className="bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-gray-300">
                {JSON.stringify(inst, null, 2)}
              </pre>
            ))}
          </div>
        </Card>
      )}

      {pay.addresses.length > 0 && (
        <Card title={`Addresses (${pay.addresses.length})`}>
          <div className="space-y-1 text-xs">
            {pay.addresses.slice(0, 50).map((a: any, i: number) => (
              <pre key={i} className="bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-gray-300">
                {JSON.stringify(a, null, 2)}
              </pre>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DriveView({ rec, importId: _importId, isFlagged, toggleFlag }: { rec: GoogleRecord; importId: number; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Drive Files ({rec.driveFiles.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rec.driveFiles.slice(0, 300).map((f: any, i: number) => {
          const key = FlagKey.driveFile(f);
          const flagged = isFlagged('driveFiles', key);
          const isFile = !!f._isFile;
          return (
            <div key={i} className={`rounded border p-3 ${flagged ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{f.name || f.title || '(unnamed)'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {isFile
                      ? `${f.mimeType || ''} · ${f.size != null ? formatSize(f.size) : ''}`
                      : 'metadata'}
                  </div>
                </div>
                <FlagButton active={flagged} size="xs" onClick={() => toggleFlag('driveFiles', key)} />
              </div>
              {f.path && (
                <div className="text-[10px] text-gray-500 truncate font-mono">{f.path}</div>
              )}
            </div>
          );
        })}
      </div>
      {rec.driveFiles.length > 300 && (
        <div className="text-xs text-gray-500 mt-3">Showing first 300 of {rec.driveFiles.length}</div>
      )}
    </div>
  );
}

export default GoogleWarrantTab;
