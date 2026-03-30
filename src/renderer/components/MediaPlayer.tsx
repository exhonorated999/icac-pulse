import { useState, useEffect, useRef } from 'react';

interface ServiceEntry {
  id: string;
  label: string;
  url: string;
  icon: string;
  builtin?: boolean;
  external?: boolean; // DRM services → open in system browser
}

const BUILTIN_SERVICES: ServiceEntry[] = [
  { id: 'spotify', label: 'Spotify', url: 'https://open.spotify.com', icon: '🎵', builtin: true },
  { id: 'siriusxm', label: 'SiriusXM', url: 'https://player.siriusxm.com/now-playing', icon: '📻', builtin: true },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com', icon: '▶️', builtin: true },
  { id: 'pandora', label: 'Pandora', url: 'https://www.pandora.com', icon: '🎶', builtin: true },
  { id: 'espn', label: 'ESPN', url: 'https://www.espn.com/watch', icon: '🏈', builtin: true },
  { id: 'plutotv', label: 'Pluto TV', url: 'https://pluto.tv/us/live-tv', icon: '📡', builtin: true },
];

function loadUserServices(): ServiceEntry[] {
  try {
    const raw = localStorage.getItem('mediaPlayer_userServices');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUserServices(services: ServiceEntry[]) {
  localStorage.setItem('mediaPlayer_userServices', JSON.stringify(services));
}

interface MediaPlayerProps {
  onPopOut?: () => void;
}

export function MediaPlayer({ onPopOut }: MediaPlayerProps) {
  const [activeService, setActiveService] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [userServices, setUserServices] = useState<ServiceEntry[]>(loadUserServices);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('mediaPlayer_zoom');
    return saved ? parseFloat(saved) : 0.65;
  });
  const webviewRef = useRef<any>(null);

  const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  // Restore last-used service
  useEffect(() => {
    const saved = localStorage.getItem('mediaPlayer_service');
    const savedUrl = localStorage.getItem('mediaPlayer_url');
    if (saved && savedUrl) {
      setActiveService(saved);
      setActiveUrl(savedUrl);
    }
  }, []);

  // Apply zoom + viewport when webview loads
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !activeUrl) return;

    const onDomReady = () => {
      try {
        wv.setZoomFactor(zoom);
        wv.executeJavaScript(`
          (function() {
            let vp = document.querySelector('meta[name="viewport"]');
            if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
            vp.content = 'width=device-width, initial-scale=1';
          })();
        `).catch(() => {});
      } catch (e) {
        console.warn('Webview injection failed:', e);
      }
    };

    wv.addEventListener('dom-ready', onDomReady);
    return () => wv.removeEventListener('dom-ready', onDomReady);
  }, [activeUrl, zoom]);

  // Apply zoom changes live
  const applyZoom = (newZoom: number) => {
    const clamped = Math.max(0.25, Math.min(1.0, newZoom));
    setZoom(clamped);
    localStorage.setItem('mediaPlayer_zoom', String(clamped));
    const wv = webviewRef.current;
    if (wv && typeof wv.setZoomFactor === 'function') {
      wv.setZoomFactor(clamped);
    }
  };

  const allServices = [...BUILTIN_SERVICES, ...userServices];

  const selectService = (serviceId: string) => {
    const svc = allServices.find(s => s.id === serviceId);
    if (!svc) return;
    setActiveService(serviceId);
    setActiveUrl(svc.url);
    setShowPicker(false);
    setDeleteConfirm(null);
    localStorage.setItem('mediaPlayer_service', serviceId);
    localStorage.setItem('mediaPlayer_url', svc.url);
  };

  const handleAddService = async () => {
    try {
      const result = await window.electronAPI.addMediaService();
      if (result.success && result.service) {
        const { name, url, icon, external } = result.service as any;
        const id = 'user_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        const entry: ServiceEntry = { id, label: name, url, icon, external: !!external };
        const updated = [...userServices, entry];
        setUserServices(updated);
        saveUserServices(updated);
        setShowPicker(false);
        // If not external, auto-select in sidebar
        if (!external) {
          setActiveService(id);
          setActiveUrl(url);
          localStorage.setItem('mediaPlayer_service', id);
          localStorage.setItem('mediaPlayer_url', url);
        }
      }
    } catch (e) {
      console.error('Add service failed:', e);
    }
  };

  const removeService = (id: string) => {
    const updated = userServices.filter(s => s.id !== id);
    setUserServices(updated);
    saveUserServices(updated);
    setDeleteConfirm(null);
    if (activeService === id) {
      setActiveService(null);
      setActiveUrl('');
      localStorage.removeItem('mediaPlayer_service');
      localStorage.removeItem('mediaPlayer_url');
    }
  };

  const handlePopOut = async () => {
    if (!activeUrl) return;
    try {
      await window.electronAPI.popOutMediaPlayer(activeUrl);
      onPopOut?.();
    } catch (e) {
      console.error('Pop-out failed:', e);
    }
  };

  // Reload sidebar webview when pop-out window is closed (user may have logged in there)
  useEffect(() => {
    const onPopoutClosed = () => {
      const wv = webviewRef.current as any;
      if (wv && activeUrl && typeof wv.reload === 'function') wv.reload();
    };
    window.electronAPI.onMediaPopoutClosed(onPopoutClosed);
    return () => window.electronAPI.removeMediaPopoutClosedListener(onPopoutClosed);
  }, [activeUrl]);

  const activeSvc = allServices.find(s => s.id === activeService);

  return (
    <div className="flex flex-col border-t border-accent-cyan/20 flex-1 min-h-0 overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-panel/80 border-b border-accent-cyan/10 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs">{activeSvc?.icon || '🎧'}</span>
          <span className="text-[11px] font-medium text-text-muted truncate">
            {activeSvc ? activeSvc.label : 'Media'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {activeUrl && (
            <>
              <button
                onClick={() => applyZoom(zoom - 0.1)}
                className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-accent-cyan rounded transition-colors text-[10px] font-bold"
                title={`Zoom out (${Math.round(zoom * 100)}%)`}
              >
                −
              </button>
              <span className="text-[8px] text-text-muted w-6 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => applyZoom(zoom + 0.1)}
                className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-accent-cyan rounded transition-colors text-[10px] font-bold"
                title="Zoom in"
              >
                +
              </button>
            </>
          )}
          <button
            onClick={() => { setShowPicker(!showPicker); setDeleteConfirm(null); }}
            className="p-1 text-text-muted hover:text-accent-cyan rounded transition-colors"
            title="Choose service"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {activeUrl && (
            <button
              onClick={handlePopOut}
              className="p-1 text-text-muted hover:text-accent-cyan rounded transition-colors"
              title="Pop out to separate window"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Service picker */}
      {showPicker && (
        <div className="border-b border-accent-cyan/10 flex-shrink-0 bg-background/80 overflow-y-auto max-h-48">
          <div className="grid grid-cols-3 gap-1 p-2">
            {/* All built-in services */}
            {BUILTIN_SERVICES.map(svc => (
              <button
                key={svc.id}
                onClick={() => selectService(svc.id)}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] transition-colors ${
                  activeService === svc.id
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-text-muted hover:bg-accent-cyan/5 hover:text-text-primary'
                }`}
              >
                <span className="text-sm">{svc.icon}</span>
                <span className="truncate w-full text-center">{svc.label}</span>
              </button>
            ))}

            {/* User-added services */}
            {userServices.map(svc => (
              <button
                key={svc.id}
                onClick={() => selectService(svc.id)}
                onContextMenu={(e) => { e.preventDefault(); setDeleteConfirm(deleteConfirm === svc.id ? null : svc.id); }}
                className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] transition-colors ${
                  activeService === svc.id
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-text-muted hover:bg-accent-cyan/5 hover:text-text-primary'
                }`}
              >
                {deleteConfirm === svc.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeService(svc.id); }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] leading-none hover:bg-red-400 z-10"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
                <span className="text-sm">{svc.icon}</span>
                <span className="truncate w-full text-center">{svc.label}</span>
              </button>
            ))}

            {/* Add new — opens pop-out browser */}
            <button
              onClick={handleAddService}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] text-text-muted hover:bg-green-500/10 hover:text-green-400 transition-colors"
              title="Add a streaming service"
            >
              <span className="text-sm">➕</span>
              <span className="truncate w-full text-center">Add</span>
            </button>
          </div>
          {userServices.length > 0 && (
            <p className="text-[9px] text-text-muted text-center opacity-50 pb-1.5">Right-click custom service to remove</p>
          )}
        </div>
      )}

      {/* Content area — fills remaining sidebar space */}
      <div className="flex-1 min-h-0 relative">
        {activeUrl ? (
          <webview
            key={activeService || activeUrl}
            ref={webviewRef}
            src={activeUrl}
            partition="persist:media"
            useragent={DESKTOP_UA}
            className="border-0"
            style={{ width: '100%', height: '100%', minWidth: '100%', minHeight: '100%' }}
            {...{ allowpopups: 'true', plugins: 'true' } as any}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg className="w-8 h-8 text-accent-cyan/15 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <p className="text-text-muted text-[11px]">Select a service above</p>
          </div>
        )}
      </div>
    </div>
  );
}
