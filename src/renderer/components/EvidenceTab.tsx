import React, { useState, useEffect } from 'react';
import { UploadProgress } from './UploadProgress';
import { ChatViewer } from './ChatViewer';

// ── Constants ────────────────────────────────────────────────────────────────

const EVIDENCE_CATEGORIES = [
  'Chat (SingleFile)',
  'Cell Phone Extraction',
  'Warrant Return',
  'Triage Results',
  'Computer Extraction',
  'Reports',
  'Other',
] as const;

type EvidenceCategory = typeof EVIDENCE_CATEGORIES[number];

const CATEGORY_COLORS: Record<EvidenceCategory, string> = {
  'Chat (SingleFile)':    'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  'Cell Phone Extraction':'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Warrant Return':       'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'Triage Results':       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Computer Extraction':  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Reports':              'bg-green-500/15 text-green-300 border-green-500/30',
  'Other':                'bg-text-muted/15 text-text-muted border-text-muted/30',
};

interface Evidence {
  id: number;
  case_id: number;
  description: string;
  file_path: string;
  category: EvidenceCategory;
  uploaded_at: string;
}

interface EvidenceTabProps {
  caseId: number;
  caseNumber: string;
}

export const EvidenceTab: React.FC<EvidenceTabProps> = ({ caseId, caseNumber }) => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<EvidenceCategory>('Other');
  const [uploading, setUploading] = useState(false);

  // Chat viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFilePath, setViewerFilePath] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerEvidenceId, setViewerEvidenceId] = useState<number>(0);

  useEffect(() => {
    loadEvidence();
  }, [caseId]);

  const loadEvidence = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getEvidence(caseId);
      setEvidence(data || []);
    } catch (error) {
      console.error('Failed to load evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEvidence = async (uploadType: 'file' | 'folder') => {
    if (!newDescription.trim()) {
      alert('Please provide a description for the evidence');
      return;
    }

    const isChatCapture = newCategory === 'Chat (SingleFile)';

    try {
      let result;

      if (uploadType === 'file') {
        result = await window.electronAPI.openFileDialog({
          properties: ['openFile', 'multiSelections'],
          title: 'Select Evidence Files',
          ...(isChatCapture ? { filters: [{ name: 'SingleFile HTML', extensions: ['html', 'htm'] }] } : {}),
        });
      } else {
        result = await window.electronAPI.openFolderDialog({
          properties: ['openDirectory'],
          title: 'Select Evidence Folder',
        });
      }

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;

      setUploading(true);

      for (const sourcePath of result.filePaths) {
        const uploadResult = await window.electronAPI.uploadCaseFile({
          caseNumber,
          category: 'evidence',
          sourcePath,
          filename: '',
        });

        if (uploadResult.relativePath) {
          await window.electronAPI.addEvidence({
            case_id: caseId,
            description: newDescription.trim(),
            file_path: uploadResult.relativePath,
            category: newCategory,
          });
        }
      }

      await loadEvidence();
      setNewDescription('');
      setNewCategory('Other');
      setShowUploadDialog(false);
    } catch (error) {
      console.error('Failed to upload evidence:', error);
      alert(`Failed to upload evidence: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: number) => {
    if (!window.confirm('Are you sure you want to delete this evidence record? The file will remain in the case folder.')) return;
    try {
      await window.electronAPI.deleteEvidence(evidenceId);
      await loadEvidence();
    } catch (error) {
      console.error('Failed to delete evidence:', error);
    }
  };

  const handleViewEvidence = (filePath: string) => {
    window.electronAPI.openFileLocation(filePath);
  };

  const handleOpenChatViewer = (item: Evidence) => {
    setViewerFilePath(item.file_path);
    setViewerTitle(item.description);
    setViewerEvidenceId(item.id);
    setViewerOpen(true);
  };

  // Group by category, preserving order
  const grouped = EVIDENCE_CATEGORIES.reduce<Record<string, Evidence[]>>((acc, cat) => {
    const items = evidence.filter(e => (e.category || 'Other') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const isChatCapture = newCategory === 'Chat (SingleFile)';

  return (
    <div className="space-y-6">
      {/* Chat Viewer Overlay */}
      {viewerOpen && (
        <ChatViewer
          filePath={viewerFilePath}
          title={viewerTitle}
          evidenceId={viewerEvidenceId}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Evidence</h2>
        {!showUploadDialog && (
          <button
            onClick={() => setShowUploadDialog(true)}
            className="px-4 py-2 bg-accent-cyan text-background rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors font-medium"
          >
            + Add Evidence
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUploadDialog && (
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Upload Evidence</h3>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Category <span className="text-accent-pink">*</span>
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as EvidenceCategory)}
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary text-base focus:outline-none focus:border-accent-cyan"
            >
              {EVIDENCE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Chat capture info banner */}
          {isChatCapture && (
            <div className="flex items-start gap-2 px-3 py-2 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg">
              <svg className="w-4 h-4 text-accent-cyan mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-accent-cyan">
                Only <strong>.html</strong> files saved with <strong>SingleFile</strong> are supported.
                After upload you'll be able to open the interactive investigative viewer.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Description <span className="text-accent-pink">*</span>
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder={
                isChatCapture
                  ? "e.g. 'SingleFile Discord DM capture – @Becky – 3/17/2026'"
                  : "e.g. 'Cellebrite extraction from iPhone 12 (suspect device)'"
              }
              className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary text-base focus:outline-none focus:border-accent-cyan resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => { setShowUploadDialog(false); setNewDescription(''); setNewCategory('Other'); }}
              className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary 
                         rounded-lg hover:border-accent-cyan transition-colors"
            >
              Cancel
            </button>
            {!isChatCapture && (
              <button
                onClick={() => handleUploadEvidence('folder')}
                disabled={uploading || !newDescription.trim()}
                className="px-4 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                           transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                Upload Folder
              </button>
            )}
            <button
              onClick={() => handleUploadEvidence('file')}
              disabled={uploading || !newDescription.trim()}
              className="px-4 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                         transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isChatCapture ? 'Upload HTML File(s)' : 'Upload File(s)'}
            </button>
          </div>
        </div>
      )}

      {/* Evidence list */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
        {loading ? (
          <p className="text-text-muted text-center py-8">Loading evidence...</p>
        ) : evidence.length === 0 ? (
          <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-8 text-center">
            <p className="text-accent-pink text-lg mb-2">No evidence uploaded yet</p>
            <p className="text-accent-pink/80 text-sm">Click "Add Evidence" to upload files or folders</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[cat as EvidenceCategory]}`}>
                    {cat}
                  </span>
                  <span className="text-xs text-text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-accent-cyan/10" />
                </div>

                <div className="space-y-2 pl-1">
                  {items.map((item) => {
                    const isChat =
                      (item.category || 'Other') === 'Chat (SingleFile)' ||
                      /\.html?$/i.test(item.file_path || '');
                    return (
                      <div
                        key={item.id}
                        className="bg-background border border-accent-cyan/20 rounded-lg p-4 
                                   hover:border-accent-cyan/40 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary font-medium mb-1">{item.description}</p>
                            <p className="text-xs text-text-muted mb-1">
                              {new Date(item.uploaded_at).toLocaleString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                            <p className="text-xs text-text-muted font-mono truncate">{item.file_path}</p>
                          </div>

                          <div className="flex gap-2 flex-shrink-0">
                            {isChat && (
                              <button
                                onClick={() => handleOpenChatViewer(item)}
                                className="px-3 py-1.5 bg-accent-cyan text-background rounded-lg 
                                           hover:bg-accent-cyan/90 transition-colors text-sm 
                                           flex items-center gap-1.5 font-medium"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Investigate
                              </button>
                            )}
                            <button
                              onClick={() => handleViewEvidence(item.file_path)}
                              className="px-3 py-1.5 bg-background border border-accent-cyan/30 
                                         text-accent-cyan rounded-lg hover:bg-accent-cyan/10 
                                         transition-colors text-sm flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                              </svg>
                              Open File Location
                            </button>
                            <button
                              onClick={() => handleDeleteEvidence(item.id)}
                              className="px-3 py-1.5 text-accent-pink hover:text-accent-pink/80 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadProgress isVisible={uploading} />
    </div>
  );
};
