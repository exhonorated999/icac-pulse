import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface OutreachData {
  date: string;
  location: string;
  numAttendees: number;
  isLawEnforcement: boolean;
  notes: string;
}

export function OutreachForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<OutreachData>({
    date: new Date().toISOString().split('T')[0], // Today's date
    location: '',
    numAttendees: 0,
    isLawEnforcement: false,
    notes: ''
  });

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      loadOutreach();
    }
  }, [id, isEdit]);

  const loadOutreach = async () => {
    try {
      const event = await window.electronAPI.getPublicOutreach(parseInt(id!));
      if (event) {
        setFormData({
          date: event.date,
          location: event.location,
          numAttendees: event.num_attendees,
          isLawEnforcement: event.is_law_enforcement === 1,
          notes: event.notes || ''
        });
      }
    } catch (error) {
      console.error('Failed to load outreach event:', error);
      alert('Failed to load outreach event');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.location || formData.numAttendees < 1) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      if (isEdit && id) {
        await window.electronAPI.updatePublicOutreach(parseInt(id), formData);
        alert('Outreach event updated successfully!');
      } else {
        await window.electronAPI.addPublicOutreach(formData);
        alert('Outreach event logged successfully!');
      }
      navigate('/outreach');
    } catch (error) {
      console.error('Failed to save outreach event:', error);
      alert('Failed to save outreach event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          {isEdit ? 'Edit Outreach Event' : 'Log New Outreach Event'}
        </h1>
        <p className="text-text-muted">
          {isEdit ? 'Update event details' : 'Record community education or training event'}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-panel border border-accent-cyan/20 rounded-xl p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Event Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                       text-text-primary focus:outline-none focus:border-accent-cyan"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Jefferson High School, Main Auditorium"
              className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan"
              required
            />
          </div>

          {/* Number of Attendees */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Number of Attendees *
            </label>
            <input
              type="number"
              min="1"
              value={formData.numAttendees || ''}
              onChange={(e) => setFormData({ ...formData, numAttendees: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 150"
              className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan"
              required
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isLawEnforcement}
                onChange={(e) => setFormData({ ...formData, isLawEnforcement: e.target.checked })}
                className="w-5 h-5 rounded border-accent-cyan/30 bg-background 
                         checked:bg-accent-cyan checked:border-accent-cyan cursor-pointer"
              />
              <div>
                <span className="text-text-primary font-medium">Law Enforcement Training</span>
                <p className="text-text-muted text-sm">Check if this was a training event for law enforcement personnel</p>
              </div>
            </label>
          </div>

          {/* Event Type Display */}
          <div className="p-4 rounded-lg bg-accent-cyan/5 border border-accent-cyan/30">
            <p className="text-sm text-text-muted mb-2">Event Type:</p>
            {formData.isLawEnforcement ? (
              <span className="inline-block px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-medium">
                🎓 Law Enforcement Training
              </span>
            ) : (
              <span className="inline-block px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                👥 Public Outreach
              </span>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details about the event..."
              rows={4}
              className="w-full px-4 py-2 bg-background border border-accent-cyan/20 rounded-lg 
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : (isEdit ? 'Update Event' : 'Log Event')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/outreach')}
              className="px-6 py-2.5 bg-panel border border-accent-cyan/20 text-text-primary font-semibold 
                       rounded-lg hover:bg-background transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
