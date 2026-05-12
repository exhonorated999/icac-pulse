/**
 * FieldSecurityLockOverlay — full-screen unlock prompt.
 *
 * Renders when Field Security is enabled AND the encryption store is locked.
 * The user must enter their password (or recovery key) to continue. While
 * mounted, the rest of the app is unreachable.
 *
 * Dispatches a `fieldSecurityChanged` window event after successful unlock
 * so the Layout (and anything else listening) can refresh its state.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  onUnlock: () => void;
}

export default function FieldSecurityLockOverlay({ onUnlock }: Props) {
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = mode === 'password'
        ? await window.electronAPI.securityUnlock(value)
        : await window.electronAPI.securityRecover(value);
      if (res.success) {
        setValue('');
        window.dispatchEvent(new Event('fieldSecurityChanged'));
        onUnlock();
      } else {
        setError(res.error || (mode === 'password' ? 'Invalid password' : 'Invalid recovery key'));
      }
    } catch (err: any) {
      setError(err?.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-panel border border-amber-500/30 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary">Field Security Locked</h2>
          <p className="text-sm text-text-muted mt-1 text-center">
            {mode === 'password'
              ? 'Enter your password to unlock the application.'
              : 'Enter your recovery key (format: XXXX-XXXX-XXXX-XXXX).'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            ref={inputRef}
            type={mode === 'password' ? 'password' : 'text'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={mode === 'password' ? 'Password' : 'Recovery key'}
            disabled={busy}
            autoComplete={mode === 'password' ? 'current-password' : 'off'}
            spellCheck={false}
            className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg text-text-primary
                       focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30
                       disabled:opacity-50 text-base"
          />

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full px-4 py-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400
                       border border-amber-500/40 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => { setMode(mode === 'password' ? 'recovery' : 'password'); setValue(''); setError(''); }}
            className="text-sm text-text-muted hover:text-accent-cyan underline-offset-2 hover:underline"
          >
            {mode === 'password' ? 'Use recovery key instead' : 'Use password instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
