import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WaitingEspIcon, ArrestIcon, AllCasesIcon, ReadyResidentialIcon, GenerateReportIcon } from '../components/DashboardIcons';
import { ImportCaseDialog } from '../components/ImportCaseDialog';
import { useLicense } from '../lib/LicenseContext';
import { DemoExpiredBanner } from '../components/DemoExpiredBanner';

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

interface Todo {
  id: number;
  case_id?: number;
  case_number?: string;
  content: string;
  due_date?: string;
  file_path?: string;
  file_name?: string;
  completed: number;
  created_at: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { canCreate, status: licenseStatus } = useLicense();
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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ content: '', dueDate: '', file: null as File | null });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [invFilter, setInvFilter] = useState('open');
  const [showInvFilter, setShowInvFilter] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('=== FRONTEND: Loading dashboard data ===');
      const dashboardStats = await window.electronAPI.getDashboardStats();
      console.log('=== FRONTEND: Received dashboard stats ===');
      console.log('Raw response:', dashboardStats);
      console.log('Type of response:', typeof dashboardStats);
      console.log('Is array?', Array.isArray(dashboardStats));
      console.log('Stats keys:', Object.keys(dashboardStats));
      console.log('Total value:', dashboardStats.total, 'Type:', typeof dashboardStats.total);
      console.log('Cybertip value:', dashboardStats.cybertip, 'Type:', typeof dashboardStats.cybertip);
      console.log('Arrests value:', dashboardStats.arrests, 'Type:', typeof dashboardStats.arrests);
      console.log('Closed value:', dashboardStats.closed, 'Type:', typeof dashboardStats.closed);
      console.log('Transferred value:', dashboardStats.transferred, 'Type:', typeof dashboardStats.transferred);
      console.log('WarrantsIssued value:', dashboardStats.warrantsIssued, 'Type:', typeof dashboardStats.warrantsIssued);
      
      console.log('=== FRONTEND: Setting stats state ===');
      setStats(dashboardStats);
      
      // Overdue warrants are included in dashboard stats
      setOverdueWarrants(dashboardStats.overdueWarrants || []);
      
      const cases = await window.electronAPI.getAllCases();
      console.log('Total cases loaded:', cases?.length);
      setAllCases(cases || []);

      // Load todos
      const todosList = await window.electronAPI.getTodos();
      setTodos(todosList || []);
      
      console.log('=== FRONTEND: Dashboard data loaded successfully ===');
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
      // Special case: "Closed Cases" includes closed_no_arrest, arrest, and referred (transferred)
      if (filterValue === 'closed_no_arrest') {
        filtered = allCases.filter(c => c.status === 'closed_no_arrest' || c.status === 'arrest' || c.status === 'referred');
      } else {
        filtered = allCases.filter(c => c.status === filterValue);
      }
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

  // Task management functions
  const handleAddTask = async () => {
    if (!newTask.content.trim()) {
      alert('Please enter task description');
      return;
    }

    try {
      let filePath = null;
      let fileName = null;

      // If file is selected, upload it first
      if (newTask.file) {
        const result = await window.electronAPI.openFolderDialog({
          title: 'Select Destination for Task File',
          buttonLabel: 'Save Here'
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return; // User cancelled
        }

        const destPath = result.filePaths[0];
        fileName = newTask.file.name;
        
        // For now, store the file name - actual file handling would require more setup
        // In production, you'd upload the file to a tasks folder
        filePath = `tasks/${fileName}`;
      }

      await window.electronAPI.addTodo({
        content: newTask.content,
        dueDate: newTask.dueDate || null,
        filePath: filePath,
        fileName: fileName
      });

      // Reload todos
      const todosList = await window.electronAPI.getTodos();
      setTodos(todosList || []);

      // Reset form
      setNewTask({ content: '', dueDate: '', file: null });
      setShowAddTask(false);
      
      alert('Task added successfully!');
    } catch (error) {
      console.error('Failed to add task:', error);
      alert(`Failed to add task: ${error}`);
    }
  };

  const handleToggleTask = async (todoId: number, completed: boolean) => {
    try {
      await window.electronAPI.updateTodo(todoId, { completed: !completed });
      
      // Reload todos
      const todosList = await window.electronAPI.getTodos();
      setTodos(todosList || []);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (todoId: number) => {
    if (!confirm('Delete this task?')) return;

    try {
      await window.electronAPI.deleteTodo(todoId);
      
      // Reload todos
      const todosList = await window.electronAPI.getTodos();
      setTodos(todosList || []);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewTask({ ...newTask, file: e.target.files[0] });
    }
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
  const clearanceRate = (stats?.total ?? 0) > 0 
    ? Math.round(((stats?.arrests ?? 0) / (stats?.total ?? 1)) * 100) 
    : 0;

  // Calculate average wait time for warrants
  const avgWaitDays = overdueWarrants.length > 0
    ? Math.round(overdueWarrants.reduce((sum, w) => sum + w.days_overdue, 0) / overdueWarrants.length)
    : 4; // Default placeholder

  // Calculate case distribution percentages
  const totalCases = (stats?.total ?? 0) || 1;
  const caseDistribution = [
    { type: 'cybertip', count: stats?.cybertip ?? 0, percentage: ((stats?.cybertip ?? 0) / totalCases) * 100, color: '#00D4FF' },
    { type: 'p2p', count: stats?.p2p ?? 0, percentage: ((stats?.p2p ?? 0) / totalCases) * 100, color: '#7B68EE' },
    { type: 'chat', count: stats?.chat ?? 0, percentage: ((stats?.chat ?? 0) / totalCases) * 100, color: '#39FFA0' },
    { type: 'other', count: stats?.other ?? 0, percentage: ((stats?.other ?? 0) / totalCases) * 100, color: '#FFB800' }
  ];

  console.log('Rendering dashboard with stats:', stats);
  console.log('Total cases for display:', stats.total);
  console.log('Arrests for display:', stats.arrests);
  console.log('Warrants issued:', stats.warrantsIssued);

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Dashboard</h1>
          <p className="text-text-muted">Welcome back, Officer</p>
        </div>
        
        <div className="flex items-center gap-4">
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

          {/* Import Case Button */}
          <button
            onClick={() => canCreate ? setShowImportDialog(true) : navigate('/settings')}
            className={`px-6 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              canCreate
                ? 'bg-accent-pink text-background hover:bg-accent-pink/90'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {!canCreate && <span>🔒</span>}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m4-4v12"/>
            </svg>
            Import Case
          </button>

          {/* New Case Button */}
          {canCreate ? (
            <Link
              to="/cases/new"
              className="px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              New Case
            </Link>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-2.5 bg-gray-600 text-gray-400 font-semibold rounded-lg cursor-not-allowed flex items-center gap-2"
            >
              <span>🔒</span>
              New Case
            </button>
          )}
        </div>
      </div>

      {licenseStatus.state === 'demo_expired' && <DemoExpiredBanner />}

      {/* KPI Ribbon - 4 Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* New Cases This Month */}
        <button
          onClick={() => {
            // Filter cases created this month
            const thisMonthCases = allCases.filter(c => {
              const caseDate = new Date(c.created_at);
              const now = new Date();
              return caseDate.getMonth() === now.getMonth() && caseDate.getFullYear() === now.getFullYear();
            });
            setFilteredCases(thisMonthCases);
            setFilterLabel('New Cases This Month');
            setShowCasesList(true);
          }}
          className="kpi-card group relative overflow-hidden bg-gradient-to-br from-cyan-500/10 to-cyan-600/20 
                   border border-cyan-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">New Cases This Month</p>
              <p className="text-4xl font-bold text-cyan-400">{stats?.newCasesThisMonth ?? 0}</p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center text-4xl">
              ➕
            </div>
          </div>
          <p className="text-text-muted text-xs">
            <span className="text-cyan-400">↑</span> {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </button>

        {/* Waiting on E.S.P. */}
        <button
          onClick={() => handleStatClick('status', 'warrants_issued', 'Waiting on E.S.P.')}
          className="kpi-card group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 to-yellow-600/20 
                   border border-yellow-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Waiting on E.S.P.</p>
              <p className="text-4xl font-bold text-yellow-400">{stats?.warrantsIssued ?? 0}</p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <WaitingEspIcon className="w-full h-full" />
            </div>
          </div>
          <p className="text-text-muted text-xs">Avg Wait: {avgWaitDays} days</p>
        </button>

        {/* Arrests Made */}
        <button
          onClick={() => handleStatClick('status', 'arrest', 'Arrests Made')}
          className="kpi-card group relative overflow-hidden bg-gradient-to-br from-pink-500/10 to-pink-600/20 
                   border border-pink-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Arrests Made</p>
              <p className="text-4xl font-bold text-pink-400">{stats?.arrests ?? 0}</p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <ArrestIcon className="w-full h-full" />
            </div>
          </div>
          <p className="text-text-muted text-xs">
            <span className="text-pink-400">↓</span> Critical milestone
          </p>
        </button>

        {/* Ready for Residential */}
        <button
          onClick={() => handleStatClick('status', 'ready_residential', 'Ready for Residential')}
          className="kpi-card group relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-600/20 
                   border border-green-500/30 rounded-xl p-6 hover:scale-[1.02] transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-muted text-sm mb-1">Ready Residential</p>
              <p className="text-4xl font-bold text-green-400">{stats?.readyResidential ?? 0}</p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center">
              <ReadyResidentialIcon className="w-full h-full" />
            </div>
          </div>
          <p className="text-text-muted text-xs">
            <span className="text-green-400">→</span> Ready for action
          </p>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Case Analytics & Active Investigations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Distribution & Overdue Warrants */}
          <div className="dashboard-section bg-panel border border-accent-cyan/20 rounded-xl p-6">
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
                        <p className="text-3xl font-bold text-text-primary">{stats?.total ?? 0}</p>
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

              {/* Overdue Warrants - Moved Here */}
              <div>
                <p className="text-text-muted text-sm mb-4">Warrant Alerts</p>
                {overdueWarrants.length > 0 ? (
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#30363d #0d1117' }}>
                    {overdueWarrants.map((warrant) => (
                      <button
                        key={warrant.id}
                        onClick={() => navigate(`/cases/${warrant.case_id}?tab=warrants`)}
                        className="w-full text-left bg-pink-500/10 border border-pink-500/30 p-3 rounded-lg 
                                 hover:bg-pink-500/20 transition-colors"
                      >
                        <p className="text-text-primary font-medium text-sm mb-1">
                          {warrant.company_name}
                        </p>
                        <p className="text-text-muted text-xs mb-1">
                          Case {warrant.case_number}
                        </p>
                        <p className="text-pink-400 text-xs font-medium">
                          ⚠️ {warrant.days_overdue} days overdue
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                    <span className="text-4xl mb-2 block">✓</span>
                    <p className="text-green-400 font-medium">All Clear</p>
                    <p className="text-text-muted text-xs mt-1">No overdue warrants</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Investigations Table */}
          <div className="dashboard-section bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">
                {invFilter === 'all' ? 'All' : invFilter === 'open' ? 'Active' : invFilter === 'closed_no_arrest' ? 'Closed' : invFilter === 'transferred' ? 'Transferred' : 'Arrest'} Investigations
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowInvFilter(f => !f)}
                    className="p-2 hover:bg-background rounded-lg transition-colors"
                    title="Filter investigations"
                  >
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {invFilter !== 'all' && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-cyan rounded-full" />
                    )}
                  </button>
                  {showInvFilter && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-panel border border-accent-cyan/20 rounded-lg shadow-xl z-50 py-1">
                      {[
                        { key: 'all', label: 'All Cases' },
                        { key: 'open', label: 'Active' },
                        { key: 'closed_no_arrest', label: 'Closed' },
                        { key: 'transferred', label: 'Transferred' },
                        { key: 'arrest', label: 'Arrest' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => { setInvFilter(opt.key); setShowInvFilter(false); }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            invFilter === opt.key
                              ? 'text-accent-cyan bg-accent-cyan/10 font-medium'
                              : 'text-text-muted hover:text-text-primary hover:bg-background/50'
                          }`}
                        >
                          {opt.label}
                          {invFilter === opt.key && <span className="float-right">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/cases')}
                  className="px-4 py-2 text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-colors text-sm"
                >
                  View All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#30363d #0d1117' }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-panel z-10">
                  <tr className="border-b border-accent-cyan/20">
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Case ID</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Category</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Investigator</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Status</th>
                    <th className="text-left text-text-muted text-sm font-medium pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allCases.filter(c => {
                    if (invFilter === 'all') return true;
                    if (invFilter === 'open') return c.status === 'open' || c.status === 'warrants_issued';
                    if (invFilter === 'closed_no_arrest') return c.status === 'closed_no_arrest';
                    if (invFilter === 'transferred') return c.status === 'transferred';
                    if (invFilter === 'arrest') return c.status === 'arrest';
                    return c.status === 'open' || c.status === 'warrants_issued';
                  }).map((caseItem) => {
                    const isWaitingWarrants = caseItem.status === 'warrants_issued';
                    const statusLabel = caseItem.status === 'open' ? 'Active'
                      : caseItem.status === 'warrants_issued' ? 'Waiting ESP'
                      : caseItem.status === 'closed_no_arrest' ? 'Closed'
                      : caseItem.status === 'transferred' ? 'Transferred'
                      : caseItem.status === 'arrest' ? 'Arrest'
                      : caseItem.status;
                    const statusColor = caseItem.status === 'open' ? 'bg-green-500/20 text-green-400'
                      : caseItem.status === 'warrants_issued' ? 'bg-yellow-500/20 text-yellow-400'
                      : caseItem.status === 'closed_no_arrest' ? 'bg-gray-500/20 text-gray-400'
                      : caseItem.status === 'transferred' ? 'bg-blue-500/20 text-blue-400'
                      : caseItem.status === 'arrest' ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400';
                    return (
                      <tr 
                        key={caseItem.id} 
                        className={`border-b border-accent-cyan/10 hover:bg-background/50 ${
                          isWaitingWarrants ? 'ring-2 ring-yellow-500/30 bg-yellow-500/5' : ''
                        }`}
                      >
                        <td className="py-3 text-text-primary font-medium">{caseItem.case_number}</td>
                        <td className="py-3 text-text-primary">{getCaseTypeLabel(caseItem.case_type)}</td>
                        <td className="py-3 text-text-primary">Officer</td>
                        <td className="py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                            {statusLabel}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Quick Stats & Tasks */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="dashboard-section bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Quick Stats</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => handleStatClick('status', 'open', 'Open Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Open Cases</span>
                <span className="text-text-primary font-bold">{stats?.active ?? 0}</span>
              </button>
              
              <button
                onClick={() => handleStatClick('status', 'closed_no_arrest', 'Closed Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Closed Cases</span>
                <span className="text-text-primary font-bold">{stats?.closed ?? 0}</span>
              </button>
              
              <button
                onClick={() => handleStatClick('status', 'referred', 'Transferred Cases')}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Transferred Cases</span>
                <span className="text-text-primary font-bold">{stats?.transferred ?? 0}</span>
              </button>
              
              <button
                onClick={() => {
                  alert(`${stats?.warrantsThisMonth ?? 0} warrants written in ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
                }}
                className="flex justify-between items-center w-full hover:bg-background/50 p-2 rounded-lg transition-colors"
              >
                <span className="text-text-muted text-sm">Warrants This Month</span>
                <span className="text-text-primary font-bold">{stats?.warrantsThisMonth ?? 0}</span>
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="dashboard-section bg-panel border border-accent-cyan/20 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-text-primary">Tasks</h3>
              <button
                onClick={() => setShowAddTask(true)}
                className="px-3 py-1.5 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                         transition-colors text-sm font-medium flex items-center gap-1"
              >
                <span>+</span>
                Add Task
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">No tasks yet</p>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      todo.completed
                        ? 'bg-accent-cyan/5 border-accent-cyan/20 opacity-60'
                        : 'bg-accent-cyan/5 border-accent-cyan/30 hover:border-accent-cyan/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(todo.completed)}
                        onChange={() => handleToggleTask(todo.id, Boolean(todo.completed))}
                        className="mt-1 w-4 h-4 rounded border-accent-cyan/30 bg-background 
                                 checked:bg-accent-cyan checked:border-accent-cyan cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${
                          todo.completed 
                            ? 'text-text-muted line-through' 
                            : 'text-text-primary'
                        }`}>
                          {todo.content}
                        </p>
                        {todo.due_date && (
                          <p className="text-xs text-text-muted mt-1">
                            Due: {new Date(todo.due_date).toLocaleDateString()}
                          </p>
                        )}
                        {todo.case_number && (
                          <p className="text-xs text-accent-cyan mt-1">
                            Case: {todo.case_number}
                          </p>
                        )}
                        {todo.file_name && (
                          <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                            📎 {todo.file_name}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTask(todo.id)}
                        className="text-accent-pink hover:text-accent-pink/80 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Generate Report Button */}
          <button
            onClick={() => setShowReportDialog(true)}
            className="w-full px-6 py-4 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan 
                     font-semibold rounded-xl hover:bg-accent-cyan/20 transition-colors flex items-center justify-center gap-3"
          >
            <div className="w-6 h-6">
              <GenerateReportIcon className="w-full h-full" />
            </div>
            Generate Report
          </button>
        </div>
      </div>

      {/* Add Task Dialog */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal-content bg-panel border border-accent-cyan/30 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-text-primary mb-4">Add New Task</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Task Description *
                </label>
                <textarea
                  value={newTask.content}
                  onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                           text-text-primary focus:outline-none focus:border-accent-cyan min-h-[100px]"
                  placeholder="Enter task description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Attach File (Optional - e.g., subpoena PDF)
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                           text-text-primary focus:outline-none focus:border-accent-cyan file:mr-4 file:py-2 file:px-4
                           file:rounded-lg file:border-0 file:text-sm file:font-semibold
                           file:bg-accent-cyan file:text-background hover:file:bg-accent-cyan/90"
                />
                {newTask.file && (
                  <p className="text-sm text-text-muted mt-2">
                    Selected: {newTask.file.name}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddTask(false);
                    setNewTask({ content: '', dueDate: '', file: null });
                  }}
                  className="flex-1 px-4 py-2 bg-background border border-accent-cyan/20 text-text-primary 
                           rounded-lg hover:bg-background/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={!newTask.content.trim()}
                  className="flex-1 px-4 py-2 bg-accent-cyan text-background font-semibold rounded-lg 
                           hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtered Cases Modal */}
      {showCasesList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal-content bg-panel border border-accent-cyan/30 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
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
      {/* Import Case Dialog */}
      {showImportDialog && (
        <ImportCaseDialog
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            setShowImportDialog(false);
            loadDashboardData(); // Reload dashboard after successful import
          }}
        />
      )}

      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="modal-content bg-panel border border-accent-cyan/30 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-text-primary mb-4">Generate Dashboard Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    placeholder="MM/DD/YYYY"
                    className="w-full pl-4 pr-12 py-3 bg-background border border-accent-cyan/30 rounded-lg 
                             text-text-primary focus:outline-none focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/50
                             [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute 
                             [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full 
                             [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Click the calendar icon or type date (MM/DD/YYYY)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  End Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    placeholder="MM/DD/YYYY"
                    className="w-full pl-4 pr-12 py-3 bg-background border border-accent-cyan/30 rounded-lg 
                             text-text-primary focus:outline-none focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/50
                             [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute 
                             [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full 
                             [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Click the calendar icon or type date (MM/DD/YYYY)
                </p>
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
