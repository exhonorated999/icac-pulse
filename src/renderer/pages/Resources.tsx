import { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';

interface Resource {
  id: number;
  title: string;
  resource_type: string | null;
  file_path: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    resourceType: '',
    notes: '',
    file: null as File | null
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const data = await window.electronAPI.getAllResources();
      setResources(data || []);
    } catch (error) {
      console.error('Failed to load resources:', error);
      alert(`Failed to load resources: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddResource = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title for the resource');
      return;
    }

    if (!formData.file) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      // Upload file first
      const result = await window.electronAPI.uploadFile({
        sourcePath: (formData.file as any).path,
        caseNumber: 'resources', // Use 'resources' as the folder name
        category: '',
        filename: formData.file.name
      });

      // Add to database
      await window.electronAPI.addResource({
        title: formData.title,
        resourceType: formData.resourceType || null,
        filePath: result.relativePath,
        notes: formData.notes || null
      });

      // Reload resources
      await loadResources();

      // Reset form
      setFormData({
        title: '',
        resourceType: '',
        notes: '',
        file: null
      });
      setShowAddDialog(false);
      
    } catch (error) {
      console.error('Failed to add resource:', error);
      alert(`Failed to add resource: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditResource = async () => {
    if (!selectedResource) return;

    if (!formData.title.trim()) {
      alert('Please enter a title for the resource');
      return;
    }

    try {
      await window.electronAPI.updateResource(selectedResource.id, {
        title: formData.title,
        resourceType: formData.resourceType || null,
        notes: formData.notes || null
      });

      await loadResources();
      setShowEditDialog(false);
      setSelectedResource(null);
      setFormData({
        title: '',
        resourceType: '',
        notes: '',
        file: null
      });
    } catch (error) {
      console.error('Failed to update resource:', error);
      alert(`Failed to update resource: ${error}`);
    }
  };

  const handleDeleteResource = async (resource: Resource) => {
    if (!confirm(`Delete resource "${resource.title}"?\n\nThis will permanently delete the file and database entry.`)) {
      return;
    }

    try {
      await window.electronAPI.deleteResource(resource.id);
      await loadResources();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      alert(`Failed to delete resource: ${error}`);
    }
  };

  const handleOpenFile = (resource: Resource) => {
    window.electronAPI.openFileLocation(resource.file_path);
  };

  const openEditDialog = (resource: Resource) => {
    setSelectedResource(resource);
    setFormData({
      title: resource.title,
      resourceType: resource.resource_type || '',
      notes: resource.notes || '',
      file: null
    });
    setShowEditDialog(true);
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'pdf':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5z"/>
            <text x="10" y="13" fontSize="8" textAnchor="middle" fill="currentColor">PDF</text>
          </svg>
        );
      case 'ppt':
      case 'pptx':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
        );
      case 'mp4':
      case 'avi':
      case 'mov':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        );
      case 'exe':
      case 'msi':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Loading resources...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-text-primary mb-2">Resources</h1>
            <p className="text-text-muted">Manage training materials, documents, and software</p>
          </div>
          
          <button
            onClick={() => setShowAddDialog(true)}
            className="px-6 py-3 bg-accent-cyan text-background rounded-lg font-medium
                     hover:bg-accent-cyan/90 transition-colors flex items-center gap-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Resource
          </button>
        </div>

        {/* Resources Grid */}
        {resources.length === 0 ? (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-accent-cyan/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No Resources Yet</h3>
            <p className="text-text-muted mb-4">Add training materials, documents, or software to get started</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-6 py-2 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Your First Resource
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-panel border border-accent-cyan/20 rounded-lg p-6 hover:border-accent-cyan/50 transition-colors"
              >
                {/* Icon and Type */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-accent-cyan">
                      {getFileIcon(resource.file_path)}
                    </div>
                    {resource.resource_type && (
                      <span className="text-xs px-2 py-1 bg-accent-cyan/20 text-accent-cyan rounded">
                        {resource.resource_type}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatDate(resource.created_at)}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2">
                  {resource.title}
                </h3>

                {/* Notes */}
                {resource.notes && (
                  <p className="text-sm text-text-muted mb-4 line-clamp-3">
                    {resource.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-accent-cyan/20">
                  <button
                    onClick={() => handleOpenFile(resource)}
                    className="flex-1 px-3 py-2 bg-accent-cyan text-background rounded-lg text-sm font-medium
                             hover:bg-accent-cyan/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    Open
                  </button>
                  <button
                    onClick={() => openEditDialog(resource)}
                    className="px-3 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg text-sm font-medium
                             hover:border-accent-cyan transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteResource(resource)}
                    className="px-3 py-2 bg-background border border-accent-pink/30 text-accent-pink rounded-lg text-sm font-medium
                             hover:border-accent-pink transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Resource Dialog */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
                <svg className="w-8 h-8 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add Resource
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Title <span className="text-accent-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                    placeholder="Enter resource title"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Type (optional)
                  </label>
                  <select
                    value={formData.resourceType}
                    onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="">Select type...</option>
                    <option value="PDF">PDF</option>
                    <option value="Powerpoint">Powerpoint</option>
                    <option value="Video">Video</option>
                    <option value="Software">Software</option>
                    <option value="Document">Document</option>
                    <option value="Spreadsheet">Spreadsheet</option>
                    <option value="Image">Image</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* File */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    File <span className="text-accent-pink">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan file:mr-4 file:py-2 file:px-4
                             file:rounded-lg file:border-0 file:bg-accent-cyan file:text-background file:cursor-pointer"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                    placeholder="Add any notes about this resource..."
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setFormData({ title: '', resourceType: '', notes: '', file: null });
                  }}
                  disabled={uploading}
                  className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                           hover:border-accent-cyan transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddResource}
                  disabled={uploading}
                  className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                           hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    'Add Resource'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Resource Dialog */}
        {showEditDialog && selectedResource && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full mx-4">
              <h3 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
                <svg className="w-8 h-8 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit Resource
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Title <span className="text-accent-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                    placeholder="Enter resource title"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Type (optional)
                  </label>
                  <select
                    value={formData.resourceType}
                    onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="">Select type...</option>
                    <option value="PDF">PDF</option>
                    <option value="Powerpoint">Powerpoint</option>
                    <option value="Video">Video</option>
                    <option value="Software">Software</option>
                    <option value="Document">Document</option>
                    <option value="Spreadsheet">Spreadsheet</option>
                    <option value="Image">Image</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                    placeholder="Add any notes about this resource..."
                  />
                </div>

                <div className="text-xs text-text-muted bg-accent-cyan/10 rounded p-3">
                  Note: File cannot be changed. Delete and re-add if you need to change the file.
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedResource(null);
                    setFormData({ title: '', resourceType: '', notes: '', file: null });
                  }}
                  className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                           hover:border-accent-cyan transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditResource}
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
    </div>
  );
}
