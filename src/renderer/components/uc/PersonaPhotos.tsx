/**
 * PersonaPhotos — photo library section for a UC persona.
 *
 * Shows a grid of thumbnails (served via the uc-photo:// custom protocol)
 * with per-photo caption editing, archive, and a "+ Add Photos" button that
 * delegates to the main-process file picker (dialog.showOpenDialog).
 *
 * Each thumbnail also displays "used N times" + a relative-time hint of the
 * last use, so the officer can see at a glance which photos have already
 * been shared with a subject (and from which chat).
 *
 * EXIF metadata is stripped on import by the main-process photos module
 * (Electron nativeImage re-encodes JPEG/PNG without metadata).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  personaId: number;
  /** Open photo viewer / metadata dialog if the parent supports it (optional). */
  onPhotoOpen?: (photo: UcPersonaPhoto) => void;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PersonaPhotos({ personaId, onPhotoOpen }: Props) {
  const [photos, setPhotos] = useState<UcPersonaPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  // Import progress — populated while a multi-file import is running.
  const [importTotal, setImportTotal] = useState(0);
  const [importDone, setImportDone] = useState(0);
  const [importCurrent, setImportCurrent] = useState<string>('');
  const [importFailures, setImportFailures] = useState<Array<{ name: string; reason: string }>>([]);
  const mounted = useRef(true);

  // NOTE: must re-arm `mounted.current = true` on every mount. React 18
  // StrictMode runs effects twice in dev (mount → cleanup → mount), so a
  // cleanup-only effect would leave `mounted.current === false` after the
  // first strict-mode pass and silently swallow every `setState` call
  // (manifests as a permanent "Loading…" with no error).
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.ucPhotoList(personaId, false);
      if (mounted.current) setPhotos(list || []);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addPhotos = async () => {
    setAdding(true);
    setErr('');
    setImportFailures([]);
    setImportDone(0);
    setImportTotal(0);
    setImportCurrent('');
    try {
      // 1. Pick files via main-process dialog.
      const picked = await window.electronAPI.ucPhotoPickFiles();
      if (!picked || picked.length === 0) {
        return; // user cancelled
      }
      if (!mounted.current) return;
      setImportTotal(picked.length);
      // 2. Process one at a time so per-file progress is accurate.
      //    Each `ucPhotoAdd` re-encodes (strips EXIF) → writes to disk →
      //    inserts the DB row → records evidence_log. HEIC / large JPGs
      //    can take a noticeable beat, hence the visible progress.
      const failures: Array<{ name: string; reason: string }> = [];
      for (let i = 0; i < picked.length; i++) {
        const f = picked[i];
        if (!mounted.current) return;
        setImportCurrent(f.name);
        try {
          await window.electronAPI.ucPhotoAdd({ personaId, srcPath: f.path });
        } catch (e: any) {
          failures.push({ name: f.name, reason: e?.message || String(e) });
        }
        if (!mounted.current) return;
        setImportDone(i + 1);
        // Refresh the grid as files come in so the user sees progress visually.
        // Don't await — fire-and-forget so the loop doesn't stall.
        void refresh();
      }
      if (mounted.current) setImportFailures(failures);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      if (mounted.current) {
        setAdding(false);
        setImportCurrent('');
        // Leave totals visible briefly if there were failures so the user
        // sees "3 of 5 succeeded — 2 failed" rather than an instant reset.
      }
    }
  };

  const startEditCaption = (p: UcPersonaPhoto) => {
    setEditing(p.id);
    setCaptionDraft(p.caption || '');
  };

  const saveCaption = async (id: number) => {
    try {
      await window.electronAPI.ucPhotoUpdate(id, { caption: captionDraft });
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  };

  const archive = async (id: number) => {
    if (!confirm('Remove this photo from the persona library? (It will be archived — evidence trail preserved.)')) return;
    try {
      await window.electronAPI.ucPhotoArchive(id);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          Photos {photos.length > 0 && <span className="text-gray-500">({photos.length})</span>}
        </span>
        <button
          onClick={addPhotos}
          disabled={adding}
          className="px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.35)' }}
        >
          {adding
            ? (importTotal > 0
                ? `Importing ${importDone}/${importTotal}…`
                : 'Opening picker…')
            : '+ Add Photos'}
        </button>
      </div>

      {err && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</div>
      )}

      {/* Per-file import progress */}
      {adding && importTotal > 0 && (
        <div className="mb-2 p-2 rounded"
             style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)' }}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span style={{ color: '#c4b5fd' }}>
              Importing {importDone} of {importTotal}…
            </span>
            <span className="text-gray-400">
              {Math.round((importDone / importTotal) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${(importDone / importTotal) * 100}%`,
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              }}
            />
          </div>
          {importCurrent && (
            <div className="mt-1.5 text-[10px] text-gray-500 truncate" title={importCurrent}>
              ⏳ {importCurrent}
            </div>
          )}
          <div className="mt-1 text-[10px] text-gray-600 italic">
            Re-encoding to strip EXIF — large/HEIC files take a moment.
          </div>
        </div>
      )}

      {/* Post-import failure summary */}
      {!adding && importFailures.length > 0 && (
        <div className="mb-2 p-2 rounded text-xs"
             style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
          <div className="font-medium mb-1">
            {importFailures.length} file{importFailures.length === 1 ? '' : 's'} failed to import:
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {importFailures.map((f, i) => (
              <li key={i} className="truncate" title={`${f.name}: ${f.reason}`}>
                <span className="text-yellow-200">{f.name}</span>
                <span className="text-gray-400"> — {f.reason}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setImportFailures([])}
            className="mt-1.5 text-[10px] underline opacity-70 hover:opacity-100"
          >dismiss</button>
        </div>
      )}

      {loading && photos.length === 0 ? (
        <div className="text-xs text-gray-500 py-3 text-center">Loading…</div>
      ) : photos.length === 0 ? (
        <div className="text-xs text-gray-500 py-4 text-center rounded"
             style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          No photos yet. Click <strong>+ Add Photos</strong> to import images for this persona.<br />
          <span className="text-[10px] text-gray-600">EXIF metadata is stripped on import.</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(p => (
            <div key={p.id} className="rounded overflow-hidden relative group"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="relative aspect-square overflow-hidden"
                   style={{ background: '#000' }}>
                {p.src_url ? (
                  <img
                    src={p.src_url}
                    alt={p.caption || `photo ${p.id}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => onPhotoOpen?.(p)}
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">no preview</div>
                )}
                {(p.use_count ?? 0) > 0 && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px]"
                       style={{ background: 'rgba(34,197,94,0.85)', color: '#fff' }}
                       title={`Used ${p.use_count} time(s)${p.last_used_at ? ` · last ${relTime(p.last_used_at)}` : ''}`}>
                    used {p.use_count}×
                  </div>
                )}
                <button
                  onClick={() => archive(p.id)}
                  className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition"
                  style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
                  title="Archive photo"
                >×</button>
              </div>
              <div className="px-1.5 py-1">
                {editing === p.id ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void saveCaption(p.id); if (e.key === 'Escape') setEditing(null); }}
                      onBlur={() => void saveCaption(p.id)}
                      className="flex-1 px-1 py-0.5 rounded text-[11px] text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.4)' }}
                      placeholder="caption…"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => startEditCaption(p)}
                    className="w-full text-left text-[11px] text-gray-400 hover:text-white truncate"
                    title={p.caption || 'click to add caption'}
                  >
                    {p.caption || <span className="text-gray-600 italic">add caption…</span>}
                  </button>
                )}
                {p.last_used_at && (
                  <div className="text-[10px] text-gray-600 truncate">
                    {p.last_used_chat_id ? `→ Chat #${p.last_used_chat_id} · ` : ''}{relTime(p.last_used_at)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
