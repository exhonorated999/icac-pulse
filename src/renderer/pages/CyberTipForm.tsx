import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    priorityLevel: 'Level 1',
    dateReceivedUTC: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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
      // Create the case
      console.log('Step 1: Creating case with data:', {
        caseNumber: formData.caseNumber,
        caseType: 'cybertip',
        status: 'open',
      });
      
      const newCase = await window.electronAPI.createCase({
        caseNumber: formData.caseNumber,
        caseType: 'cybertip',
        status: 'open',
      });
      
      console.log('Step 2: Case created successfully:', newCase);
      
      if (!newCase || !newCase.id) {
        throw new Error('Case creation failed - no ID returned');
      }

      // Save CyberTip data
      console.log('Step 3: Saving CyberTip data for case ID:', newCase.id);
      
      try {
        await window.electronAPI.saveCyberTipData({
          caseId: newCase.id,
          cybertipNumber: formData.cybertipNumber,
          reportDate: formData.reportDate,
          occurrenceDate: formData.occurrenceDate,
          reportingCompany: formData.reportingCompany,
          priorityLevel: formData.priorityLevel,
          dateReceivedUtc: formData.dateReceivedUTC,
          ncmecFolderPath: formData.ncmecPdfPath,
        });
        console.log('Step 4: CyberTip data saved successfully');
      } catch (ctError: any) {
        console.error('Step 4 ERROR: Failed to save CyberTip data:', ctError);
        throw new Error(`Failed to save CyberTip data: ${ctError.message}`);
      }

      console.log('Step 5: Case creation complete, redirecting to cases list');
      
      // Skip PDF/identifier/file uploads for now - just create the basic case
      // TODO: Re-enable after basic flow works
      
      // Success! Navigate to cases list
      alert(`CyberTip case "${formData.caseNumber}" created successfully!`);
      navigate('/cases');
    } catch (error: any) {
      console.error('Failed to create case:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      // Check for specific errors
      if (errorMessage.includes('UNIQUE constraint')) {
        alert(`Case number "${formData.caseNumber}" already exists. Please use a different case number.`);
      } else {
        alert(`Failed to create case: ${errorMessage}\n\nPlease check the console for more details.`);
      }
    } finally {
      setSubmitting(false);
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
                  <option value="Level 1">Level 1</option>
                  <option value="Level 2">Level 2</option>
                  <option value="Level 3">Level 3</option>
                  <option value="Level E">Level E</option>
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
    </div>
  );
}
