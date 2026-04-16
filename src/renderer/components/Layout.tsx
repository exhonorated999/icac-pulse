import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Logo } from './Logo';
import { AllCasesIcon, SettingsIcon } from './DashboardIcons';
import { ThemeToggle } from './ThemeToggle';
import { MediaPlayer } from './MediaPlayer';
import { ResourceDrawer } from './ResourceDrawer';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
}

/* ── Sidebar user info panel — reads profile from localStorage ── */
function UserInfoSidebar({ user }: { user: any }) {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('userProfile_fullName') || user?.username || 'User');
  const [role] = useState('Officer');

  useEffect(() => {
    const onUpdate = () => {
      setDisplayName(localStorage.getItem('userProfile_fullName') || user?.username || 'User');
    };
    window.addEventListener('userProfileUpdated', onUpdate);
    return () => window.removeEventListener('userProfileUpdated', onUpdate);
  }, [user]);

  const initials = displayName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-accent-cyan flex items-center justify-center">
        <span className="text-background font-bold text-sm">{initials}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{displayName}</p>
        <p className="text-xs text-text-muted">{role}</p>
      </div>
    </div>
  );
}

// Neon Dashboard Icon Component (Orange Glow)
const DashboardIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="dashboard-icon"
  >
    <defs>
      <filter id="glow-orange">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Outer border */}
    <rect x="2" y="2" width="20" height="20" rx="2" stroke="#FFB800" strokeWidth="1.5" fill="none" filter="url(#glow-orange)"/>
    {/* Grid of 9 squares (3x3) */}
    {/* Top row */}
    <rect x="4.5" y="4.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="10" y="4.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="15.5" y="4.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    {/* Middle row */}
    <rect x="4.5" y="10" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="10" y="10" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="15.5" y="10" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    {/* Bottom row */}
    <rect x="4.5" y="15.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="10" y="15.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
    <rect x="15.5" y="15.5" width="4" height="4" rx="1" stroke="#FFB800" strokeWidth="1.2" fill="none" filter="url(#glow-orange)"/>
  </svg>
);

// Neon Create Case Icon Component (Purple Glow)
const CreateCaseIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="create-case-icon"
  >
    <defs>
      <filter id="glow-purple">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Document outline */}
    <path 
      d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" 
      stroke="#9D4EDD" 
      strokeWidth="1.5" 
      fill="none" 
      filter="url(#glow-purple)"
    />
    {/* Folded corner */}
    <path 
      d="M14 2V8H20" 
      stroke="#9D4EDD" 
      strokeWidth="1.5" 
      fill="none" 
      filter="url(#glow-purple)"
    />
    {/* Plus sign */}
    <line 
      x1="12" y1="10" x2="12" y2="18" 
      stroke="#9D4EDD" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      filter="url(#glow-purple)"
    />
    <line 
      x1="8" y1="14" x2="16" y2="14" 
      stroke="#9D4EDD" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      filter="url(#glow-purple)"
    />
  </svg>
);

// Neon Public Outreach Icon Component (Green Glow)
const OutreachIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="outreach-icon"
  >
    <defs>
      <filter id="glow-green">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Group of people */}
    <circle cx="8" cy="8" r="3" stroke="#39FFA0" strokeWidth="1.5" fill="none" filter="url(#glow-green)"/>
    <path d="M2 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#39FFA0" strokeWidth="1.5" strokeLinecap="round" filter="url(#glow-green)"/>
    <circle cx="16" cy="8" r="3" stroke="#39FFA0" strokeWidth="1.5" fill="none" filter="url(#glow-green)"/>
    <path d="M14 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#39FFA0" strokeWidth="1.5" strokeLinecap="round" filter="url(#glow-green)"/>
  </svg>
);

// Neon Resources Icon Component (Teal Glow)
const ResourcesIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="resources-icon"
  >
    <defs>
      <filter id="glow-teal">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Stack of books/folders */}
    <path d="M3 6h18v12H3V6z" stroke="#00D4FF" strokeWidth="1.5" fill="none" filter="url(#glow-teal)"/>
    <path d="M3 10h18" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-teal)"/>
    <path d="M3 14h18" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-teal)"/>
    <circle cx="12" cy="12" r="2" stroke="#00D4FF" strokeWidth="1.5" fill="none" filter="url(#glow-teal)"/>
  </svg>
);

// Neon Offense Reference Icon Component (Red/Pink Glow)
const OffenseIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="offense-icon"
  >
    <defs>
      <filter id="glow-red">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Gavel/Legal symbol */}
    <path d="M3 21h18" stroke="#FF2A6D" strokeWidth="1.5" strokeLinecap="round" filter="url(#glow-red)"/>
    <path d="M6 18v-3l4-4 6 6-4 4h-3" stroke="#FF2A6D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-red)"/>
    <path d="M14.5 6.5l3-3" stroke="#FF2A6D" strokeWidth="1.5" strokeLinecap="round" filter="url(#glow-red)"/>
    <rect x="13" y="4" width="5" height="4" rx="1" stroke="#FF2A6D" strokeWidth="1.5" fill="none" filter="url(#glow-red)"/>
  </svg>
);

/* ── Bug Report Modal ── */
function BugReportModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Read registration for API key and reporter name
      let apiKey = '';
      let reporterName = '';
      try {
        const reg = JSON.parse(localStorage.getItem('icac_registration') || '{}');
        apiKey = reg.apiKey || '';
        reporterName = reg.name || '';
      } catch {}
      const res = await (window as any).electronAPI.submitBugReport({
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: steps.trim(),
        severity,
        apiKey,
        reporterName,
      });
      setResult({ success: true, message: `Bug report submitted successfully${res?.bug_id ? ` (ID: ${res.bug_id})` : ''}.` });
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setResult({ success: false, message: err?.message || 'Failed to submit bug report. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-panel border border-accent-cyan/30 rounded-xl shadow-2xl w-full max-w-lg mx-4
                      shadow-accent-cyan/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-accent-cyan/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-3.83-7.94M12 12.75c-2.883 0-5.647.508-8.207 1.44a23.91 23.91 0 003.83-7.94M12 12.75V8.25m0-4.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Report a Bug</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Title *</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              required
              placeholder="Brief summary of the issue"
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm
                         placeholder-text-muted focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/20"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm
                         focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/20"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Describe what happened..."
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm
                         placeholder-text-muted focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/20 resize-none"
            />
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Steps to Reproduce</label>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm
                         placeholder-text-muted focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/20 resize-none"
            />
          </div>

          {/* Result Message */}
          {result && (
            <div className={`text-sm px-3 py-2 rounded-lg ${result.success
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="px-5 py-2 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg text-sm font-medium
                         hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Layout({ children, user }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaEnabled, setMediaEnabled] = useState(() => localStorage.getItem('mediaPlayerEnabled') === 'true');
  const [bugModalOpen, setBugModalOpen] = useState(false);

  // Listen for settings toggle and boss-key (Ctrl+Alt+M)
  useEffect(() => {
    const onSettingsToggle = () => setMediaEnabled(localStorage.getItem('mediaPlayerEnabled') === 'true');
    window.addEventListener('mediaPlayerToggle', onSettingsToggle);

    const onBossKey = () => {
      setMediaEnabled(prev => {
        const next = !prev;
        localStorage.setItem('mediaPlayerEnabled', String(next));
        return next;
      });
    };
    window.electronAPI.onToggleMediaPlayer(onBossKey);

    return () => {
      window.removeEventListener('mediaPlayerToggle', onSettingsToggle);
      window.electronAPI.removeToggleMediaPlayerListener(onBossKey);
    };
  }, []);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/cases/new', label: 'Create Case', icon: 'create' },
    { path: '/cases', label: 'All Cases', icon: 'allcases' },
    { path: '/outreach', label: 'Public Outreach', icon: 'outreach' },
    { path: '/resources', label: 'Resources', icon: 'resources' },
    { path: '/offense-reference', label: 'Offense Reference', icon: 'offense' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-panel border-r border-accent-cyan/20 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-accent-cyan/20">
          <Logo size="small" showFullText={true} />
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-accent-cyan/20">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="w-full px-3 py-2 pl-10 bg-background border border-accent-cyan/30 rounded-lg 
                       text-text-primary text-sm placeholder-text-muted
                       focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/20"
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent-cyan transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Navigation Menu */}
        <nav className={`p-4 space-y-2 ${mediaEnabled ? 'flex-shrink-0' : 'flex-1'} overflow-y-auto`}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-active={isActive}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${isActive 
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30' 
                    : 'text-text-muted hover:bg-accent-cyan/5 hover:text-text-primary'
                  }
                `}
              >
                {item.icon === 'dashboard' ? (
                  <DashboardIcon />
                ) : item.icon === 'create' ? (
                  <CreateCaseIcon />
                ) : item.icon === 'outreach' ? (
                  <OutreachIcon />
                ) : item.icon === 'resources' ? (
                  <ResourcesIcon />
                ) : item.icon === 'offense' ? (
                  <OffenseIcon />
                ) : item.icon === 'allcases' ? (
                  <div className="w-6 h-6">
                    <AllCasesIcon className="w-full h-full" />
                  </div>
                ) : item.icon === 'settings' ? (
                  <div className="w-6 h-6">
                    <SettingsIcon className="w-full h-full" />
                  </div>
                ) : (
                  <span className="text-xl">{item.icon}</span>
                )}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}

        </nav>

        {/* Inline Media Player — between nav and user info */}
        {mediaEnabled && (
          <MediaPlayer />
        )}

        {/* User Info & Theme Toggle */}
        <div className="p-4 border-t border-accent-cyan/20 space-y-3 flex-shrink-0">
          <UserInfoSidebar user={user} />

          {/* Report Bug */}
          <button
            onClick={() => setBugModalOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all
                       bg-amber-500/10 border border-amber-500/30 text-amber-400
                       hover:bg-amber-500/20 hover:border-amber-500/50"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="font-medium text-xs">Report a Bug</span>
          </button>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Investigative Resources Drawer */}
      <ResourceDrawer />

      {/* Bug Report Modal */}
      {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
    </div>
  );
}
