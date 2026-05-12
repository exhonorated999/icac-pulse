// src/renderer/components/DownloadCaptureModal.tsx
// Globally mounted modal — listens for `resource-download-complete` events from
// any embedded resource BrowserView (Flock, TLO, ICACCops, GridCop, Vigilant,
// TR CLEAR, Accurint, ICAC Data System, BYOA) and prompts the user to route
// the freshly downloaded file into Evidence, Cybertip, OS Downloads, or trash.

import { useEffect, useState, useMemo } from 'react';

type DownloadInfo = {
  id: string;
  partition: string;
  provider: string;
  filename: string;
  mimeType: string;
  totalBytes: number;
  tempPath: string;
  sourceUrl: string;
  startedAt: string;
  /** Set when capture originated from a UC chat (see main/downloadCapture.ts). */
  chatId?: number | null;
};

type CaseRow = { id: number; case_number?: string; caseNumber?: string; title?: string };

type Destination = 'evidence' | 'cybertip' | 'warrant-production' | 'downloads' | 'discard';

const EVIDENCE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'digital',  label: 'Digital Evidence' },
  { value: 'photo',    label: 'Photo' },
  { value: 'video',    label: 'Video' },
  { value: 'audio',    label: 'Audio' },
  { value: 'other',    label: 'Other' },
];

function formatBytes(n: number): string {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${u[i]}`;
}

export default function DownloadCaptureModal() {
  const [queue, setQueue] = useState<DownloadInfo[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [destination, setDestination] = useState<Destination>('evidence');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [evidenceType, setEvidenceType] = useState('document');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [ctIpAddress, setCtIpAddress] = useState('');
  const [ctDatetime, setCtDatetime] = useState('');
  const [ctOfficerDesc, setCtOfficerDesc] = useState('');
  const [wpSubfolder, setWpSubfolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  // UC chat → primary case preselect hint
  const [ucHint, setUcHint] = useState<{ chatId: number; caseNumber?: string } | null>(null);

  const current = queue[0] || null;

  // While a routing form is showing, hide the resource-tray BrowserView so
  // it doesn't paint over the modal (BVs are a native layer above the DOM).
  useEffect(() => {
    if (current) {
      window.dispatchEvent(new Event('pulse:bv-suspend'));
    } else {
      window.dispatchEvent(new Event('pulse:bv-resume'));
    }
  }, [current]);

  // Subscribe to download events
  useEffect(() => {
    const off = window.electronAPI.onResourceDownloadComplete((info) => {
      setQueue((q) => [...q, info]);
    });
    return off;
  }, []);

  // Load cases when a modal becomes active
  useEffect(() => {
    if (!current) return;
    let mounted = true;
    (async () => {
      try {
        const rows: any[] = (await window.electronAPI.getAllCases()) || [];
        if (!mounted) return;
        // newest first
        const sorted = [...rows].sort((a, b) => (b.id || 0) - (a.id || 0));
        setCases(sorted);

        // UC chat capture? Try to preselect the chat's primary case.
        let preselected: number | null = null;
        if (current.chatId && (window as any).electronAPI?.ucChatGet) {
          try {
            const chat = await (window as any).electronAPI.ucChatGet(current.chatId);
            if (chat?.primary_case_id && sorted.some(r => r.id === chat.primary_case_id)) {
              preselected = chat.primary_case_id;
              const c = sorted.find(r => r.id === chat.primary_case_id);
              setUcHint({
                chatId: current.chatId,
                caseNumber: c?.case_number || c?.caseNumber,
              });
            } else if (current.chatId) {
              setUcHint({ chatId: current.chatId });
            }
          } catch { /* ignore lookup failure */ }
        }

        if (preselected != null) {
          setSelectedCaseId(preselected);
        } else {
          // try to detect a currently-open case from the URL hash (#/cases/:id)
          const m = window.location.hash.match(/\/cases\/(\d+)/);
          const fromUrl = m ? parseInt(m[1]) : null;
          if (fromUrl && sorted.some(r => r.id === fromUrl)) setSelectedCaseId(fromUrl);
          else if (sorted.length > 0) setSelectedCaseId(sorted[0].id);
        }
      } catch (e: any) {
        setErrMsg(e.message || 'Failed to load cases');
      }
    })();
    // Pre-fill description with filename and a sensible default type
    setDescription(current.filename);
    setTag(`download_${Date.now()}`);
    const ext = current.filename.toLowerCase().split('.').pop() || '';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) setEvidenceType('document');
    else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic'].includes(ext)) setEvidenceType('photo');
    else if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'webm'].includes(ext)) setEvidenceType('video');
    else if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) setEvidenceType('audio');
    else setEvidenceType('digital');
    return () => { mounted = false; };
  }, [current?.id]);

  const selectedCase = useMemo(
    () => cases.find(c => c.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

  function caseNumberOf(c: CaseRow | null): string {
    if (!c) return '';
    return (c as any).case_number || (c as any).caseNumber || String(c.id);
  }

  function reset() {
    setErrMsg('');
    setDestination('evidence');
    setDescription('');
    setTag('');
    setCtIpAddress('');
    setCtDatetime('');
    setCtOfficerDesc('');
    setWpSubfolder('');
    setBusy(false);
    setUcHint(null);
  }

  function dequeue() {
    setQueue((q) => q.slice(1));
    reset();
  }

  async function confirm() {
    if (!current) return;
    setBusy(true);
    setErrMsg('');
    try {
      if (destination === 'discard') {
        await window.electronAPI.resourceDownloadDiscard(current.id);
        dequeue();
        return;
      }
      if (destination === 'downloads') {
        const r = await window.electronAPI.resourceDownloadMoveToDownloads(current.id);
        if (!r.success) throw new Error(r.error || 'Failed to move to Downloads');
        dequeue();
        return;
      }
      if (!selectedCase) throw new Error('Pick a case first');

      if (destination === 'evidence') {
        const r = await window.electronAPI.resourceDownloadRouteToEvidence({
          downloadId: current.id,
          caseId: selectedCase.id,
          caseNumber: caseNumberOf(selectedCase),
          type: evidenceType,
          tag: tag || null,
          description: description || current.filename,
        });
        if (!r.success) throw new Error(r.error || 'Save to Evidence failed');
      } else if (destination === 'cybertip') {
        const r = await window.electronAPI.resourceDownloadRouteToCybertip({
          downloadId: current.id,
          caseId: selectedCase.id,
          caseNumber: caseNumberOf(selectedCase),
          officerDescription: ctOfficerDesc || description || current.filename,
          ipAddress: ctIpAddress || undefined,
          datetime: ctDatetime || undefined,
        });
        if (!r.success) throw new Error(r.error || 'Save to Cybertip failed');
      } else if (destination === 'warrant-production') {
        const r = await window.electronAPI.resourceDownloadRouteToWarrantProduction({
          downloadId: current.id,
          caseId: selectedCase.id,
          caseNumber: caseNumberOf(selectedCase),
          subfolder: wpSubfolder.trim() || null,
          description: description || current.filename,
        });
        if (!r.success) throw new Error(r.error || 'Save to Warrant Production failed');
      }
      dequeue();
    } catch (e: any) {
      setErrMsg(e.message || String(e));
      setBusy(false);
    }
  }

  if (!current) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {current.provider} — Captured Download
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f3f4f6', marginTop: 4, wordBreak: 'break-all' }}>
              {current.filename}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {formatBytes(current.totalBytes)} · {current.mimeType || 'unknown type'}
              {queue.length > 1 && <> · <span style={{ color: '#fbbf24' }}>{queue.length - 1} more queued</span></>}
            </div>
          </div>
        </div>

        {/* Destination radios */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <DestBtn label="📁 Evidence"          desc="Attach to case Evidence module"        active={destination === 'evidence'}           onClick={() => setDestination('evidence')} />
          <DestBtn label="📜 Warrant Production" desc="cases/<n>/warrants/production/"        active={destination === 'warrant-production'} onClick={() => setDestination('warrant-production')} />
          <DestBtn label="🛡 Cybertip"          desc="Add to case Cybertip files"            active={destination === 'cybertip'}           onClick={() => setDestination('cybertip')} />
          <DestBtn label="⬇ Downloads"         desc="Save to OS Downloads folder"           active={destination === 'downloads'}          onClick={() => setDestination('downloads')} />
          <DestBtn label="🗑 Discard"           desc="Delete the staged file"                active={destination === 'discard'}            onClick={() => setDestination('discard')} />
        </div>

        {/* Case selector (only for evidence/cybertip/warrant-production) */}
        {(destination === 'evidence' || destination === 'cybertip' || destination === 'warrant-production') && (
          <div style={{ marginBottom: 10 }}>
            <label style={lblStyle}>Case</label>
            <select
              value={selectedCaseId ?? ''}
              onChange={(e) => setSelectedCaseId(e.target.value ? parseInt(e.target.value) : null)}
              style={inputStyle}
            >
              {cases.length === 0 && <option value="">No cases available</option>}
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {caseNumberOf(c)}{c.title ? ` — ${c.title}` : ''}
                </option>
              ))}
            </select>
            {ucHint && (
              <div style={{
                marginTop: 6,
                fontSize: 11,
                color: '#a78bfa',
                background: 'rgba(124, 58, 237, 0.12)',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                borderRadius: 6,
                padding: '6px 10px',
              }}>
                {ucHint.caseNumber
                  ? <>🛡 UC Chat #{ucHint.chatId} → bound case <strong>{ucHint.caseNumber}</strong> preselected. Override above if needed.</>
                  : <>🛡 UC Chat #{ucHint.chatId} — no primary case bound. Pick a case to route this capture (chat will be auto-linked).</>}
              </div>
            )}
          </div>
        )}

        {/* Evidence-specific fields */}
        {destination === 'evidence' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lblStyle}>Type</label>
                <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} style={inputStyle}>
                  {EVIDENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Tag</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. EVID-001" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lblStyle}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        {/* Cybertip-specific fields */}
        {destination === 'cybertip' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lblStyle}>IP Address (optional)</label>
                <input value={ctIpAddress} onChange={(e) => setCtIpAddress(e.target.value)} placeholder="e.g. 47.152.63.33" style={inputStyle} />
              </div>
              <div>
                <label style={lblStyle}>Date/Time (optional)</label>
                <input value={ctDatetime} onChange={(e) => setCtDatetime(e.target.value)} placeholder="e.g. 2026-05-11 14:00 UTC" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lblStyle}>Officer Description</label>
              <input value={ctOfficerDesc} onChange={(e) => setCtOfficerDesc(e.target.value)} placeholder="What is this file?" style={inputStyle} />
            </div>
          </>
        )}

        {/* Warrant Production fields */}
        {destination === 'warrant-production' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={lblStyle}>Subfolder (optional)</label>
              <input
                value={wpSubfolder}
                onChange={(e) => setWpSubfolder(e.target.value)}
                placeholder="e.g. Meta-123456 or 2025-11-01 Google"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                File will be saved under cases/{caseNumberOf(selectedCase) || '<case>'}/warrants/production/{wpSubfolder.trim() || ''}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lblStyle}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        {errMsg && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
            {errMsg}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={() => { window.electronAPI.resourceDownloadDiscard(current.id); dequeue(); }} disabled={busy} style={btnSecondaryStyle}>
            Cancel
          </button>
          <button onClick={confirm} disabled={busy || ((destination === 'evidence' || destination === 'cybertip' || destination === 'warrant-production') && !selectedCase)} style={btnPrimaryStyle}>
            {busy ? 'Saving…' : destination === 'discard' ? 'Delete' : destination === 'downloads' ? 'Save to Downloads' : destination === 'warrant-production' ? 'Save to Warrants/Production' : 'Save to Case'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DestBtn({ label, desc, active, onClick }: { label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 8,
        background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(34,211,238,0.6)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#67e8f9' : '#e5e7eb',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{desc}</div>
    </button>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 560,
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '18px 20px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  color: '#e5e7eb',
  fontFamily: 'inherit',
};

const lblStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e5e7eb', fontSize: 14,
  boxSizing: 'border-box',
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6, color: '#9ca3af', cursor: 'pointer', fontSize: 13,
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'rgba(34,211,238,0.15)',
  border: '1px solid rgba(34,211,238,0.6)',
  borderRadius: 6, color: '#22d3ee', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
