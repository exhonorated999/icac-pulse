import { useState } from 'react';

interface EmailVerificationResult {
  email: string;
  valid: boolean;
  classification: 'deliverable' | 'risky' | 'undeliverable';
  status: 'valid' | 'invalid' | 'disposable' | 'risky' | 'offline' | 'catch-all' | 'unknown';
  checks: {
    syntax: { valid: boolean; message: string };
    disposable: { isDisposable: boolean; message: string };
    typo: { hasTypo: boolean; suggestion?: string; message: string };
    dns: { valid: boolean; message: string; mxRecords?: string[] };
    smtp: { valid: boolean; message: string };
  };
  message: string;
  timestamp: string;
}

interface EmailVerifierProps {
  email: string;
  onVerified?: (result: EmailVerificationResult) => void;
}

export function EmailVerifier({ email, onVerified }: EmailVerifierProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<EmailVerificationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleVerify = async () => {
    if (!email || email.trim() === '') {
      alert('Please enter an email address first');
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      const verificationResult = await window.electronAPI.verifyEmail(email.trim());
      setResult(verificationResult);
      setShowResults(true);
      
      if (onVerified) {
        onVerified(verificationResult);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      alert('Failed to verify email address');
    } finally {
      setVerifying(false);
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'deliverable':
        return '✅';
      case 'risky':
        return '⚠️';
      case 'undeliverable':
        return '❌';
      default:
        return '❓';
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'deliverable':
        return 'text-green-400';
      case 'risky':
        return 'text-yellow-400';
      case 'undeliverable':
        return 'text-red-400';
      default:
        return 'text-text-muted';
    }
  };

  const getClassificationBg = (classification: string) => {
    switch (classification) {
      case 'deliverable':
        return 'bg-green-500/10 border-green-500/30';
      case 'risky':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'undeliverable':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-panel border-accent-cyan/20';
    }
  };

  return (
    <>
      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={verifying || !email}
        className="px-3 py-1.5 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 
                 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center gap-2"
        title="Verify email address"
      >
        {verifying ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verifying...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verify Email
          </>
        )}
      </button>

      {/* Results Modal */}
      {showResults && result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-accent-cyan/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-accent-cyan/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getClassificationIcon(result.classification || 'undeliverable')}</span>
                  <div>
                    <h3 className="text-xl font-bold text-text-primary">Email Verification Results</h3>
                    <p className="text-sm text-text-muted mt-1">{result.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResults(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Classification Summary */}
            <div className={`p-6 border-b border-accent-cyan/20 ${getClassificationBg(result.classification || 'undeliverable')}`}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${getClassificationColor(result.classification || 'undeliverable')}`}>
                    {(result.classification || 'undeliverable').toUpperCase()}
                  </div>
                  <div className="text-text-primary">{result.message}</div>
                </div>
                {result.classification === 'risky' && result.checks.dns.valid && (
                  <div className="text-sm text-text-muted bg-background/50 rounded p-2">
                    💡 <strong>Note:</strong> This classification means the email cannot be fully verified, but that doesn't mean it's fake. 
                    Many legitimate mail servers (Microsoft, Google, government domains) block verification attempts as a security measure.
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Checks */}
            <div className="p-6 space-y-4">
              <h4 className="font-bold text-text-primary mb-3">Verification Details</h4>

              {/* Syntax Check */}
              <div className="bg-background rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{result.checks.syntax.valid ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <div className="font-medium text-text-primary">Syntax Check</div>
                    <div className="text-sm text-text-muted mt-1">{result.checks.syntax.message}</div>
                  </div>
                </div>
              </div>

              {/* Disposable Check */}
              <div className="bg-background rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{result.checks.disposable.isDisposable ? '⚠️' : '✅'}</span>
                  <div className="flex-1">
                    <div className="font-medium text-text-primary">Disposable Email Check</div>
                    <div className="text-sm text-text-muted mt-1">{result.checks.disposable.message}</div>
                  </div>
                </div>
              </div>

              {/* Typo Check */}
              {result.checks.typo.hasTypo && (
                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">Typo Detection</div>
                      <div className="text-sm text-text-muted mt-1">{result.checks.typo.message}</div>
                      {result.checks.typo.suggestion && (
                        <div className="text-sm text-accent-cyan mt-2">
                          Suggested: <span className="font-mono">{result.checks.typo.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* DNS Check */}
              {result.status !== 'offline' && (
                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{result.checks.dns.valid ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">DNS/Mail Server Check</div>
                      <div className="text-sm text-text-muted mt-1">{result.checks.dns.message}</div>
                      {result.checks.dns.mxRecords && result.checks.dns.mxRecords.length > 0 && (
                        <div className="text-xs text-text-muted mt-2 font-mono">
                          {result.checks.dns.mxRecords.slice(0, 3).map((mx, i) => (
                            <div key={i}>• {mx}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SMTP Check */}
              {result.status !== 'offline' && result.checks.dns.valid && (
                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{result.checks.smtp.valid ? '✅' : '⚠️'}</span>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">Mailbox Verification (SMTP)</div>
                      <div className="text-sm text-text-muted mt-1">{result.checks.smtp.message}</div>
                      {!result.checks.smtp.valid && result.checks.dns.valid && (
                        <div className="text-xs text-yellow-400 mt-1">
                          ⚠️ Server blocked verification attempt - this does not mean the email is invalid
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Offline Notice */}
              {result.status === 'offline' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🌐</span>
                    <div className="flex-1">
                      <div className="font-medium text-blue-400">Internet Connection Required</div>
                      <div className="text-sm text-text-muted mt-1">
                        Full verification requires an internet connection. Only offline checks (syntax, disposable domains, typos) were performed.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-accent-cyan/20 flex justify-end">
              <button
                onClick={() => setShowResults(false)}
                className="px-6 py-2 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
