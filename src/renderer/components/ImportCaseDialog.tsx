import { useState, useEffect } from 'react';

interface ImportCaseDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportCaseDialog({ onClose, onSuccess }: ImportCaseDialogProps) {
  const [step, setStep] = useState<'select' | 'password' | 'importing' | 'complete'>('select');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [password, setPassword] = useState('');
  const [progress, setProgress] = useState({ step: '', current: 0, total: 5, message: '' });
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [passwordAttempts, setPasswordAttempts] = useState(0);

  useEffect(() => {
    // Listen for progress updates
    window.electronAPI.onImportProgress((progressData: any) => {
      setProgress(progressData);
    });
  }, []);

  const handleSelectFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        filters: [
          { name: 'PULSE Case Files', extensions: ['pulse'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        setSelectedFile(result.filePaths[0]);
        setStep('password');
        setError('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select file');
    }
  };

  const handleValidateAndImport = async () => {
    setError('');

    if (!password) {
      setError('Please enter the export password');
      return;
    }

    if (passwordAttempts >= 3) {
      setError('Maximum password attempts exceeded. Please restart the import process.');
      return;
    }

    setStep('importing');

    try {
      // First validate the file and password
      const validation = await window.electronAPI.validateImportFile({
        filePath: selectedFile,
        password
      });

      if (!validation.valid) {
        setPasswordAttempts(prev => prev + 1);
        const attemptsLeft = 3 - (passwordAttempts + 1);
        setError(
          validation.error === 'Decryption failed. Incorrect password or corrupted file.'
            ? `Incorrect password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
            : validation.error || 'Validation failed'
        );
        setStep('password');
        return;
      }

      // Password is correct, proceed with import
      const result = await window.electronAPI.importCompleteCase({
        filePath: selectedFile,
        password
      });

      if (result.success) {
        setImportResult(result);
        setStep('complete');
        
        // Call success callback after a short delay
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        setError(result.error || 'Import failed');
        setStep('password');
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStep('password');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-accent-pink rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* File Selection Step */}
        {step === 'select' && (
          <>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Import Case from PULSE File</h3>

            <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-accent-pink flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-text-primary mb-2">Import Instructions</p>
                  <ul className="text-text-muted space-y-1 list-disc list-inside">
                    <li>Select the .pulse file you received</li>
                    <li>Enter the password provided by the exporting detective</li>
                    <li>The case will be imported with all data and files</li>
                    <li>If the case number already exists, it will be auto-renamed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-accent-pink/30 rounded-lg p-12 mb-6 text-center
                          hover:border-accent-pink/50 transition-colors cursor-pointer"
                 onClick={handleSelectFile}>
              <svg className="w-16 h-16 text-accent-pink/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              <p className="text-text-primary font-medium mb-1">Click to select PULSE file</p>
              <p className="text-text-muted text-sm">or drag and drop here</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-background border border-accent-pink/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-pink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectFile}
                className="flex-1 px-4 py-3 bg-accent-pink text-background rounded-lg font-medium
                         hover:bg-accent-pink/90 transition-colors"
              >
                Select File
              </button>
            </div>
          </>
        )}

        {/* Password Entry Step */}
        {step === 'password' && (
          <>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Enter Import Password</h3>

            <div className="bg-panel border border-accent-pink/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5 text-accent-pink flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-text-muted truncate">File:</p>
                  <p className="text-text-primary font-medium truncate">{selectedFile.split('\\').pop()}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Password <span className="text-accent-pink">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the password provided by the exporter"
                className="w-full px-4 py-2 bg-background border border-accent-pink/30 rounded-lg
                         text-text-primary focus:outline-none focus:border-accent-pink"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleValidateAndImport();
                  }
                }}
              />
              {passwordAttempts > 0 && passwordAttempts < 3 && (
                <p className="text-sm text-yellow-400 mt-2">
                  ⚠️ {3 - passwordAttempts} attempt{3 - passwordAttempts !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setPassword('');
                  setPasswordAttempts(0);
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-background border border-accent-pink/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-pink transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleValidateAndImport}
                disabled={passwordAttempts >= 3}
                className="flex-1 px-4 py-3 bg-accent-pink text-background rounded-lg font-medium
                         hover:bg-accent-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Case
              </button>
            </div>
          </>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <>
            <h3 className="text-2xl font-bold text-text-primary mb-6">Importing Case...</h3>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted text-sm">
                  Step {progress.current} of {progress.total}
                </span>
                <span className="text-text-primary text-sm font-medium">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              
              <div className="w-full bg-background rounded-full h-3 overflow-hidden border border-accent-pink/30">
                <div
                  className="h-full bg-accent-pink transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>

              <p className="text-text-primary mt-4 text-center">
                {progress.message || 'Processing...'}
              </p>
            </div>

            <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin">
                  <svg className="w-5 h-5 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </div>
                <p className="text-sm text-text-muted">
                  Please wait... Importing case data and files.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-text-primary mb-2">Import Complete!</h3>
              <p className="text-text-muted">Case has been successfully imported</p>
            </div>

            <div className="bg-panel border border-accent-pink/30 rounded-lg p-6 mb-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Case Number:</span>
                  <span className="text-text-primary font-medium">{importResult.caseNumber}</span>
                </div>
                {importResult.caseId && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Case ID:</span>
                    <span className="text-text-primary">{importResult.caseId}</span>
                  </div>
                )}
              </div>
            </div>

            {importResult.warnings && importResult.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-yellow-400 mb-2">⚠️ Import Warnings:</p>
                <ul className="text-sm text-text-muted space-y-1 list-disc list-inside">
                  {importResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-text-muted">
                The case has been imported to your system. You can find it in the "All Cases" section.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-accent-pink text-background rounded-lg font-medium
                       hover:bg-accent-pink/90 transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
