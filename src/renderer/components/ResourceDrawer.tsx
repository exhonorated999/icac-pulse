import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Resource definitions ──────────────────────────────────── */
interface Resource {
  id: string;
  label: string;
  enabledKey: string;
  isBV: boolean;
  accent: string;      // tailwind ring color
  accentHex: string;   // for badges / indicators
  icon: React.ReactNode;
  isByoa?: boolean;
  byoaUrl?: string;
}

const RESOURCES: Resource[] = [
  {
    id: 'flock', label: 'Flock Safety', enabledKey: 'flockEnabled', isBV: true,
    accent: 'teal', accentHex: '#2dd4bf',
    icon: (
      <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'tlo', label: 'TLO / TransUnion', enabledKey: 'tloEnabled', isBV: true,
    accent: 'indigo', accentHex: '#818cf8',
    icon: (
      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'icaccops', label: 'ICAC Cops', enabledKey: 'icaccopsEnabled', isBV: true,
    accent: 'amber', accentHex: '#fbbf24',
    icon: (
      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'gridcop', label: 'GridCop', enabledKey: 'gridcopEnabled', isBV: true,
    accent: 'emerald', accentHex: '#34d399',
    icon: (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'vigilant', label: 'Vigilant LPR', enabledKey: 'vigilantEnabled', isBV: true,
    accent: 'rose', accentHex: '#fb7185',
    icon: (
      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0H9m10 0a2 2 0 002-2V9a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0014.586 5H13" />
      </svg>
    ),
  },
  {
    id: 'trclear', label: 'TR CLEAR', enabledKey: 'trclearEnabled', isBV: true,
    accent: 'sky', accentHex: '#38bdf8',
    icon: (
      <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'accurint', label: 'Accurint', enabledKey: 'accurintEnabled', isBV: true,
    accent: 'orange', accentHex: '#f97316',
    icon: (
      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
      </svg>
    ),
  },
];

/* ── Load BYOA apps from localStorage ──────────────────────── */
function loadByoaResources(): Resource[] {
  try {
    const apps: { id: string; label: string; url: string }[] = JSON.parse(localStorage.getItem('byoaApps') || '[]');
    return apps.map(a => ({
      id: `byoa_${a.id}`,
      label: a.label,
      enabledKey: `byoa_${a.id}_enabled`,
      isBV: true,
      accent: 'purple',
      accentHex: '#a78bfa',
      isByoa: true,
      byoaUrl: a.url,
      icon: (
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    }));
  } catch { return []; }
}

/* ── Component ─────────────────────────────────────────────── */
export function ResourceDrawer() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [enabledResources, setEnabledResources] = useState<Resource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([...RESOURCES, ...loadByoaResources()]);

  const flockRef = useRef<HTMLDivElement>(null);
  const tloRef = useRef<HTMLDivElement>(null);
  const icaccopsRef = useRef<HTMLDivElement>(null);
  const gridcopRef = useRef<HTMLDivElement>(null);
  const vigilantRef = useRef<HTMLDivElement>(null);
  const trclearRef = useRef<HTMLDivElement>(null);
  const accurintRef = useRef<HTMLDivElement>(null);
  const byoaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);

  /* ── Watch localStorage for toggle changes ─────────────── */
  const refreshEnabled = useCallback(() => {
    const byoa = loadByoaResources();
    const all = [...RESOURCES, ...byoa];
    setAllResources(all);
    const active = all.filter(r => localStorage.getItem(r.enabledKey) === 'true');
    setEnabledResources(active);
    // Ensure BYOA BrowserViews exist for enabled apps
    active.filter(r => r.isByoa && r.byoaUrl).forEach(r => {
      const rawId = r.id.replace('byoa_', '');
      window.electronAPI?.byoaCreateView(rawId, r.byoaUrl!);
    });
    return active;
  }, []);

  useEffect(() => {
    refreshEnabled();
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('Enabled') || e.key.includes('_enabled') || e.key === 'byoaApps')) refreshEnabled();
    };
    // Also listen for custom event dispatched from Settings
    const onCustom = () => refreshEnabled();
    window.addEventListener('storage', onStorage);
    window.addEventListener('resourceToggle', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('resourceToggle', onCustom);
    };
  }, [refreshEnabled]);

  /* ── BrowserView positioning ───────────────────────────── */
  const getRefEl = useCallback((resId: string): HTMLDivElement | null => {
    if (resId === 'flock') return flockRef.current;
    if (resId === 'tlo') return tloRef.current;
    if (resId === 'icaccops') return icaccopsRef.current;
    if (resId === 'gridcop') return gridcopRef.current;
    if (resId === 'vigilant') return vigilantRef.current;
    if (resId === 'trclear') return trclearRef.current;
    if (resId === 'accurint') return accurintRef.current;
    if (resId.startsWith('byoa_')) return byoaRefs.current[resId] || null;
    return null;
  }, []);

  const positionBV = useCallback((resId: string) => {
    const el = getRefEl(resId);
    if (!el || !window.electronAPI) return;
    const r = el.getBoundingClientRect();
    const b = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    if (b.width < 10 || b.height < 10) return;
    if (resId.startsWith('byoa_')) {
      const rawId = resId.replace('byoa_', '');
      window.electronAPI.byoaSetBounds(rawId, b);
      window.electronAPI.byoaSetVisible(rawId, true);
    } else {
      const setBounds: Record<string, (b: any) => void> = {
        flock: window.electronAPI.flockSetBounds, tlo: window.electronAPI.tloSetBounds,
        icaccops: window.electronAPI.icaccopsSetBounds, gridcop: window.electronAPI.gridcopSetBounds,
        vigilant: window.electronAPI.vigilantSetBounds, trclear: window.electronAPI.trclearSetBounds,
        accurint: window.electronAPI.accurintSetBounds,
      };
      const setVisible: Record<string, (v: boolean) => void> = {
        flock: window.electronAPI.flockSetVisible, tlo: window.electronAPI.tloSetVisible,
        icaccops: window.electronAPI.icaccopsSetVisible, gridcop: window.electronAPI.gridcopSetVisible,
        vigilant: window.electronAPI.vigilantSetVisible, trclear: window.electronAPI.trclearSetVisible,
        accurint: window.electronAPI.accurintSetVisible,
      };
      setBounds[resId]?.(b);
      setVisible[resId]?.(true);
    }
  }, [getRefEl]);

  const hideBV = useCallback((resId: string) => {
    if (!window.electronAPI) return;
    if (resId.startsWith('byoa_')) {
      window.electronAPI.byoaSetVisible(resId.replace('byoa_', ''), false);
    } else {
      const setVisible: Record<string, (v: boolean) => void> = {
        flock: window.electronAPI.flockSetVisible, tlo: window.electronAPI.tloSetVisible,
        icaccops: window.electronAPI.icaccopsSetVisible, gridcop: window.electronAPI.gridcopSetVisible,
        vigilant: window.electronAPI.vigilantSetVisible, trclear: window.electronAPI.trclearSetVisible,
        accurint: window.electronAPI.accurintSetVisible,
      };
      setVisible[resId]?.(false);
    }
  }, []);

  const hideAllBVs = useCallback(() => {
    allResources.filter(r => r.isBV).forEach(r => hideBV(r.id));
  }, [hideBV, allResources]);

  /* ── Open / Close ──────────────────────────────────────── */
  const handleOpen = useCallback(() => {
    const active = refreshEnabled();
    if (!active.length) return;
    const tab = active.find(r => r.id === activeTab) ? activeTab! : active[0].id;
    setActiveTab(tab);
    setOpen(true);
    // Position BV after animation
    setTimeout(() => {
      const res = active.find(r => r.id === tab);
      if (res?.isBV) {
        if (res.isByoa && res.byoaUrl) {
          const rawId = tab.replace('byoa_', '');
          window.electronAPI?.byoaCreateView(rawId, res.byoaUrl).then(() => {
            setTimeout(() => positionBV(tab), 100);
          });
        } else {
          positionBV(tab);
        }
      }
    }, 350);
  }, [activeTab, positionBV, refreshEnabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    hideAllBVs();
  }, [hideAllBVs]);

  const handleToggle = useCallback(() => {
    if (open) handleClose(); else handleOpen();
  }, [open, handleClose, handleOpen]);

  /* ── Tab switch ────────────────────────────────────────── */
  const switchTab = useCallback((resId: string) => {
    // Hide all BVs first
    allResources.filter(r => r.isBV).forEach(r => hideBV(r.id));
    setActiveTab(resId);
    const res = allResources.find(r => r.id === resId);
    if (res?.isBV && open) {
      // For BYOA, ensure view is created before positioning
      if (res.isByoa && res.byoaUrl) {
        const rawId = resId.replace('byoa_', '');
        window.electronAPI?.byoaCreateView(rawId, res.byoaUrl).then(() => {
          setTimeout(() => positionBV(resId), 100);
        });
      } else {
        setTimeout(() => positionBV(resId), 50);
      }
    }
  }, [open, hideBV, positionBV, allResources]);

  /* ── Resize tracking ───────────────────────────────────── */
  useEffect(() => {
    const onResize = () => {
      if (!open || !activeTab) return;
      const res = allResources.find(r => r.id === activeTab);
      if (res?.isBV) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => positionBV(activeTab));
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, activeTab, positionBV, allResources]);

  /* ── Reposition after expand/collapse ──────────────────── */
  useEffect(() => {
    if (!open || !activeTab) return;
    const res = allResources.find(r => r.id === activeTab);
    if (res?.isBV) {
      setTimeout(() => positionBV(activeTab), 320);
    }
  }, [expanded, open, activeTab, positionBV, allResources]);

  /* ── Hide BVs on unmount ───────────────────────────────── */
  useEffect(() => {
    return () => hideAllBVs();
  }, [hideAllBVs]);

  /* ── Don't render if nothing is enabled ────────────────── */
  if (!enabledResources.length) return null;

  const drawerWidth = expanded ? 'calc(100vw - 256px)' : '560px';

  return (
    <>
      {/* ═══ FAB Button ═══ */}
      <button
        onClick={handleToggle}
        className="fixed z-[9998] w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          bottom: 24, right: 24,
          background: 'rgba(255,140,0,0.15)',
          border: '1.5px solid rgba(255,140,0,0.6)',
          color: '#ff8c00',
          backdropFilter: 'blur(8px)',
          animation: 'rhGlow 3s ease-in-out infinite',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        title="Investigative Resources"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 0 32px rgba(255,140,0,0.55), 0 0 12px rgba(255,140,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {enabledResources.length > 1 && (
          <span
            className="absolute -top-1.5 -right-1.5 rounded-full font-bold flex items-center justify-center border-2 border-background"
            style={{ width: 18, height: 18, fontSize: 10, background: '#ff8c00', color: '#0B1120', animation: 'rhPulse 2s infinite' }}
          >
            {enabledResources.length}
          </span>
        )}
      </button>

      {/* ═══ Drawer ═══ */}
      <div
        className="fixed top-0 right-0 h-full z-[9999]"
        style={{
          width: drawerWidth,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s ease',
        }}
      >
        <div
          className="h-full flex flex-col border-l border-accent-cyan/20"
          style={{ background: 'rgba(10,14,22,0.97)', backdropFilter: 'blur(24px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center border border-accent-cyan/20">
                <svg className="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">Investigative Resources</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                title={expanded ? 'Collapse' : 'Expand'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/5 px-3 flex-shrink-0 gap-1 overflow-x-auto" style={{ minHeight: 42 }}>
            {enabledResources.map(r => (
              <button
                key={r.id}
                onClick={() => switchTab(r.id)}
                className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition relative ${
                  activeTab === r.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {r.label}
                {activeTab === r.id && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all"
                    style={{ width: '100%', background: r.accentHex }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content panels */}
          <div className="flex-1 min-h-0 relative">
            {/* Flock BrowserView placeholder */}
            <div
              className={`absolute inset-0 ${activeTab === 'flock' ? '' : 'hidden'}`}
            >
              <div
                ref={flockRef}
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'rgba(10,15,28,0.5)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <p className="text-gray-600 text-xs">Loading Flock Safety…</p>
              </div>
            </div>

            {/* TLO BrowserView placeholder */}
            <div
              className={`absolute inset-0 ${activeTab === 'tlo' ? '' : 'hidden'}`}
            >
              <div
                ref={tloRef}
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'rgba(10,15,28,0.5)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <p className="text-gray-600 text-xs">Loading TLO / TransUnion…</p>
              </div>
            </div>

            {/* ICAC Cops BrowserView placeholder */}
            <div
              className={`absolute inset-0 ${activeTab === 'icaccops' ? '' : 'hidden'}`}
            >
              <div
                ref={icaccopsRef}
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'rgba(10,15,28,0.5)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <p className="text-gray-600 text-xs">Loading ICAC Cops…</p>
              </div>
            </div>

            {/* GridCop BrowserView placeholder */}
            <div
              className={`absolute inset-0 ${activeTab === 'gridcop' ? '' : 'hidden'}`}
            >
              <div
                ref={gridcopRef}
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'rgba(10,15,28,0.5)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <p className="text-gray-600 text-xs">Loading GridCop…</p>
              </div>
            </div>

            {/* Vigilant LPR BrowserView placeholder */}
            <div className={`absolute inset-0 ${activeTab === 'vigilant' ? '' : 'hidden'}`}>
              <div ref={vigilantRef} className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(10,15,28,0.5)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <p className="text-gray-600 text-xs">Loading Vigilant LPR…</p>
              </div>
            </div>

            {/* TR CLEAR BrowserView placeholder */}
            <div className={`absolute inset-0 ${activeTab === 'trclear' ? '' : 'hidden'}`}>
              <div ref={trclearRef} className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(10,15,28,0.5)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <p className="text-gray-600 text-xs">Loading Thomson Reuters CLEAR…</p>
              </div>
            </div>

            {/* Accurint BrowserView placeholder */}
            <div className={`absolute inset-0 ${activeTab === 'accurint' ? '' : 'hidden'}`}>
              <div ref={accurintRef} className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(10,15,28,0.5)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <p className="text-gray-600 text-xs">Loading Accurint…</p>
              </div>
            </div>

            {/* BYOA BrowserView placeholders */}
            {allResources.filter(r => r.isByoa).map(r => (
              <div
                key={r.id}
                className={`absolute inset-0 ${activeTab === r.id ? '' : 'hidden'}`}
              >
                <div
                  ref={el => { byoaRefs.current[r.id] = el; }}
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: 'rgba(10,15,28,0.5)',
                    border: '1px dashed rgba(255,255,255,0.08)',
                    borderRadius: 8,
                  }}
                >
                  <p className="text-gray-600 text-xs">Loading {r.label}…</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Keyframe animations ═══ */}
      <style>{`
        @keyframes rhGlow {
          0%, 100% { box-shadow: 0 0 14px rgba(255,140,0,0.3), inset 0 0 8px rgba(255,140,0,0.08); }
          50% { box-shadow: 0 0 22px rgba(255,140,0,0.45), inset 0 0 12px rgba(255,140,0,0.15); }
        }
        @keyframes rhPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
