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
  scars_marks_tattoos?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  license_plate?: string;
  has_weapons?: boolean;
  firearms_info?: string;
  firearms_pdf_path?: string;
  criminal_history?: string;
  criminal_history_pdf_path?: string;
  latitude?: number;
  longitude?: number;
  geocoded_date?: string;
}

interface FirearmEntry {
  make_model: string;
  calibre: string;
  serial_number: string;
}

interface CriminalRecordEntry {
  date: string;
  case_number: string;
  offense: string;
  sentence: string;
  notes: string;
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
  
  // Structured firearms & criminal history arrays (stored as JSON in DB TEXT columns)
  const [firearms, setFirearms] = useState<FirearmEntry[]>([]);
  const [crimRecords, setCrimRecords] = useState<CriminalRecordEntry[]>([]);
  
  // Modal state
  const [showFirearmModal, setShowFirearmModal] = useState(false);
  const [showCrimRecordModal, setShowCrimRecordModal] = useState(false);
  const [newFirearm, setNewFirearm] = useState<FirearmEntry>({ make_model: '', calibre: '', serial_number: '' });
  const [newCrimRecord, setNewCrimRecord] = useState<CriminalRecordEntry>({ date: '', case_number: '', offense: '', sentence: '', notes: '' });
  
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
    scars_marks_tattoos: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_color: '',
    license_plate: '',
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
        // Parse structured firearms and criminal history from JSON
        try {
          const fa = suspectData.firearms_info ? JSON.parse(suspectData.firearms_info) : [];
          setFirearms(Array.isArray(fa) ? fa : []);
        } catch { setFirearms([]); }
        try {
          const cr = suspectData.criminal_history ? JSON.parse(suspectData.criminal_history) : [];
          setCrimRecords(Array.isArray(cr) ? cr : []);
        } catch { setCrimRecords([]); }
        
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

  /* ── Firearms CRUD (always editable, no edit-mode gate) ── */
  const addFirearm = async () => {
    if (!newFirearm.make_model && !newFirearm.serial_number) {
      showToast?.('Enter at least a make/model or serial number', 'error');
      return;
    }
    const updated = [...firearms, { ...newFirearm }];
    setFirearms(updated);
    setNewFirearm({ make_model: '', calibre: '', serial_number: '' });
    setShowFirearmModal(false);
    // Persist as JSON
    const json = JSON.stringify(updated);
    const fd = { ...formData, firearms_info: json };
    setFormData(fd);
    if (suspect?.id) {
      await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
      setSuspect(prev => prev ? { ...prev, firearms_info: json } : prev);
    }
    showToast?.('Firearm added', 'success');
  };

  const removeFirearm = async (index: number) => {
    const updated = firearms.filter((_, i) => i !== index);
    setFirearms(updated);
    const json = updated.length > 0 ? JSON.stringify(updated) : '';
    const fd = { ...formData, firearms_info: json };
    setFormData(fd);
    if (suspect?.id) {
      await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
      setSuspect(prev => prev ? { ...prev, firearms_info: json } : prev);
    }
  };

  /* ── Criminal Records CRUD (always editable, no edit-mode gate) ── */
  const addCrimRecord = async () => {
    if (!newCrimRecord.offense) {
      showToast?.('Offense is required', 'error');
      return;
    }
    const updated = [...crimRecords, { ...newCrimRecord }];
    setCrimRecords(updated);
    setNewCrimRecord({ date: '', case_number: '', offense: '', sentence: '', notes: '' });
    setShowCrimRecordModal(false);
    const json = JSON.stringify(updated);
    const fd = { ...formData, criminal_history: json };
    setFormData(fd);
    if (suspect?.id) {
      await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
      setSuspect(prev => prev ? { ...prev, criminal_history: json } : prev);
    }
    showToast?.('Criminal record added', 'success');
  };

  const removeCrimRecord = async (index: number) => {
    const updated = crimRecords.filter((_, i) => i !== index);
    setCrimRecords(updated);
    const json = updated.length > 0 ? JSON.stringify(updated) : '';
    const fd = { ...formData, criminal_history: json };
    setFormData(fd);
    if (suspect?.id) {
      await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
      setSuspect(prev => prev ? { ...prev, criminal_history: json } : prev);
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

      {/* ── Identity Card (50% width) ─────────────────────────── */}
      <div className="w-1/2">
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <h3 className="text-base font-semibold text-accent-cyan mb-4">Identity</h3>

          {/* Photo + core fields */}
          <div className="flex gap-4">
            {/* Mugshot */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2" style={{ width: '140px' }}>
              {suspectPhotos.length === 0 ? (
                <div className="w-full aspect-[3/4] bg-background rounded-lg border-2 border-dashed border-accent-cyan/30 
                                flex flex-col items-center justify-center gap-1">
                  <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-[10px] text-text-muted">No photo</span>
                </div>
              ) : (
                <div className="relative group w-full aspect-[3/4] bg-background rounded-lg overflow-hidden border border-accent-cyan/20">
                  <img
                    src={`icac-case-file://${suspectPhotos[0].photo_path}`}
                    alt="Suspect"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.electronAPI.openFileLocation(suspectPhotos[0].photo_path)}
                  />
                  <button onClick={() => handleDeletePhoto(suspectPhotos[0].id)}
                    className="absolute top-1 right-1 p-1 bg-accent-pink rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-pink/80">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <button onClick={() => handleUploadPhoto('suspect')}
                className="w-full px-2 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-[10px] 
                           rounded hover:bg-accent-cyan/20 transition-colors text-center">
                + Upload Photo
              </button>
              {/* Extra photos strip */}
              {suspectPhotos.length > 1 && (
                <div className="grid grid-cols-3 gap-1 w-full">
                  {suspectPhotos.slice(1).map((photo) => (
                    <div key={photo.id} className="relative group aspect-square bg-background rounded overflow-hidden border border-accent-cyan/20">
                      <img src={`icac-case-file://${photo.photo_path}`} alt="Suspect"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.electronAPI.openFileLocation(photo.photo_path)} />
                      <button onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-accent-pink rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 content-start">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-0.5">First Name</label>
                {editMode ? (
                  <input type="text" value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-background border border-accent-cyan/30 rounded text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                ) : (
                  <p className="text-text-primary text-sm font-medium">{suspect?.first_name || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-0.5">Last Name</label>
                {editMode ? (
                  <input type="text" value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-background border border-accent-cyan/30 rounded text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                ) : (
                  <p className="text-text-primary text-sm font-medium">{suspect?.last_name || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-0.5">Date of Birth</label>
                {editMode ? (
                  <input type="date" value={formData.dob || ''}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-2 py-1.5 bg-background border border-accent-cyan/30 rounded text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                ) : (
                  <p className="text-text-primary text-sm">{suspect?.dob || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-0.5">Driver's License</label>
                {editMode ? (
                  <input type="text" value={formData.drivers_license || ''}
                    onChange={(e) => setFormData({ ...formData, drivers_license: e.target.value })}
                    className="w-full px-2 py-1.5 bg-background border border-accent-cyan/30 rounded text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                ) : (
                  <p className="text-text-primary text-sm font-mono">{suspect?.drivers_license || 'N/A'}</p>
                )}
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <label className="text-xs font-medium text-text-muted">Phone Number</label>
                  {(formData.phone_carrier || suspect?.phone_carrier) && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded-full border border-accent-cyan/30">
                      {formData.phone_carrier || suspect?.phone_carrier}
                      {(formData.phone_line_type || suspect?.phone_line_type) && ` · ${formData.phone_line_type || suspect?.phone_line_type}`}
                    </span>
                  )}
                </div>
                {editMode ? (
                  <div className="flex gap-2">
                    <input type="tel" value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-background border border-accent-cyan/30 rounded text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                    {isCarrierLookupEnabled() && formData.phone && (
                      <button type="button" onClick={handleCarrierLookup}
                        className="px-2 py-1.5 bg-background border border-accent-cyan/30 text-accent-cyan rounded hover:bg-accent-cyan/10 transition-colors text-xs">
                        📱 Lookup
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-text-primary text-sm font-mono">{suspect?.phone || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Physical Description ─────────────────────────────── */}
      <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
        <p className="text-sm font-medium text-text-muted mb-3">Physical Description</p>
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-background rounded-lg px-3 py-2 border border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-0.5">Height</label>
            {editMode ? (
              <input type="text" placeholder="e.g. 5'10&quot;" value={formData.height || ''}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="w-full bg-transparent text-text-primary text-sm focus:outline-none" />
            ) : (
              <p className="text-text-primary text-sm font-medium">{suspect?.height || 'N/A'}</p>
            )}
          </div>
          <div className="bg-background rounded-lg px-3 py-2 border border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-0.5">Weight</label>
            {editMode ? (
              <input type="text" placeholder="e.g. 180 lbs" value={formData.weight || ''}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full bg-transparent text-text-primary text-sm focus:outline-none" />
            ) : (
              <p className="text-text-primary text-sm font-medium">{suspect?.weight || 'N/A'}</p>
            )}
          </div>
          <div className="bg-background rounded-lg px-3 py-2 border border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-0.5">Hair Color</label>
            {editMode ? (
              <input type="text" placeholder="e.g. Brown" value={formData.hair_color || ''}
                onChange={(e) => setFormData({ ...formData, hair_color: e.target.value })}
                className="w-full bg-transparent text-text-primary text-sm focus:outline-none" />
            ) : (
              <p className="text-text-primary text-sm font-medium">{suspect?.hair_color || 'N/A'}</p>
            )}
          </div>
          <div className="bg-background rounded-lg px-3 py-2 border border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-0.5">Eye Color</label>
            {editMode ? (
              <input type="text" placeholder="e.g. Blue" value={formData.eye_color || ''}
                onChange={(e) => setFormData({ ...formData, eye_color: e.target.value })}
                className="w-full bg-transparent text-text-primary text-sm focus:outline-none" />
            ) : (
              <p className="text-text-primary text-sm font-medium">{suspect?.eye_color || 'N/A'}</p>
            )}
          </div>
          <div className="bg-background rounded-lg px-3 py-2 border border-accent-cyan/10">
            <label className="block text-xs font-medium text-text-muted mb-0.5">Scars / Marks / Tattoos</label>
            {editMode ? (
              <input type="text" placeholder="Description" value={formData.scars_marks_tattoos || ''}
                onChange={(e) => setFormData({ ...formData, scars_marks_tattoos: e.target.value })}
                className="w-full bg-transparent text-text-primary text-sm focus:outline-none" />
            ) : (
              <p className="text-text-primary text-sm font-medium">{suspect?.scars_marks_tattoos || 'N/A'}</p>
            )}
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

      {/* ── Registered Firearms + Criminal History — VIPER style ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── Registered Firearms ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-amber-400">Registered Firearms</h3>
            <div className="flex gap-2">
              <button onClick={() => handleUploadRecordPdf('firearms_pdf_path', 'Firearms', 'Select Firearms Record PDF')}
                className="px-3 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs rounded 
                           hover:bg-amber-400/20 transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Upload Firearms Doc
              </button>
              <button onClick={() => setShowFirearmModal(true)}
                className="px-3 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs rounded 
                           hover:bg-accent-cyan/20 transition-colors">
                + Add Firearm
              </button>
            </div>
          </div>

          {/* Uploaded PDF indicator */}
          {(formData.firearms_pdf_path || suspect?.firearms_pdf_path) && (
            <div className="bg-background rounded p-2 border border-amber-400/20 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-text-primary text-xs truncate">
                  {(formData.firearms_pdf_path || suspect?.firearms_pdf_path || '').split(/[\\/]/).pop()}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { const p = formData.firearms_pdf_path || suspect?.firearms_pdf_path; if (p) window.electronAPI.openFileLocation(p); }}
                  className="px-2 py-0.5 text-[10px] text-accent-cyan hover:text-accent-cyan/80">Open</button>
                <button onClick={async () => {
                  const fd = { ...formData, firearms_pdf_path: '' };
                  setFormData(fd);
                  if (suspect?.id) {
                    await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
                    setSuspect(prev => prev ? { ...prev, firearms_pdf_path: '' } : prev);
                  }
                }}
                  className="px-2 py-0.5 text-[10px] text-accent-pink hover:text-accent-pink/80">Remove</button>
              </div>
            </div>
          )}

          {/* Firearms list */}
          {firearms.length === 0 ? (
            <p className="text-text-muted text-xs italic py-2">No registered firearms</p>
          ) : (
            <div className="space-y-1.5">
              {firearms.map((fa, i) => (
                <div key={i} className="bg-background rounded p-2.5 border border-accent-cyan/10 flex items-center justify-between group">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{fa.make_model || 'Unknown'}</p>
                    <p className="text-text-muted text-xs">
                      {fa.calibre && <span>{fa.calibre}</span>}
                      {fa.calibre && fa.serial_number && <span className="mx-1.5">·</span>}
                      {fa.serial_number && <span className="font-mono">S/N: {fa.serial_number}</span>}
                    </p>
                  </div>
                  <button onClick={() => removeFirearm(i)}
                    className="p-1 text-accent-pink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-pink/10 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Criminal History ─────── */}
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-accent-pink">Criminal History</h3>
            <div className="flex gap-2">
              <button onClick={() => handleUploadRecordPdf('criminal_history_pdf_path', 'CriminalHistory', 'Select Criminal History PDF')}
                className="px-3 py-1 bg-accent-pink/10 border border-accent-pink/30 text-accent-pink text-xs rounded 
                           hover:bg-accent-pink/20 transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Upload Rap Sheet
              </button>
              <button onClick={() => setShowCrimRecordModal(true)}
                className="px-3 py-1 bg-accent-pink/10 border border-accent-pink/30 text-accent-pink text-xs rounded 
                           hover:bg-accent-pink/20 transition-colors">
                + Add Record
              </button>
            </div>
          </div>

          {/* Uploaded PDF indicator */}
          {(formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path) && (
            <div className="bg-background rounded p-2 border border-accent-pink/20 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-text-primary text-xs truncate">
                  {(formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path || '').split(/[\\/]/).pop()}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { const p = formData.criminal_history_pdf_path || suspect?.criminal_history_pdf_path; if (p) window.electronAPI.openFileLocation(p); }}
                  className="px-2 py-0.5 text-[10px] text-accent-cyan hover:text-accent-cyan/80">Open</button>
                <button onClick={async () => {
                  const fd = { ...formData, criminal_history_pdf_path: '' };
                  setFormData(fd);
                  if (suspect?.id) {
                    await window.electronAPI.saveSuspect({ ...fd, case_id: caseId });
                    setSuspect(prev => prev ? { ...prev, criminal_history_pdf_path: '' } : prev);
                  }
                }}
                  className="px-2 py-0.5 text-[10px] text-accent-pink hover:text-accent-pink/80">Remove</button>
              </div>
            </div>
          )}

          {/* Criminal records list */}
          {crimRecords.length === 0 ? (
            <p className="text-text-muted text-xs italic py-2">No criminal history recorded</p>
          ) : (
            <div className="space-y-1.5">
              {crimRecords.map((cr, i) => (
                <div key={i} className="bg-background rounded p-2.5 border border-accent-cyan/10 flex items-start justify-between group">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium">{cr.offense}</p>
                    <div className="flex gap-3 text-text-muted text-xs mt-0.5">
                      {cr.date && <span>{cr.date}</span>}
                      {cr.case_number && <span className="font-mono">#{cr.case_number}</span>}
                    </div>
                    {cr.sentence && <p className="text-text-muted text-xs mt-0.5">{cr.sentence}</p>}
                    {cr.notes && <p className="text-text-muted/60 text-xs mt-0.5 italic">{cr.notes}</p>}
                  </div>
                  <button onClick={() => removeCrimRecord(i)}
                    className="p-1 text-accent-pink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-pink/10 rounded flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Firearm Modal ── */}
      {showFirearmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowFirearmModal(false)}>
          <div className="bg-panel border border-accent-cyan/30 rounded-xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Add Firearm</h3>
            <div className="space-y-3">
              <input type="text" value={newFirearm.make_model} placeholder="Make/Model"
                onChange={e => setNewFirearm({ ...newFirearm, make_model: e.target.value })}
                className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" autoFocus />
              <input type="text" value={newFirearm.calibre} placeholder="Calibre"
                onChange={e => setNewFirearm({ ...newFirearm, calibre: e.target.value })}
                className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
              <input type="text" value={newFirearm.serial_number} placeholder="Serial Number"
                onChange={e => setNewFirearm({ ...newFirearm, serial_number: e.target.value })}
                className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowFirearmModal(false)}
                className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg hover:border-accent-cyan transition-colors text-sm">
                Cancel
              </button>
              <button onClick={addFirearm}
                className="px-4 py-2 bg-amber-400 text-background rounded-lg hover:bg-amber-500 transition-colors text-sm font-medium">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Criminal Record Modal ── */}
      {showCrimRecordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCrimRecordModal(false)}>
          <div className="bg-panel border border-accent-pink/30 rounded-xl p-6 w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Add Criminal Record</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Date of Conviction *</label>
                  <input type="date" value={newCrimRecord.date}
                    onChange={e => setNewCrimRecord({ ...newCrimRecord, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Case Number</label>
                  <input type="text" value={newCrimRecord.case_number} placeholder="e.g. 2024-CF-12345"
                    onChange={e => setNewCrimRecord({ ...newCrimRecord, case_number: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Offense *</label>
                <input type="text" value={newCrimRecord.offense} placeholder="e.g. 487(a) PC - Grand Theft"
                  onChange={e => setNewCrimRecord({ ...newCrimRecord, offense: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Sentence</label>
                <input type="text" value={newCrimRecord.sentence} placeholder="e.g. 3 years probation, 180 days county jail"
                  onChange={e => setNewCrimRecord({ ...newCrimRecord, sentence: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Notes</label>
                <textarea value={newCrimRecord.notes} placeholder="Additional details..."
                  onChange={e => setNewCrimRecord({ ...newCrimRecord, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-background border border-accent-cyan/30 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-cyan resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCrimRecordModal(false)}
                className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg hover:border-accent-cyan transition-colors text-sm">
                Cancel
              </button>
              <button onClick={addCrimRecord}
                className="px-4 py-2 bg-accent-pink text-white rounded-lg hover:bg-accent-pink/90 transition-colors text-sm font-medium">
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
