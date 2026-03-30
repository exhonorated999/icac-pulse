import { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<'loading' | 'register' | 'login'>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPortable, setIsPortable] = useState(false);

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      // Check if we're in portable mode
      const portable = await window.electronAPI.isPortableMode();
      setIsPortable(portable);
      
      // If not in portable mode, skip security
      if (!portable) {
        // Simulate a logged-in user for installed mode
        onLoginSuccess({ username: 'Officer', usbBound: false });
        return;
      }
      
      // Check if user is already registered
      const isRegistered = await window.electronAPI.isUserRegistered();
      setMode(isRegistered ? 'login' : 'register');
    } catch (error) {
      console.error('Failed to check registration status:', error);
      setError('Failed to initialize security system');
      setMode('register'); // Default to register if check fails
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await window.electronAPI.registerSecureUser(username, password);
      if (result.success !== false) {
        onLoginSuccess(result);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await window.electronAPI.loginUser(username, password);
      if (result.success !== false) {
        onLoginSuccess(result);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-panel to-background">
          <div className="stars-small"></div>
          <div className="stars-medium"></div>
        </div>
        <div className="text-center relative z-10">
          <div className="mb-8 animate-pulse-slow">
            <Logo size="large" showFullText={true} />
          </div>
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-primary text-lg">Initializing security system...</p>
        </div>
        {renderStyles()}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden">
      {/* Starfield background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-panel to-background">
        <div className="stars-small"></div>
        <div className="stars-medium"></div>
      </div>

      <div className="bg-panel p-8 rounded-lg shadow-2xl border border-accent-cyan/30 max-w-md w-full relative z-10 mx-4">
        <div className="text-center mb-8">
          <div className="mb-6">
            <Logo size="medium" showFullText={true} />
          </div>
          
          {isPortable && (
            <div className="mb-4 p-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-accent-cyan text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span className="font-semibold">Portable Mode Active</span>
              </div>
            </div>
          )}
          
          <div className="w-20 h-20 bg-accent-cyan/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mode === 'register' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              )}
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {mode === 'register' ? 'First-Time Setup' : 'Welcome Back'}
          </h1>
          <p className="text-text-muted">
            {mode === 'register' 
              ? 'Register your credentials to secure this USB installation' 
              : 'Login to access your case management system'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg">
            <p className="text-accent-pink text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg focus:outline-none focus:border-accent-cyan text-text-primary"
              placeholder="Enter your username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg focus:outline-none focus:border-accent-cyan text-text-primary"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg focus:outline-none focus:border-accent-cyan text-text-primary"
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'register' && isPortable && (
            <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4">
              <p className="text-sm text-text-muted">
                <span className="font-semibold text-accent-cyan">🔒 USB Security:</span> Your credentials will be bound to this USB drive. 
                The application will only work with this specific USB drive inserted.
              </p>
            </div>
          )}

          {mode === 'login' && (
            <div className="bg-panel-light/30 border border-accent-cyan/20 rounded-lg p-3">
              <p className="text-xs text-text-muted">
                <span className="font-semibold text-accent-cyan">Recovery:</span> Master password is <code className="bg-background px-1 py-0.5 rounded">Ipreventcrime1!</code>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-cyan hover:bg-accent-cyan/90 text-background font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                <span>{mode === 'register' ? 'Registering...' : 'Logging in...'}</span>
              </>
            ) : (
              <span>{mode === 'register' ? 'Register & Continue' : 'Login'}</span>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 pt-4 border-t border-accent-cyan/20 text-center">
            <p className="text-sm text-text-muted">
              Need to register? Please use the recovery password to access the system.
            </p>
          </div>
        )}
      </div>

      {renderStyles()}
    </div>
  );
}

function renderStyles() {
  return (
    <style>{`
      @keyframes pulse-slow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .animate-pulse-slow {
        animation: pulse-slow 2s ease-in-out infinite;
      }
      
      .stars-small, .stars-medium {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
          radial-gradient(2px 2px at 20px 30px, rgba(0, 212, 255, 0.3), transparent),
          radial-gradient(2px 2px at 60px 70px, rgba(0, 212, 255, 0.2), transparent),
          radial-gradient(1px 1px at 50px 50px, rgba(0, 212, 255, 0.4), transparent),
          radial-gradient(1px 1px at 80px 10px, rgba(0, 212, 255, 0.3), transparent),
          radial-gradient(2px 2px at 90px 60px, rgba(0, 212, 255, 0.2), transparent),
          radial-gradient(1px 1px at 30px 80px, rgba(0, 212, 255, 0.3), transparent);
        background-size: 100px 100px;
        animation: twinkle 3s ease-in-out infinite;
      }
      
      .stars-medium {
        background-image: 
          radial-gradient(1px 1px at 40px 20px, rgba(255, 184, 0, 0.3), transparent),
          radial-gradient(1px 1px at 70px 50px, rgba(255, 184, 0, 0.2), transparent),
          radial-gradient(1px 1px at 10px 70px, rgba(255, 184, 0, 0.4), transparent);
        background-size: 150px 150px;
        animation: twinkle 4s ease-in-out infinite 0.5s;
      }
      
      @keyframes twinkle {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  );
}
