import { useState, useEffect, useRef } from 'react';

interface Report {
  id?: number;
  case_id: number;
  content: string;
  updated_at?: string;
}

interface ReportTabProps {
  caseId: number;
  caseNumber?: string;
}

export function ReportTab({ caseId, caseNumber }: ReportTabProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReport();
  }, [caseId]);

  useEffect(() => {
    // Set the content as HTML when loaded
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const loadReport = async () => {
    try {
      const data = await window.electronAPI.getReport(caseId);
      console.log('Report loaded:', data);
      
      if (data) {
        setReport(data);
        setContent(data.content || '');
        
        if (data.updated_at) {
          setLastSaved(new Date(data.updated_at).toLocaleString());
        }
      } else {
        setContent('');
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const handlePopOut = async () => {
    try {
      await window.electronAPI.openReportWindow({
        caseId,
        caseNumber: caseNumber || `Case ${caseId}`
      });
    } catch (error) {
      console.error('Failed to open pop-out window:', error);
      alert('Failed to open pop-out window');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Get content from contenteditable div
      const htmlContent = editorRef.current?.innerHTML || '';
      
      console.log('Saving report for case:', caseId);
      console.log('Content length:', htmlContent.length);
      
      await window.electronAPI.saveReport({
        case_id: caseId,
        content: htmlContent,
      });
      
      setLastSaved(new Date().toLocaleString());
      
      // Restore window focus first
      window.focus();
      
      // Then refocus the editor after save
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 100);
      
      alert('Report saved successfully!');
    } catch (error) {
      console.error('Failed to save report:', error);
      window.focus(); // Restore focus even on error
      alert(`Failed to save report: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setSaving(true);
      
      const htmlContent = editorRef.current?.innerHTML || '';
      
      if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<br>') {
        alert('Report is empty. Please add content before exporting.');
        return;
      }
      
      console.log('Exporting report to PDF for case:', caseId);
      
      const result = await window.electronAPI.exportReportPDF({
        caseId: caseId,
        content: htmlContent,
      });
      
      // Restore focus after async operation
      window.focus();
      
      if (result.success) {
        alert('Report exported successfully! The PDF has been saved.');
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
      window.focus(); // Restore focus even on error
      alert(`Failed to export PDF: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-text-muted">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Case Report</h2>
          {lastSaved && (
            <p className="text-sm text-text-muted mt-1">Last saved: {lastSaved}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePopOut}
            disabled={saving}
            className="px-6 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                     hover:border-accent-cyan hover:bg-accent-cyan/10 transition-colors flex items-center gap-2 font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Pop Out
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-accent-cyan text-background rounded-lg 
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2 font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {saving ? 'Saving...' : 'Save Report'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={saving}
            className="px-6 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                     hover:border-accent-cyan hover:bg-accent-cyan/10 transition-colors flex items-center gap-2 font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-3">
        <div className="flex gap-2">
          <button
            onClick={() => applyFormat('bold')}
            className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded hover:border-accent-cyan hover:bg-accent-cyan/10 transition-colors font-bold"
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            onClick={() => applyFormat('italic')}
            className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded hover:border-accent-cyan hover:bg-accent-cyan/10 transition-colors italic"
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button
            onClick={() => applyFormat('underline')}
            className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded hover:border-accent-cyan hover:bg-accent-cyan/10 transition-colors underline"
            title="Underline (Ctrl+U)"
          >
            U
          </button>
        </div>
      </div>

      {/* Rich Text Editor */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
        <div
          ref={editorRef}
          contentEditable={!saving}
          spellCheck={true}
          className="w-full min-h-[600px] p-4 bg-background text-text-primary rounded-lg border border-accent-cyan/20
                   focus:outline-none focus:border-accent-cyan overflow-y-auto"
          style={{
            fontSize: '16px',
            lineHeight: '1.8',
            fontFamily: 'Arial, sans-serif'
          }}
          onInput={(e) => {
            // Track changes but don't update state on every keystroke
            console.log('Content updated');
          }}
        />
      </div>

      {/* Helper Text */}
      <div className="text-sm text-text-muted italic">
        <p>💡 Tip: Use the formatting buttons or keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) to format text.</p>
        <p className="mt-1">📝 Click "Pop Out" to open the report in a separate window while you navigate other tabs.</p>
        <p className="mt-1">📄 Click "Save Report" to save your work. Click "Download PDF" to export for court.</p>
      </div>
    </div>
  );
}
