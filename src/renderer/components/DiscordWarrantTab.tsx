import { useState, useEffect } from 'react';
import '../styles/meta-warrant.css';

interface DiscordWarrantTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Types (mirror parser output) ───────────────────────────────────────────

interface MediaIndexEntry { size: number; mimeType: string; originalPath: string; kind?: string }

interface DiscordSession {
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

interface DiscordSubscriber {
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

interface DiscordMessage {
  id: string;
  timestamp: string;
  contents: string;
  attachments: string;
}

interface DiscordChannel {
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

interface DiscordServer {
  id: string;
  name: string;
  auditLog: any[];
}

interface DiscordActivityEvent {
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

interface DiscordActivity {
  sessionStarts: DiscordActivityEvent[];
  sessionEnds: DiscordActivityEvent[];
  appOpens: DiscordActivityEvent[];
  logins: DiscordActivityEvent[];
  registers: DiscordActivityEvent[];
  otherImportant: DiscordActivityEvent[];
  eventCounts: Record<string, number>;
  totalEventCount: number;
}

interface DiscordIpRow {
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

interface DiscordDeviceRow {
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

interface DiscordStats {
  messageCount: number;
  channelCount: number;
  serverCount: number;
  sessionCount: number;
  ipCount: number;
  deviceCount: number;
  eventCount: number;
  mediaCount: number;
}

interface DiscordResult {
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
  promotions: { quests: any[]; drops: any[] };
  store: { wishlist: any[] };
  virtualCurrency: { accounts: any[]; transactions: any[] };
  activity: DiscordActivity;
  ipActivity: DiscordIpRow[];
  devices: DiscordDeviceRow[];
  contentFiles: Record<string, any>;
  stats: DiscordStats;
}

interface DiscordImportHeader {
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

interface DiscordImportFull extends DiscordImportHeader {
  result: DiscordResult;
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

type SectionId = 'overview' | 'subscriber' | 'messages' | 'servers' | 'ip' | 'devices' | 'activity' | 'billing';

// ─── Stable flag-key generators (MUST MATCH discordWarrantHtmlReport.DiscordFlagKey) ──

const FlagKey = {
  message:  (m: DiscordMessage) => String(m.id || ''),
  server:   (s: DiscordServer) => String(s.id || ''),
  ip:       (r: DiscordIpRow) => String(r.ip || ''),
  device:   (r: DiscordDeviceRow) => String(r.device_vendor_id || r.key || ''),
  activity: (ev: DiscordActivityEvent) =>
    `${ev.timestamp || ''}|${ev.event_type || ''}|${ev.ip || ''}|${ev.session || ''}`,
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

const fmtList = (arr: any[] | undefined | null, sep = ', '): string => {
  if (!arr || !arr.length) return '';
  return arr.filter((x) => x != null && x !== '').join(sep);
};

const allActivityEvents = (res: DiscordResult): DiscordActivityEvent[] => {
  const a = res.activity || ({} as any);
  return [
    ...(a.sessionStarts || []),
    ...(a.sessionEnds || []),
    ...(a.appOpens || []),
    ...(a.logins || []),
    ...(a.registers || []),
    ...(a.otherImportant || []),
  ];
};

// ─── ARIN lookup chip (verbatim from MetaWarrantTab) ────────────────────────

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

// ─── Flag button (matches Meta mwp-flag-btn style) ──────────────────────────

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

// ─── KV row helper (matches Meta mwp-kv-row style) ─────────────────────────

function KvRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="mwp-kv-row">
      <span className="mwp-kv-label">{label}</span>
      <span className="mwp-kv-value">{String(value)}</span>
    </div>
  );
}

// ─── Stat badge (matches Meta mwp-stat style) ──────────────────────────────

function StatBadge({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <div className={`mwp-stat ${count > 0 ? 'has-data' : ''}`}>
      <span className="mwp-stat-icon">{icon}</span>
      <span className="mwp-stat-count">{count}</span>
      <span className="mwp-stat-label">{label}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DiscordWarrantTab({ caseId, caseNumber }: DiscordWarrantTabProps) {
  const [imports, setImports] = useState<DiscordImportHeader[]>([]);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [activeImport, setActiveImport] = useState<DiscordImportFull | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [pushingEvidence, setPushingEvidence] = useState(false);

  const refreshImports = async () => {
    try {
      const r = await window.electronAPI.discordWarrantListImports(caseId);
      if (r.success) setImports(r.imports);
      else setError(r.error || 'Failed to load imports');
    } catch (e: any) { setError(e.message); }
  };

  const refreshScan = async () => {
    setScanning(true);
    try {
      const r = await window.electronAPI.discordWarrantScan(caseId);
      if (r.success) setCandidates(r.candidates);
    } catch { /* non-fatal */ }
    setScanning(false);
  };

  const loadImport = async (id: number) => {
    try {
      const r = await window.electronAPI.discordWarrantGetImport(id);
      if (r.success && r.import) {
        setActiveImport(r.import as DiscordImportFull);
        setActiveSection('overview');
        const f = await window.electronAPI.warrantFlagList({ caseId, provider: 'discord', importId: id });
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
      const r = await window.electronAPI.discordWarrantImport({
        caseId, filePath: c.filePath, sourceKind: c.sourceKind, sourceRefId: c.sourceRefId,
      });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      const s = r.summary;
      setToast({
        msg: s
          ? `Imported · ${s.channelCount} channel${s.channelCount === 1 ? '' : 's'} · ${s.messageCount} msgs · ${s.serverCount} servers · ${s.ipCount} IPs · ${s.eventCount} events`
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
      const p = await window.electronAPI.discordWarrantPickFile();
      if (p.canceled) return;
      if (!p.success || !p.filePath) { setError(p.error || 'File selection failed'); return; }
      setImporting(true);
      const r = await window.electronAPI.discordWarrantImport({ caseId, filePath: p.filePath, sourceKind: 'picker' });
      if (!r.success) { setError(r.error || 'Import failed'); return; }
      setToast({ msg: 'Import complete', type: 'success' });
      await refreshImports();
      await refreshScan();
      if (r.importId) setActiveImportId(r.importId);
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const handleDeleteImport = async (imp: DiscordImportHeader) => {
    if (!window.confirm(`Delete "${imp.label}" and all its flags? This cannot be undone.`)) return;
    try {
      const r = await window.electronAPI.discordWarrantDeleteImport(imp.id);
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
        caseId, provider: 'discord', importId: activeImport.id, section, flagKey,
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
      const r = await window.electronAPI.warrantFlagClear({ caseId, provider: 'discord', importId: activeImport.id });
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
      : `Build a Full bundle of this Discord production and add it to the Evidence module?\n\nNote: full bundles can be large if the production has many records.`;
    if (!window.confirm(confirmMsg)) return;

    setPushingEvidence(true);
    try {
      const r = await window.electronAPI.discordWarrantExportBundle({ importId: activeImport.id, mode });
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

  // ─── Render: loading ──────────────────────────────────────────────────────

  if (loading) {
    return <div className="mwp-loading"><div className="mwp-spinner" />Loading Discord warrant data…</div>;
  }

  // ─── Render: imports list (no active import) ──────────────────────────────

  if (!activeImportId || !activeImport) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Discord Warrant Parser</h2>
            <p className="text-sm text-gray-400 mt-1">
              Discord Data Package parser — Case {caseNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshScan}
              disabled={scanning}
              className="mwp-btn-sm"
            >
              {scanning ? 'Scanning…' : 'Rescan'}
            </button>
            <button
              onClick={handlePickAndImport}
              disabled={importing}
              className="mwp-btn-primary"
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
          <section className="rounded-lg border border-amber-500/40 bg-amber-500/5">
            <header className="px-4 py-2 border-b border-amber-500/30 text-sm font-medium text-amber-200">
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
              No Discord warrant returns imported yet. Click <strong>Import ZIP / Folder…</strong> to select a Discord
              Data Package, or attach the return to the Warrants/Evidence module first and rescan.
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

  // ─── Render: detail view (mwp-layout) ─────────────────────────────────────

  const res = activeImport.result;
  const sub = res.subscriber;
  const channelCount = res.channels?.length || 0;
  const serverCount = res.servers?.length || 0;
  const ipCount = res.ipActivity?.length || 0;
  const deviceCount = res.devices?.length || 0;
  const eventCount = res.activity?.totalEventCount || 0;
  const billingShow = (res.billing && (res.billing.billingProfile?.length || res.billing.paymentSources?.length || res.billing.payments?.length || res.billing.entitlements?.length))
    || (res.dsar?.length || 0) > 0
    || (res.promotions && (res.promotions.quests?.length || res.promotions.drops?.length))
    || (res.store?.wishlist?.length || 0) > 0
    || (res.virtualCurrency && (res.virtualCurrency.accounts?.length || res.virtualCurrency.transactions?.length));

  // Count flagged items per section for nav pills
  const flaggedMessageCount = (res.channels || []).reduce((s, c) => s + (c.messages || []).filter(m => isFlagged('messages', FlagKey.message(m))).length, 0);
  const flaggedServerCount = (res.servers || []).filter(s => isFlagged('servers', FlagKey.server(s))).length;

  const navSections: { id: SectionId; label: string; icon: string; count?: number; show: boolean }[] = [
    { id: 'overview',   label: 'Overview',         icon: '👤', show: true },
    { id: 'subscriber', label: 'Subscriber Info',  icon: '📇', show: !!sub },
    { id: 'messages',   label: 'Messages',         icon: '💬', count: flaggedMessageCount, show: channelCount > 0 },
    { id: 'servers',    label: 'Servers / Guilds', icon: '🏛️', count: flaggedServerCount, show: serverCount > 0 },
    { id: 'ip',         label: 'IP Activity',      icon: '🌐', count: ipCount, show: ipCount > 0 },
    { id: 'devices',    label: 'Devices',          icon: '📱', count: deviceCount, show: deviceCount > 0 },
    { id: 'activity',   label: 'Activity Events',  icon: '📊', count: eventCount, show: eventCount > 0 },
    { id: 'billing',    label: 'Billing & DSAR',   icon: '💳', show: !!billingShow },
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
              title="Build an HTML bundle of the FULL Discord production and add it to the Evidence module"
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
                {s.count != null && s.count > 0 ? <span className="mwp-nav-count">{s.count}</span> : null}
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
          {activeSection === 'overview'   && renderOverview(res, activeImport)}
          {activeSection === 'subscriber' && sub && renderSubscriber(sub)}
          {activeSection === 'messages'   && <MessagesPanel res={res} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'servers'    && renderServers(res, isFlagged, toggleFlag)}
          {activeSection === 'ip'         && renderIp(res, isFlagged, toggleFlag)}
          {activeSection === 'devices'    && renderDevices(res, isFlagged, toggleFlag)}
          {activeSection === 'activity'   && <ActivityPanel res={res} isFlagged={isFlagged} toggleFlag={toggleFlag} />}
          {activeSection === 'billing'    && renderBilling(res)}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Section renderers — using mwp- CSS classes from meta-warrant.css
// ════════════════════════════════════════════════════════════════════════════

type FlagFn = (section: string, key: string) => boolean;
type ToggleFn = (section: string, key: string) => void;

function renderOverview(res: DiscordResult, imp: DiscordImportFull) {
  const s = res.stats;
  const sub = res.subscriber;
  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">
        <span style={{ fontSize: 24 }}>🎮</span> Discord Account — {sub?.username || 'Unknown'}
      </h2>

      <div className="mwp-card-grid">
        <div className="mwp-card">
          <h3 className="mwp-card-title">📋 Account</h3>
          <div className="mwp-kv-list">
            <KvRow label="Username" value={sub?.username ? `${sub.username}${sub.discriminator ? `#${sub.discriminator}` : ''}` : null} />
            <KvRow label="Global Name" value={sub?.global_name} />
            <KvRow label="User ID" value={sub?.id} />
            <KvRow label="Email" value={sub?.email} />
            <KvRow label="Phone" value={sub?.phone} />
            <KvRow label="Last Known IP" value={sub?.ip} />
            <KvRow label="Verified" value={sub?.verified ? 'Yes' : 'No'} />
            <KvRow label="Has Mobile" value={sub?.has_mobile ? 'Yes' : 'No'} />
          </div>
        </div>

        <div className="mwp-card mwp-card-full">
          <h3 className="mwp-card-title">📊 Production Totals</h3>
          <div className="mwp-stats-grid">
            <StatBadge label="Channels" count={s?.channelCount || 0} icon="💬" />
            <StatBadge label="Messages" count={s?.messageCount || 0} icon="✉️" />
            <StatBadge label="Servers" count={s?.serverCount || 0} icon="🏛️" />
            <StatBadge label="Sessions" count={s?.sessionCount || 0} icon="🔑" />
            <StatBadge label="Unique IPs" count={s?.ipCount || 0} icon="🌐" />
            <StatBadge label="Devices" count={s?.deviceCount || 0} icon="📱" />
            <StatBadge label="Activity Events" count={s?.eventCount || 0} icon="📊" />
            <StatBadge label="Avatars / Media" count={s?.mediaCount || 0} icon="📷" />
          </div>
        </div>

        <div className="mwp-card">
          <h3 className="mwp-card-title">📁 Import Details</h3>
          <div className="mwp-kv-list">
            <KvRow label="Label" value={imp.label} />
            <KvRow label="Source" value={imp.sourceKind === 'warrant' ? 'From Warrants' : imp.sourceKind === 'evidence' ? 'From Evidence' : 'Picker'} />
            <KvRow label="Media" value={`${imp.mediaCount} file${imp.mediaCount !== 1 ? 's' : ''}`} />
            <KvRow label="Imported" value={imp.createdAt ? new Date(imp.createdAt).toLocaleString() : null} />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderSubscriber(sub: DiscordSubscriber) {
  const sessions = sub.sessions || [];
  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">📇 Subscriber Info</h2>

      <div className="mwp-card-grid">
        <div className="mwp-card">
          <h3 className="mwp-card-title">👤 Profile</h3>
          <div className="mwp-kv-list">
            <KvRow label="Username" value={sub.username ? `${sub.username}${sub.discriminator ? `#${sub.discriminator}` : ''}` : null} />
            <KvRow label="Global Name" value={sub.global_name} />
            <KvRow label="User ID" value={sub.id} />
            <KvRow label="Email" value={sub.email} />
            <KvRow label="Phone" value={sub.phone} />
            <KvRow label="Last Known IP" value={sub.ip} />
            <KvRow label="Verified" value={sub.verified ? 'Yes' : 'No'} />
            <KvRow label="Has Mobile" value={sub.has_mobile ? 'Yes' : 'No'} />
            <KvRow label="Premium Until" value={sub.premium_until} />
            <KvRow label="Avatar Hash" value={sub.avatar_hash} />
            <KvRow label="Flags" value={fmtList(sub.flags as any[])} />
            <KvRow label="Connections" value={(sub.connections || []).length} />
            <KvRow label="Relationships" value={(sub.relationships || []).length} />
          </div>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mwp-card">
          <h3 className="mwp-card-title">🔑 User Sessions ({sessions.length})</h3>
          <table className="mwp-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>ARIN</th>
                <th>OS</th>
                <th>Platform</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Expires</th>
                <th>MFA</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i}>
                  <td className="mwp-mono">{s.ip || '—'}</td>
                  <td>{s.ip ? <ArinButton ip={s.ip} /> : '—'}</td>
                  <td>{s.os || '—'}</td>
                  <td>{s.platform || '—'}</td>
                  <td>{s.creation_time || '—'}</td>
                  <td>{s.last_used || '—'}</td>
                  <td>{s.expiration_time || '—'}</td>
                  <td>{s.is_mfa ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MessagesPanel({ res, isFlagged, toggleFlag }: { res: DiscordResult; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const channels = res.channels || [];
  const [selectedChannel, setSelectedChannel] = useState<string | null>(channels[0]?.channelId || null);
  const [search, setSearch] = useState('');

  const channel = channels.find(c => c.channelId === selectedChannel) || null;
  const cap = 500;
  const allMsgs = channel?.messages || [];
  const filtered = search
    ? allMsgs.filter(m =>
        (m.contents || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.attachments || '').toLowerCase().includes(search.toLowerCase()))
    : allMsgs;
  const display = filtered.slice(0, cap);

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">💬 Messages — {channels.length} channel{channels.length === 1 ? '' : 's'}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Channel sidebar */}
        <div className="mwp-card" style={{ maxHeight: '70vh', overflowY: 'auto', padding: 0 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.73em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Channels
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {channels.map(c => {
              const active = c.channelId === selectedChannel;
              const flaggedInCh = (c.messages || []).filter(m => isFlagged('messages', FlagKey.message(m))).length;
              const label = c.guildName ? `${c.guildName} · ${c.channelName || c.channelId}` : (c.channelName || c.channelId);
              return (
                <li key={c.channelId}>
                  <button
                    onClick={() => setSelectedChannel(c.channelId)}
                    className={`mwp-nav-item ${active ? 'active' : ''}`}
                    style={{ width: '100%', borderRadius: 0, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className="mwp-nav-icon">💬</span>
                    <span className="mwp-nav-label" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={label}>{truncate(label, 36)}</span>
                      <span style={{ fontSize: '0.73em', color: '#6b7280' }}>
                        {(c.messages || []).length} msg
                        {flaggedInCh > 0 ? <span style={{ color: '#fbbf24', marginLeft: 4 }}>· {flaggedInCh} flagged</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Message content */}
        <div className="mwp-card">
          {channel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '0.93em', color: '#e5e7eb' }}>
                  <strong>{channel.guildName ? `${channel.guildName} · ` : ''}{channel.channelName || channel.channelId}</strong>
                  <span style={{ fontSize: '0.73em', color: '#6b7280', marginLeft: 8 }}>{(channel.messages || []).length} msg</span>
                </div>
                <input
                  type="text"
                  placeholder="Search contents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.8em', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', width: 256 }}
                />
              </div>
              {filtered.length > cap && (
                <div style={{ fontSize: '0.73em', color: '#60a5fa', marginBottom: 8 }}>Showing first {cap} of {filtered.length}.</div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className="mwp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Flag</th>
                      <th style={{ width: 170 }}>Time</th>
                      <th style={{ width: 170 }}>Msg ID</th>
                      <th>Contents</th>
                      <th style={{ width: 200 }}>Attachments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.map((m, i) => {
                      const key = FlagKey.message(m);
                      const flagged = isFlagged('messages', key);
                      return (
                        <tr key={`${m.id || i}-${i}`} className={flagged ? 'mwp-row-flagged' : ''}>
                          <td>
                            <FlagButton section="messages" flagKey={key} flagged={flagged} onToggle={toggleFlag} />
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{m.timestamp || ''}</td>
                          <td className="mwp-mono">{m.id || ''}</td>
                          <td style={{ wordBreak: 'break-word' }}>{truncate(m.contents || '', 500)}</td>
                          <td style={{ wordBreak: 'break-word' }}>{truncate(m.attachments || '', 200)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mwp-empty">Select a channel.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderServers(res: DiscordResult, isFlagged: FlagFn, toggleFlag: ToggleFn) {
  const servers = res.servers || [];
  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">🏛️ Servers / Guilds ({servers.length})</h2>
      {servers.map(s => {
        const key = FlagKey.server(s);
        const flagged = isFlagged('servers', key);
        const audit = s.auditLog || [];
        return (
          <div key={s.id} className={`mwp-card ${flagged ? 'mwp-flagged' : ''}`} style={flagged ? { boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.5)', borderLeft: '4px solid #fbbf24' } : undefined}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: '0.93em', color: '#f3f4f6', fontWeight: 600 }}>{s.name || '—'}</div>
                <div className="mwp-mono" style={{ color: '#6b7280' }}>{s.id}</div>
              </div>
              <FlagButton section="servers" flagKey={key} flagged={flagged} onToggle={toggleFlag} />
            </div>
            <div style={{ fontSize: '0.8em', color: '#9ca3af', marginBottom: 8 }}>Audit log entries: {audit.length}</div>
            {audit.length > 0 && (
              <pre style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 12, fontSize: '0.67em', color: '#d1d5db', overflow: 'auto', maxHeight: 256 }}>
                {truncate(JSON.stringify(audit, null, 2), 4000)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderIp(res: DiscordResult, isFlagged: FlagFn, toggleFlag: ToggleFn) {
  const rows = res.ipActivity || [];
  if (rows.length === 0) return <div className="mwp-empty">No IP activity records</div>;

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">🌐 IP Activity ({rows.length})</h2>

      <div className="mwp-card">
        <h3 className="mwp-card-title">Unique IPs ({rows.length})</h3>
        <div className="mwp-ip-chips">
          {rows.map(r => (
            <span key={r.ip} className="mwp-ip-chip">
              {r.ip} <span className="mwp-ip-count">×{r.count}</span>
              <ArinButton ip={r.ip} />
            </span>
          ))}
        </div>
      </div>

      <div className="mwp-card">
        <h3 className="mwp-card-title">Activity Log</h3>
        <table className="mwp-table">
          <thead>
            <tr>
              <th>IP Address</th>
              <th>ARIN</th>
              <th>Hits</th>
              <th>Locations</th>
              <th>ISP</th>
              <th>Browsers</th>
              <th>OS</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Sources</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = FlagKey.ip(r);
              const flagged = isFlagged('ips', key);
              return (
                <tr key={i} className={flagged ? 'mwp-row-flagged' : ''}>
                  <td className="mwp-mono">{r.ip}</td>
                  <td><ArinButton ip={r.ip} /></td>
                  <td>{r.count}</td>
                  <td title={fmtList(r.locations, '; ')}>{truncate(fmtList(r.locations, '; '), 60)}</td>
                  <td title={fmtList(r.isps)}>{truncate(fmtList(r.isps), 40)}</td>
                  <td title={fmtList(r.browsers)}>{truncate(fmtList(r.browsers), 30)}</td>
                  <td title={fmtList(r.oses)}>{truncate(fmtList(r.oses), 40)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.firstSeen || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.lastSeen || '—'}</td>
                  <td style={{ fontSize: '0.73em', color: '#6b7280' }}>{fmtList(r.sources)}</td>
                  <td><FlagButton section="ips" flagKey={key} flagged={flagged} onToggle={toggleFlag} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderDevices(res: DiscordResult, isFlagged: FlagFn, toggleFlag: ToggleFn) {
  const rows = res.devices || [];
  if (rows.length === 0) return <div className="mwp-empty">No device records</div>;

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">📱 Devices ({rows.length})</h2>
      <div className="mwp-card">
        <table className="mwp-table">
          <thead>
            <tr>
              <th>Device Vendor ID</th>
              <th>Device</th>
              <th>OS</th>
              <th>Browser</th>
              <th>Client Ver.</th>
              <th>Hits</th>
              <th>IPs</th>
              <th>ARIN</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = FlagKey.device(r);
              const flagged = isFlagged('devices', key);
              return (
                <tr key={i} className={flagged ? 'mwp-row-flagged' : ''}>
                  <td className="mwp-mono" title={r.device_vendor_id || r.key}>{truncate(r.device_vendor_id || r.key, 24)}</td>
                  <td>{r.device || '—'}</td>
                  <td>{[r.os, r.os_version].filter(Boolean).join(' ') || '—'}</td>
                  <td>{r.browser || '—'}</td>
                  <td className="mwp-mono">{r.client_version || '—'}</td>
                  <td>{r.count}</td>
                  <td className="mwp-mono" title={fmtList(r.ips)}>{truncate(fmtList(r.ips), 30)}</td>
                  <td>
                    {(r.ips || []).map((ip, j) => (
                      <span key={j}>
                        {j > 0 ? ', ' : ''}<ArinButton ip={ip} />
                      </span>
                    ))}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.firstSeen || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.lastSeen || '—'}</td>
                  <td><FlagButton section="devices" flagKey={key} flagged={flagged} onToggle={toggleFlag} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityPanel({ res, isFlagged, toggleFlag }: { res: DiscordResult; isFlagged: FlagFn; toggleFlag: ToggleFn }) {
  const all = allActivityEvents(res);
  const [filter, setFilter] = useState<'all' | 'flagged' | 'login' | 'session' | 'app' | 'register'>('all');
  const [search, setSearch] = useState('');

  const cap = 1000;
  let rows = all;
  if (filter === 'flagged') rows = rows.filter(ev => isFlagged('activity', FlagKey.activity(ev)));
  if (filter === 'login') rows = rows.filter(ev => (ev.event_type || '').startsWith('login'));
  if (filter === 'session') rows = rows.filter(ev => (ev.event_type || '').startsWith('session'));
  if (filter === 'app') rows = rows.filter(ev => ev.event_type === 'app_opened');
  if (filter === 'register') rows = rows.filter(ev => (ev.event_type || '').startsWith('register'));

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(ev =>
      (ev.ip || '').toLowerCase().includes(q) ||
      (ev.event_type || '').toLowerCase().includes(q) ||
      (ev.session || '').toLowerCase().includes(q) ||
      (ev.city || '').toLowerCase().includes(q)
    );
  }

  const display = rows.slice(0, cap);

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">📊 Activity Events ({all.length})</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'flagged', 'session', 'login', 'app', 'register'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`mwp-btn-sm ${filter === f ? 'mwp-nav-item active' : ''}`}
            style={filter === f ? { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' } : undefined}
          >
            {f}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search IP / event / session…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: 8, padding: '4px 8px', fontSize: '0.8em', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', width: 256 }}
        />
      </div>
      {rows.length > cap && (
        <div style={{ fontSize: '0.73em', color: '#60a5fa', marginBottom: 8 }}>Showing first {cap} of {rows.length}.</div>
      )}
      <div className="mwp-card">
        <table className="mwp-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Cat</th>
              <th>IP</th>
              <th>Location</th>
              <th>Device/Browser</th>
              <th>OS</th>
              <th>Client Ver.</th>
              <th>Session</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {display.map((ev, i) => {
              const key = FlagKey.activity(ev);
              const flagged = isFlagged('activity', key);
              const loc = [ev.city, ev.region_code, ev.country_code].filter(Boolean).join(', ');
              return (
                <tr key={i} className={flagged ? 'mwp-row-flagged' : ''}>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev.timestamp || '—'}</td>
                  <td>{ev.event_type || '—'}</td>
                  <td style={{ fontSize: '0.73em', color: '#6b7280' }}>{ev.category || ''}</td>
                  <td className="mwp-mono">{ev.ip || '—'}</td>
                  <td title={loc}>{truncate(loc, 40)}</td>
                  <td>{ev.device || ev.browser || '—'}</td>
                  <td>{[ev.os, ev.os_version].filter(Boolean).join(' ') || '—'}</td>
                  <td className="mwp-mono">{ev.client_version || '—'}</td>
                  <td className="mwp-mono" title={ev.session || ''}>{truncate(ev.session || '', 16)}</td>
                  <td><FlagButton section="activity" flagKey={key} flagged={flagged} onToggle={toggleFlag} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderBilling(res: DiscordResult) {
  const blocks: { title: string; rows: any[] }[] = [
    { title: 'Billing Profile', rows: res.billing?.billingProfile || [] },
    { title: 'Payment Sources', rows: res.billing?.paymentSources || [] },
    { title: 'Payments', rows: res.billing?.payments || [] },
    { title: 'Entitlements', rows: res.billing?.entitlements || [] },
    { title: 'DSAR Requests', rows: res.dsar || [] },
    { title: 'Promotions — Quests', rows: res.promotions?.quests || [] },
    { title: 'Promotions — Drops', rows: res.promotions?.drops || [] },
    { title: 'Store Wishlist', rows: res.store?.wishlist || [] },
    { title: 'Virtual Currency — Accounts', rows: res.virtualCurrency?.accounts || [] },
    { title: 'Virtual Currency — Transactions', rows: res.virtualCurrency?.transactions || [] },
  ].filter(b => b.rows.length > 0);

  if (blocks.length === 0) {
    return <div className="mwp-empty">No billing / DSAR records.</div>;
  }

  return (
    <div className="mwp-section">
      <h2 className="mwp-section-title">💳 Billing & DSAR</h2>
      {blocks.map(b => {
        const keys = new Set<string>();
        for (const r of b.rows) if (r && typeof r === 'object') for (const k of Object.keys(r)) keys.add(k);
        const cols = Array.from(keys).slice(0, 8);
        const cap = 200;
        const display = b.rows.slice(0, cap);
        return (
          <div key={b.title} className="mwp-card">
            <h3 className="mwp-card-title">{b.title} ({b.rows.length})</h3>
            {b.rows.length > cap && (
              <div style={{ fontSize: '0.73em', color: '#60a5fa', marginBottom: 8 }}>Showing first {cap} of {b.rows.length}.</div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="mwp-table">
                <thead>
                  <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {display.map((r, i) => (
                    <tr key={i}>
                      {cols.map(c => (
                        <td key={c} title={String(r && r[c] != null ? r[c] : '')}>
                          {truncate(String(r && r[c] != null ? r[c] : ''), 120)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DiscordWarrantTab;
