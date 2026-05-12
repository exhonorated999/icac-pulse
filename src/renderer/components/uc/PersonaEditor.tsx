/**
 * PersonaEditor — modal for creating / editing a UC persona.
 */
import { useEffect, useState } from 'react';
import { PersonaPhotos } from './PersonaPhotos';

interface Props {
  persona: Partial<UcPersona> | null;
  onClose: () => void;
  onSaved: (p: UcPersona) => void;
}

export function PersonaEditor({ persona, onClose, onSaved }: Props) {
  const isNew = !persona?.id;
  const [form, setForm] = useState<Partial<UcPersona>>({
    display_name: '',
    real_age: null,
    displayed_age: null,
    gender: '',
    hometown: '',
    bio: '',
    backstory: '',
    notes: '',
    ...(persona || {}),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setForm({ display_name: '', ...(persona || {}) }); }, [persona]);

  const set = (k: keyof UcPersona, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.display_name || !String(form.display_name).trim()) {
      setErr('Display name is required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      let result: UcPersona;
      if (isNew) {
        result = await window.electronAPI.ucPersonaCreate(form);
      } else {
        result = await window.electronAPI.ucPersonaUpdate(persona!.id!, form);
      }
      onSaved(result);
      onClose();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
  } as const;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl p-6 w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
           style={{ background: '#0F1525', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-lg font-semibold mb-4 text-white">
          {isNew ? 'New UC Persona' : `Edit Persona: ${persona?.display_name}`}
        </h2>
        {err && (
          <div className="mb-3 p-2 rounded text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</div>
        )}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Display Name *</span>
            <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                   value={form.display_name || ''} onChange={e => set('display_name', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Real Age (officer)</span>
              <input type="number" className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={form.real_age ?? ''} onChange={e => set('real_age', e.target.value ? parseInt(e.target.value, 10) : null)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Displayed Age (persona)</span>
              <input type="number" className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={form.displayed_age ?? ''} onChange={e => set('displayed_age', e.target.value ? parseInt(e.target.value, 10) : null)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Gender</span>
              <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={form.gender || ''} onChange={e => set('gender', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Hometown</span>
              <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                     value={form.hometown || ''} onChange={e => set('hometown', e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Bio (short)</span>
            <input className="w-full px-2 py-1.5 rounded text-sm text-white outline-none" style={inputStyle}
                   value={form.bio || ''} onChange={e => set('bio', e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Backstory (used as cheat-sheet)</span>
            <textarea className="w-full px-2 py-1.5 rounded text-sm text-white outline-none resize-y" style={inputStyle}
                      rows={4} value={form.backstory || ''} onChange={e => set('backstory', e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Officer Notes (private)</span>
            <textarea className="w-full px-2 py-1.5 rounded text-sm text-white outline-none resize-y" style={inputStyle}
                      rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </label>
          {isNew ? (
            <div className="text-xs text-gray-500 italic px-1 py-2 rounded"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
              Save the persona first to add a photo library.
            </div>
          ) : (
            <PersonaPhotos personaId={persona!.id!} />
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>Cancel</button>
          <button onClick={save} disabled={saving}
                  className="px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
                  style={{ background: '#7c3aed', color: '#fff' }}>
            {saving ? 'Saving…' : (isNew ? 'Create' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
