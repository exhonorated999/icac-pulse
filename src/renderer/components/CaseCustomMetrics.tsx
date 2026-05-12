/**
 * CaseCustomMetrics — per-case editor for user-defined metrics.
 *
 * Renders on the Case Overview tab. Each metric is a colored row with the
 * input control matching its type:
 *   counter  → number input
 *   checkbox → toggle (true/false)
 *   date     → date input
 *   text     → text input
 *
 * Values are written to localStorage immediately on change (debounced via
 * onBlur for text/number to avoid flooding storage events).
 */

import { useEffect, useState } from 'react';
import {
  CustomMetric,
  METRIC_COLOR_MAP,
  METRIC_TYPE_ICONS,
  getCustomMetrics,
  getCaseMetrics,
  setCaseMetricValue,
} from '../lib/customMetrics';

interface Props {
  caseId: number;
}

export default function CaseCustomMetrics({ caseId }: Props) {
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});

  // Keep local state in sync with localStorage + cross-component edits.
  useEffect(() => {
    const load = () => {
      setMetrics(getCustomMetrics());
      setValues(getCaseMetrics(caseId));
    };
    load();
    window.addEventListener('customMetricsChanged', load);
    return () => window.removeEventListener('customMetricsChanged', load);
  }, [caseId]);

  if (metrics.length === 0) return null;

  const commit = (metricId: string, raw: any) => {
    setValues(prev => ({ ...prev, [metricId]: raw }));
    setCaseMetricValue(caseId, metricId, raw);
  };

  return (
    <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
      <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Custom Metrics
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metrics.map(m => {
          const c = METRIC_COLOR_MAP[m.color];
          const v = values[m.id];
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded border"
              style={{ borderColor: c.border, background: c.bg }}
            >
              <span
                className="w-9 h-9 rounded flex items-center justify-center text-base font-bold shrink-0"
                style={{ color: c.fg, background: 'rgba(0,0,0,0.25)', border: `1px solid ${c.border}` }}
                title={m.type}
              >
                {METRIC_TYPE_ICONS[m.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: c.fg }}>{m.name}</div>
              </div>
              <MetricInput metric={m} value={v} onCommit={raw => commit(m.id, raw)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricInput({
  metric, value, onCommit,
}: {
  metric: CustomMetric;
  value: any;
  onCommit: (raw: any) => void;
}) {
  // Local controlled state — flushed to parent on blur or immediate for checkbox.
  const [local, setLocal] = useState<any>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  const baseInput =
    'px-2 py-1 bg-background border border-accent-cyan/30 rounded text-sm text-text-primary ' +
    'focus:outline-none focus:ring-2 focus:ring-accent-cyan/40';

  switch (metric.type) {
    case 'counter':
      return (
        <input
          type="number"
          value={local === '' || local === null || local === undefined ? '' : local}
          onChange={e => setLocal(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={() => onCommit(local === '' ? 0 : Number(local) || 0)}
          className={`${baseInput} w-24 text-right`}
        />
      );
    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => onCommit(!local)}
          className={`w-12 h-6 rounded-full relative transition-colors ${
            local ? 'bg-accent-cyan/60' : 'bg-background border border-accent-cyan/20'
          }`}
          aria-pressed={!!local}
          aria-label={`Toggle ${metric.name}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              local ? 'left-6' : 'left-0.5'
            }`}
          />
        </button>
      );
    case 'date':
      return (
        <input
          type="date"
          value={local || ''}
          onChange={e => { setLocal(e.target.value); onCommit(e.target.value); }}
          className={`${baseInput} w-40`}
        />
      );
    case 'text':
      return (
        <input
          type="text"
          value={local || ''}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => onCommit(local || '')}
          className={`${baseInput} w-48`}
          placeholder="—"
        />
      );
  }
}
