import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface P2PFormData {
  caseNumber: string;
  downloadDate: string;
  platform: string;
  suspectIp: string;
  ipProvider: string;
}

export function P2PForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<P2PFormData>({
    caseNumber: '',
    downloadDate: '',
    platform: 'bittorrent',
    suspectIp: '',
    ipProvider: '',
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
    if (!formData.downloadDate) {
      alert('Download date is required');
      return;
    }
    if (!formData.suspectIp.trim()) {
      alert('Suspect IP address is required');
      return;
    }
    if (!formData.ipProvider.trim()) {
      alert('ISP provider is required');
      return;
    }

    setSubmitting(true);

    try {
      // Create the case
      const caseResult = await window.electronAPI.createCase({
        caseNumber: formData.caseNumber,
        caseType: 'p2p',
        status: 'open',
      });

      console.log('Case created:', caseResult);

      // Save P2P-specific data
      await window.electronAPI.saveP2PData({
        caseId: caseResult.id,
        downloadDate: formData.downloadDate,
        platform: formData.platform,
        suspectIp: formData.suspectIp,
        ipProvider: formData.ipProvider,
      });

      console.log('P2P data saved');

      // Navigate to cases list
      navigate('/cases');
    } catch (error) {
      console.error('Failed to create P2P case:', error);
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
            Create P2P Case
          </h1>
          <p className="text-text-muted">
            Peer-to-peer file sharing investigation
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

          {/* P2P Investigation Details */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h3 className="text-xl font-bold text-text-primary mb-4">P2P Investigation Details</h3>
            
            <div className="space-y-4">
              {/* Download Date */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Download Date *
                </label>
                <input
                  type="date"
                  name="downloadDate"
                  value={formData.downloadDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  required
                />
              </div>

              {/* Network Platform */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Network Platform *
                </label>
                <select
                  name="platform"
                  value={formData.platform}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  required
                >
                  <option value="bittorrent">BitTorrent</option>
                  <option value="shareazza">Shareazza</option>
                  <option value="irc">IRC</option>
                  <option value="freenet">Freenet</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Suspect IP Address */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Suspect IP Address *
                </label>
                <input
                  type="text"
                  name="suspectIp"
                  value={formData.suspectIp}
                  onChange={handleInputChange}
                  placeholder="e.g., 192.168.1.100"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 font-mono"
                  required
                />
              </div>

              {/* ISP Provider */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  ISP Provider *
                </label>
                <input
                  type="text"
                  name="ipProvider"
                  value={formData.ipProvider}
                  onChange={handleInputChange}
                  placeholder="e.g., Comcast, Verizon, AT&T"
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  required
                />
              </div>
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

        {/* Note about download folder */}
        <div className="mt-6 p-4 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg">
          <p className="text-text-primary text-sm">
            <strong>Note:</strong> You can upload the P2P download folder after creating the case from the case detail page.
          </p>
        </div>
      </div>
    </div>
  );
}
