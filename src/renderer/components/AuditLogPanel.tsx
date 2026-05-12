import React, { useEffect, useState, useCallback } from 'react';

type Entry = {
  id: number;
  seq: number;
  event_type: string;
  event_data: Record<string, any> | null;
  prev_hash: string | null;
  hash: string;
  timestamp: string;
  user: string | null;
  host: string | null;
  app_version: string | null;
};

const EVENT_META: Record<string, { icon: string; color: string; label?: string }> = {
  app_launch:        { icon: '🚀', color: 'text-accent-pink',   label: 'App Launch' },
  app_exit:          { icon: '⏻',  color: 'text-text-muted',    label: 'App Exit' },
  case_created:      { icon: '➕', color: 'text-status-success', label: 'Case Created' },
  case_opened:       { icon: '📂', color: 'text-amber-400',     label: 'Case Opened' },
  case_deleted:      { icon: '🗑️', color: 'text-red-400',       label: 'Case Deleted' },
  evidence_created:  { icon: '📎', color: 'text-accent-cyan',   label: 'Evidence Added' },
  warrant_created:   { icon: '📜', color: 'text-amber-400',     label: 'Warrant Created' },
  registration:      { icon: '🪪', color: 'text-accent-cyan',   label: 'Registration' },
  license_activated: { icon: '🔑', color: 'text-status-success', label: 'License Activated' },
  unlock:            { icon: '🔓', color: 'text-amber-400',     label: 'Unlock' },
  lock:              { icon: '🔒', color: 'text-text-muted',    label: 'Lock' },
  update_check:      { icon: '🔄', color: 'text-accent-cyan',   label: 'Update Check' },
  update_downloaded: { icon: '⬇️', color: 'text-accent-cyan',   label: 'Update Downloaded' },
  update_installed:  { icon: '✅', color: 'text-status-success', label: 'Update Installed' },
  audit_export:      { icon: '📤', color: 'text-accent-cyan',   label: 'Audit Exported' },
  audit_verify:      { icon: '✔️', color: 'text-status-success', label: 'Chain Verified' },
};

function metaFor(type: string) {
  return EVENT_META[type] ?? { icon: '•', color: 'text-text-muted', label: type };
}

function formatData(data: Record<string, any> | null): React.ReactNode {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="text-xs font-mono text-text-muted/80 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
      {Object.entries(data).map(([k, v]) => (
        <span key={k}>
          <span className="text-text-muted/60">{k}=</span>
          <span className="text-text-muted">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

const AuditLogPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Windows Event Log forwarding
  const [winState, setWinState] = useState<{ supported: boolean; enabled: boolean; sourceRegistered: boolean; source: string } | null>(null);
  const [togglingWin, setTogglingWin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.auditLogGet(200);
      if (res?.success) {
        setEntries(res.entries || []);
        setTotal(res.total || 0);
      } else {
        setStatus({ type: 'error', message: res?.error || 'Failed to load audit log' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to load audit log' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Load Windows Event Log state once
  useEffect(() => {
    (async () => {
      try {
        const s = await window.electronAPI.auditLogWindowsGet();
        setWinState(s);
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  const toggleWindowsForwarding = useCallback(async () => {
    if (!winState || togglingWin) return;
    setTogglingWin(true);
    setStatus(null);
    try {
      const next = !winState.enabled;
      const r = await window.electronAPI.auditLogWindowsSet(next);
      if (r.success) {
        const fresh = await window.electronAPI.auditLogWindowsGet();
        setWinState(fresh);
        setStatus({
          type: 'success',
          message: next
            ? `Windows Event Log forwarding enabled — entries will mirror to Application log under source "${fresh.source}".`
            : 'Windows Event Log forwarding disabled.',
        });
      } else {
        setStatus({
          type: 'error',
          message: r.needsAdmin
            ? 'Source registration requires administrator privileges. Right-click P.U.L.S.E. and choose "Run as administrator" once, then re-enable this toggle.'
            : (r.error || 'Failed to toggle Windows Event Log forwarding.'),
        });
      }
    } finally {
      setTogglingWin(false);
    }
  }, [winState, togglingWin]);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setStatus(null);
    try {
      const r = await window.electronAPI.auditLogVerify();
      if (r.valid) {
        setStatus({ type: 'success', message: `Chain integrity verified — ${r.totalEntries} entries, no tampering detected.` });
      } else {
        setStatus({
          type: 'error',
          message: `Chain integrity FAILED${r.firstBreakSeq != null ? ` at seq #${r.firstBreakSeq}` : ''}${r.reason ? `: ${r.reason}` : ''}`,
        });
      }
      void load();
    } finally {
      setVerifying(false);
    }
  }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatus(null);
    try {
      const r = await window.electronAPI.auditLogExport();
      if (r.success) {
        setStatus({ type: 'success', message: `Exported to: ${r.filePath}` });
        void load();
      } else {
        setStatus({ type: 'error', message: r.error || 'Export failed' });
      }
    } finally {
      setExporting(false);
    }
  }, [load]);

  return (
    <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <span className="text-2xl">📜</span>
          Audit Log
        </h2>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-text-muted hover:text-text-primary p-1"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg className={`w-5 h-5 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-text-muted mt-2">
        Tamper-evident record of security, license, case, evidence, warrant, and update events. Every
        entry is hash-chained (SHA-256) so any modification or deletion is detectable.
      </p>

      {!collapsed && (
        <>
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg border border-accent-cyan/30 text-accent-cyan
                         hover:border-accent-cyan hover:bg-accent-cyan/5 transition-colors
                         disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-3 py-2 text-sm rounded-lg border border-amber-400/40 text-amber-400
                         hover:border-amber-400 hover:bg-amber-400/5 transition-colors
                         disabled:opacity-50 flex items-center gap-1.5"
            >
              {verifying ? (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              Verify Chain Integrity
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-2 text-sm rounded-lg border border-status-success/40 text-status-success
                         hover:border-status-success hover:bg-status-success/5 transition-colors
                         disabled:opacity-50 flex items-center gap-1.5"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-status-success border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export Full Log (JSONL)
            </button>
          </div>

          {/* Windows Event Log forwarding toggle */}
          {winState && (
            <div className="mt-3 flex items-center justify-between gap-4 px-3 py-2.5 bg-background border border-accent-cyan/10 rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-text-primary text-sm">Forward to Windows Event Log</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Mirror each entry to the Windows Application event log under source{' '}
                  <span className="font-mono text-accent-cyan">{winState.source}</span>. Lets enterprise SIEM/log
                  forwarders pick up P.U.L.S.E. activity.{' '}
                  {winState.supported
                    ? (winState.sourceRegistered
                        ? <span className="text-status-success">Source registered.</span>
                        : <span className="text-amber-400">First write requires admin (one-time source registration).</span>)
                    : <span className="text-red-400">Only available on Windows.</span>}
                </div>
              </div>
              <button
                onClick={toggleWindowsForwarding}
                disabled={!winState.supported || togglingWin}
                role="switch"
                aria-checked={winState.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0
                            ${winState.enabled ? 'bg-accent-cyan' : 'bg-text-muted/30'}
                            disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                              ${winState.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          )}

          {/* Status banner */}
          {status && (
            <div
              className={`mt-3 px-3 py-2 text-sm rounded-lg border ${
                status.type === 'success'
                  ? 'border-status-success/40 bg-status-success/5 text-status-success'
                  : status.type === 'error'
                  ? 'border-red-500/40 bg-red-500/5 text-red-400'
                  : 'border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan'
              }`}
            >
              {status.message}
            </div>
          )}

          {/* Entries list */}
          <div className="mt-4 bg-background border border-accent-cyan/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wider text-text-muted/70 border-b border-accent-cyan/10">
              <span>Recent Entries</span>
              <span>{total} {total === 1 ? 'entry' : 'entries'} (most recent first)</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {entries.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted text-sm">
                  {loading ? 'Loading…' : 'No audit entries yet. Events will appear as you use the app.'}
                </div>
              ) : (
                <ul className="divide-y divide-accent-cyan/5">
                  {entries.map(e => {
                    const m = metaFor(e.event_type);
                    return (
                      <li key={e.id} className="px-4 py-2.5 hover:bg-accent-cyan/5 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-text-muted/60 font-mono text-xs">#{e.seq}</span>
                            <span className="text-base leading-none">{m.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className={`font-semibold text-sm ${m.color}`}>
                                {m.label ?? e.event_type}
                              </div>
                              {formatData(e.event_data)}
                              {(e.user || e.host || e.app_version) && (
                                <div className="text-xs font-mono text-text-muted/60 mt-0.5">
                                  {e.user && <span>user={e.user} </span>}
                                  {e.host && <span>host={e.host} </span>}
                                  {e.app_version && <span>v{e.app_version}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-text-muted/70 whitespace-nowrap">
                            {new Date(e.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogPanel;
