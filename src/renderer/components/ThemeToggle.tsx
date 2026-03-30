import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (newTheme: 'dark' | 'light') => {
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-mode');
      document.body.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.body.classList.remove('light-mode');
    }
  };

  const handleToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 w-full p-2 rounded-lg bg-background hover:bg-accent-cyan/10 
                 transition-colors group"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* Icon container */}
      <div className="relative w-10 h-6 bg-accent-cyan/20 rounded-full transition-colors group-hover:bg-accent-cyan/30">
        {/* Sliding toggle */}
        <div 
          className={`absolute top-1 w-4 h-4 bg-accent-cyan rounded-full transition-all duration-300 shadow-lg
                     ${theme === 'dark' ? 'left-1' : 'left-5'}`}
        />
        
        {/* Moon icon (dark mode) */}
        <svg 
          className={`absolute left-1 top-1 w-4 h-4 transition-opacity duration-300
                     ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
        
        {/* Sun icon (light mode) */}
        <svg 
          className={`absolute right-1 top-1 w-4 h-4 transition-opacity duration-300
                     ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      </div>
      
      {/* Label */}
      <div className="flex-1 text-left">
        <p className="text-xs font-medium text-text-primary group-hover:text-accent-cyan transition-colors">
          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </p>
      </div>
    </button>
  );
}
