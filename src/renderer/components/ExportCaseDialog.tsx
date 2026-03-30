import { useState, useEffect } from 'react';

interface ExportCaseDialogProps {
  caseId: number;
  caseNumber: string;
  onClose: () => void;
}

export function ExportCaseDialog({ caseId, caseNumber, onClose }: ExportCaseDialogProps) {
  const [step, setStep] = useState<'warning' | 'password' | 'exporting' | 'complete'>('warning');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToWarning, setAgreedToWarning] = useState(false);
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [progress, setProgress] = useState({ step: '', current: 0, total: 5, message: '' });
  const [exportResult, setExportResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get export size
    window.electronAPI.getExportSize(caseId).then((result) => {
      if (result.success && result.size) {
        setExportSize(result.size);
      }
    });

    // Listen for progress updates
    window.electronAPI.onExportProgress((progressData: any) => {
      setProgress(progressData);
    });
  }, [caseId]);

  const handleContinueFromWarning = () => {
    if (!agreedToWarning) {
      setError('You must agree to handle data securely');
      return;
    }
    setStep('password');
    setError('');
  };

  const handleStartExport = async () => {
    setError('');

    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setError('Password should be at least 8 characters for security');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStep('exporting');

    try {
      const result = await window.electronAPI.exportCompleteCase({
        caseId,
        password
      });

      if (result.cancelled) {
        onClose();
        return;
      }

      if (result.success) {
        setExportResult(result);
        setStep('complete');
      } else {
        setError(result.error || 'Export failed');
        setStep('password');
      }
    } catch (err: any) {
      setError(err.message || 'Export failed');
      setStep('password');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getPasswordStrength = (): { text: string; color: string } => {
    if (!password) return { text: '', color: '' };
    if (password.length < 8) return { text: 'Weak', color: 'text-accent-pink' };
    if (password.length < 12) return { text: 'Moderate', color: 'text-yellow-400' };
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return { text: 'Strong', color: 'text-green-400' };
    }
    return { text: 'Good', color: 'text-accent-cyan' };
  };

  const passwordStrength = getPasswordStrength();
  const sizeInGB = exportSize ? exportSize / (1024 * 1024 * 1024) : 0;
  const isLargeExport = sizeInGB > 7;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Security Warning Step */}
        {step === 'warning' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-12 h-12 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div>
                <h3 className="text-2xl font-bold text-text-primary">Security Warning</h3>
                <p className="text-text-muted">Please read carefully before exporting</p>
              </div>
            </div>

            <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-6 mb-6">
              <h4 className="font-bold text-accent-pink mb-4 text-lg">Sensitive Case Data Export</h4>
              
              <div className="space-y-4 text-text-primary">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent-pink flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p className="font-medium">This export contains highly sensitive investigation data</p>
                    <p className="text-sm text-text-muted mt-1">All case details, evidence files, warrants, and suspect information will be included</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent-pink flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <div>
                    <p className="font-medium">Use encrypted USB drive or secure file transfer</p>
                    <p className="text-sm text-text-muted mt-1">Do not email or upload to unsecured cloud storage</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent-pink flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  <div>
                    <p className="font-medium">Delete from shared locations after transfer</p>
                    <p className="text-sm text-text-muted mt-1">Remove from USB drives after successful import to destination</p>
                  </div>
                </div>

                {exportSize && (
                  <div className="mt-4 pt-4 border-t border-accent-pink/30">
                    <p className="text-sm">
                      <span className="font-medium">Estimated package size:</span> {formatBytes(exportSize)}
                      {isLargeExport && (
                        <span className="ml-2 text-yellow-400">⚠️ Large export - may take several minutes</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToWarning}
                  onChange={(e) => setAgreedToWarning(e.target.checked)}
                  className="w-5 h-5 rounded border-accent-cyan/30 bg-background text-accent-cyan
                           focus:ring-2 focus:ring-accent-cyan/20"
                />
                <span className="text-text-primary font-medium">
                  I understand and will handle this data securely according to my agency's policies
                </span>
              </label>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-cyan transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueFromWarning}
                disabled={!agreedToWarning}
                className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Password Setup
              </button>
            </div>
          </>
        )}

        {/* Password Setup Step */}
        {step === 'password' && (
          <>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Set Export Password</h3>

            <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div className="text-sm text-text-muted">
                  <p className="font-medium text-text-primary mb-1">Password Protection</p>
                  <p>The recipient will need this password to import the case. Choose a strong password and communicate it securely (not via email).</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Password <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min. 8 characters)"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                  autoFocus
                />
                {password && (
                  <p className={`text-sm mt-1 ${passwordStrength.color}`}>
                    Strength: {passwordStrength.text}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Confirm Password <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleStartExport();
                    }
                  }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('warning')}
                className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-cyan transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStartExport}
                className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors"
              >
                Start Export
              </button>
            </div>
          </>
        )}

        {/* Exporting Step */}
        {step === 'exporting' && (
          <>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Exporting Case...</h3>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted text-sm">
                  Step {progress.current} of {progress.total}
                </span>
                <span className="text-text-primary text-sm font-medium">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              
              <div className="w-full bg-background rounded-full h-3 overflow-hidden border border-accent-cyan/30">
                <div
                  className="h-full bg-accent-cyan transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>

              <p className="text-text-primary mt-4 text-center">
                {progress.message || 'Processing...'}
              </p>
            </div>

            <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </div>
                <p className="text-sm text-text-muted">
                  Please wait... This may take several minutes for large cases.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Complete Step */}
        {step === 'complete' && exportResult && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-text-primary mb-2">Export Complete!</h3>
              <p className="text-text-muted">Case {caseNumber} has been successfully exported</p>
            </div>

            <div className="bg-panel border border-accent-cyan/30 rounded-lg p-6 mb-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">File:</span>
                  <span className="text-text-primary font-medium">{exportResult.filePath?.split('\\').pop() || 'Transfer file'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Size:</span>
                  <span className="text-text-primary">{exportResult.fileSize ? formatBytes(exportResult.fileSize) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Files Included:</span>
                  <span className="text-text-primary">{exportResult.fileCount || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-text-muted">
                <strong className="text-text-primary">Next Steps:</strong><br/>
                1. Transfer the .pulse file to the destination system using a secure method<br/>
                2. Communicate the password securely (phone call, in person, etc.)<br/>
                3. The recipient can import using the "Import Case" button on their Dashboard
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
