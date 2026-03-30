import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface Case {
  id: number;
  case_number: string;
  case_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface OverdueWarrant {
  id: number;
  case_id: number;
  case_number: string;
  company_name: string;
  date_due: string;
  days_overdue: number;
}

interface RecentActivity {
  case_number: string;
  case_type: string;
  activity: string;
  timestamp: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [showCasesList, setShowCasesList] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [overdueWarrants, setOverdueWarrants] = useState<OverdueWarrant[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const dashboardStats = await window.electronAPI.getDashboardStats();
      setStats(dashboardStats);
      
      const cases = await window.electronAPI.getAllCases();
      setAllCases(cases || []);
      
      // Load overdue warrants
      const warrants = await window.electronAPI.getOverdueWarrants();
      setOverdueWarrants(warrants || []);

      // Generate recent activity from cases
      if (cases && cases.length > 0) {
        const sorted = [...cases].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 5);
        
        const activity = sorted.map(c => ({
          case_number: c.case_number,
          case_type: c.case_type,
          activity: 'Updated',
          timestamp: c.updated_at
        }));
        setRecentActivity(activity);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatClick = (filterType: string, filterValue: string, label: string) => {
    let filtered: Case[] = [];
    
    if (filterType === 'all') {
      filtered = allCases;
    } else if (filterType === 'status') {
      filtered = allCases.filter(c => c.status === filterValue);
    } else if (filterType === 'type') {
      filtered = allCases.filter(c => c.case_type === filterValue);
    }
    
    setFilteredCases(filtered);
    setFilterLabel(label);
    setShowCasesList(true);
  };

  const handleDeleteCase = async (caseId: number, caseNumber: string) => {
    const confirmed = confirm(
      `⚠️ WARNING: DELETE CASE ${caseNumber}\n\n` +
      `This will permanently delete:\n` +
      `• All case data in the database\n` +
      `• All case evidence files\n` +
      `• All warrant files\n` +
      `• All suspect photos\n` +
      `• All related records\n\n` +
      `This action CANNOT be undone!\n\n` +
      `It is STRONGLY RECOMMENDED to export the case before deletion.\n\n` +
      `This feature is intended for deleting training cases only.\n\n` +
      `Do you wish to continue?`
    );

    if (!confirmed) {
      return;
    }

    const userInput = prompt(`Please type the case number "${caseNumber}" to confirm deletion:`);
    
    if (userInput !== caseNumber) {
      alert('Case number did not match. Deletion cancelled.');
      return;
    }

    try {
      await window.electronAPI.deleteCase(caseId);
      alert(`Case ${caseNumber} has been permanently deleted.`);
      
      await loadDashboardData();
      setShowCasesList(false);
    } catch (error) {
      console.error('Failed to delete case:', error);
      alert(`Failed to delete case: ${error}`);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Open',
      warrants_issued: 'Warrants Issued',
      ready_residential: 'Ready for Residential',
      arrest: 'Arrest',
      closed_no_arrest: 'Closed',
      referred: 'Transferred',
    };
    return labels[status] || status;
  };

  const getCaseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cybertip: 'CyberTip',
      p2p: 'Peer 2 Peer',
      chat: 'Chat',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getCaseTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      cybertip: '🛡️',
      p2p: '🔗',
      chat: '💬',
      other: '📋'
    };
    return icons[type] || '📋';
  };

  const handleGenerateReport = async () => {
    if (!reportDateFrom || !reportDateTo) {
      alert('Please select both start and end dates for the report');
      return;
    }

    const fromDate = new Date(reportDateFrom);
    const toDate = new Date(reportDateTo);

    if (fromDate > toDate) {
      alert('Start date must be before end date');
      return;
    }

    setGeneratingReport(true);

    try {
      await window.electronAPI.generateDashboardReport({
        dateFrom: reportDateFrom,
        dateTo: reportDateTo
      });

      setShowReportDialog(false);
      setReportDateFrom('');
      setReportDateTo('');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert(`Failed to generate report: ${error}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Failed to load dashboard data</div>
      </div>
    );
  }

  // Calculate metrics
  const clearanceRate = stats.total > 0 
    ? Math.round((stats.arrests / stats.total) * 100) 
    : 0;

  // Calculate average wait time for warrants
  const avgWaitDays = overdueWarrants.length > 0
    ? Math.round(overdueWarrants.reduce((sum, w) => sum + w.days_overdue, 0) / overdueWarrants.length)
    : 4; // Default placeholder

  // Calculate case distribution percentages
  const totalCases = stats.total || 1;
  const caseDistribution = [
    { type: 'cybertip', count: stats.cybertip, percentage: (stats.cybertip / totalCases) * 100, color: '#00D4FF' },
    { type: 'p2p', count: stats.p2p, percentage: (stats.p2p / totalCases) * 100, color: '#7B68EE' },
    { type: 'chat', count: stats.chat, percentage: (stats.chat / totalCases) * 100, color: '#39FFA0' },
    { type: 'other', count: stats.other, percentage: (stats.other / totalCases) * 100, color: '#FFB800' }
  ];

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Dashboard</h1>
          <p className="text-text-muted">Welcome back, Officer</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="px-4 py-2 bg-panel border border-accent-cyan/20 rounded-lg text-text-primary 
                       placeholder-text-muted focus:outline-none focus:border-accent-cyan w-64"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          </div>
          
          {/* Notification Bell */}
          <button className="relative p-2 hover:bg-panel rounded-lg transition-colors">
            <span className="text-2xl">🔔</span>
            {overdueWarrants.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent-pink text-background text-xs font-bold 
                           w-5 h-5 rounded-full flex items-center justify-center">
                {overdueWarrants.length}
              </span>
            )}
          </button>

          {/* New Case Button */}
          <Link
            to="/cases/new"
            className="px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg 
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            New Case
          </Link>
        </div>
      </div>

      {/* KPI Ribbon - 4 Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Cases */}
        <button
          onClick={() => handleStatClick('status', 'open', 'Active Cases')}
          className="group relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-600/20 
                   border border-green-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Active Cases</p>
              <p className="text-4xl font-bold text-green-400">{stats.active}</p>
            </div>
            <div className="text-green-400 text-3xl">
              📈
            </div>
          </div>
          <p className="text-text-muted text-xs">
            <span className="text-green-400">↑</span> {formatTime(allCases[0]?.updated_at || new Date().toISOString())}
          </p>
        </button>

        {/* Waiting on E.S.P. */}
        <button
          onClick={() => handleStatClick('status', 'warrants_issued', 'Waiting on E.S.P.')}
          className="group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 to-yellow-600/20 
                   border border-yellow-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Waiting on E.S.P.</p>
              <p className="text-4xl font-bold text-yellow-400">{stats.warrantsIssued}</p>
            </div>
            <div className="text-yellow-400 text-3xl">
              📊
            </div>
          </div>
          <p className="text-text-muted text-xs">Avg Wait: {avgWaitDays} days</p>
        </button>

        {/* Arrests Made */}
        <button
          onClick={() => handleStatClick('status', 'arrest', 'Arrests Made')}
          className="group relative overflow-hidden bg-gradient-to-br from-pink-500/10 to-pink-600/20 
                   border border-pink-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Arrests Made</p>
              <p className="text-4xl font-bold text-pink-400">{stats.arrests}</p>
            </div>
            <div className="text-pink-400 text-3xl">
              🎯
            </div>
          </div>
          <p className="text-text-muted text-xs">
            <span className="text-pink-400">↓</span> Critical milestone
          </p>
        </button>

        {/* Clearance Rate */}
        <div
          className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 to-cyan-600/20 
                   border border-cyan-500/30 rounded-xl p-6"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Clearance Rate</p>
              <p className="text-4xl font-bold text-cyan-400">{clearanceRate}%</p>
            </div>
            <div className="text-cyan-400 text-3xl">
              ⚖️
            </div>
          </div>
          <div className="w-full bg-background/50 rounded-full h-2">
            <div 
              className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${clearanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Analytics - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Distribution & New Cases Chart */}
          <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <h3 className="text-xl font-bold text-text-primary mb-6">Case Analytics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Case Distribution Donut */}
              <div>
                <p className="text-text-muted text-sm mb-4">Case Distribution</p>
                <div className="flex items-center justify-center gap-8">
                  {/* Donut Chart */}
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {caseDistribution.reduce((acc, item, index) => {
                        const prevPercentage = index === 0 ? 0 : 
                          caseDistribution.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
                        const circumference = 2 * Math.PI * 40;
                        const offset = circumference - (item.percentage / 100) * circumference;
                        const rotation = (prevPercentage / 100) * 360;
                        
                        return [
                          ...acc,
                          <circle
                            key={item.type}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={item.color}
                            strokeWidth="12"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            style={{
                              transformOrigin: '50% 50%',
                              transform: `rotate(${rotation}deg)`
                            }}
                            opacity="0.8"
                          />
                        ];
                      }, [] as JSX.Element[])}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-text-primary">{stats.total}</p>
                        <p className="text-xs text-text-muted">Total</p>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2">
                    {caseDistribution.map(item => (
                      <button
                        key={item.type}
                        onClick={() => handleStatClick('type', item.type, getCaseTypeLabel(item.type))}
                        className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-text-primary">
                          {getCaseTypeLabel(item.type)} ({item.count})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* New Cases Bar Chart */}
              <div>
                <p className="text-text-muted text-sm mb-4">New Cases / Month</p>
                <div className="flex items-end justify-around h-48 gap-2">
                  {/* Mock data - replace with actual monthly data */}
                  {[
                    { label: 'M01', value: 60 },
                    { label: 'J0', value: 75 },
                    { label: '24', value: 90 }
                  ].map((bar, index) => (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-gradient-to-t from-accent-cyan to-accent-cyan/50 rounded-t transition-all hover:opacity-80"
                        style={{ height: `${bar.value}%` }}
                      />
                      <p className="text-xs text-text-muted mt-2">{bar.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Investigations Table */}
          <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">Active Investigations</h3>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-background rounded-lg transition-colors">
                  <span className="text-text-muted">⚙️</span>
                </button>
                <button className="p-2 hover:bg-background rounded-lg transition-colors">
                  <span className="text-text-muted">🔔</span>
                </button>
                <button
                  onClick={() => navigate('/cases')}
                  className="px-4 py-2 text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-colors text-sm"
                >
                  View All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-accent-cyan/20">
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Case ID</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Category</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Investigator</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Status</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allCases.filter(c => c.status === 'open').slice(0, 5).map((caseItem) => (
                    <tr key={caseItem.id} className="border-b border-accent-cyan/10 hover:bg-background/50">
                      <td className="py-3 text-text-primary font-medium">{caseItem.case_number}</td>
                      <td className="py-3 text-text-primary">{getCaseTypeLabel(caseItem.case_type)}</td>
                      <td className="py-3 text-text-primary">Officer</td>
                      <td className="py-3">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          Active
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => navigate(`/cases/${caseItem.id}`)}
                          className="px-4 py-1.5 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                                   transition-colors text-sm font-medium"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Updates - Right sidebar */}
        <div className="space-y-6">
          {/* Recent Updates */}
          <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4">Recent Updates</h3>
            
            <div className="space-y-4">
              {recentActivity.slice(0, 5).map((activity, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const caseItem = allCases.find(c => c.case_number === activity.case_number);
                    if (caseItem) navigate(`/cases/${caseItem.id}`);
                  }}
                  className="flex items-start gap-3 w-full text-left hover:bg-background/50 p-3 rounded-lg transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${activity.case_type === 'cybertip' ? 'bg-cyan-500/20 text-cyan-400' : 
                      activity.case_type === 'p2p' ? 'bg-purple-500/20 text-purple-400' :
                      activity.case_type === 'chat' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'}`}
                  >
                    {getCaseTypeIcon(activity.case_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium mb-1">
                      Case {activity.case_number} - {getCaseTypeLabel(activity.case_type)}
                    </p>
                    <p className="text-text-muted text-xs">
                      {activity.activity} ({formatTime(activity.timestamp)})
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Overdue Warrants Alert */}
          {overdueWarrants.length > 0 && (
            <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/20 border border-pink-500/30 rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold text-pink-400">Overdue Warrants</h3>
              </div>
              
              <div className="space-y-3">
                {overdueWarrants.slice(0, 3).map((warrant) => (
                  <button
                    key={warrant.id}
                    onClick={() => navigate(`/cases/${warrant.case_id}?tab=warrants`)}
                    className="w-full text-left bg-background/50 p-3 rounded-lg hover:bg-background/70 transition-colors"
                  >
                    <p className="text-text-primary font-medium text-sm mb-1">
                      {warrant.company_name}
                    </p>
                    <p className="text-text-muted text-xs mb-1">
                      Case {warrant.case_number}
                    </p>
                    <p className="text-pink-400 text-xs font-medium">
                      {warrant.days_overdue} days overdue
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Quick Stats</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => handleStatClick('all', '', 'All Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Total Cases</span>
                <span className="text-text-primary font-bold">{stats.total}</span>
              </button>
              
              <button
                onClick={() => handleStatClick('status', 'closed_no_arrest', 'Closed Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Closed</span>
                <span className="text-text-primary font-bold">{stats.closed}</span>
              </button>
              
              <button
                onClick={() => handleStatClick('status', 'referred', 'Transferred Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Transferred</span>
                <span className="text-text-primary font-bold">{stats.transferred}</span>
              </button>
              
              <button
                onClick={() => handleStatClick('status', 'ready_residential', 'Ready for Residential')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Ready Residential</span>
                <span className="text-text-primary font-bold">{stats.readyResidential}</span>
              </button>
            </div>
          </div>

          {/* Generate Report Button */}
          <button
            onClick={() => setShowReportDialog(true)}
            className="w-full px-6 py-4 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan 
                     font-semibold rounded-xl hover:bg-accent-cyan/20 transition-colors flex items-center justify-center gap-2"
          >
            <span>📊</span>
            Generate Report
          </button>
        </div>
      </div>

      {/* Filtered Cases Modal */}
      {showCasesList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-accent-cyan/30 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">{filterLabel}</h3>
              <button
                onClick={() => setShowCasesList(false)}
                className="text-text-muted hover:text-text-primary text-2xl"
              >
                ×
              </button>
            </div>

            {filteredCases.length === 0 ? (
              <p className="text-text-muted text-center py-8">No cases found</p>
            ) : (
              <div className="space-y-3">
                {filteredCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="flex items-center justify-between p-4 bg-background border border-accent-cyan/20 
                             rounded-lg hover:border-accent-cyan/40 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-text-primary mb-1">
                        {caseItem.case_number} - {getCaseTypeLabel(caseItem.case_type)}
                      </p>
                      <p className="text-sm text-text-muted">
                        Status: {getStatusLabel(caseItem.status)} | Created: {formatDate(caseItem.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/cases/${caseItem.id}`)}
                        className="px-4 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                                 transition-colors text-sm font-medium"
                      >
                        View Case
                      </button>
                      <button
                        onClick={() => handleDeleteCase(caseItem.id, caseItem.case_number)}
                        className="px-4 py-2 bg-accent-pink/20 text-accent-pink border border-accent-pink/30 
                                 rounded-lg hover:bg-accent-pink/30 transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-accent-cyan/30 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-text-primary mb-4">Generate Dashboard Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowReportDialog(false)}
                  className="flex-1 px-4 py-2 bg-background border border-accent-cyan/20 text-text-primary 
                           rounded-lg hover:bg-background/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="flex-1 px-4 py-2 bg-accent-cyan text-background font-semibold rounded-lg 
                           hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                >
                  {generatingReport ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
