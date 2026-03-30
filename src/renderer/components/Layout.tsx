import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { AllCasesIcon, SettingsIcon } from './DashboardIcons';
import { ThemeToggle } from './ThemeToggle';
import { MediaPlayer } from './MediaPlayer';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
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

export function Layout({ children, user }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaEnabled, setMediaEnabled] = useState(() => localStorage.getItem('mediaPlayerEnabled') === 'true');

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center">
              <span className="text-accent-cyan font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-text-muted">Officer</p>
            </div>
          </div>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
