import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ParsedIdentifier {
  type: string;
  value: string;
  context?: string;
}

interface CyberTipFormData {
  caseNumber: string;
  cybertipNumber: string;
  reportDate: string;
  occurrenceDate: string;
  reportingCompany: string;
  priorityLevel: string;
  dateReceivedUTC: string;
}

export function CyberTipForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CyberTipFormData>({
    caseNumber: '',
    cybertipNumber: '',
    reportDate: '',
    occurrenceDate: '',
    reportingCompany: '',
    priorityLevel: '1',
    dateReceivedUTC: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // PDF import state
  const [importedPdfPath, setImportedPdfPath] = useState<string | null>(null);
  const [importedPdfName, setImportedPdfName] = useState<string>('');
  const [parsedIdentifiers, setParsedIdentifiers] = useState<ParsedIdentifier[]>([]);
  const [importing, setImporting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pendingPdfPath, setPendingPdfPath] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Convert NCMEC date "MM-DD-YYYY HH:MM:SS UTC" → "YYYY-MM-DDTHH:MM" for datetime-local input
  const ncmecDateToInputDate = (ncmecDate: string): string => {
    if (!ncmecDate) return '';
    // Pattern: "11-01-2022 08:45:44 UTC"
    const match = ncmecDate.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?\s*UTC?/);
    if (match) {
      const [, mm, dd, yyyy, hh, min] = match;
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
    return '';
  };

  // ── Convert NCMEC date to just date (YYYY-MM-DD) for date input
  const ncmecDateToDate = (ncmecDate: string): string => {
    if (!ncmecDate) return '';
    const match = ncmecDate.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (match) {
      const [, mm, dd, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };

  // ── Import CyberTip PDF ─────────────────────────────────────────
  const handleImportPDF = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        title: 'Select NCMEC CyberTip PDF',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths?.length) return;

      const pdfPath = result.filePaths[0];
      setPendingPdfPath(pdfPath);

      // Try without password first
      setImporting(true);
      try {
        const parsed = await window.electronAPI.parseNCMECPDF(pdfPath);
        if (parsed && parsed.cybertipNumber) {
          applyParsedData(parsed, pdfPath);
          return;
        }
      } catch (err: any) {
        // If password error, show modal
        const msg = err?.message || err?.toString() || '';
        if (msg.includes('password') || msg.includes('Password') || msg.includes('encrypted') || msg.includes('PasswordException')) {
          setImporting(false);
          setShowPasswordModal(true);
          return;
        }
      }

      // If we get here with no data, it might need a password
      setImporting(false);
      setShowPasswordModal(true);
    } catch (error: any) {
      setImporting(false);
      console.error('PDF import error:', error);
      alert(`Failed to import PDF: ${error?.message || error}`);
    }
  };

  // ── Retry parse with password ───────────────────────────────────
  const handlePasswordSubmit = async () => {
    if (!pdfPassword.trim()) return;

    setShowPasswordModal(false);
    setImporting(true);

    try {
      const parsed = await window.electronAPI.parseNCMECPDF(pendingPdfPath, pdfPassword);
      if (parsed && parsed.cybertipNumber) {
        applyParsedData(parsed, pendingPdfPath);
      } else {
        alert('Could not extract CyberTip data from the PDF. The file may not be a valid NCMEC CyberTip report.');
        setImporting(false);
      }
    } catch (error: any) {
      setImporting(false);
      const msg = error?.message || '';
      if (msg.includes('password') || msg.includes('Password')) {
        alert('Incorrect password. Please try again.');
        setShowPasswordModal(true);
      } else {
        alert(`Failed to parse PDF: ${msg}`);
      }
    }
  };

  // ── Apply parsed data to form ───────────────────────────────────
  const applyParsedData = (parsed: any, pdfPath: string) => {
    const fileName = pdfPath.split(/[\\/]/).pop() || 'cybertip.pdf';
    setImportedPdfPath(pdfPath);
    setImportedPdfName(fileName);

    // Populate form fields
    setFormData(prev => ({
      ...prev,
      cybertipNumber: parsed.cybertipNumber || prev.cybertipNumber,
      reportingCompany: parsed.reportingCompany || prev.reportingCompany,
      priorityLevel: parsed.priorityLevel || prev.priorityLevel,
      dateReceivedUTC: ncmecDateToInputDate(parsed.dateReceivedUtc) || prev.dateReceivedUTC,
      occurrenceDate: ncmecDateToDate(parsed.incidentTime) || prev.occurrenceDate,
      reportDate: ncmecDateToDate(parsed.dateReceivedUtc) || prev.reportDate,
    }));

    // Store identifiers for preview and later DB insert
    if (parsed.identifiers?.length) {
      setParsedIdentifiers(parsed.identifiers);
    }

    setImporting(false);
    setPdfPassword('');
  };

  // ── Submit handler ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.caseNumber.trim()) {
      alert('Case number is required');
      return;
    }
    if (!formData.cybertipNumber.trim()) {
      alert('CyberTipline report number is required');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create the case
      const newCase = await window.electronAPI.createCase({
        caseNumber: formData.caseNumber,
        caseType: 'cybertip',
        status: 'open',
      });

      if (!newCase || !newCase.id) {
        throw new Error('Case creation failed - no ID returned');
      }

      // 2. Save CyberTip metadata
      await window.electronAPI.saveCyberTipData({
        caseId: newCase.id,
        cybertipNumber: formData.cybertipNumber,
        reportDate: formData.reportDate,
        occurrenceDate: formData.occurrenceDate,
        reportingCompany: formData.reportingCompany,
        priorityLevel: formData.priorityLevel,
        dateReceivedUtc: formData.dateReceivedUTC,
      });

      // 3. Save parsed identifiers to DB
      if (parsedIdentifiers.length > 0) {
        for (const id of parsedIdentifiers) {
          try {
            await window.electronAPI.saveCyberTipIdentifier({
              caseId: newCase.id,
              identifierType: id.type,
              identifierValue: id.value,
              platform: id.context || null,
              provider: formData.reportingCompany || null,
            });
          } catch (idErr) {
            console.warn('Failed to save identifier:', id, idErr);
          }
        }
      }

      // 4. Copy the imported PDF into the case's cybertip directory
      if (importedPdfPath) {
        try {
          const copyResult = await window.electronAPI.copyCybertipPDF(
            importedPdfPath,
            formData.caseNumber
          );
          if (!copyResult.success) {
            console.warn('Failed to copy CyberTip PDF:', copyResult.error);
          }
        } catch (copyErr) {
          console.warn('Failed to copy CyberTip PDF:', copyErr);
        }
      }

      alert(`CyberTip case "${formData.caseNumber}" created successfully!`);
      navigate('/cases');
    } catch (error: any) {
      console.error('Failed to create case:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';

      if (errorMessage.includes('UNIQUE constraint')) {
        alert(`Case number "${formData.caseNumber}" already exists. Please use a different case number.`);
      } else {
        alert(`Failed to create case: ${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Identifier type badge colors ────────────────────────────────
  const badgeColor = (type: string) => {
    switch (type) {
      case 'ip': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'email': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'phone': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'username': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'userid': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'name': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'url': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Create CyberTip Case
          </h1>
          <p className="text-text-muted">
            NCMEC CyberTipline report investigation
          </p>
        </div>

        {/* ── Import CyberTip PDF Button ─────────────────────────── */}
        <div className="mb-6">
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">
                  📄 Import NCMEC CyberTip PDF
                </h3>
                <p className="text-sm text-text-muted">
                  Auto-populate case fields from an NCMEC CyberTipline report PDF
                </p>
              </div>
              <button
                type="button"
                onClick={handleImportPDF}
                disabled={importing}
                className="px-6 py-3 bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan font-semibold rounded-lg
                         hover:bg-accent-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
                    Parsing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import PDF
                  </>
                )}
              </button>
            </div>

            {/* Show imported file name */}
            {importedPdfName && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Imported:</span>
                <span className="text-text-muted">{importedPdfName}</span>
                <span className="text-text-muted/50 text-xs">— will be saved to NCMEC Files on case creation</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Case Number <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="text"
                  name="caseNumber"
                  value={formData.caseNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 2024-001-ICAC"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  CyberTipline Report Number <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="text"
                  name="cybertipNumber"
                  value={formData.cybertipNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 123456789"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Report Date
                </label>
                <input
                  type="date"
                  name="reportDate"
                  value={formData.reportDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Occurrence Date
                </label>
                <input
                  type="date"
                  name="occurrenceDate"
                  value={formData.occurrenceDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Reporting Company
                </label>
                <input
                  type="text"
                  name="reportingCompany"
                  value={formData.reportingCompany}
                  onChange={handleInputChange}
                  placeholder="e.g., Facebook, Snapchat"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Priority Level
                </label>
                <select
                  name="priorityLevel"
                  value={formData.priorityLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                >
                  <option value="1">Priority Level 1 - High/Immediate</option>
                  <option value="2">Priority Level 2 - Medium/Elevated</option>
                  <option value="3">Priority Level 3 - Low/Routine</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Date Received (UTC)
                </label>
                <input
                  type="datetime-local"
                  name="dateReceivedUTC"
                  value={formData.dateReceivedUTC}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>
            </div>
          </div>

          {/* ── Parsed Identifiers Preview ─────────────────────────── */}
          {parsedIdentifiers.length > 0 && (
            <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Extracted Identifiers
              </h3>
              <p className="text-sm text-text-muted mb-4">
                {parsedIdentifiers.length} identifier{parsedIdentifiers.length !== 1 ? 's' : ''} extracted from the CyberTip PDF — will be saved to the case automatically.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {parsedIdentifiers.map((id, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-background/50 rounded-lg px-4 py-2 border border-white/5"
                  >
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${badgeColor(id.type)}`}>
                      {id.type.toUpperCase()}
                    </span>
                    <span className="text-text-primary font-mono text-sm flex-1 truncate">
                      {id.value}
                    </span>
                    {id.context && (
                      <span className="text-text-muted text-xs truncate max-w-[200px]">
                        {id.context}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/cases/new')}
              className="px-6 py-3 text-text-muted hover:text-text-primary transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-accent-cyan text-background font-bold rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                  Creating Case...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Case
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Password Modal ───────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-panel border border-accent-cyan/30 rounded-xl p-6 w-[420px] shadow-2xl">
            <h3 className="text-xl font-bold text-text-primary mb-2">
              🔒 PDF Password Required
            </h3>
            <p className="text-sm text-text-muted mb-4">
              This NCMEC CyberTip PDF is password-protected. Enter the password to extract data.
            </p>
            <input
              type="password"
              value={pdfPassword}
              onChange={e => setPdfPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Enter PDF password..."
              autoFocus
              className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg
                       text-text-primary placeholder-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowPasswordModal(false); setPdfPassword(''); setPendingPdfPath(''); }}
                className="px-4 py-2 text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                disabled={!pdfPassword.trim()}
                className="px-6 py-2 bg-accent-cyan text-background font-bold rounded-lg
                         hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
              >
                Unlock & Parse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
