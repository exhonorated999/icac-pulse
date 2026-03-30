import React, { useState, useEffect } from 'react';

interface ProsecutionTabProps {
  caseId: number;
}

interface ProsecutionData {
  court_case_number?: string;
  da_name?: string;
  charges?: string;
  convicted?: boolean;
  sentence?: string;
}

const ProsecutionTab: React.FC<ProsecutionTabProps> = ({ caseId }) => {
  const [prosecutionData, setProsecutionData] = useState<ProsecutionData>({
    court_case_number: '',
    da_name: '',
    charges: '',
    convicted: false,
    sentence: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    loadProsecutionData();
  }, [caseId]);

  const loadProsecutionData = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getProsecution(caseId);
      
      if (data) {
        setProsecutionData({
          court_case_number: data.court_case_number || '',
          da_name: data.da_name || '',
          charges: data.charges || '',
          convicted: data.convicted === 1,
          sentence: data.sentence || ''
        });
        setHasData(true);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Failed to load prosecution data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await window.electronAPI.saveProsecution({
        case_id: caseId,
        ...prosecutionData
      });
      setEditMode(false);
      setHasData(true);
      await loadProsecutionData();
      
      // Restore focus after async operations
      window.focus();
    } catch (error) {
      console.error('Failed to save prosecution data:', error);
      window.focus(); // Restore focus even on error
      alert('Failed to save prosecution data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    loadProsecutionData();
  };

  const handleChange = (field: keyof ProsecutionData, value: string | boolean) => {
    setProsecutionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Prosecution Information</h2>
        <div className="flex gap-2">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-accent-cyan text-background font-medium rounded hover:bg-opacity-80 transition-colors"
            >
              {hasData ? 'Edit' : 'Add Information'}
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-panel text-text-primary border border-text-muted rounded hover:bg-opacity-80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-accent-cyan text-background font-medium rounded hover:bg-opacity-80 transition-colors"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-panel rounded-lg p-6 space-y-6">
        {/* Court Case Number */}
        <div>
          <label className="block text-text-primary font-medium mb-2">
            Court Case Number
          </label>
          {editMode ? (
            <input
              type="text"
              value={prosecutionData.court_case_number}
              onChange={(e) => handleChange('court_case_number', e.target.value)}
              className="w-full px-4 py-2 bg-background text-text-primary border border-text-muted rounded focus:outline-none focus:border-accent-cyan"
              placeholder="Enter court case number"
            />
          ) : (
            <div className="text-text-primary">
              {prosecutionData.court_case_number || (
                <span className="text-text-muted italic">Not specified</span>
              )}
            </div>
          )}
        </div>

        {/* District Attorney Assigned */}
        <div>
          <label className="block text-text-primary font-medium mb-2">
            District Attorney Assigned
          </label>
          {editMode ? (
            <input
              type="text"
              value={prosecutionData.da_name}
              onChange={(e) => handleChange('da_name', e.target.value)}
              className="w-full px-4 py-2 bg-background text-text-primary border border-text-muted rounded focus:outline-none focus:border-accent-cyan"
              placeholder="Enter DA name"
            />
          ) : (
            <div className="text-text-primary">
              {prosecutionData.da_name || (
                <span className="text-text-muted italic">Not specified</span>
              )}
            </div>
          )}
        </div>

        {/* Charges Filed */}
        <div>
          <label className="block text-text-primary font-medium mb-2">
            Charges Filed
          </label>
          {editMode ? (
            <textarea
              value={prosecutionData.charges}
              onChange={(e) => handleChange('charges', e.target.value)}
              className="w-full px-4 py-2 bg-background text-text-primary border border-text-muted rounded focus:outline-none focus:border-accent-cyan min-h-[120px]"
              placeholder="Enter charges filed..."
            />
          ) : (
            <div className="text-text-primary whitespace-pre-wrap">
              {prosecutionData.charges || (
                <span className="text-text-muted italic">Not specified</span>
              )}
            </div>
          )}
        </div>

        {/* Convicted */}
        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={prosecutionData.convicted}
              onChange={(e) => handleChange('convicted', e.target.checked)}
              disabled={!editMode}
              className="w-5 h-5 bg-background border border-text-muted rounded checked:bg-accent-cyan checked:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-text-primary font-medium">Convicted</span>
          </label>
        </div>

        {/* Sentence (only show if convicted) */}
        {prosecutionData.convicted && (
          <div>
            <label className="block text-text-primary font-medium mb-2">
              Sentence
            </label>
            {editMode ? (
              <textarea
                value={prosecutionData.sentence}
                onChange={(e) => handleChange('sentence', e.target.value)}
                className="w-full px-4 py-2 bg-background text-text-primary border border-text-muted rounded focus:outline-none focus:border-accent-cyan min-h-[100px]"
                placeholder="Enter sentence details..."
              />
            ) : (
              <div className="text-text-primary whitespace-pre-wrap">
                {prosecutionData.sentence || (
                  <span className="text-text-muted italic">Not specified</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!hasData && !editMode && (
          <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-8 text-center">
            <p className="text-accent-pink text-lg mb-2">No prosecution information yet</p>
            <p className="text-accent-pink/80 text-sm">Click "Add Information" to enter prosecution details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProsecutionTab;
