import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface OtherFormData {
  caseNumber: string;
  synopsis: string;
}

export function OtherForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<OtherFormData>({
    caseNumber: '',
    synopsis: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    if (!formData.synopsis.trim()) {
      alert('Synopsis is required');
      return;
    }

    setSubmitting(true);

    try {
      // Create the case
      const caseResult = await window.electronAPI.createCase({
        caseNumber: formData.caseNumber,
        caseType: 'other',
        status: 'open',
      });

      console.log('Case created:', caseResult);

      // Save Other-specific data (synopsis as case_type_description)
      await window.electronAPI.saveOtherData({
        caseId: caseResult.id,
        caseTypeDescription: formData.synopsis,
      });

      console.log('Other case data saved');

      // Navigate to cases list
      navigate('/cases');
    } catch (error) {
      console.error('Failed to create Other case:', error);
      alert('Failed to create case. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/cases/new')}
            className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Case Types
          </button>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Create Other Case
          </h1>
          <p className="text-text-muted">
            General investigation case
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Case Number */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4">Case Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Case Number *
              </label>
              <input
                type="text"
                name="caseNumber"
                value={formData.caseNumber}
                onChange={handleInputChange}
                placeholder="e.g., 24-987654321"
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                required
              />
            </div>
          </div>

          {/* Synopsis */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4">Case Synopsis</h3>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Synopsis *
              </label>
              <textarea
                name="synopsis"
                value={formData.synopsis}
                onChange={handleInputChange}
                placeholder="Brief description of the investigation..."
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 
                         min-h-[150px] resize-y"
                required
              />
              <p className="text-xs text-text-muted mt-1">
                Provide a brief overview of this investigation case.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/cases/new')}
              className="px-6 py-3 bg-panel border border-accent-cyan/30 text-text-primary rounded-lg 
                       hover:border-accent-cyan transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-accent-cyan text-background font-medium rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Case...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
