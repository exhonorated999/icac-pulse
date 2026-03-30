import { useState, useEffect } from 'react';

interface Warrant {
  id?: number;
  case_id: number;
  company_name: string;
  date_issued: string;
  date_served?: string;
  date_due: string;
  warrant_pdf_path?: string;
  received: boolean;
  date_received?: string;
  return_files_path?: string;
  notes?: string;
}

interface WarrantsTabProps {
  caseId: number;
  caseNumber: string;
}

export function WarrantsTab({ caseId, caseNumber }: WarrantsTabProps) {
  const [warrants, setWarrants] = useState<Warrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWarrant, setEditingWarrant] = useState<Warrant | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Warrant>>({
    company_name: '',
    date_issued: '',
    date_served: '',
    date_due: '',
    notes: '',
    received: false,
  });
  
  const [pendingPdfPath, setPendingPdfPath] = useState<string | null>(null);

  useEffect(() => {
    loadWarrants();
  }, [caseId]);

  const loadWarrants = async () => {
    try {
      const data = await window.electronAPI.getWarrants(caseId);
      console.log('Warrants loaded:', data);
      setWarrants(data || []);
    } catch (error) {
      console.error('Failed to load warrants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWarrant = () => {
    setEditingWarrant(null);
    setFormData({
      company_name: '',
      date_issued: new Date().toISOString().split('T')[0],
      date_served: '',
      date_due: '',
      notes: '',
      received: false,
    });
    setPendingPdfPath(null);
    setShowAddForm(true);
  };
  
  const handleUploadPdfForNewWarrant = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        title: 'Select Warrant PDF'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      setPendingPdfPath(result.filePaths[0]);
      window.focus();
    } catch (error) {
      console.error('Failed to select PDF:', error);
      alert('Failed to select PDF file');
    }
  };

  const handleEditWarrant = (warrant: Warrant) => {
    setEditingWarrant(warrant);
    setFormData(warrant);
    setShowAddForm(true);
  };

  const handleSaveWarrant = async () => {
    try {
      if (!formData.date_issued || !formData.date_due) {
        alert('Please fill in Date Issued and Production Due Date');
        return;
      }

      let savedWarrantId: number;

      if (editingWarrant) {
        // Update existing warrant
        await window.electronAPI.updateWarrant(editingWarrant.id!, {
          ...formData,
          case_id: caseId,
        });
        savedWarrantId = editingWarrant.id!;
      } else {
        // Add new warrant
        const result = await window.electronAPI.addWarrant({
          ...formData,
          case_id: caseId,
        });
        savedWarrantId = result.id;
      }
      
      // If there's a pending PDF, upload it now
      if (pendingPdfPath && !editingWarrant) {
        try {
          const cleanCompanyName = (formData.company_name || 'Warrant').replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
          const fileName = `${cleanCompanyName}_${formData.date_issued}_warrant.pdf`;
          
          await window.electronAPI.uploadCaseFile({
            caseNumber,
            category: 'warrants',
            sourcePath: pendingPdfPath,
            filename: fileName,
          });
        } catch (pdfError) {
          console.error('Failed to upload PDF:', pdfError);
          alert('Warrant saved but PDF upload failed. You can upload it from the warrant list.');
        }
      }

      await loadWarrants();
      setShowAddForm(false);
      setFormData({});
      setEditingWarrant(null);
      setPendingPdfPath(null);
      
      // Restore focus after async operations
      window.focus();
    } catch (error) {
      console.error('Failed to save warrant:', error);
      window.focus(); // Restore focus even on error
      alert('Failed to save warrant');
    }
  };

  const handleUploadWarrantPDF = async (warrantId: number) => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const filePath = result.filePaths[0];
      const warrant = warrants.find(w => w.id === warrantId);
      
      if (!warrant) return;

      // Clean company name and create filename
      const cleanCompanyName = warrant.company_name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
      const fileName = `${cleanCompanyName}_${warrant.date_issued}_warrant.pdf`;
      
      console.log('Uploading warrant PDF:', fileName);

      // Copy to case directory
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber,
        category: 'warrants',
        sourcePath: filePath,
        filename: fileName,
      });

      console.log('Upload result:', uploadResult);

      // Update warrant record with relative path
      await window.electronAPI.updateWarrant(warrantId, {
        warrant_pdf_path: uploadResult.relativePath || `warrants/${fileName}`,
      });

      await loadWarrants();
      
      alert('Warrant PDF uploaded successfully!');
      
      // Restore focus after alert - focus on main content
      setTimeout(() => {
        window.focus();
        document.body.focus();
        // Try to focus a button in the warrants list
        const button = document.querySelector<HTMLButtonElement>('button');
        if (button) {
          button.focus();
        }
      }, 150);
    } catch (error) {
      console.error('Failed to upload warrant PDF:', error);
      alert(`Failed to upload warrant PDF: ${error}`);
    }
  };

  const handleUploadWarrantReturn = async (warrantId: number) => {
    try {
      const result = await window.electronAPI.openFolderDialog({
        properties: ['openDirectory', 'openFile', 'multiSelections'],
        title: 'Select Warrant Return Files or Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const warrant = warrants.find(w => w.id === warrantId);
      if (!warrant) return;

      // Clean company name for folder name
      const cleanCompanyName = warrant.company_name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
      const returnFolderName = `${cleanCompanyName}_${warrant.date_issued}_return`;

      console.log('Uploading warrant returns for:', returnFolderName);

      // Create the return folder path
      const returnCategory = `warrants/${returnFolderName}`;
      
      // Upload each selected file/folder
      let uploadedPaths: string[] = [];
      for (const sourcePath of result.filePaths) {
        console.log('Uploading:', sourcePath);
        
        const uploadResult = await window.electronAPI.uploadCaseFile({
          caseNumber,
          category: returnCategory,
          sourcePath,
          filename: '', // Let it use original filename/foldername
        });
        
        if (uploadResult.relativePath) {
          uploadedPaths.push(uploadResult.relativePath);
        }
      }

      console.log('Uploaded paths:', uploadedPaths);

      // Update warrant record with the return folder path
      // Store the full path including case number: caseNumber/warrants/returnFolder
      const returnFolderPath = `${caseNumber}/${returnCategory}`;
      
      await window.electronAPI.updateWarrant(warrantId, {
        return_files_path: returnFolderPath,
      });

      await loadWarrants();
      
      alert(`Successfully uploaded ${result.filePaths.length} item(s) to warrant returns!`);
      
      // Restore focus after alert - focus on main content
      setTimeout(() => {
        window.focus();
        document.body.focus();
        // Try to focus a button in the warrants list
        const button = document.querySelector<HTMLButtonElement>('button');
        if (button) {
          button.focus();
        }
      }, 150);
    } catch (error) {
      console.error('Failed to upload warrant return:', error);
      alert(`Failed to upload warrant return files: ${error}`);
    }
  };

  const handleMarkReceived = async (warrantId: number) => {
    try {
      await window.electronAPI.updateWarrant(warrantId, {
        received: true,
        date_received: new Date().toISOString().split('T')[0],
      });

      await loadWarrants();
      
      // Restore focus after async operations
      window.focus();
    } catch (error) {
      console.error('Failed to mark warrant as received:', error);
      window.focus(); // Restore focus even on error
      alert('Failed to mark warrant as received');
    }
  };

  const handleDeleteWarrant = async (warrantId: number) => {
    if (!window.confirm('Are you sure you want to delete this warrant?')) {
      return;
    }

    try {
      await window.electronAPI.deleteWarrant(warrantId);
      await loadWarrants();
      
      // Restore focus after async operations
      window.focus();
    } catch (error) {
      console.error('Failed to delete warrant:', error);
      window.focus(); // Restore focus even on error
      alert('Failed to delete warrant');
    }
  };

  const getDaysOverdue = (dateDue: string) => {
    const due = new Date(dateDue);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (warrant: Warrant) => {
    if (warrant.received) return false;
    const daysOverdue = getDaysOverdue(warrant.date_due);
    return daysOverdue > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-text-primary">Search Warrants</h3>
          <p className="text-text-muted">Track warrant issuance, service, and returns</p>
        </div>
        <button
          onClick={handleAddWarrant}
          className="px-6 py-3 bg-accent-cyan text-background font-bold rounded-lg 
                   hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Warrant
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
          <h4 className="text-xl font-bold text-text-primary mb-4">
            {editingWarrant ? 'Edit Warrant' : 'Add New Warrant'}
          </h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={formData.company_name || ''}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                placeholder="e.g., Facebook, Google"
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary placeholder-text-muted
                         focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Date Issued <span className="text-accent-pink">*</span>
              </label>
              <input
                type="date"
                value={formData.date_issued || ''}
                onChange={(e) => setFormData({...formData, date_issued: e.target.value})}
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Date Served
              </label>
              <input
                type="date"
                value={formData.date_served || ''}
                onChange={(e) => setFormData({...formData, date_served: e.target.value})}
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Production Due Date <span className="text-accent-pink">*</span>
              </label>
              <input
                type="date"
                value={formData.date_due || ''}
                onChange={(e) => setFormData({...formData, date_due: e.target.value})}
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-muted mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                placeholder="Additional information about this warrant..."
                className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary placeholder-text-muted
                         focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>
            
            {/* Warrant PDF Upload (for new warrants only) */}
            {!editingWarrant && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Warrant PDF (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleUploadPdfForNewWarrant}
                  className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary hover:border-accent-cyan transition-colors
                           flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {pendingPdfPath ? (
                    <span className="text-accent-cyan">PDF Selected: {pendingPdfPath.split('\\').pop()}</span>
                  ) : (
                    <span>Upload Warrant PDF</span>
                  )}
                </button>
                {pendingPdfPath && (
                  <p className="text-xs text-accent-cyan mt-1">PDF will be uploaded when warrant is saved</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingWarrant(null);
                setFormData({});
              }}
              className="px-6 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg 
                       hover:border-accent-cyan transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWarrant}
              className="px-6 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 transition-colors"
            >
              {editingWarrant ? 'Update' : 'Add'} Warrant
            </button>
          </div>
        </div>
      )}

      {/* Warrants List */}
      {warrants.length === 0 ? (
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Warrants Yet</h3>
          <p className="text-text-muted mb-6">Add your first search warrant to start tracking</p>
          <button
            onClick={handleAddWarrant}
            className="px-6 py-3 bg-accent-cyan text-background font-bold rounded-lg 
                     hover:bg-accent-cyan/90 transition-colors"
          >
            Add Your First Warrant
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {warrants.map((warrant) => {
            const overdue = isOverdue(warrant);
            const daysOverdue = overdue ? getDaysOverdue(warrant.date_due) : 0;

            return (
              <div
                key={warrant.id}
                className={`bg-panel border rounded-lg p-6 ${
                  overdue 
                    ? 'border-accent-pink bg-accent-pink/5' 
                    : warrant.received 
                    ? 'border-status-success/30' 
                    : 'border-accent-cyan/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-bold text-text-primary">
                        {warrant.company_name}
                      </h4>
                      {warrant.received ? (
                        <span className="px-3 py-1 bg-status-success/20 text-status-success text-xs font-medium rounded-full">
                          ✓ Received
                        </span>
                      ) : overdue ? (
                        <span className="px-3 py-1 bg-accent-pink text-background text-xs font-bold rounded-full animate-pulse">
                          ⚠ {daysOverdue} days overdue
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan text-xs font-medium rounded-full">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-text-muted">Issued:</span>
                        <span className="text-text-primary ml-2 font-medium">
                          {new Date(warrant.date_issued).toLocaleDateString()}
                        </span>
                      </div>
                      {warrant.date_served && (
                        <div>
                          <span className="text-text-muted">Served:</span>
                          <span className="text-text-primary ml-2 font-medium">
                            {new Date(warrant.date_served).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-text-muted">Due:</span>
                        <span className={`ml-2 font-medium ${overdue ? 'text-accent-pink' : 'text-text-primary'}`}>
                          {new Date(warrant.date_due).toLocaleDateString()}
                        </span>
                      </div>
                      {warrant.date_received && (
                        <div>
                          <span className="text-text-muted">Received:</span>
                          <span className="text-status-success ml-2 font-medium">
                            {new Date(warrant.date_received).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {warrant.notes && (
                      <p className="text-text-muted text-sm mt-2">{warrant.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditWarrant(warrant)}
                      className="p-2 text-text-muted hover:text-accent-cyan transition-colors"
                      title="Edit Warrant"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteWarrant(warrant.id!)}
                      className="p-2 text-text-muted hover:text-accent-pink transition-colors"
                      title="Delete Warrant"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-accent-cyan/20">
                  <button
                    onClick={() => handleUploadWarrantPDF(warrant.id!)}
                    className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg 
                             hover:border-accent-cyan hover:text-accent-cyan transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {warrant.warrant_pdf_path ? 'Update' : 'Upload'} Warrant PDF
                  </button>

                  {warrant.warrant_pdf_path && (
                    <button
                      onClick={() => window.electronAPI.openFileLocation(warrant.warrant_pdf_path!)}
                      className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                               hover:border-accent-cyan transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View PDF
                    </button>
                  )}

                  {!warrant.received && (
                    <button
                      onClick={() => handleMarkReceived(warrant.id!)}
                      className="px-4 py-2 bg-status-success text-background font-medium rounded-lg 
                               hover:bg-status-success/90 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark as Received
                    </button>
                  )}

                  <button
                    onClick={() => handleUploadWarrantReturn(warrant.id!)}
                    className="px-4 py-2 bg-accent-cyan text-background font-medium rounded-lg 
                             hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {warrant.return_files_path ? 'Update' : 'Attach'} Returns
                  </button>

                  {warrant.return_files_path && (
                    <button
                      onClick={() => window.electronAPI.openFileLocation(warrant.return_files_path!)}
                      className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                               hover:border-accent-cyan transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      View Returns
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
