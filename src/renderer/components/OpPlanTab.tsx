import { useState, useEffect } from 'react';

interface OpPlan {
  id?: number;
  case_id: number;
  plan_pdf_path?: string;
  approved?: boolean;
  approver_name?: string;
  approval_date?: string;
  execution_date?: string;
}

interface OpPlanTabProps {
  caseId: number;
  caseNumber: string;
}

export function OpPlanTab({ caseId, caseNumber }: OpPlanTabProps) {
  const [opPlan, setOpPlan] = useState<OpPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOpPlan();
  }, [caseId]);

  const loadOpPlan = async () => {
    try {
      const data = await window.electronAPI.getOpsPlan(caseId);
      console.log('Op Plan loaded:', data);
      setOpPlan(data);
    } catch (error) {
      console.error('Failed to load op plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPDF = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        title: 'Select Operations Plan PDF'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const filePath = result.filePaths[0];
      
      console.log('Uploading OP Plan PDF:', filePath);

      // Copy to case directory
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber,
        category: 'operations_plan',
        sourcePath: filePath,
        filename: 'ops_plan.pdf',
      });

      console.log('Upload result:', uploadResult);

      // Save to database
      await window.electronAPI.saveOpsPlan({
        case_id: caseId,
        plan_pdf_path: uploadResult.relativePath,
      });

      await loadOpPlan();
      
      alert('Operations Plan PDF uploaded successfully!');
      
      // Restore focus after alert - focus on main content
      setTimeout(() => {
        window.focus();
        document.body.focus();
        // Try to focus a button or the main container
        const viewButton = document.querySelector<HTMLButtonElement>('button');
        if (viewButton) {
          viewButton.focus();
        }
      }, 150);
    } catch (error) {
      console.error('Failed to upload PDF:', error);
      alert(`Failed to upload PDF: ${error}`);
    }
  };

  const handleViewPDF = () => {
    if (opPlan?.plan_pdf_path) {
      window.electronAPI.openFileLocation(opPlan.plan_pdf_path);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-text-muted">Loading operations plan...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Operations Plan</h2>
      </div>

      {/* Upload Section */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-text-primary">OP Plan PDF</h3>
          <button
            onClick={handleUploadPDF}
            className="px-4 py-2 bg-accent-cyan text-background rounded-lg 
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {opPlan?.plan_pdf_path ? 'Replace PDF' : 'Upload PDF'}
          </button>
        </div>

        {opPlan?.plan_pdf_path ? (
          <div className="bg-background/50 rounded-lg p-6 border border-accent-cyan/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-cyan/10 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-text-primary font-semibold text-lg">ops_plan.pdf</p>
                  <p className="text-text-muted text-sm">Operations Plan Document</p>
                </div>
              </div>
              <button
                onClick={handleViewPDF}
                className="px-6 py-3 bg-accent-cyan text-background font-medium rounded-lg 
                         hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-accent-pink/10 rounded-lg p-8 border border-accent-pink/30 text-center">
            <svg className="w-16 h-16 text-accent-pink mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-accent-pink text-lg mb-2">No Operations Plan uploaded</p>
            <p className="text-accent-pink/80 text-sm">Click "Upload PDF" to add an operations plan document</p>
          </div>
        )}
      </div>
    </div>
  );
}
