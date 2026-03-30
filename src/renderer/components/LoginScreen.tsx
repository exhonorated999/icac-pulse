import { useState } from 'react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);

    try {
      await window.electronAPI.loginUser(username.trim(), password);
      onLoginSuccess(username.trim());
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-accent-cyan mb-2">
            ICAC P.U.L.S.E.
          </h1>
          <p className="text-text-muted text-sm">
            Prosecution & Unit Lead Support Engine
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-panel border border-accent-cyan/30 rounded-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              🔒 USB-Secured Access
            </h2>
            <p className="text-text-muted text-sm leading-relaxed">
              Enter your credentials to access the application.
              This USB drive must match your registered device.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                autoFocus
                className="w-full bg-background border border-text-muted/30 rounded px-4 py-2.5
                         text-text-primary placeholder-text-muted/50
                         focus:outline-none focus:border-accent-cyan transition-colors"
              />
            </div>

            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleLogin();
                  }
                }}
                className="w-full bg-background border border-text-muted/30 rounded px-4 py-2.5
                         text-text-primary placeholder-text-muted/50
                         focus:outline-none focus:border-accent-cyan transition-colors"
              />
            </div>

            {error && (
              <div className="bg-accent-pink/10 border border-accent-pink/30 rounded p-3">
                <p className="text-accent-pink text-sm">⚠️ {error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-accent-cyan text-background font-semibold py-3 rounded
                       hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>

          {/* Recovery Info */}
          <div className="mt-6 pt-6 border-t border-text-muted/20">
            <p className="text-text-muted text-xs leading-relaxed">
              💡 <strong>Forgot your password?</strong> Use the master recovery password
              to regain access, then change your password in Settings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-6">
          100% Offline • USB-Bound • Encrypted
        </p>
      </div>
    </div>
  );
}
