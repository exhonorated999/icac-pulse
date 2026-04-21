import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────

interface TimelineEvent {
  id: number;
  case_id: number;
  timestamp: string;
  end_timestamp?: string;
  title: string;
  description?: string;
  lane: 'incident' | 'investigative' | 'forensics';
  category: string;
  significance: 'major' | 'supporting';
  entity_link?: string;
  source_type: string;
  source_id?: string;
  created_at: string;
}

interface CaseTimelineProps {
  caseId: number;
}

// ── Constants ──────────────────────────────────────────────

const LANES = {
  incident:      { label: 'Incident &\nReports',     color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.4)' },
  investigative: { label: 'Investigative\nActions',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.4)' },
  forensics:     { label: 'Forensics &\nEvidence',    color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.4)' },
} as const;

const CATEGORIES: Record<string, string> = {
  warrant: '📋', rms: '📄', interview: '🎙️',
  digital: '💻', arrest: '🚔', note: '📝', custom: '📌',
};

type LaneKey = keyof typeof LANES;
type ZoomLevel = 'full' | 'week' | 'day';

// ── Component ──────────────────────────────────────────────

export function CaseTimeline({ caseId }: CaseTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [laneFilter, setLaneFilter] = useState<'all' | LaneKey>('all');
  const [sigFilter, setSigFilter] = useState<'all' | 'major' | 'supporting'>('all');
  const [zoom, setZoom] = useState<ZoomLevel>('full');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; title: string; color: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load events ──
  const loadEvents = useCallback(async () => {
    try {
      const evts = await window.electronAPI.getTimelineEvents(caseId);
      setEvents(evts || []);
    } catch (err) {
      console.error('Failed to load timeline events:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Generate auto events ──
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.generateTimelineEvents(caseId);
      if (result.success) {
        setEvents(result.events);
      }
    } catch (err) {
      console.error('Failed to generate timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ──
  const handleAddEvent = () => {
    setEditId(null);
    setShowModal(true);
  };

  const handleEditEvent = (id: number) => {
    setEditId(id);
    setShowModal(true);
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Delete this timeline event?')) return;
    await window.electronAPI.deleteTimelineEvent(id);
    setSelectedId(null);
    await loadEvents();
  };

  const handleSaveEvent = async (data: any) => {
    setSaveError(null);
    try {
      let result: any;
      if (editId) {
        result = await window.electronAPI.updateTimelineEvent(editId, data);
      } else {
        result = await window.electronAPI.addTimelineEvent({ ...data, case_id: caseId });
      }
      if (result && result.success === false) {
        console.error('Timeline save failed:', result.error);
        setSaveError('Failed to save timeline event. Please try again.');
        return;
      }
      setShowModal(false);
      setEditId(null);
      if (mountedRef.current) {
        await loadEvents();
      }
    } catch (err: any) {
      console.error('Timeline save error:', err);
      setSaveError(err.message || 'Failed to save timeline event.');
    }
  };

  // ── Filtering ──
  const filtered = events.filter(e => {
    if (laneFilter !== 'all' && e.lane !== laneFilter) return false;
    if (sigFilter !== 'all' && e.significance !== sigFilter) return false;
    return true;
  });

  const selectedEvent = selectedId ? events.find(e => e.id === selectedId) : null;

  // ── Empty state ──
  if (loading) {
    return (
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ClockIcon />
          Case Timeline
        </h3>
        <div className="text-center py-8 text-text-muted">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ClockIcon />
          Case Timeline
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={handleAddEvent}
            className="px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/20 transition text-sm font-medium">
            + Add Event
          </button>
          <button onClick={handleRefresh}
            className="px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50 transition text-sm font-medium flex items-center gap-1">
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          {/* Save error banner */}
          {saveError && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
              <span className="text-red-400 text-sm">{saveError}</span>
              <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-300 text-xs ml-4">✕</button>
            </div>
          )}
          {/* Filters + Zoom */}
          <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Lane:</span>
              <select value={laneFilter} onChange={e => setLaneFilter(e.target.value as any)}
                className="bg-background border border-gray-600 rounded px-2 py-1 text-text-primary text-xs focus:border-accent-cyan outline-none">
                <option value="all">All Lanes</option>
                {Object.entries(LANES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label.replace('\n', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Show:</span>
              <select value={sigFilter} onChange={e => setSigFilter(e.target.value as any)}
                className="bg-background border border-gray-600 rounded px-2 py-1 text-text-primary text-xs focus:border-accent-cyan outline-none">
                <option value="all">All Events</option>
                <option value="major">Major Only</option>
                <option value="supporting">Supporting Only</option>
              </select>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-text-muted mr-1">Zoom:</span>
              {(['full', 'week', 'day'] as ZoomLevel[]).map(z => (
                <button key={z} onClick={() => setZoom(z)}
                  className={`px-2 py-1 rounded text-xs transition ${
                    zoom === z
                      ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:text-white'
                  }`}>
                  {z.charAt(0).toUpperCase() + z.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Swimlane visualization */}
          <Swimlane
            events={filtered}
            allEvents={events}
            zoom={zoom}
            selectedId={selectedId}
            onSelect={setSelectedId}
            laneFilter={laneFilter}
            setTooltip={setTooltip}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wider mr-2">Legend:</span>
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400" /> Major
            </span>
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-500 opacity-60" /> Supporting
            </span>
            <span className="text-[10px] text-gray-600 ml-auto">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Detail panel */}
          {selectedEvent && (
            <DetailPanel
              event={selectedEvent}
              onClose={() => setSelectedId(null)}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
            />
          )}
        </>
      ) : (
        <div className="text-center py-10">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-text-muted mb-4">No timeline events yet</p>
          <button onClick={handleRefresh}
            className="px-5 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-lg hover:bg-accent-cyan/30 transition font-medium">
            Generate Timeline from Case Data
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <EventModal
          event={editId ? events.find(e => e.id === editId) : undefined}
          onSave={handleSaveEvent}
          onClose={() => { setShowModal(false); setEditId(null); }}
        />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-[99999] px-3 py-2 rounded-lg border border-gray-600 text-sm pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x, top: tooltip.y,
            background: 'rgba(17,17,22,0.96)',
          }}>
          <div className="text-text-muted text-xs">{tooltip.date}</div>
          <div style={{ color: tooltip.color }}>{tooltip.title}</div>
        </div>
      )}
    </div>
  );
}

// ── Swimlane Sub-component ──────────────────────────────────

interface SwimlaneProps {
  events: TimelineEvent[];
  allEvents: TimelineEvent[];
  zoom: ZoomLevel;
  selectedId: number | null;
  onSelect: (id: number) => void;
  laneFilter: 'all' | LaneKey;
  setTooltip: (t: { x: number; y: number; date: string; title: string; color: string } | null) => void;
}

function Swimlane({ events, allEvents, zoom, selectedId, onSelect, laneFilter, setTooltip }: SwimlaneProps) {
  if (!events.length) return null;

  // Time range
  const timestamps = events.map(e => new Date(e.timestamp).getTime());
  let minT = Math.min(...timestamps);
  let maxT = Math.max(...timestamps);

  // Zoom
  if (zoom === 'day') {
    const center = selectedId
      ? new Date(allEvents.find(e => e.id === selectedId)?.timestamp || maxT).getTime()
      : maxT;
    minT = center - 12 * 3600000;
    maxT = center + 12 * 3600000;
  } else if (zoom === 'week') {
    const center = selectedId
      ? new Date(allEvents.find(e => e.id === selectedId)?.timestamp || maxT).getTime()
      : maxT;
    minT = center - 3.5 * 86400000;
    maxT = center + 3.5 * 86400000;
  }

  // Padding
  const span = maxT - minT || 86400000;
  const pad = span * 0.05;
  minT -= pad;
  maxT += pad;
  const totalSpan = maxT - minT;

  // Ticks
  const spanDays = totalSpan / 86400000;
  let tickInterval: number;
  if (spanDays <= 2) tickInterval = 3600000 * 3;
  else if (spanDays <= 14) tickInterval = 86400000;
  else if (spanDays <= 90) tickInterval = 86400000 * 7;
  else tickInterval = 86400000 * 30;

  const ticks: { pct: number; label: string }[] = [];
  const firstTick = Math.ceil(minT / tickInterval) * tickInterval;
  for (let t = firstTick; t <= maxT; t += tickInterval) {
    const pct = ((t - minT) / totalSpan) * 100;
    const d = new Date(t);
    let label: string;
    if (tickInterval < 86400000) label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    else if (tickInterval <= 86400000) label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    else label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    ticks.push({ pct, label });
  }

  // Active lanes
  const laneOrder: LaneKey[] = ['incident', 'investigative', 'forensics'];
  const activeLanes = laneFilter === 'all' ? laneOrder : laneOrder.filter(l => l === laneFilter);

  const trackWidth = 2000;

  const evtPos = (e: TimelineEvent) => {
    const t = new Date(e.timestamp).getTime();
    return Math.max(0, Math.min(100, ((t - minT) / totalSpan) * 100));
  };

  // ── Cluster detection for overlapping dots ──
  // Dots within this % threshold are considered overlapping
  const CLUSTER_THRESHOLD = 0.8; // percent of total track width

  function computeOffsets(laneEvents: TimelineEvent[]): Map<number, number> {
    const offsets = new Map<number, number>();
    if (!laneEvents.length) return offsets;

    // Sort by position
    const sorted = [...laneEvents].sort((a, b) => evtPos(a) - evtPos(b));
    
    // Group into clusters
    const clusters: TimelineEvent[][] = [];
    let current: TimelineEvent[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const prevPct = evtPos(current[current.length - 1]);
      const curPct = evtPos(sorted[i]);
      if (curPct - prevPct < CLUSTER_THRESHOLD) {
        current.push(sorted[i]);
      } else {
        clusters.push(current);
        current = [sorted[i]];
      }
    }
    clusters.push(current);

    // For each cluster, assign vertical offsets (pixels from center)
    for (const cluster of clusters) {
      if (cluster.length <= 1) {
        offsets.set(cluster[0].id, 0);
        continue;
      }
      // Spread events vertically within lane (lane height = 80px, center = 0)
      const spacing = Math.min(18, 50 / cluster.length);
      const startOffset = -((cluster.length - 1) * spacing) / 2;
      cluster.forEach((evt, i) => {
        offsets.set(evt.id, startOffset + i * spacing);
      });
    }
    return offsets;
  }

  return (
    <div className="rounded-lg border border-gray-700 flex" style={{ background: 'rgba(15,15,20,0.6)' }}>
      {/* Fixed lane labels column */}
      <div className="flex-shrink-0 w-40">
        {activeLanes.map((laneKey) => {
          const lane = LANES[laneKey];
          return (
            <div key={laneKey} className="border-b border-gray-700/50" style={{ minHeight: 80 }}>
              <div className="h-full px-3 py-3 flex items-center border-r border-gray-700/50"
                style={{ background: lane.bg, borderLeft: `3px solid ${lane.border}`, minHeight: 80 }}>
                <span className="text-xs font-bold uppercase tracking-wider whitespace-pre-line" style={{ color: lane.color }}>
                  {lane.label}
                </span>
              </div>
            </div>
          );
        })}
        {/* Spacer for time axis */}
        <div className="border-t border-gray-700 border-r border-gray-700/50 h-8" />
      </div>

      {/* Single scrollable tracks area */}
      <div className="flex-1 overflow-x-auto">
        <div style={{ minWidth: trackWidth }}>
          {/* Lane tracks */}
          {activeLanes.map((laneKey) => {
            const lane = LANES[laneKey];
            const laneEvents = events.filter(e => e.lane === laneKey);
            const offsets = computeOffsets(laneEvents);
            return (
              <div key={laneKey} className="border-b border-gray-700/50" style={{ minHeight: 80 }}>
                <div className="relative" style={{ minWidth: trackWidth, height: '100%', minHeight: 80 }}>
                  {/* Gridlines */}
                  {ticks.map((t, i) => (
                    <div key={i} className="absolute top-0 h-full border-l border-gray-800/40" style={{ left: `${t.pct}%` }} />
                  ))}
                  {/* Connector line */}
                  <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: lane.border }} />
                  {/* Event dots */}
                  {laneEvents.map(evt => {
                    const pct = evtPos(evt);
                    const yOffset = offsets.get(evt.id) || 0;
                    const isMajor = evt.significance === 'major';
                    const isSelected = evt.id === selectedId;
                    const sz = isMajor ? 14 : 10;
                    const glow = isSelected ? `0 0 12px ${lane.color}` : (isMajor ? `0 0 8px ${lane.color}55` : 'none');
                    const catIcon = CATEGORIES[evt.category] || '📌';
                    return (
                      <div key={evt.id}
                        className="absolute flex flex-col items-center cursor-pointer group"
                        style={{
                          left: `${pct}%`, top: '50%',
                          transform: `translate(-50%, calc(-50% + ${yOffset}px))`,
                          zIndex: isSelected ? 20 : 10,
                        }}
                        onClick={() => onSelect(evt.id)}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setTooltip({
                            x: rect.left + rect.width / 2 - 60,
                            y: rect.top - 52,
                            date: new Date(evt.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                            title: `${catIcon} ${evt.title}`,
                            color: lane.color,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div className="rounded-full border-2 transition-all duration-200"
                          style={{
                            width: sz, height: sz,
                            background: lane.color,
                            borderColor: isSelected ? '#fff' : lane.color,
                            boxShadow: glow,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Time axis */}
          <div className="border-t border-gray-700">
            <div className="relative h-8" style={{ minWidth: trackWidth }}>
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${t.pct}%` }}>
                  <div className="h-3 border-l border-gray-600" />
                  <span className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ────────────────────────────────────────────

interface DetailPanelProps {
  event: TimelineEvent;
  onClose: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

function DetailPanel({ event, onClose, onEdit, onDelete }: DetailPanelProps) {
  const lane = LANES[event.lane] || LANES.incident;
  const isManual = event.source_type === 'manual';
  const catIcon = CATEGORIES[event.category] || '📌';
  const ts = new Date(event.timestamp);

  return (
    <div className="mt-4 p-4 rounded-lg border" style={{ background: lane.bg, borderColor: lane.border }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-lg">{catIcon}</span>
            <h4 className="text-lg font-bold" style={{ color: lane.color }}>{event.title}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: lane.color, borderColor: lane.border }}>
              {event.significance}
            </span>
            {isManual
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-300 border border-gray-500">Manual</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Auto</span>
            }
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-text-muted">Date:</span>{' '}
              <span className="text-text-primary">{ts.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div><span className="text-text-muted">Time:</span>{' '}
              <span className="text-text-primary">{ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div><span className="text-text-muted">Lane:</span>{' '}
              <span style={{ color: lane.color }}>{lane.label.replace('\n', ' ')}</span>
            </div>
            <div><span className="text-text-muted">Category:</span>{' '}
              <span className="text-text-primary">{event.category}</span>
            </div>
            {event.entity_link && (
              <div className="col-span-2">
                <span className="text-text-muted">Entity:</span>{' '}
                <span className="text-text-primary">{event.entity_link}</span>
              </div>
            )}
          </div>
          {event.description && (
            <p className="text-gray-300 text-sm mt-3 leading-relaxed">{event.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 ml-4">
          {isManual && (
            <>
              <button onClick={() => onEdit(event.id)}
                className="px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/20 transition text-xs">
                Edit
              </button>
              <button onClick={() => onDelete(event.id)}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition text-xs">
                Delete
              </button>
            </>
          )}
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-400 border border-gray-600 hover:text-white transition text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Modal ─────────────────────────────────────────────

interface EventModalProps {
  event?: TimelineEvent;
  onSave: (data: any) => void;
  onClose: () => void;
}

function EventModal({ event, onSave, onClose }: EventModalProps) {
  const isEdit = !!event;
  const ts = event ? new Date(event.timestamp) : new Date();

  const [date, setDate] = useState(event ? ts.toISOString().slice(0, 10) : '');
  const [time, setTime] = useState(event ? ts.toTimeString().slice(0, 5) : '');
  const [title, setTitle] = useState(event?.title || '');
  const [lane, setLane] = useState<LaneKey>(event?.lane || 'incident');
  const [category, setCategory] = useState(event?.category || 'custom');
  const [significance, setSignificance] = useState<'major' | 'supporting'>(event?.significance || 'major');
  const [entityLink, setEntityLink] = useState(event?.entity_link || '');
  const [description, setDescription] = useState(event?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    try {
      const timestamp = new Date(`${date}T${time || '00:00'}:00`).toISOString();
      onSave({
        timestamp, title: title.trim(), lane, category, significance,
        entity_link: entityLink.trim() || null,
        description: description.trim() || null,
        source_type: 'manual',
      });
    } catch (err) {
      console.error('Invalid date/time:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-text-primary mb-5">{isEdit ? 'Edit' : 'Add'} Timeline Event</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none" />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="e.g., Search Warrant Executed"
              className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Lane *</label>
              <select value={lane} onChange={e => setLane(e.target.value as LaneKey)}
                className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none">
                {Object.entries(LANES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label.replace('\n', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Significance</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={significance === 'major'} onChange={() => setSignificance('major')}
                  className="text-accent-cyan" />
                <span className="text-text-primary text-sm">Major Milestone</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={significance === 'supporting'} onChange={() => setSignificance('supporting')}
                  className="text-accent-cyan" />
                <span className="text-text-primary text-sm">Supporting Detail</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Entity Link</label>
            <input type="text" value={entityLink} onChange={e => setEntityLink(e.target.value)}
              placeholder="e.g., Det. Miller, SUSPECT NAME"
              className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Additional details..."
              className="w-full px-3 py-2 bg-background border border-gray-600 rounded-lg text-text-primary focus:border-accent-cyan outline-none resize-y" />
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" onClick={onClose}
              className="px-5 py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition">
              Cancel
            </button>
            <button type="submit"
              className="px-5 py-2 bg-accent-cyan hover:bg-accent-cyan/80 rounded-lg text-black font-semibold transition">
              {isEdit ? 'Save' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
