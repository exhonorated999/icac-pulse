/**
 * AddChatModal — pick persona + platform + initial URL/handle.
 */
import { useEffect, useState } from 'react';

interface Props {
  personas: UcPersona[];
  defaultPersonaId?: number;
  onClose: () => void;
  onCreated: (chat: UcChat) => void;
}

const PLATFORMS: { id: UcChatPlatform; label: string; defaultUrl: string }[] = [
  { id: 'discord',   label: 'Discord',   defaultUrl: 'https://discord.com/app' },
  { id: 'telegram',  label: 'Telegram',  defaultUrl: 'https://web.telegram.org/a/' },
  { id: 'instagram', label: 'Instagram', defaultUrl: 'https://www.instagram.com/direct/inbox/' },
  { id: 'whatsapp',  label: 'WhatsApp',  defaultUrl: 'https://web.whatsapp.com/' },
  { id: 'snapchat',  label: 'Snapchat',  defaultUrl: 'https://web.snapchat.com/' },
  { id: 'messenger', label: 'Messenger', defaultUrl: 'https://www.messenger.com/' },
  { id: 'meetme',    label: 'MeetMe',    defaultUrl: 'https://app.meetme.com/get-started/email/login' },
  { id: 'sniffies',  label: 'Sniffies',  defaultUrl: 'https://sniffies.com/' },
  { id: 'custom',    label: 'Custom URL', defaultUrl: '' },
];

export function AddChatModal({ personas, defaultPersonaId, onClose, onCreated }: Props) {
  const [personaId, setPersonaId] = useState<number | null>(defaultPersonaId ?? personas[0]?.id ?? null);
  const [platform, setPlatform] = useState<UcChatPlatform>('discord');
  const [url, setUrl] = useState(PLATFORMS[0].defaultUrl);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = PLATFORMS.find(p => p.id === platform);
    if (p && p.id !== 'custom') setUrl(p.defaultUrl);
    if (p && p.id === 'custom') setUrl('');
  }, [platform]);

  const create = async () => {
    if (!personaId) { setErr('Pick a persona first (create one in Settings if you have none).'); return; }
    if (platform === 'custom' && !url.trim()) { setErr('Enter a URL for custom platform.'); return; }
    setSaving(true);
    setErr('');
    try {
      const chat = await window.electronAPI.ucChatCreate({
        persona_id: personaId,
        platform,
        platform_url: url || null,
        suspect_handle: handle || null,
        suspect_display_name: displayName || null,
        notes: notes || null,
      });
      onCreated(chat);
      onClose();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' } as const;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl p-6 w-[520px] max-w-[95vw]"
           style={{ background: '#0F1525', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-lg font-semibold mb-4 text-white">New UC Chat</h2>
        {err && (
          <div className="mb-3 p-2 rounded text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</div>
        )}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Persona</span>
            <select className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                    value={personaId ?? ''} onChange={e => setPersonaId(parseInt(e.target.value, 10) || null)}>
              {personas.length === 0 && <option value="">(no personas — create one in Settings)</option>}
              {personas.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Platform</span>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button key={p.id}
                        onClick={() => setPlatform(p.id)}
                        className="px-2 py-2 rounded text-xs"
                        style={{
                          background: platform === p.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                          border: platform === p.id ? '1px solid rgba(124,58,237,0.6)' : '1px solid rgba(255,255,255,0.08)',
                          color: platform === p.id ? '#c4b5fd' : '#9ca3af',
                        }}>
                  {p.label}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">URL</span>
            <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                   value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Suspect Handle</span>
              <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={handle} onChange={e => setHandle(e.target.value)} placeholder="@predator123" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Display Name</span>
              <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Notes</span>
            <textarea className="w-full px-2 py-1.5 rounded text-sm text-white outline-none resize-y" style={inputStyle}
                      rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>Cancel</button>
          <button onClick={create} disabled={saving || !personaId}
                  className="px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
                  style={{ background: '#7c3aed', color: '#fff' }}>
            {saving ? 'Creating…' : 'Create Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}
