/**
 * Custom metrics — Viper-compatible port.
 *
 * Storage model (matches Viper's localStorage layout so users can mentally
 * map between products):
 *
 *   localStorage['customMetrics']           → CustomMetric[]
 *   localStorage['caseMetrics_<caseId>']    → Record<metricId, primitive>
 *   localStorage['quickStatsPreferences']   → string[] (metric keys)
 *
 * Why localStorage and not the sql.js DB?
 *   - Viper stores it that way; users moving between products see the
 *     same UX & data lifetime.
 *   - It's per-installation by design — metrics are agency policy, not
 *     case content. Nothing in here is PII.
 *   - Avoids touching the DB migration ladder for what is essentially a
 *     preferences feature.
 *
 * Live updates:
 *   Any mutation dispatches a `customMetricsChanged` window event so other
 *   open views (Dashboard, Settings, CaseOverview) can refresh without
 *   relying on focus/re-mount.
 */

export type MetricType = 'counter' | 'checkbox' | 'date' | 'text';
export type MetricColor = 'cyan' | 'blue' | 'purple' | 'orange' | 'pink' | 'green';

export interface CustomMetric {
  id: string;          // UUID-like; stable across renames
  name: string;        // user-facing label
  type: MetricType;
  color: MetricColor;
}

const KEY_METRICS = 'customMetrics';
const KEY_QUICK_STATS = 'quickStatsPreferences';
const CASE_METRICS_PREFIX = 'caseMetrics_';

export const METRIC_TYPE_ICONS: Record<MetricType, string> = {
  counter: '#',
  checkbox: '☑',
  date: '📅',
  text: '📝',
};

export const METRIC_COLOR_MAP: Record<MetricColor, { fg: string; bg: string; border: string }> = {
  cyan:   { fg: '#67e8f9', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.35)'  },
  blue:   { fg: '#93c5fd', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.35)'  },
  purple: { fg: '#c4b5fd', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.35)'  },
  orange: { fg: '#fdba74', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.35)'  },
  pink:   { fg: '#f9a8d4', bg: 'rgba(236,72,153,0.10)',  border: 'rgba(236,72,153,0.35)'  },
  green:  { fg: '#86efac', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.35)'   },
};

/* ────────────────────────────────────────────────────────────────────
 * Metric definitions CRUD
 * ──────────────────────────────────────────────────────────────────── */

export function getCustomMetrics(): CustomMetric[] {
  try {
    const raw = localStorage.getItem(KEY_METRICS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isMetric) : [];
  } catch {
    return [];
  }
}

export function saveCustomMetrics(list: CustomMetric[]): void {
  localStorage.setItem(KEY_METRICS, JSON.stringify(list));
  emitChanged();
}

export function upsertCustomMetric(metric: Omit<CustomMetric, 'id'> & { id?: string }): CustomMetric {
  const list = getCustomMetrics();
  if (metric.id) {
    const idx = list.findIndex(m => m.id === metric.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...metric, id: metric.id } as CustomMetric;
      saveCustomMetrics(list);
      return list[idx];
    }
  }
  const created: CustomMetric = {
    id: metric.id || cryptoRandomId(),
    name: (metric.name || '').trim() || 'Untitled',
    type: metric.type,
    color: metric.color,
  };
  list.push(created);
  saveCustomMetrics(list);
  return created;
}

export function deleteCustomMetric(id: string): void {
  saveCustomMetrics(getCustomMetrics().filter(m => m.id !== id));
  // Note: we intentionally do NOT scrub per-case values. If the user
  // re-adds a metric with the same id later, their historic data returns.
}

function isMetric(v: any): v is CustomMetric {
  return v && typeof v.id === 'string' && typeof v.name === 'string'
    && ['counter', 'checkbox', 'date', 'text'].includes(v.type)
    && ['cyan', 'blue', 'purple', 'orange', 'pink', 'green'].includes(v.color);
}

/* ────────────────────────────────────────────────────────────────────
 * Per-case values
 * ──────────────────────────────────────────────────────────────────── */

export function getCaseMetrics(caseId: number | string): Record<string, any> {
  try {
    const raw = localStorage.getItem(CASE_METRICS_PREFIX + caseId);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export function setCaseMetricValue(caseId: number | string, metricId: string, value: any): void {
  const obj = getCaseMetrics(caseId);
  if (value === null || value === undefined || value === '' || value === false || value === 0) {
    delete obj[metricId];
  } else {
    obj[metricId] = value;
  }
  localStorage.setItem(CASE_METRICS_PREFIX + caseId, JSON.stringify(obj));
  emitChanged();
}

export function deleteCaseMetrics(caseId: number | string): void {
  localStorage.removeItem(CASE_METRICS_PREFIX + caseId);
  emitChanged();
}

/* ────────────────────────────────────────────────────────────────────
 * Quick Stats preferences (which metric keys appear on the dashboard)
 * Stored as an array of "keys". A key is either a built-in id (e.g.
 * 'cases_total') or `custom_<metricId>` for a custom metric.
 * ──────────────────────────────────────────────────────────────────── */

export function getQuickStatsSelection(): string[] {
  try {
    const raw = localStorage.getItem(KEY_QUICK_STATS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}

export function setQuickStatsSelection(keys: string[]): void {
  localStorage.setItem(KEY_QUICK_STATS, JSON.stringify(keys));
  emitChanged();
}

/* ────────────────────────────────────────────────────────────────────
 * Aggregation — given all the cases the dashboard knows about, compute
 * a { value, monthly } pair for a metric. "Monthly" = same aggregation
 * but only across cases whose `created_at` falls in the current calendar
 * month. Mirrors Viper's behavior so the dashboard rendering can be a
 * straight copy.
 * ──────────────────────────────────────────────────────────────────── */

export interface CaseLike {
  id: number;
  created_at?: string | null;
}

export interface MetricAggregate {
  value: number;
  monthly: number;
}

export function aggregateMetric(metric: CustomMetric, cases: CaseLike[]): MetricAggregate {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let value = 0;
  let monthly = 0;
  for (const c of cases) {
    const v = getCaseMetrics(c.id)[metric.id];
    if (!hasMeaningfulValue(metric.type, v)) continue;
    const contribution = contributionOf(metric.type, v);
    value += contribution;
    if (c.created_at && c.created_at.startsWith(ym)) {
      monthly += contribution;
    }
  }
  return { value, monthly };
}

function hasMeaningfulValue(type: MetricType, v: any): boolean {
  if (v === null || v === undefined) return false;
  switch (type) {
    case 'counter':  return typeof v === 'number' ? v !== 0 : !isNaN(Number(v)) && Number(v) !== 0;
    case 'checkbox': return v === true;
    case 'date':     return typeof v === 'string' && v.length > 0;
    case 'text':     return typeof v === 'string' && v.trim().length > 0;
  }
}

function contributionOf(type: MetricType, v: any): number {
  if (type === 'counter') return Number(v) || 0;
  // checkbox, date, text → "presence" semantics: each case counts as 1
  return 1;
}

/* ────────────────────────────────────────────────────────────────────
 * Internals
 * ──────────────────────────────────────────────────────────────────── */

function emitChanged() {
  try { window.dispatchEvent(new Event('customMetricsChanged')); } catch {}
}

function cryptoRandomId(): string {
  // Prefer crypto.randomUUID where available (modern Chromium / Electron).
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID();
    }
  } catch {}
  // Fallback — collision-resistant enough for a per-installation list.
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
