import React, { useState, useEffect } from 'react';

interface UploadProgressProps {
  isVisible: boolean;
}

interface ProgressData {
  current: number;
  total: number;
  currentFile: string;
  percentage: number;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ isVisible }) => {
  const [progress, setProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    currentFile: '',
    percentage: 0
  });

  useEffect(() => {
    // Listen for progress updates from main process
    const handleProgress = (_event: any, data: ProgressData) => {
      setProgress(data);
    };

    // Add event listener
    if ((window as any).electronAPI && (window as any).electronAPI.onUploadProgress) {
      (window as any).electronAPI.onUploadProgress(handleProgress);
    }

    // Cleanup
    return () => {
      if ((window as any).electronAPI && (window as any).electronAPI.removeUploadProgressListener) {
        (window as any).electronAPI.removeUploadProgressListener(handleProgress);
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
      <div className="bg-panel border border-accent-cyan/30 rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          <div className="animate-spin w-8 h-8 border-4 border-accent-cyan border-t-transparent rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-text-primary">Uploading Evidence</h3>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-text-muted mb-2">
            <span>
              {progress.current} of {progress.total} files
            </span>
            <span className="text-accent-cyan font-bold">{progress.percentage}%</span>
          </div>
          
          <div className="w-full bg-background rounded-full h-4 overflow-hidden border border-accent-cyan/20">
            <div 
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-cyan/70 transition-all duration-300 ease-out flex items-center justify-center"
              style={{ width: `${progress.percentage}%` }}
            >
              {progress.percentage > 10 && (
                <span className="text-xs font-bold text-background">{progress.percentage}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Current File */}
        <div className="bg-background/50 rounded-lg p-4 border border-accent-cyan/10">
          <p className="text-xs text-text-muted mb-1">Currently copying:</p>
          <p className="text-sm text-text-primary font-medium truncate" title={progress.currentFile}>
            {progress.currentFile || 'Preparing...'}
          </p>
        </div>

        {/* Warning Message */}
        <div className="mt-6 p-4 bg-accent-pink/10 border border-accent-pink/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-accent-pink text-xl">⚠️</span>
            <div>
              <p className="text-sm text-text-primary font-medium mb-1">Please wait</p>
              <p className="text-xs text-text-muted">
                Do not close this window. Large evidence folders may take several minutes to copy.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {progress.total > 100 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-text-muted">
              Large evidence folder detected ({progress.total.toLocaleString()} files)
            </p>
            <p className="text-xs text-text-muted mt-1">
              This may take a few minutes. The app is working and has not frozen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
