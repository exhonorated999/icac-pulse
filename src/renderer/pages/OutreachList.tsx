import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface PublicOutreach {
  id: number;
  date: string;
  location: string;
  num_attendees: number;
  is_law_enforcement: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface OutreachMaterial {
  id: number;
  material_name: string;
  material_type: string;
  file_path: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function OutreachList() {
  const [outreachEvents, setOutreachEvents] = useState<PublicOutreach[]>([]);
  const [materials, setMaterials] = useState<OutreachMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'public' | 'leo'>('all');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showEditMaterial, setShowEditMaterial] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<OutreachMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    materialName: '',
    materialType: '',
    notes: '',
    file: null as File | null
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadOutreach();
    loadMaterials();
  }, []);

  const loadOutreach = async () => {
    try {
      const events = await window.electronAPI.getAllPublicOutreach();
      setOutreachEvents(events || []);
    } catch (error) {
      console.error('Failed to load outreach events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const mats = await window.electronAPI.getOutreachMaterials();
      setMaterials(mats || []);
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const handleDelete = async (id: number, location: string) => {
    const confirmed = confirm(`Delete outreach event at ${location}?`);
    if (!confirmed) return;

    try {
      await window.electronAPI.deletePublicOutreach(id);
      alert('Outreach event deleted successfully');
      loadOutreach();
    } catch (error) {
      console.error('Failed to delete outreach event:', error);
      alert('Failed to delete outreach event');
    }
  };

  const handleAddMaterial = async () => {
    if (!materialForm.materialName.trim()) {
      alert('Please enter a material name');
      return;
    }

    if (!materialForm.materialType) {
      alert('Please select a material type');
      return;
    }

    if (!materialForm.file) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      // Upload file
      const result = await window.electronAPI.uploadFile({
        sourcePath: (materialForm.file as any).path,
        caseNumber: 'outreach',
        category: '',
        filename: materialForm.file.name
      });

      // Add to database
      await window.electronAPI.addOutreachMaterial({
        materialName: materialForm.materialName,
        materialType: materialForm.materialType,
        filePath: result.relativePath,
        notes: materialForm.notes || null
      });

      await loadMaterials();
      setShowAddMaterial(false);
      setMaterialForm({ materialName: '', materialType: '', notes: '', file: null });
    } catch (error) {
      console.error('Failed to add material:', error);
      alert(`Failed to add material: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditMaterial = async () => {
    if (!selectedMaterial) return;

    if (!materialForm.materialName.trim()) {
      alert('Please enter a material name');
      return;
    }

    if (!materialForm.materialType) {
      alert('Please select a material type');
      return;
    }

    try {
      await window.electronAPI.updateOutreachMaterial(selectedMaterial.id, {
        materialName: materialForm.materialName,
        materialType: materialForm.materialType,
        notes: materialForm.notes || null
      });

      await loadMaterials();
      setShowEditMaterial(false);
      setSelectedMaterial(null);
      setMaterialForm({ materialName: '', materialType: '', notes: '', file: null });
    } catch (error) {
      console.error('Failed to update material:', error);
      alert(`Failed to update material: ${error}`);
    }
  };

  const handleDeleteMaterial = async (material: OutreachMaterial) => {
    if (!confirm(`Delete material "${material.material_name}"?\n\nThis will permanently delete the file.`)) {
      return;
    }

    try {
      await window.electronAPI.deleteOutreachMaterial(material.id);
      await loadMaterials();
    } catch (error) {
      console.error('Failed to delete material:', error);
      alert(`Failed to delete material: ${error}`);
    }
  };

  const handleOpenMaterial = (material: OutreachMaterial) => {
    window.electronAPI.openFileLocation(material.file_path);
  };

  const openEditMaterialDialog = (material: OutreachMaterial) => {
    setSelectedMaterial(material);
    setMaterialForm({
      materialName: material.material_name,
      materialType: material.material_type,
      notes: material.notes || '',
      file: null
    });
    setShowEditMaterial(true);
  };

  const filteredEvents = outreachEvents.filter(event => {
    if (filterType === 'all') return true;
    if (filterType === 'public') return event.is_law_enforcement === 0;
    if (filterType === 'leo') return event.is_law_enforcement === 1;
    return true;
  });

  const totalPublic = outreachEvents.filter(e => e.is_law_enforcement === 0).length;
  const totalLEO = outreachEvents.filter(e => e.is_law_enforcement === 1).length;
  const totalAttendees = outreachEvents.reduce((sum, e) => sum + e.num_attendees, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Loading outreach events...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Public Outreach</h1>
          <p className="text-text-muted">Track community education and training events</p>
        </div>
        
        <Link
          to="/outreach/new"
          className="px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg 
                   hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          Log New Event
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
          <p className="text-text-muted text-sm mb-1">Total Events</p>
          <p className="text-3xl font-bold text-text-primary">{outreachEvents.length}</p>
        </div>
        
        <div className="bg-panel border border-green-500/20 rounded-xl p-6">
          <p className="text-text-muted text-sm mb-1">Public Outreach</p>
          <p className="text-3xl font-bold text-green-400">{totalPublic}</p>
        </div>
        
        <div className="bg-panel border border-cyan-500/20 rounded-xl p-6">
          <p className="text-text-muted text-sm mb-1">LE Training</p>
          <p className="text-3xl font-bold text-cyan-400">{totalLEO}</p>
        </div>
        
        <div className="bg-panel border border-accent-cyan/20 rounded-xl p-6">
          <p className="text-text-muted text-sm mb-1">Total Attendees</p>
          <p className="text-3xl font-bold text-text-primary">{totalAttendees}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-accent-cyan text-background'
              : 'bg-panel text-text-primary border border-accent-cyan/20 hover:bg-accent-cyan/10'
          }`}
        >
          All Events ({outreachEvents.length})
        </button>
        <button
          onClick={() => setFilterType('public')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterType === 'public'
              ? 'bg-green-500 text-background'
              : 'bg-panel text-text-primary border border-green-500/20 hover:bg-green-500/10'
          }`}
        >
          Public Outreach ({totalPublic})
        </button>
        <button
          onClick={() => setFilterType('leo')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterType === 'leo'
              ? 'bg-cyan-500 text-background'
              : 'bg-panel text-text-primary border border-cyan-500/20 hover:bg-cyan-500/10'
          }`}
        >
          Law Enforcement Training ({totalLEO})
        </button>
      </div>

      {/* Events Table */}
      <div className="bg-panel border border-accent-cyan/20 rounded-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg mb-4">No outreach events logged yet</p>
            <Link
              to="/outreach/new"
              className="inline-block px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg 
                       hover:bg-accent-cyan/90 transition-colors"
            >
              Log Your First Event
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent-cyan/5">
                <tr className="border-b border-accent-cyan/30">
                  <th className="text-left text-text-primary text-sm font-medium p-4">Date</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Location</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Type</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Attendees</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Notes</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-accent-cyan/10 hover:bg-background/50">
                    <td className="p-4 text-text-primary font-medium">
                      {new Date(event.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-text-primary">{event.location}</td>
                    <td className="p-4">
                      {event.is_law_enforcement === 1 ? (
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-medium">
                          Law Enforcement
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          Public Outreach
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-text-primary font-bold">{event.num_attendees}</td>
                    <td className="p-4 text-text-muted text-sm max-w-xs truncate">
                      {event.notes || '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link
                          to={`/outreach/edit/${event.id}`}
                          className="px-3 py-1.5 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                                   transition-colors text-sm font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(event.id, event.location)}
                          className="px-3 py-1.5 bg-accent-pink text-background rounded-lg hover:bg-accent-pink/90 
                                   transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outreach Materials Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Outreach Materials</h2>
            <p className="text-text-muted text-sm">Presentations, handouts, and resources used in outreach events</p>
          </div>
          <button
            onClick={() => setShowAddMaterial(true)}
            className="px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Material
          </button>
        </div>

        {materials.length === 0 ? (
          <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-xl p-8 text-center">
            <svg className="w-12 h-12 text-accent-pink mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            <p className="text-accent-pink mb-3">No materials uploaded yet</p>
            <button
              onClick={() => setShowAddMaterial(true)}
              className="px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Your First Material
            </button>
          </div>
        ) : (
          <div className="bg-panel border border-accent-cyan/20 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-accent-cyan/5">
                <tr className="border-b border-accent-cyan/30">
                  <th className="text-left text-text-primary text-sm font-medium p-4">Material Name</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Type</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Notes</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Added</th>
                  <th className="text-left text-text-primary text-sm font-medium p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="border-b border-accent-cyan/10 hover:bg-background/50">
                    <td className="p-4 text-text-primary font-medium">{material.material_name}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan rounded-full text-xs font-medium">
                        {material.material_type}
                      </span>
                    </td>
                    <td className="p-4 text-text-muted text-sm max-w-xs truncate">
                      {material.notes || '-'}
                    </td>
                    <td className="p-4 text-text-muted text-sm">
                      {new Date(material.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenMaterial(material)}
                          className="px-3 py-1.5 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                                   transition-colors text-sm font-medium"
                          title="Open file location"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => openEditMaterialDialog(material)}
                          className="px-3 py-1.5 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                                   hover:border-accent-cyan transition-colors text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(material)}
                          className="px-3 py-1.5 bg-accent-pink text-background rounded-lg hover:bg-accent-pink/90 
                                   transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Material Dialog */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-text-primary mb-6">Add Outreach Material</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Material Name <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="text"
                  value={materialForm.materialName}
                  onChange={(e) => setMaterialForm({ ...materialForm, materialName: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                  placeholder="e.g., Internet Safety Presentation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Type <span className="text-accent-pink">*</span>
                </label>
                <select
                  value={materialForm.materialType}
                  onChange={(e) => setMaterialForm({ ...materialForm, materialType: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                >
                  <option value="">Select type...</option>
                  <option value="Powerpoint">Powerpoint</option>
                  <option value="PDF">PDF</option>
                  <option value="Video">Video</option>
                  <option value="Worksheet">Worksheet</option>
                  <option value="Handout">Handout</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  File <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan file:mr-4 file:py-2 file:px-4
                           file:rounded-lg file:border-0 file:bg-accent-cyan file:text-background file:cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                  placeholder="Additional information about this material..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddMaterial(false);
                  setMaterialForm({ materialName: '', materialType: '', notes: '', file: null });
                }}
                disabled={uploading}
                className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-cyan transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMaterial}
                disabled={uploading}
                className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Add Material'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Material Dialog */}
      {showEditMaterial && selectedMaterial && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-text-primary mb-6">Edit Material</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Material Name <span className="text-accent-pink">*</span>
                </label>
                <input
                  type="text"
                  value={materialForm.materialName}
                  onChange={(e) => setMaterialForm({ ...materialForm, materialName: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Type <span className="text-accent-pink">*</span>
                </label>
                <select
                  value={materialForm.materialType}
                  onChange={(e) => setMaterialForm({ ...materialForm, materialType: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan"
                >
                  <option value="">Select type...</option>
                  <option value="Powerpoint">Powerpoint</option>
                  <option value="PDF">PDF</option>
                  <option value="Video">Video</option>
                  <option value="Worksheet">Worksheet</option>
                  <option value="Handout">Handout</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                           text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                />
              </div>

              <div className="text-xs text-text-muted bg-accent-cyan/10 rounded p-3">
                Note: File cannot be changed. Delete and re-add if you need to change the file.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditMaterial(false);
                  setSelectedMaterial(null);
                  setMaterialForm({ materialName: '', materialType: '', notes: '', file: null });
                }}
                className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-cyan transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditMaterial}
                className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
