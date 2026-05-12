import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface Case {
  id: number;
  case_number: string;
  case_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  suspects_summary?: string | null;
  suspect_count?: number;
  evidence_count?: number;
}

type SortKey = 'case_number' | 'case_type' | 'status' | 'created_at' | 'updated_at' | 'suspects';
type SortDir = 'asc' | 'desc';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  warrants_issued: 'Warrants Issued',
  ready_residential: 'Ready for Residential',
  arrest: 'Arrest',
  closed_no_arrest: 'Closed — No Arrest',
  referred: 'Referred',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-status-success/15 text-status-success border-status-success/30',
  warrants_issued: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  ready_residential: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  arrest: 'bg-accent-pink/15 text-accent-pink border-accent-pink/30',
  closed_no_arrest: 'bg-text-muted/15 text-text-muted border-text-muted/30',
  referred: 'bg-text-muted/15 text-text-muted border-text-muted/30',
};

const TYPE_LABELS: Record<string, string> = {
  cybertip: 'CyberTip',
  p2p: 'P2P',
  chat: 'Chat',
  other: 'Other',
};

const TYPE_ICONS: Record<string, string> = {
  cybertip: '🛡️',
  p2p: '🔗',
  chat: '💬',
  other: '📋',
};

export function CasesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    void loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const all = (await window.electronAPI.getAllCases()) as Case[];
      setCases(all || []);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, c: Case) => {
    e.stopPropagation();
    if (!confirm(`Delete case ${c.case_number}? This cannot be undone.`)) return;
    try {
      await window.electronAPI.deleteCase(c.id);
      setCases(cs => cs.filter(x => x.id !== c.id));
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete case');
    }
  };

  // Compute filtered list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (typeFilter !== 'all' && c.case_type !== typeFilter) return false;
      if (q) {
        const hay = [
          c.case_number,
          c.case_type,
          c.status,
          STATUS_LABELS[c.status] || '',
          TYPE_LABELS[c.case_type] || '',
          c.suspects_summary || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, searchQuery, statusFilter, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case 'case_number': av = a.case_number; bv = b.case_number; break;
        case 'case_type':   av = a.case_type;   bv = b.case_type;   break;
        case 'status':      av = a.status;      bv = b.status;      break;
        case 'created_at':  av = a.created_at;  bv = b.created_at;  break;
        case 'updated_at':  av = a.updated_at;  bv = b.updated_at;  break;
        case 'suspects':    av = a.suspects_summary || ''; bv = b.suspects_summary || ''; break;
      }
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Quick stats
  const stats = useMemo(() => {
    const total = cases.length;
    const closedStatuses = new Set(['closed_no_arrest', 'arrest', 'referred']);
    const active = cases.filter(c => !closedStatuses.has(c.status)).length;
    const closed = cases.filter(c => c.status === 'closed_no_arrest').length;
    const warrantsIssued = cases.filter(c => c.status === 'warrants_issued').length;
    return { total, active, closed, warrantsIssued };
  }, [cases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-primary text-lg">Loading cases...</p>
        </div>
      </div>
    );
  }

  const SortHeader: React.FC<{ k: SortKey; label: string; className?: string }> = ({ k, label, className }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted
                 cursor-pointer select-none hover:text-accent-cyan transition-colors ${className || ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="flex flex-col leading-none text-[0.6rem]">
          <span className={sortKey === k && sortDir === 'asc' ? 'text-accent-cyan' : 'text-text-muted/40'}>▲</span>
          <span className={sortKey === k && sortDir === 'desc' ? 'text-accent-cyan' : 'text-text-muted/40'}>▼</span>
        </span>
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-text-primary mb-1">All Cases</h1>
            <p className="text-text-muted">Manage and view all your cases</p>
          </div>
          <button
            onClick={() => navigate('/cases/new')}
            className="px-5 py-2.5 bg-transparent border-2 border-accent-cyan text-accent-cyan font-medium rounded-lg
                       hover:bg-accent-cyan/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Case
          </button>
        </div>

        {/* Search + Filters card */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[260px] relative">
              <input
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-accent-cyan/30 rounded-lg
                         text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-accent-cyan/30 rounded-lg
                         text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            >
              <option value="all">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-muted mt-3">
            Search cases by number, type, status, or suspect name.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-text-muted/70">Quick Stats</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Cases"  value={stats.total}          accent="cyan"    iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <StatCard label="Active Cases" value={stats.active}         accent="success" iconPath="M5 13l4 4L19 7" />
          <StatCard label="Closed"       value={stats.closed}         accent="muted"   iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          <StatCard label="Warrants Issued" value={stats.warrantsIssued} accent="pink" iconPath="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </div>

        {/* Cases table */}
        {sorted.length === 0 ? (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No cases found</h3>
            <p className="text-text-muted mb-6">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first case to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
              <button
                onClick={() => navigate('/cases/new')}
                className="px-6 py-3 bg-accent-cyan text-background font-bold rounded-lg hover:bg-accent-cyan/90 transition-colors"
              >
                Create Your First Case
              </button>
            )}
          </div>
        ) : (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg overflow-hidden">
            <div className="overflow-x-auto pulse-tabs-scroll">
              <table className="w-full min-w-[900px]">
                <thead className="bg-background/60 border-b border-accent-cyan/20">
                  <tr>
                    <SortHeader k="case_number" label="Case Number" />
                    <SortHeader k="case_type"   label="Type" />
                    <SortHeader k="status"      label="Status" />
                    <SortHeader k="created_at"  label="Created" />
                    <SortHeader k="updated_at"  label="Updated" />
                    <SortHeader k="suspects"    label="Suspect(s)" />
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, idx) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className={`cursor-pointer transition-colors
                                  ${idx % 2 === 0 ? 'bg-transparent' : 'bg-background/30'}
                                  hover:bg-accent-cyan/5 border-b border-accent-cyan/5 last:border-b-0`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-accent-cyan font-semibold hover:underline">{c.case_number}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-text-primary">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{TYPE_ICONS[c.case_type] || '📁'}</span>
                          <span>{TYPE_LABELS[c.case_type] || c.case_type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[c.status] || 'border-text-muted/30 text-text-muted'}`}>
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-text-primary max-w-[260px] truncate" title={c.suspects_summary || ''}>
                        {c.suspects_summary || <span className="text-text-muted/60">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="inline-flex items-center gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/cases/${c.id}`); }}
                            className="text-accent-cyan hover:underline text-sm font-medium"
                          >
                            Open
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, c)}
                            className="text-text-muted hover:text-red-400 transition-colors"
                            title="Delete case"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-text-muted bg-background/40 border-t border-accent-cyan/10 flex items-center justify-between">
              <span>{sorted.length} of {cases.length} {cases.length === 1 ? 'case' : 'cases'}</span>
              <span>Sorted by {sortKey.replace('_', ' ')} ({sortDir})</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ACCENT_STYLES: Record<string, { ring: string; icon: string; iconBg: string }> = {
  cyan:    { ring: 'border-accent-cyan/30',    icon: 'text-accent-cyan',    iconBg: 'bg-accent-cyan/10' },
  success: { ring: 'border-status-success/30', icon: 'text-status-success', iconBg: 'bg-status-success/10' },
  muted:   { ring: 'border-text-muted/30',     icon: 'text-text-muted',     iconBg: 'bg-text-muted/10' },
  pink:    { ring: 'border-accent-pink/30',    icon: 'text-accent-pink',    iconBg: 'bg-accent-pink/10' },
};

const StatCard: React.FC<{ label: string; value: number; accent: 'cyan' | 'success' | 'muted' | 'pink'; iconPath: string }> = ({
  label,
  value,
  accent,
  iconPath,
}) => {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`bg-panel border ${s.ring} rounded-lg p-4 flex items-center justify-between`}>
      <div>
        <div className="text-sm text-text-muted">{label}</div>
        <div className="text-3xl font-bold text-text-primary mt-1">{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-lg ${s.iconBg} ${s.icon} flex items-center justify-center`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
    </div>
  );
};
