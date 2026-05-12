/**
 * QuickStatsCard — Dashboard widget showing user-selectable stats.
 *
 * Built-in stats (always available, default-selected) and user-defined
 * custom metrics share a single picker. The settings cog opens a modal to
 * toggle which entries appear and in what order.
 *
 * Selection persists in localStorage['quickStatsPreferences'] (Viper-compatible).
 * Built-in keys: `builtin:open|closed|transferred|warrants`
 * Custom keys:   `custom:<metricId>`
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CustomMetric,
  METRIC_COLOR_MAP,
  METRIC_TYPE_ICONS,
  getCustomMetrics,
  getQuickStatsSelection,
  setQuickStatsSelection,
  aggregateMetric,
  CaseLike,
} from '../lib/customMetrics';

interface BuiltinStat {
  key: string;
  label: string;
  value: number;
  onClick: () => void;
}

interface Props {
  builtin: BuiltinStat[];     // always 4 entries, ordered open/closed/transferred/warrants
  cases: CaseLike[];          // for custom metric aggregation
}

const DEFAULT_SELECTION = ['builtin:open', 'builtin:closed', 'builtin:transferred', 'builtin:warrants'];

export default function QuickStatsCard({ builtin, cases }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [selection, setSelection] = useState<string[]>([]);

  // Initial load + react to custom-metric changes from Settings / Case Overview.
  useEffect(() => {
    const load = () => {
      setMetrics(getCustomMetrics());
      const stored = getQuickStatsSelection();
      // First-run users get the built-in defaults.
      setSelection(stored.length > 0 ? stored : DEFAULT_SELECTION);
    };
    load();
    window.addEventListener('customMetricsChanged', load);
    // Also re-aggregate when per-case values change anywhere.
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('customMetricsChanged', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  // Resolve every selected key to a renderable row. Custom metrics deleted
  // since selection time are silently skipped.
  const rows = useMemo(() => {
    const builtinByKey = new Map(builtin.map(b => [b.key, b]));
    const metricById = new Map(metrics.map(m => [m.id, m]));
    return selection
      .map(key => {
        if (key.startsWith('builtin:')) {
          const b = builtinByKey.get(key);
          if (!b) return null;
          return { kind: 'builtin' as const, key, label: b.label, value: b.value, onClick: b.onClick };
        }
        if (key.startsWith('custom:')) {
          const id = key.slice('custom:'.length);
          const m = metricById.get(id);
          if (!m) return null;
          const agg = aggregateMetric(m, cases);
          return {
            kind: 'custom' as const,
            key,
            label: m.name,
            metric: m,
            value: agg.value,
            monthly: agg.monthly,
            onClick: () => {/* no-op for now; could open a per-metric drill-down */},
          };
        }
        return null;
      })
      .filter(Boolean) as Array<
        | { kind: 'builtin'; key: string; label: string; value: number; onClick: () => void }
        | { kind: 'custom'; key: string; label: string; metric: CustomMetric; value: number; monthly: number; onClick: () => void }
      >;
  }, [selection, builtin, metrics, cases]);

  const togglePick = (key: string) => {
    setSelection(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      setQuickStatsSelection(next);
      return next;
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setSelection(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      setQuickStatsSelection(next);
      return next;
    });
  };

  return (
    <div className="dashboard-section bg-panel border border-accent-cyan/20 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary">Quick Stats</h3>
        <button
          onClick={() => setShowPicker(true)}
          title="Customize Quick Stats"
          aria-label="Customize Quick Stats"
          className="p-1.5 rounded text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-text-muted italic py-3 text-center">
            No stats selected. Click the cog to choose what to display.
          </div>
        ) : (
          rows.map(r => {
            if (r.kind === 'builtin') {
              return (
                <button
                  key={r.key}
                  onClick={r.onClick}
                  className="flex justify-between items-center w-full p-3 rounded-lg bg-accent-cyan/5 border border-accent-cyan/30 hover:border-accent-cyan/50 hover:bg-accent-cyan/10 transition-colors"
                >
                  <span className="text-text-muted text-sm">{r.label}</span>
                  <span className="text-text-primary font-bold">{r.value}</span>
                </button>
              );
            }
            const c = METRIC_COLOR_MAP[r.metric.color];
            return (
              <button
                key={r.key}
                onClick={r.onClick}
                title={`${r.label} — ${r.value} total / ${r.monthly} this month`}
                className="flex justify-between items-center w-full p-3 rounded-lg border transition-colors hover:brightness-110"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <span className="text-sm flex items-center gap-2" style={{ color: c.fg }}>
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${c.border}` }}
                  >
                    {METRIC_TYPE_ICONS[r.metric.type]}
                  </span>
                  {r.label}
                </span>
                <span className="font-bold flex items-baseline gap-1.5" style={{ color: c.fg }}>
                  {r.value}
                  <span className="text-[10px] opacity-70">({r.monthly}/mo)</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {showPicker && (
        <PickerModal
          builtin={builtin}
          metrics={metrics}
          selection={selection}
          onToggle={togglePick}
          onMove={move}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function PickerModal({
  builtin, metrics, selection, onToggle, onMove, onClose,
}: {
  builtin: BuiltinStat[];
  metrics: CustomMetric[];
  selection: string[];
  onToggle: (key: string) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onClose: () => void;
}) {
  // Build the master list (every available option) plus the "ordered selection"
  // for the right-hand reorder pane.
  const allOptions: Array<{ key: string; label: string; tone: 'builtin' | 'custom'; metric?: CustomMetric }> = [
    ...builtin.map(b => ({ key: b.key, label: b.label, tone: 'builtin' as const })),
    ...metrics.map(m => ({ key: `custom:${m.id}`, label: m.name, tone: 'custom' as const, metric: m })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-accent-cyan/30 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-text-primary">Customize Quick Stats</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-text-muted mb-5">
          Pick which stats appear in the Quick Stats card. Built-in stats are always
          available; custom metrics come from <em>Settings → Custom Metrics</em>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Available */}
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted mb-2 font-semibold">
              Available
            </div>
            <ul className="space-y-1.5">
              {allOptions.map(opt => {
                const checked = selection.includes(opt.key);
                const swatch = opt.metric ? METRIC_COLOR_MAP[opt.metric.color] : null;
                return (
                  <li key={opt.key}>
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent-cyan/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(opt.key)}
                        className="w-4 h-4 accent-accent-cyan"
                      />
                      {swatch && (
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ background: swatch.fg, border: `1px solid ${swatch.border}` }}
                        />
                      )}
                      <span className="text-sm text-text-primary">{opt.label}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-text-muted">
                        {opt.tone}
                      </span>
                    </label>
                  </li>
                );
              })}
              {allOptions.length === builtin.length && (
                <li className="text-xs text-text-muted italic px-2 pt-2">
                  No custom metrics yet — add some in Settings → Custom Metrics.
                </li>
              )}
            </ul>
          </div>

          {/* Order */}
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted mb-2 font-semibold">
              Display Order
            </div>
            {selection.length === 0 ? (
              <div className="text-xs italic text-text-muted px-2">
                Nothing selected yet.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {selection.map((key, idx) => {
                  const opt = allOptions.find(o => o.key === key);
                  if (!opt) return null;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-accent-cyan/20"
                    >
                      <span className="text-text-muted text-xs w-5">{idx + 1}.</span>
                      <span className="text-sm text-text-primary flex-1 truncate">{opt.label}</span>
                      <button
                        onClick={() => onMove(idx, -1)}
                        disabled={idx === 0}
                        className="px-1.5 text-text-muted hover:text-accent-cyan disabled:opacity-30"
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => onMove(idx, 1)}
                        disabled={idx === selection.length - 1}
                        className="px-1.5 text-text-muted hover:text-accent-cyan disabled:opacity-30"
                        title="Move down"
                      >▼</button>
                      <button
                        onClick={() => onToggle(key)}
                        className="px-1.5 text-text-muted hover:text-red-400"
                        title="Remove"
                      >×</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border border-accent-cyan/40 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
