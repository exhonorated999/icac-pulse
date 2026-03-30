import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Case {
  id: number;
  case_number: string;
  case_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function CasesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const allCases = await window.electronAPI.getAllCases();
      console.log('Loaded cases:', allCases);
      setCases(allCases || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
      alert('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-status-success/20 text-status-success',
      warrants_issued: 'bg-status-warning/20 text-status-warning',
      ready_residential: 'bg-accent-cyan/20 text-accent-cyan',
      arrest: 'bg-accent-pink/20 text-accent-pink',
      closed_no_arrest: 'bg-text-muted/20 text-text-muted',
      referred: 'bg-text-muted/20 text-text-muted',
    };
    return colors[status] || 'bg-text-muted/20 text-text-muted';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Open',
      warrants_issued: 'Warrants Issued',
      ready_residential: 'Ready for Residential',
      arrest: 'Arrest',
      closed_no_arrest: 'Closed - No Arrest',
      referred: 'Referred',
    };
    return labels[status] || status;
  };

  const getCaseTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      cybertip: '🛡️',
      p2p: '🔗',
      chat: '💬',
      other: '📋',
    };
    return icons[type] || '📁';
  };

  const getCaseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cybertip: 'CyberTip',
      p2p: 'P2P',
      chat: 'Chat',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const filteredCases = cases.filter(c => {
    // Filter by type
    if (filter !== 'all' && c.case_type !== filter) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.case_number.toLowerCase().includes(query) ||
        c.case_type.toLowerCase().includes(query) ||
        c.status.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-primary text-lg">Loading cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-text-primary mb-2">All Cases</h1>
            <p className="text-text-muted">
              {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'} found
            </p>
          </div>
          <button
            onClick={() => navigate('/cases/new')}
            className="px-6 py-3 bg-accent-cyan text-background font-bold rounded-lg 
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Case
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by case number, type, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'cybertip', label: 'CyberTip' },
                { value: 'p2p', label: 'P2P' },
                { value: 'chat', label: 'Chat' },
                { value: 'other', label: 'Other' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setFilter(btn.value)}
                  className={`
                    px-4 py-2 rounded-lg transition-all font-medium
                    ${filter === btn.value
                      ? 'bg-accent-cyan text-background'
                      : 'bg-background text-text-muted hover:text-text-primary border border-accent-cyan/30'
                    }
                  `}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cases List */}
        {filteredCases.length === 0 ? (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No cases found</h3>
            <p className="text-text-muted mb-6">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Create your first case to get started'}
            </p>
            {!searchQuery && filter === 'all' && (
              <button
                onClick={() => navigate('/cases/new')}
                className="px-6 py-3 bg-accent-cyan text-background font-bold rounded-lg 
                         hover:bg-accent-cyan/90 transition-colors"
              >
                Create Your First Case
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCases.map((caseItem) => (
              <button
                key={caseItem.id}
                onClick={() => navigate(`/cases/${caseItem.id}`)}
                className="w-full bg-panel border border-accent-cyan/20 rounded-lg p-6 
                         hover:border-accent-cyan hover:bg-accent-cyan/5 transition-all text-left
                         group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Icon */}
                    <div className="text-4xl group-hover:scale-110 transition-transform">
                      {getCaseTypeIcon(caseItem.case_type)}
                    </div>

                    {/* Case Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-text-primary group-hover:text-accent-cyan transition-colors">
                          {caseItem.case_number}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                          {getStatusLabel(caseItem.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span className="capitalize">{getCaseTypeLabel(caseItem.case_type)}</span>
                        <span>•</span>
                        <span>Created {new Date(caseItem.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Updated {new Date(caseItem.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-accent-cyan opacity-0 group-hover:opacity-100 
                               transform translate-x-2 group-hover:translate-x-0 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
