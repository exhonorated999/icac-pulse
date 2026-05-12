/**
 * ChatPhotoPanel — collapsible photo grid for the active chat's right rail.
 *
 * Lets the officer copy a persona photo to the clipboard in one click while
 * a chat is active. Every copy is recorded in `uc_photo_uses`, evidence_log,
 * and the chat event stream — so a "sent" badge can show photos already used
 * in THIS chat (vs photos used in other chats only).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  personaId: number;
  chatId: number | null;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function ChatPhotoPanel({ personaId, chatId }: Props) {
  const [photos, setPhotos] = useState<UcPersonaPhoto[]>([]);
  const [usesInChat, setUsesInChat] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(true);
  const [copying, setCopying] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');
  const mounted = useRef(true);
  // Re-arm on every mount — React 18 StrictMode runs effects twice in dev
  // (mount → cleanup → mount); without this the panel would silently
  // swallow every setState after the first cleanup pass.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!personaId) return;
    try {
      const list = await window.electronAPI.ucPhotoList(personaId, false);
      if (!mounted.current) return;
      setPhotos(list || []);
      // If a chat is active, build a set of photo IDs already used in THIS chat
      if (chatId) {
        const usedInThis = new Set<number>();
        await Promise.all((list || []).map(async p => {
          try {
            const uses = await window.electronAPI.ucPhotoUses(p.id);
            if ((uses || []).some(u => u.chat_id === chatId)) usedInThis.add(p.id);
          } catch {}
        }));
        if (mounted.current) setUsesInChat(usedInThis);
      } else {
        setUsesInChat(new Set());
      }
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || String(e));
    }
  }, [personaId, chatId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const copyPhoto = async (id: number) => {
    if (!chatId) {
      setErr('Open a chat first — every copy is recorded against the active chat for evidence trail.');
      return;
    }
    setCopying(id);
    setErr('');
    try {
      await window.electronAPI.ucPhotoCopyToClipboard(id, chatId);
      setToast('📋 Copied — paste into chat now');
      setUsesInChat(prev => { const next = new Set(prev); next.add(id); return next; });
      setTimeout(() => mounted.current && setToast(''), 2200);
      // Refresh in the background to update use_count / last_used_at
      void refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      if (mounted.current) setCopying(null);
    }
  };

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/5"
      >
        <span className="text-xs uppercase tracking-wide text-gray-500">
          Persona Photos {photos.length > 0 && <span className="text-gray-600">({photos.length})</span>}
        </span>
        <span className="text-xs text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {toast && (
            <div className="mb-2 p-1.5 rounded text-[11px] text-center"
                 style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.25)' }}>
              {toast}
            </div>
          )}
          {err && (
            <div className="mb-2 p-1.5 rounded text-[11px]"
                 style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</div>
          )}
          {photos.length === 0 ? (
            <div className="text-[11px] text-gray-600 italic text-center py-3">
              No photos. Add photos from the persona editor.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map(p => {
                const usedHere = usesInChat.has(p.id);
                const usedElsewhere = (p.use_count ?? 0) > 0 && !usedHere;
                return (
                  <button
                    key={p.id}
                    onClick={() => void copyPhoto(p.id)}
                    disabled={copying === p.id || !chatId}
                    className="relative rounded overflow-hidden group disabled:opacity-60"
                    style={{ background: '#000', border: usedHere ? '1px solid rgba(34,197,94,0.6)' : '1px solid rgba(255,255,255,0.08)' }}
                    title={
                      !chatId
                        ? 'Open a chat to copy photos'
                        : usedHere
                          ? `Already sent in this chat — copy again`
                          : `Click to copy${p.caption ? ` — ${p.caption}` : ''}`
                    }
                  >
                    <div className="aspect-square w-full">
                      {p.src_url
                        ? <img src={p.src_url} alt={p.caption || ''} className="w-full h-full object-cover" draggable={false} />
                        : <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-700">—</div>}
                    </div>
                    {usedHere && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px] font-bold"
                           style={{ background: 'rgba(34,197,94,0.9)', color: '#fff' }}>SENT</div>
                    )}
                    {usedElsewhere && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px]"
                           style={{ background: 'rgba(245,158,11,0.85)', color: '#fff' }}
                           title={p.last_used_at ? `last used ${relTime(p.last_used_at)} ago${p.last_used_chat_id ? ` in Chat #${p.last_used_chat_id}` : ''}` : ''}>
                        {p.use_count}×
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-end opacity-0 group-hover:opacity-100 transition"
                         style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%)' }}>
                      <span className="text-[10px] text-white px-1.5 py-1 font-medium">
                        {copying === p.id ? '…' : '📋 Copy'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {photos.length > 0 && !chatId && (
            <div className="mt-2 text-[10px] text-gray-600 italic">
              Open a chat to enable copy (every copy is logged for evidence).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
