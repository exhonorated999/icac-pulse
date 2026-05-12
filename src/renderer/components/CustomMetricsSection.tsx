/**
 * CustomMetricsSection — Settings UI for managing user-defined metrics.
 *
 * Mirrors Viper's Settings → Custom Metrics panel: a flat list of metrics
 * with inline edit (name + type + color), Add button, and Delete button.
 *
 * Lives in Settings.tsx between "Investigative Resources" and "About".
 * Storage is delegated to `../lib/customMetrics`.
 */

import { useEffect, useState } from 'react';
import {
  CustomMetric,
  MetricType,
  MetricColor,
  METRIC_TYPE_ICONS,
  METRIC_COLOR_MAP,
  getCustomMetrics,
  upsertCustomMetric,
  deleteCustomMetric,
} from '../lib/customMetrics';

const TYPE_OPTIONS: { value: MetricType; label: string; hint: string }[] = [
  { value: 'counter',  label: 'Counter',  hint: 'Numeric — sums across cases' },
  { value: 'checkbox', label: 'Checkbox', hint: 'Yes/no — counts cases marked yes' },
  { value: 'date',     label: 'Date',     hint: 'Date — counts cases with a date set' },
  { value: 'text',     label: 'Text',     hint: 'Free text — counts cases with text entered' },
];

const COLOR_OPTIONS: MetricColor[] = ['cyan', 'blue', 'purple', 'orange', 'pink', 'green'];

export default function CustomMetricsSection() {
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<MetricType>('counter');
  const [draftColor, setDraftColor] = useState<MetricColor>('cyan');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MetricType>('counter');
  const [editColor, setEditColor] = useState<MetricColor>('cyan');

  useEffect(() => {
    setMetrics(getCustomMetrics());
    const onChange = () => setMetrics(getCustomMetrics());
    window.addEventListener('customMetricsChanged', onChange);
    return () => window.removeEventListener('customMetricsChanged', onChange);
  }, []);

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) return;
    upsertCustomMetric({ name, type: draftType, color: draftColor });
    setDraftName('');
    setDraftType('counter');
    setDraftColor('cyan');
  };

  const startEdit = (m: CustomMetric) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditType(m.type);
    setEditColor(m.color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    upsertCustomMetric({ id: editingId, name, type: editType, color: editColor });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleDelete = (m: CustomMetric) => {
    const ok = window.confirm(
      `Delete custom metric "${m.name}"?\n\n` +
      `Its dashboard tile (if any) will disappear. Values already entered on individual cases are kept on disk and reappear if you recreate a metric with the same ID.`
    );
    if (!ok) return;
    deleteCustomMetric(m.id);
    if (editingId === m.id) setEditingId(null);
  };

  return (
    <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
      <h2 className="text-xl font-bold text-text-primary mb-2 flex items-center gap-2">
        <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Custom Metrics
      </h2>
      <p className="text-sm text-text-muted mb-5">
        Define your own tracked fields. They appear on every Case Overview tab and can be
        selected for the Dashboard&apos;s Quick Stats card. Values stay on this machine.
      </p>

      {/* Existing metrics list */}
      {metrics.length === 0 ? (
        <div className="text-sm text-text-muted italic mb-5 px-3 py-4 bg-background/40 border border-dashed border-accent-cyan/20 rounded">
          No custom metrics yet. Use the form below to add your first one.
        </div>
      ) : (
        <ul className="space-y-2 mb-6">
          {metrics.map(m => {
            const c = METRIC_COLOR_MAP[m.color];
            const isEditing = editingId === m.id;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 rounded border"
                style={{ borderColor: c.border, background: c.bg }}
              >
                {/* Icon swatch */}
                <span
                  className="w-9 h-9 rounded flex items-center justify-center text-base font-bold shrink-0"
                  style={{ color: c.fg, background: 'rgba(0,0,0,0.25)', border: `1px solid ${c.border}` }}
                  title={m.type}
                >
                  {METRIC_TYPE_ICONS[m.type]}
                </span>

                {isEditing ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 bg-background border border-accent-cyan/30 rounded text-sm text-text-primary"
                      autoFocus
                    />
                    <select
                      value={editType}
                      onChange={e => setEditType(e.target.value as MetricType)}
                      className="px-2 py-1 bg-background border border-accent-cyan/30 rounded text-xs text-text-primary"
                    >
                      {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1 text-xs rounded bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border border-accent-cyan/40"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 text-xs rounded bg-background hover:bg-background/70 text-text-muted border border-text-muted/30"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate" style={{ color: c.fg }}>
                        {m.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {TYPE_OPTIONS.find(t => t.value === m.type)?.label}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(m)}
                      className="px-3 py-1 text-xs rounded bg-background hover:bg-accent-cyan/10 text-text-muted hover:text-accent-cyan border border-accent-cyan/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="px-3 py-1 text-xs rounded bg-background hover:bg-red-500/10 text-text-muted hover:text-red-400 border border-red-500/20"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add new */}
      <div className="bg-background/40 border border-accent-cyan/20 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-text-muted mb-3 font-semibold">
          Add Metric
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="e.g. Devices Seized"
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Type</label>
            <select
              value={draftType}
              onChange={e => setDraftType(e.target.value as MetricType)}
              className="px-3 py-2 bg-background border border-accent-cyan/30 rounded text-sm text-text-primary"
              title={TYPE_OPTIONS.find(t => t.value === draftType)?.hint}
            >
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Color</label>
            <ColorPicker value={draftColor} onChange={setDraftColor} />
          </div>
          <button
            onClick={handleAdd}
            disabled={!draftName.trim()}
            className="px-4 py-2 rounded bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border border-accent-cyan/40 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add
          </button>
        </div>
        <div className="text-xs text-text-muted mt-2">
          {TYPE_OPTIONS.find(t => t.value === draftType)?.hint}
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: MetricColor; onChange: (c: MetricColor) => void }) {
  return (
    <div className="flex gap-1.5">
      {COLOR_OPTIONS.map(c => {
        const m = METRIC_COLOR_MAP[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className="w-7 h-7 rounded-full border-2 transition-transform"
            style={{
              background: m.fg,
              borderColor: active ? '#fff' : m.border,
              transform: active ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        );
      })}
    </div>
  );
}
