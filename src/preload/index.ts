import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // User/Auth
  registerUser: (username: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.REGISTER_USER, username),
  getCurrentUser: () => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CURRENT_USER),
  verifyHardware: () => 
    ipcRenderer.invoke(IPC_CHANNELS.VERIFY_HARDWARE),
  
  // Security (USB binding for portable mode)
  isPortableMode: () =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_PORTABLE_MODE),
  isUserRegistered: () =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_USER_REGISTERED),
  registerSecureUser: (username: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.REGISTER_SECURE_USER, username, password),
  loginUser: (username: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGIN_USER, username, password),
  changePassword: (username: string, currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGE_PASSWORD, username, currentPassword, newPassword),
  
  // Cases
  createCase: (caseData: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_CASE, caseData),
  getCase: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CASE, caseId),
  getAllCases: () => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_CASES),
  updateCase: (caseId: number, updates: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CASE, caseId, updates),
  deleteCase: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CASE, caseId),
  exportCase: (caseId: number, exportPath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CASE, caseId, exportPath),
  
  // Case-specific data
  saveCyberTipData: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CYBERTIP_DATA, data),
  getCyberTipData: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CYBERTIP_DATA, caseId),
  saveCyberTipIdentifier: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CYBERTIP_IDENTIFIER, data),
  getCyberTipIdentifiers: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CYBERTIP_IDENTIFIERS, caseId),
  deleteCyberTipIdentifier: (id: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CYBERTIP_IDENTIFIER, id),
  saveCyberTipFile: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CYBERTIP_FILE, data),
  getCyberTipFiles: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CYBERTIP_FILES, caseId),
  deleteCyberTipFile: (id: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CYBERTIP_FILE, id),
  uploadCaseFile: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_FILE, data),
  
  // P2P
  getP2PData: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_P2P_DATA, caseId),
  saveP2PData: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_P2P_DATA, data),
  arinLookup: (ipAddress: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ARIN_LOOKUP, ipAddress),
  pingIp: (ipAddress: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PING_IP, ipAddress),
  
  // Phone Tools
  carrierLookup: (phoneNumber: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CARRIER_LOOKUP, phoneNumber),
  
  // Geocoding
  geocodeAddress: (address: string, suspectId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GEOCODE_ADDRESS, { address, suspectId }),
  
  // Secrets/API Keys
  getSecret: (keyName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SECRET, keyName),
  setSecret: (keyName: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SECRET, keyName, value),
  
  // Chat
  getChatData: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CHAT_DATA, caseId),
  saveChatData: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CHAT_DATA, data),
  saveChatIdentifier: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CHAT_IDENTIFIER, data),
  getChatIdentifiers: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CHAT_IDENTIFIERS, caseId),
  deleteChatIdentifier: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CHAT_IDENTIFIER, id),
  
  // Other
  getOtherData: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OTHER_DATA, caseId),
  saveOtherData: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_OTHER_DATA, data),
  saveOtherIdentifier: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_OTHER_IDENTIFIER, data),
  getOtherIdentifiers: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OTHER_IDENTIFIERS, caseId),
  deleteOtherIdentifier: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_OTHER_IDENTIFIER, id),
  
  // Warrants
  addWarrant: (warrant: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.ADD_WARRANT, warrant),
  updateWarrant: (warrantId: number, updates: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_WARRANT, warrantId, updates),
  getWarrants: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_WARRANTS, caseId),
  deleteWarrant: (warrantId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_WARRANT, warrantId),
  
  // Suspects
  saveSuspect: (suspect: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SUSPECT, suspect),
  getSuspect: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_SUSPECT, caseId),
  addWeapon: (suspectId: number, description: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.ADD_WEAPON, suspectId, description),
  deleteWeapon: (weaponId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_WEAPON, weaponId),
  exportSuspectPdf: (caseId: number, caseNumber: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SUSPECT_PDF, caseId, caseNumber),
  
  // Operations Plans
  saveOpsPlan: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_OPS_PLAN, data),
  getOpsPlan: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_OPS_PLAN, caseId),
  saveOpsEntryTeam: (opsPlanId: number, team: any[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_OPS_ENTRY_TEAM, opsPlanId, team),
  getOpsEntryTeam: (opsPlanId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OPS_ENTRY_TEAM, opsPlanId),
  saveOpsResidents: (opsPlanId: number, residents: any[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_OPS_RESIDENTS, opsPlanId, residents),
  getOpsResidents: (opsPlanId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OPS_RESIDENTS, opsPlanId),
  exportOpsPlanPdf: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_OPS_PLAN_PDF, data),
  
  // Reports
  saveReport: (caseId: number, content: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_REPORT, caseId, content),
  getReport: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_REPORT, caseId),
  exportReportPDF: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_REPORT_PDF, data),
  openReportWindow: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_REPORT_WINDOW, data),
  
  // Email Verification
  verifyEmail: (email: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VERIFY_EMAIL, email),
  
  // Prosecution
  saveProsecution: (data: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROSECUTION, data),
  getProsecution: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_PROSECUTION, caseId),
  
  // Case Notes
  getCaseNotes: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CASE_NOTES, caseId),
  addCaseNote: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_CASE_NOTE, data),
  deleteCaseNote: (noteId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CASE_NOTE, noteId),
  
  // Evidence
  getEvidence: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_EVIDENCE, caseId),
  addEvidence: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_EVIDENCE, data),
  deleteEvidence: (evidenceId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_EVIDENCE, evidenceId),
  
  // Probable Cause
  saveProbableCause: (caseId: number, content: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROBABLE_CAUSE, caseId, content),
  getProbableCause: (caseId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_PROBABLE_CAUSE, caseId),
  
  // Todos
  addTodo: (todo: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.ADD_TODO, todo),
  updateTodo: (todoId: number, updates: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TODO, todoId, updates),
  getTodos: (caseId?: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_TODOS, caseId),
  deleteTodo: (todoId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_TODO, todoId),
  
  // Public Outreach
  getAllPublicOutreach: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_PUBLIC_OUTREACH),
  getPublicOutreach: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PUBLIC_OUTREACH, id),
  addPublicOutreach: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_PUBLIC_OUTREACH, data),
  updatePublicOutreach: (id: number, data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PUBLIC_OUTREACH, id, data),
  deletePublicOutreach: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_PUBLIC_OUTREACH, id),
  
  // Outreach Materials
  getOutreachMaterials: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OUTREACH_MATERIALS),
  addOutreachMaterial: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_OUTREACH_MATERIAL, data),
  updateOutreachMaterial: (id: number, data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_OUTREACH_MATERIAL, id, data),
  deleteOutreachMaterial: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_OUTREACH_MATERIAL, id),
  
  // Resources
  getAllResources: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_RESOURCES),
  getResource: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RESOURCE, id),
  addResource: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_RESOURCE, data),
  updateResource: (id: number, data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_RESOURCE, id, data),
  deleteResource: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_RESOURCE, id),
  
  // Offense Reference
  getAllOffenses: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_OFFENSES),
  getOffense: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OFFENSE, id),
  addOffense: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_OFFENSE, data),
  updateOffense: (id: number, data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_OFFENSE, id, data),
  deleteOffense: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_OFFENSE, id),
  reorderOffenses: (offenseIds: number[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.REORDER_OFFENSES, offenseIds),
  exportOffenses: () =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_OFFENSES),
  importOffenses: (options: { overwriteDuplicates: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_OFFENSES, options),
  
  // Dashboard
  getDashboardStats: () => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_DASHBOARD_STATS),
  exportDashboardReport: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DASHBOARD_REPORT, data),
  generateDashboardReport: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.GENERATE_DASHBOARD_REPORT, data),
  
  // Search
  searchCases: (query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_CASES, query),
  
  // Settings
  getCasesPath: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CASES_PATH),
  changeCasesPath: (newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGE_CASES_PATH, newPath),
  migrateCaseFiles: (data: { oldPath: string, newPath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.MIGRATE_CASE_FILES, data),
  
  // Export
  exportDACase: (data: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DA_CASE, data),
  
  // Case Transfer
  getExportSize: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_EXPORT_SIZE, caseId),
  exportCompleteCase: (data: { caseId: number; password: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_COMPLETE_CASE, data),
  validateImportFile: (data: { filePath: string; password: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_IMPORT_FILE, data),
  importCompleteCase: (data: { filePath: string; password: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_COMPLETE_CASE, data),
  onExportProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('export-progress', (_event, progress) => callback(progress));
  },
  onImportProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('import-progress', (_event, progress) => callback(progress));
  },
  
  // File operations
  uploadFile: (options: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_FILE, options),
  openFileLocation: (relativePath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_LOCATION, relativePath),
  readFileSnippet: (relativePath: string, bytes: number) =>
    ipcRenderer.invoke('read-file-snippet', relativePath, bytes),
  openChatViewer: (data: { filePath: string; title: string; evidenceId: number }) =>
    ipcRenderer.invoke('open-chat-viewer', data),

  // Flock Safety
  flockSetBounds: (bounds: any) => ipcRenderer.send('flock-set-bounds', bounds),
  flockSetVisible: (visible: boolean) => ipcRenderer.send('flock-set-visible', visible),
  flockSearchPlate: (params: any) => ipcRenderer.invoke('flock-search-plate', params),
  flockReset: () => ipcRenderer.invoke('flock-reset'),

  // TLO / TransUnion
  tloSetBounds: (bounds: any) => ipcRenderer.send('tlo-set-bounds', bounds),
  tloSetVisible: (visible: boolean) => ipcRenderer.send('tlo-set-visible', visible),
  tloSearchPerson: (params: any) => ipcRenderer.invoke('tlo-search-person', params),
  tloReset: () => ipcRenderer.invoke('tlo-reset'),

  // ICAC Cops
  icaccopsSetBounds: (bounds: any) => ipcRenderer.send('icaccops-set-bounds', bounds),
  icaccopsSetVisible: (visible: boolean) => ipcRenderer.send('icaccops-set-visible', visible),
  icaccopsReset: () => ipcRenderer.invoke('icaccops-reset'),

  // GridCop
  gridcopSetBounds: (bounds: any) => ipcRenderer.send('gridcop-set-bounds', bounds),
  gridcopSetVisible: (visible: boolean) => ipcRenderer.send('gridcop-set-visible', visible),
  gridcopReset: () => ipcRenderer.invoke('gridcop-reset'),

  // Vigilant LPR
  vigilantSetBounds: (bounds: any) => ipcRenderer.send('vigilant-set-bounds', bounds),
  vigilantSetVisible: (visible: boolean) => ipcRenderer.send('vigilant-set-visible', visible),
  vigilantReset: () => ipcRenderer.invoke('vigilant-reset'),

  // Thomson Reuters CLEAR
  trclearSetBounds: (bounds: any) => ipcRenderer.send('trclear-set-bounds', bounds),
  trclearSetVisible: (visible: boolean) => ipcRenderer.send('trclear-set-visible', visible),
  trclearReset: () => ipcRenderer.invoke('trclear-reset'),

  // BYOA (Bring Your Own Application)
  byoaCreateView: (id: string, url: string) => ipcRenderer.invoke('byoa-create-view', { id, url }),
  byoaSetBounds: (id: string, bounds: any) => ipcRenderer.send('byoa-set-bounds', { id, bounds }),
  byoaSetVisible: (id: string, visible: boolean) => ipcRenderer.send('byoa-set-visible', { id, visible }),
  byoaReset: (id: string) => ipcRenderer.invoke('byoa-reset', { id }),
  byoaDestroyView: (id: string) => ipcRenderer.invoke('byoa-destroy-view', { id }),
  saveChatHighlights: (evidenceId: number, highlights: any[]) =>
    ipcRenderer.invoke('save-chat-highlights', evidenceId, highlights),
  loadChatHighlights: (evidenceId: number) =>
    ipcRenderer.invoke('load-chat-highlights', evidenceId),
  getFilePath: (relativePath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_PATH, relativePath),
  parseNCMECPDF: (pdfPath: string, password?: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_NCMEC_PDF, pdfPath, password),
  copyCybertipPDF: (sourcePath: string, caseNumber: string) =>
    ipcRenderer.invoke('copy-cybertip-pdf', sourcePath, caseNumber),
  updateIdentifierProvider: (id: number, provider: string) =>
    ipcRenderer.invoke('update-identifier-provider', id, provider),
  
  // Export
  exportDashboardPDF: () => 
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DASHBOARD_PDF),
  
  // Utility - Open file dialog
  openFileDialog: (options: any) => 
    ipcRenderer.invoke('open-file-dialog', options),
  openFolderDialog: (options: any) => 
    ipcRenderer.invoke('open-folder-dialog', options),
  saveFolderDialog: (options: any) => 
    ipcRenderer.invoke('save-folder-dialog', options),
  
  // Suspect photo methods
  addSuspectPhoto: (photoData: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SUSPECT_PHOTO, photoData),
  getSuspectPhotos: (suspectId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_SUSPECT_PHOTOS, suspectId),
  deleteSuspectPhoto: (photoId: number) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_SUSPECT_PHOTO, photoId),
  
  // Window management
  restoreWindowFocus: () => 
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_WINDOW_FOCUS),
  
  // Upload progress listeners
  onUploadProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('upload-progress', callback);
  },
  removeUploadProgressListener: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('upload-progress', callback);
  },
  
  // Migration progress listeners
  onMigrationProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('migration-progress', callback);
  },
  removeMigrationProgressListener: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('migration-progress', callback);
  },

  // CDR Module
  getCDRRecords: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CDR_RECORDS, caseId),
  importCDRRecords: (data: { caseId: number; records: any[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CDR_RECORDS, data),
  deleteCDRRecords: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CDR_RECORDS, caseId),
  readEvidenceFile: (relativePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.READ_EVIDENCE_FILE, relativePath),

  // Aperture Module
  getApertureEmails: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APERTURE_EMAILS, caseId),
  importApertureEmails: (data: { caseId: number; fileData: string; fileName: string; sourceName?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_APERTURE_EMAILS, data),
  updateApertureEmail: (data: { id: number; flagged?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_APERTURE_EMAIL, data),
  deleteApertureEmails: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_APERTURE_EMAILS, caseId),
  getApertureSources: (caseId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APERTURE_SOURCES, caseId),
  getApertureNotes: (emailId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APERTURE_NOTES, emailId),
  addApertureNote: (data: { caseId: number; emailId: number; content: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_APERTURE_NOTE, data),
  deleteApertureNote: (noteId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_APERTURE_NOTE, noteId),
  saveApertureReport: (data: { caseId: number; caseNumber: string; html: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_APERTURE_REPORT, data),

  // Media Player
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke('open-external-url', url),
  popOutMediaPlayer: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.POP_OUT_MEDIA_PLAYER, url),
  addMediaService: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_MEDIA_SERVICE),
  onToggleMediaPlayer: (callback: () => void) => {
    ipcRenderer.on('toggle-media-player', callback);
  },
  removeToggleMediaPlayerListener: (callback: () => void) => {
    ipcRenderer.removeListener('toggle-media-player', callback);
  },
  onMediaPopoutClosed: (callback: () => void) => {
    ipcRenderer.on('media-popout-closed', callback);
  },
  removeMediaPopoutClosedListener: (callback: () => void) => {
    ipcRenderer.removeListener('media-popout-closed', callback);
  },

  // Field Security
  securityCheck: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_CHECK),
  securitySetup: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SETUP, password),
  securityUnlock: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_UNLOCK, password),
  securityRecover: (recoveryKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_RECOVER, recoveryKey),
  securityChangePw: (newPassword: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_CHANGE_PW, newPassword),
  securityNewRecovery: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_NEW_RECOVERY),
  securityDisable: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_DISABLE),
  securityLock: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_LOCK),

  // In-App Updater
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  downloadAppUpdate: (url: string) =>
    ipcRenderer.invoke('download-app-update', { url }),
  installAppUpdate: (installerPath: string) =>
    ipcRenderer.invoke('install-app-update', { installerPath }),
  onUpdateDownloadProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on('update-download-progress', (_event, data) => callback(data));
  },
  removeUpdateDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('update-download-progress');
  },
});
