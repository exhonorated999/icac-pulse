/**
 * UcAlertHost — global toast surface for UC chat alerts.
 *
 * Mounts once in Layout.tsx. Subscribes to 'uc-alert' from main and renders
 * a stack of dismissible toasts at bottom-right. Each toast auto-clears
 * after 6s. Click → dispatches 'pulse:uc-open-chat' which ChatTray catches
 * (future: actually navigate; v1 just opens the tray).
 */
import { useEffect, useState, useRef } from 'react';

interface Toast {
  id: number;
  chatId: number;
  title: string;
  body: string;
  kind: UcAlertPayload['kind'];
  ts: number;
}

let nextId = 1;

export function UcAlertHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    const off = window.electronAPI.ucOnAlert((payload: UcAlertPayload) => {
      const id = nextId++;
      const t: Toast = {
        id,
        chatId: payload.chatId,
        title: payload.kind === 'activity' ? 'UC Chat' : (payload.title || 'New message'),
        body: payload.kind === 'activity' ? 'New activity' : (payload.body || ''),
        kind: payload.kind,
        ts: payload.ts,
      };
      setToasts(prev => [t, ...prev].slice(0, 5));
      const handle = setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== id));
        timers.current.delete(id);
      }, 6000);
      timers.current.set(id, handle);
    });
    return () => {
      off();
      timers.current.forEach(h => clearTimeout(h));
      timers.current.clear();
    };
  }, []);

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(x => x.id !== id));
    const h = timers.current.get(id);
    if (h) { clearTimeout(h); timers.current.delete(id); }
  };
  const focusChat = (chatId: number) => {
    window.dispatchEvent(new CustomEvent('pulse:uc-open-chat', { detail: { chatId } }));
  };

  if (!toasts.length) return null;

  return (
    <div className="fixed z-[9999] flex flex-col gap-2"
         style={{ bottom: 96, right: 24, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id}
             onClick={() => { focusChat(t.chatId); dismiss(t.id); }}
             className="px-3 py-2 rounded-lg cursor-pointer"
             style={{
               background: 'rgba(15,21,37,0.96)',
               border: '1px solid rgba(124,58,237,0.55)',
               boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 12px rgba(124,58,237,0.2)',
               maxWidth: 340,
               pointerEvents: 'auto',
               animation: 'ucToastIn 0.2s ease',
             }}>
          <div className="flex items-start gap-2">
            <span className="text-base">💬</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{t.title}</div>
              {t.body && <div className="text-xs text-gray-400 line-clamp-2">{t.body}</div>}
              <div className="text-[10px] text-gray-500 mt-1">Chat #{t.chatId} · click to open</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                    className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes ucToastIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
