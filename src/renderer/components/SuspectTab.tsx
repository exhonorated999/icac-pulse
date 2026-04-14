import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Suspect {
  id?: number;
  case_id: number;
  first_name?: string;
  last_name?: string;
  name?: string;
  dob?: string;
  drivers_license?: string;
  address?: string;
  phone?: string;
  phone_carrier?: string;
  phone_line_type?: string;
  phone_location?: string;
  workplace?: string;
  place_of_work?: string;
  height?: string;
  weight?: string;
  hair_color?: string;
  eye_color?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  has_weapons?: boolean;
  firearms_info?: string;
  firearms_pdf_path?: string;
  criminal_history?: string;
  criminal_history_pdf_path?: string;
  latitude?: number;
  longitude?: number;
  geocoded_date?: string;
}

interface SuspectPhoto {
  id: number;
  suspect_id: number;
  photo_path: string;
  photo_type: 'suspect' | 'vehicle' | 'residence';
  description?: string;
  created_at: string;
}

interface SuspectTabProps {
  caseId: number;
  caseNumber: string;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SuspectTab({ caseId, caseNumber, showToast }: SuspectTabProps) {
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [photos, setPhotos] = useState<SuspectPhoto[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [exporting, setExporting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [firearmsMode, setFirearmsMode] = useState<'manual' | 'pdf'>('manual');
  const [crimHistoryMode, setCrimHistoryMode] = useState<'manual' | 'pdf'>('manual');
  
  const [formData, setFormData] = useState<Partial<Suspect>>({
    first_name: '',
    last_name: '',
    dob: '',
    drivers_license: '',
    address: '',
    phone: '',
    place_of_work: '',
    height: '',
    weight: '',
    hair_color: '',
    eye_color: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_color: '',
    has_weapons: false,
    firearms_info: '',
    firearms_pdf_path: '',
    criminal_history: '',
    criminal_history_pdf_path: '',
  });

  useEffect(() => {
    loadSuspectData();
  }, [caseId]);

  // Check if carrier lookup is enabled
  const isCarrierLookupEnabled = () => {
    return localStorage.getItem('veriphoneEnabled') === 'true';
  };

  const handleCarrierLookup = async () => {
    if (!formData.phone) {
      showToast?.('Please enter a phone number first', 'error');
      return;
    }

    try {
      showToast?.('Looking up carrier via Veriphone...', 'info');
      
      const result = await window.electronAPI.carrierLookup(formData.phone);
      
      // Restore focus after async operation
      window.focus();
      
      if (result.success && result.carrier) {
        // Update formData with carrier info
        setFormData({
          ...formData,
          phone_carrier: result.carrier,
          phone_line_type: result.lineType || null,
          phone_location: result.location || null
        });
        
        const details = result.lineType ? ` (${result.lineType})` : '';
        const location = result.location ? ` - ${result.location}` : '';
        showToast?.(`Carrier: ${result.carrier}${details}${location}`, 'success');
      } else {
        showToast?.(`Carrier lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Carrier lookup error:', error);
      window.focus(); // Restore focus even on error
      showToast?.(`Failed to lookup carrier: ${error}`, 'error');
    }
  };

  const handleGeocodeAddress = async () => {
    if (!suspect?.address || !suspect?.id) {
      showToast?.('Please enter an address first', 'error');
      return;
    }

    try {
      setGeocoding(true);
      showToast?.('Geocoding address via OpenStreetMap...', 'info');
      
      const result = await window.electronAPI.geocodeAddress(suspect.address, suspect.id);
      
      if (result.success) {
        // Update suspect data with coordinates
        setSuspect(prevSuspect => {
          if (!prevSuspect) return prevSuspect;
          return {
            ...prevSuspect,
            latitude: result.latitude,
            longitude: result.longitude,
            geocoded_date: new Date().toISOString()
          };
        });
        
        showToast?.(`Address geocoded successfully`, 'success');
        
        // Restore focus
        window.focus();
      } else {
        showToast?.(`Geocoding failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      showToast?.(`Failed to geocode address: ${error}`, 'error');
    } finally {
      setGeocoding(false);
    }
  };

  const loadSuspectData = async () => {
    try {
      const suspectData = await window.electronAPI.getSuspect(caseId);
      console.log('Suspect data loaded:', suspectData);
      
      if (suspectData) {
        setSuspect(suspectData);
        setFormData(suspectData);
        if (suspectData.firearms_pdf_path) setFirearmsMode('pdf');
        if (suspectData.criminal_history_pdf_path) setCrimHistoryMode('pdf');
        
        // Load photos
        console.log('Loading photos for suspect ID:', suspectData.id);
        const photoData = await window.electronAPI.getSuspectPhotos(suspectData.id);
        console.log('Photos loaded:', photoData);
        setPhotos(photoData || []);
      } else {
        console.log('No suspect data found for case:', caseId);
        setPhotos([]);
      }
    } catch (error) {
      console.error('Failed to load suspect data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const suspectData = {
        ...formData,
        case_id: caseId,
      };
      
      console.log('=== SAVING SUSPECT DATA ===');
      console.log('Form data being sent:', suspectData);
      console.log('Hair color:', suspectData.hair_color);
      console.log('Eye color:', suspectData.eye_color);
      
      const saved = await window.electronAPI.saveSuspect(suspectData);
      console.log('Suspect saved, received back:', saved);
      console.log('Saved hair color:', saved?.hair_color);
      console.log('Saved eye color:', saved?.eye_color);
      
      setSuspect(saved);
      setEditMode(false);
      
      // Reload to get updated data
      await loadSuspectData();
      
      // Restore focus after async operations
      window.focus();
      
      if (showToast) showToast('Suspect information saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save suspect:', error);
      window.focus(); // Restore focus even on error
      if (showToast) showToast('Failed to save suspect information', 'error');
    }
  };

  const handleCancel = () => {
    if (suspect) {
      setFormData(suspect);
    }
    setEditMode(false);
  };

  const handleUploadPhoto = async (photoType: 'suspect' | 'vehicle' | 'residence') => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
        ],
        title: `Select ${photoType === 'suspect' ? 'Suspect' : photoType === 'vehicle' ? 'Vehicle' : 'Residence'} Photo(s)`
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      // If suspect doesn't exist, create it automatically
      let suspectId = suspect?.id;
      if (!suspectId) {
        const suspectData = {
          case_id: caseId,
          first_name: '',
          last_name: '',
        };
        const saved = await window.electronAPI.saveSuspect(suspectData);
        suspectId = saved.id;
        setSuspect(saved);
      }

      // Upload each photo
      for (const filePath of result.filePaths) {
        const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'photo.jpg';
        const timestamp = Date.now();
        const uniqueFileName = `${photoType}_${timestamp}_${fileName}`;
        
        console.log('Uploading photo:', { filePath, uniqueFileName, photoType });
        
        // Copy to suspect folder
        const uploadResult = await window.electronAPI.uploadCaseFile({
          caseNumber,
          category: 'suspect',
          sourcePath: filePath,
          filename: uniqueFileName,
        });

        console.log('Upload result:', uploadResult);

        // Save to database
        const photoRecord = {
          suspect_id: suspectId,
          photo_path: uploadResult.relativePath,
          photo_type: photoType,
          description: '',
        };
        
        console.log('Saving photo to database:', photoRecord);
        const savedPhoto = await window.electronAPI.addSuspectPhoto(photoRecord);
        console.log('Photo saved to database:', savedPhoto);
      }

      // Reload all suspect data including photos
      console.log('Reloading suspect data after photo upload...');
      await loadSuspectData();
      
      if (showToast) showToast(`${result.filePaths.length} photo(s) uploaded successfully!`, 'success');
    } catch (error) {
      console.error('Failed to upload photo:', error);
      if (showToast) showToast(`Failed to upload photo: ${error}`, 'error');
    }
  };

  const handleExportPDF = async () => {
    if (!suspect) {
      if (showToast) showToast('No suspect data to export', 'error');
      return;
    }

    setExporting(true);
    try {
      await window.electronAPI.exportSuspectPdf(caseId, caseNumber);
      
      // Restore focus after async operation
      window.focus();
      
      if (showToast) showToast('Suspect report exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export suspect PDF:', error);
      window.focus(); // Restore focus even on error
      if (showToast) showToast(`Failed to export PDF: ${error}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await window.electronAPI.deleteSuspectPhoto(photoId);
      
      // Reload photos
      if (suspect?.id) {
        const photoData = await window.electronAPI.getSuspectPhotos(suspect.id);
        setPhotos(photoData || []);
      }
      
      // Restore focus after async operations
      window.focus();
      
      if (showToast) showToast('Photo deleted successfully!', 'success');
    } catch (error) {
      console.error('Failed to delete photo:', error);
      window.focus(); // Restore focus even on error
      if (showToast) showToast('Failed to delete photo', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-text-muted">Loading suspect information...</div>
      </div>
    );
  }

  const handleUploadRecordPdf = async (field: 'firearms_pdf_path' | 'criminal_history_pdf_path', category: string, title: string) => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        title
      });
      if (result.canceled || !result.filePaths?.length) return;
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber, category, sourcePath: result.filePaths[0], filename: result.filePaths[0].split(/[\\/]/).pop(),
      });
      const updated = { ...formData, [field]: uploadResult.relativePath };
      setFormData(updated);
      // Auto-save
      if (suspect?.id) {
        await window.electronAPI.saveSuspect({ ...updated, case_id: caseId });
        setSuspect(prev => prev ? { ...prev, [field]: uploadResult.relativePath } : prev);
      }
      showToast?.('PDF uploaded', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Failed to upload PDF', 'error');
    }
  };

  const suspectPhotos = photos.filter(p => p.photo_type === 'suspect');
  const vehiclePhotos = photos.filter(p => p.photo_type === 'vehicle');
  const residencePhotos = photos.filter(p => p.photo_type === 'residence');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Suspect Information</h2>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button
                onClick={handleExportPDF}
                disabled={exporting || !suspect}
                className="px-4 py-2 bg-accent-pink/10 border border-accent-pink/30 text-accent-pink rounded-lg 
                         hover:bg-accent-pink/20 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-accent-cyan text-background rounded-lg 
                         hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg 
                         hover:border-accent-cyan transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-accent-cyan text-background rounded-lg 
                         hover:bg-accent-cyan/90 transition-colors"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Identity Card ─────────────────────────────────────────── */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
        <h3 className="text-base font-semibold text-accent-cyan mb-5">Identity</h3>

        {/* Hero row: mugshot + core identity fields */}
        <div className="flex gap-6">

          {/* Mugshot column */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3" style={{ width: '180px' }}>
            {suspectPhotos.length === 0 ? (
              <div className="w-full aspect-[3/4] bg-background rounded-lg border-2 border-dashed border-accent-cyan/30 
                              flex flex-col items-center justify-center gap-2">
                <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-text-muted text-center">No photo</span>
              </div>
            ) : (
              <div className="relative group w-full aspect-[3/4] bg-background rounded-lg overflow-hidden border border-accent-cyan/20">
                <img
                  src={`icac-case-file://${suspectPhotos[0].photo_path}`}
                  alt="Suspect"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => window.electronAPI.openFileLocation(suspectPhotos[0].photo_path)}
                />
                <button
                  onClick={() => handleDeletePhoto(suspectPhotos[0].id)}
                  className="absolute top-2 right-2 p-1.5 bg-accent-pink rounded-lg opacity-0 group-hover:opacity-100 
                           transition-opacity hover:bg-accent-pink/80"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={() => handleUploadPhoto('suspect')}
              className="w-full px-2 py-1.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs 
                         rounded-lg hover:bg-accent-cyan/20 transition-colors text-center"
            >
              + Upload Photo
            </button>
            {/* Additional suspect photos strip */}
            {suspectPhotos.length > 1 && (
              <div className="grid grid-cols-3 gap-1 w-full">
                {suspectPhotos.slice(1).map((photo) => (
                  <div key={photo.id} className="relative group aspect-square bg-background rounded overflow-hidden border border-accent-cyan/20">
                    <img
                      src={`icac-case-file://${photo.photo_path}`}
                      alt="Suspect"
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.electronAPI.openFileLocation(photo.photo_path)}
                    />
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 bg-accent-pink rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Core identity fields */}
          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4 content-start">
            {/* Full name spanning both cols */}
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">First Name</label>
              {editMode ? (
                <input type="text" value={formData.first_name || ''}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-base focus:outline-none focus:border-accent-cyan" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.first_name || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Last Name</label>
              {editMode ? (
                <input type="text" value={formData.last_name || ''}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-base focus:outline-none focus:border-accent-cyan" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.last_name || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Date of Birth</label>
              {editMode ? (
                <input type="date" value={formData.dob || ''}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-base focus:outline-none focus:border-accent-cyan" />
              ) : (
                <p className="text-text-primary text-base">{suspect?.dob || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Driver's License</label>
              {editMode ? (
                <input type="text" value={formData.drivers_license || ''}
                  onChange={(e) => setFormData({ ...formData, drivers_license: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-base focus:outline-none focus:border-accent-cyan" />
              ) : (
                <p className="text-text-primary text-base font-mono">{suspect?.drivers_license || 'N/A'}</p>
              )}
            </div>

            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium text-text-muted">Phone Number</label>
                {(formData.phone_carrier || suspect?.phone_carrier) && (
                  <span className="text-xs px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded-full border border-accent-cyan/30">
                    {formData.phone_carrier || suspect?.phone_carrier}
                    {(formData.phone_line_type || suspect?.phone_line_type) && ` • ${formData.phone_line_type || suspect?.phone_line_type}`}
                    {(formData.phone_location || suspect?.phone_location) && ` • ${formData.phone_location || suspect?.phone_location}`}
                  </span>
                )}
              </div>
              {editMode ? (
                <div className="flex gap-2">
                  <input type="tel" value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="flex-1 px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                             text-text-primary text-base focus:outline-none focus:border-accent-cyan" />
                  {isCarrierLookupEnabled() && formData.phone && (
                    <button type="button" onClick={handleCarrierLookup}
                      className="px-3 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                               hover:bg-accent-cyan/10 transition-colors text-sm flex items-center gap-1">
                      <span>📱</span> Lookup
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-text-primary text-base font-mono">{suspect?.phone || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Physical description strip ── */}
        <div className="mt-6 pt-5 border-t border-accent-cyan/10">
          <p className="text-sm font-medium text-text-muted mb-3">Physical Description</p>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-background rounded-lg px-4 py-3 border border-accent-cyan/10">
              <label className="block text-sm font-medium text-text-muted mb-1">Height</label>
              {editMode ? (
                <input type="text" placeholder="e.g. 5'10&quot;" value={formData.height || ''}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  className="w-full bg-transparent text-text-primary text-base focus:outline-none" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.height || 'N/A'}</p>
              )}
            </div>
            <div className="bg-background rounded-lg px-4 py-3 border border-accent-cyan/10">
              <label className="block text-sm font-medium text-text-muted mb-1">Weight</label>
              {editMode ? (
                <input type="text" placeholder="e.g. 180 lbs" value={formData.weight || ''}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full bg-transparent text-text-primary text-base focus:outline-none" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.weight || 'N/A'}</p>
              )}
            </div>
            <div className="bg-background rounded-lg px-4 py-3 border border-accent-cyan/10">
              <label className="block text-sm font-medium text-text-muted mb-1">Hair Color</label>
              {editMode ? (
                <input type="text" placeholder="e.g. Brown" value={formData.hair_color || ''}
                  onChange={(e) => setFormData({ ...formData, hair_color: e.target.value })}
                  className="w-full bg-transparent text-text-primary text-base focus:outline-none" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.hair_color || 'N/A'}</p>
              )}
            </div>
            <div className="bg-background rounded-lg px-4 py-3 border border-accent-cyan/10">
              <label className="block text-sm font-medium text-text-muted mb-1">Eye Color</label>
              {editMode ? (
                <input type="text" placeholder="e.g. Blue" value={formData.eye_color || ''}
                  onChange={(e) => setFormData({ ...formData, eye_color: e.target.value })}
                  className="w-full bg-transparent text-text-primary text-base focus:outline-none" />
              ) : (
                <p className="text-text-primary text-base font-medium">{suspect?.eye_color || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Residence + Vehicle — side by side ──────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── Residence Card ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <h3 className="text-base font-semibold text-accent-cyan mb-4">Residence</h3>

          {/* Address */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-text-muted mb-1">Address</label>
            {editMode ? (
              <textarea value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
            ) : (
              <p className="text-text-primary text-sm">{suspect?.address || 'N/A'}</p>
            )}
            {suspect?.address && !editMode && (
              <button onClick={handleGeocodeAddress} disabled={geocoding}
                className={`mt-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  geocoding ? 'bg-accent-cyan/50 text-background cursor-not-allowed'
                            : 'bg-accent-cyan text-background hover:bg-accent-cyan/90'}`}>
                {geocoding ? 'Geocoding...' : suspect?.latitude ? 'Update Location' : 'Geocode'}
              </button>
            )}
          </div>

          {/* Map (stacked vertically) */}
          {suspect?.latitude && suspect?.longitude && !editMode && (
            <div className="mb-3">
              <div className="h-40 rounded-lg overflow-hidden border border-accent-cyan/20">
                <MapContainer
                  center={[suspect.latitude, suspect.longitude]}
                  zoom={16}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[suspect.latitude, suspect.longitude]}>
                    <Popup>
                      <div className="text-xs">
                        <strong>Suspect Residence</strong><br />{suspect.address}
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <p className="text-xs text-text-muted mt-1">
                {suspect.latitude.toFixed(6)}, {suspect.longitude.toFixed(6)}
              </p>
            </div>
          )}

          {/* Residence photos */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted">Residence Photos</span>
            <button onClick={() => handleUploadPhoto('residence')}
              className="px-2 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs 
                         rounded hover:bg-accent-cyan/20 transition-colors">
              + Upload
            </button>
          </div>
          {residencePhotos.length === 0 ? (
            <div className="bg-background rounded-lg p-3 border border-dashed border-accent-cyan/20 text-center">
              <p className="text-text-muted text-xs italic">No residence photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {residencePhotos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square bg-background rounded-lg overflow-hidden border border-accent-cyan/20">
                  <img
                    src={`icac-case-file://${photo.photo_path}`}
                    alt="Residence"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.electronAPI.openFileLocation(photo.photo_path)}
                  />
                  <button onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-accent-pink rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Place of Work */}
          <div className="mt-4 pt-3 border-t border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-1">Place of Work</label>
            {editMode ? (
              <input type="text" value={formData.place_of_work || formData.workplace || ''}
                onChange={(e) => setFormData({ ...formData, place_of_work: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                         text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
            ) : (
              <p className="text-text-primary text-sm">{suspect?.place_of_work || suspect?.workplace || 'N/A'}</p>
            )}
          </div>
        </div>

        {/* ── Vehicle Card ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-accent-cyan">Vehicle</h3>
            <button onClick={() => handleUploadPhoto('vehicle')}
              className="px-2 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs 
                         rounded hover:bg-accent-cyan/20 transition-colors">
              + Upload Photo
            </button>
          </div>

          {/* Vehicle photo */}
          {vehiclePhotos.length === 0 ? (
            <div className="bg-background rounded-lg p-4 border border-dashed border-accent-cyan/20 text-center mb-4">
              <svg className="w-8 h-8 text-text-muted mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 17h.01M16 17h.01M3 11l1.5-5A2 2 0 016.4 4h11.2a2 2 0 011.9 1.4L21 11M3 11v6a1 1 0 001 1h1m16-7v6a1 1 0 01-1 1h-1M3 11h18" />
              </svg>
              <p className="text-text-muted text-xs italic">No vehicle photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {vehiclePhotos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square bg-background rounded-lg overflow-hidden border border-accent-cyan/20">
                  <img
                    src={`icac-case-file://${photo.photo_path}`}
                    alt="Vehicle"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.electronAPI.openFileLocation(photo.photo_path)}
                  />
                  <button onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-accent-pink rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Vehicle details — 2-col grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Make</label>
              {editMode ? (
                <input type="text" value={formData.vehicle_make || ''}
                  onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                  className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan"
                  placeholder="e.g., Toyota" />
              ) : (
                <p className="text-text-primary text-sm">{suspect?.vehicle_make || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Model</label>
              {editMode ? (
                <input type="text" value={formData.vehicle_model || ''}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                  className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan"
                  placeholder="e.g., Camry" />
              ) : (
                <p className="text-text-primary text-sm">{suspect?.vehicle_model || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Color</label>
              {editMode ? (
                <input type="text" value={formData.vehicle_color || ''}
                  onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                  className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan"
                  placeholder="e.g., Silver" />
              ) : (
                <p className="text-text-primary text-sm">{suspect?.vehicle_color || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">License Plate</label>
              {editMode ? (
                <input type="text" value={formData.license_plate || ''}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan uppercase"
                  placeholder="e.g., ABC1234" />
              ) : (
                <p className="text-text-primary text-sm uppercase">{suspect?.license_plate || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Firearms Registered + Criminal History — side by side ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── Firearms Registered Card ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-accent-cyan">Firearms Registered</h3>
            <div className="flex bg-background rounded-lg border border-accent-cyan/20 overflow-hidden">
              <button onClick={() => setFirearmsMode('manual')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  firearmsMode === 'manual' ? 'bg-accent-cyan text-background' : 'text-text-muted hover:text-text-primary'}`}>
                Manual
              </button>
              <button onClick={() => setFirearmsMode('pdf')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  firearmsMode === 'pdf' ? 'bg-accent-cyan text-background' : 'text-text-muted hover:text-text-primary'}`}>
                Upload PDF
              </button>
            </div>
          </div>

          {firearmsMode === 'manual' ? (
            <>
              {editMode ? (
                <textarea value={formData.firearms_info || ''}
                  onChange={(e) => setFormData({ ...formData, firearms_info: e.target.value })}
                  rows={8}
                  placeholder="Enter registered firearms information (make, model, serial#, caliber)..."
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan resize-none" />
              ) : (
                <div className="bg-background rounded-lg p-3 border border-accent-cyan/10 min-h-[140px]">
                  {suspect?.firearms_info ? (
                    <pre className="text-text-primary text-sm whitespace-pre-wrap font-sans">{suspect.firearms_info}</pre>
                  ) : (
                    <p className="text-text-muted text-xs italic">No firearms data entered. Click Edit to add.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {(formData.firearms_pdf_path || suspect?.firearms_pdf_path) ? (
                <div className="bg-background rounded-lg p-3 border border-accent-cyan/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-text-primary text-sm truncate">
                        {(formData.firearms_pdf_path || suspect?.firearms_pdf_path || '').split(/[\\/]/).pop()}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        const p = formData.firearms_pdf_path || suspect?.firearms_pdf_path;
                        if (p) window.electronAPI.openFileLocation(p);
                      }}
                        className="px-2 py-1 text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors">
                        Open
                      </button>
                      {editMode && (
                        <button onClick={() => {
                          setFormData({ ...formData, firearms_pdf_path: '' });
                          setFirearmsMode('manual');
                        }}
                          className="px-2 py-1 text-xs text-accent-pink hover:text-accent-pink/80 transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => handleUploadRecordPdf('firearms_pdf_path', 'Firearms', 'Select Firearms Record PDF')}
                  className="w-full py-8 bg-background rounded-lg border-2 border-dashed border-accent-cyan/20 
                           hover:border-accent-cyan/40 transition-colors flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-text-muted text-xs">Upload CLETS / firearms printout PDF</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Criminal History Card ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-accent-cyan">Criminal History</h3>
            <div className="flex bg-background rounded-lg border border-accent-cyan/20 overflow-hidden">
              <button onClick={() => setCrimHistoryMode('manual')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  crimHistoryMode === 'manual' ? 'bg-accent-cyan text-background' : 'text-text-muted hover:text-text-primary'}`}>
                Manual
              </button>
              <button onClick={() => setCrimHistoryMode('pdf')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  crimHistoryMode === 'pdf' ? 'bg-accent-cyan text-background' : 'text-text-muted hover:text-text-primary'}`}>
                Upload PDF
              </button>
            </div>
          </div>

          {crimHistoryMode === 'manual' ? (
            <>
              {editMode ? (
                <textarea value={formData.criminal_history || ''}
                  onChange={(e) => setFormData({ ...formData, criminal_history: e.target.value })}
                  rows={8}
                  placeholder="Enter criminal history (priors, convictions, warrants, probation/parole status)..."
                  className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                           text-text-primary text-sm focus:outline-none focus:border-accent-cyan resize-none" />
              ) : (
                <div className="bg-background rounded-lg p-3 border border-accent-cyan/10 min-h-[140px]">
                  {suspect?.criminal_history ? (
                    <pre className="text-text-primary text-sm whitespace-pre-wrap font-sans">{suspect.criminal_history}</pre>
                  ) : (
                    <p className="text-text-muted text-xs italic">No criminal history entered. Click Edit to add.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {(formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path) ? (
                <div className="bg-background rounded-lg p-3 border border-accent-cyan/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-text-primary text-sm truncate">
                        {(formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path || '').split(/[\\/]/).pop()}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        const p = formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path;
                        if (p) window.electronAPI.openFileLocation(p);
                      }}
                        className="px-2 py-1 text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors">
                        Open
                      </button>
                      {editMode && (
                        <button onClick={() => {
                          setFormData({ ...formData, criminal_history_pdf_path: '' });
                          setCrimHistoryMode('manual');
                        }}
                          className="px-2 py-1 text-xs text-accent-pink hover:text-accent-pink/80 transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => handleUploadRecordPdf('criminal_history_pdf_path', 'CriminalHistory', 'Select Criminal History PDF')}
                  className="w-full py-8 bg-background rounded-lg border-2 border-dashed border-accent-cyan/20 
                           hover:border-accent-cyan/40 transition-colors flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-text-muted text-xs">Upload CLETS / RAP sheet PDF</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
