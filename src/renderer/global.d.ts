// Global type declarations for Electron API exposed via preload

interface ElectronAPI {
  // User/Auth
  registerUser: (username: string) => Promise<{ success: boolean; user: any }>;
  getCurrentUser: () => Promise<{ username: string } | null>;
  verifyHardware: () => Promise<{ valid: boolean; error?: string }>;
  
  // Security (USB binding for portable mode)
  isPortableMode: () => Promise<boolean>;
  isUserRegistered: () => Promise<boolean>;
  registerSecureUser: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginUser: (username: string, password: string) => Promise<{ success: boolean; username?: string; error?: string }>;
  changePassword: (username: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  
  // Cases
  createCase: (caseData: any) => Promise<{ success: boolean; caseId?: number; case?: any; error?: string }>;
  getCase: (caseId: number) => Promise<any>;
  getAllCases: () => Promise<any[]>;
  updateCase: (caseId: number, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteCase: (caseId: number) => Promise<{ success: boolean; error?: string }>;
  exportCase: (caseId: number, exportPath: string) => Promise<{ success: boolean; error?: string }>;
  
  // Case-specific data
  saveCyberTipData: (data: any) => Promise<{ success: boolean; error?: string }>;
  getCyberTipData: (caseId: number) => Promise<any>;
  saveCyberTipIdentifier: (data: any) => Promise<{ success: boolean; id?: number; error?: string }>;
  getCyberTipIdentifiers: (caseId: number) => Promise<any[]>;
  deleteCyberTipIdentifier: (id: number) => Promise<{ success: boolean; error?: string }>;
  saveCyberTipFile: (data: any) => Promise<{ success: boolean; error?: string }>;
  getCyberTipFiles: (caseId: number) => Promise<any[]>;
  deleteCyberTipFile: (id: number) => Promise<{ success: boolean; error?: string }>;
  uploadCaseFile: (data: any) => Promise<{ success: boolean; error?: string }>;
  
  // P2P
  getP2PData: (caseId: number) => Promise<any>;
  saveP2PData: (data: any) => Promise<{ success: boolean; error?: string }>;
  arinLookup: (ipAddress: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  pingIp: (ipAddress: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  
  // Phone Tools
  carrierLookup: (phoneNumber: string) => Promise<{ success: boolean; carrier?: string; error?: string }>;
  
  // Geocoding
  geocodeAddress: (address: string, suspectId: number) => Promise<{ success: boolean; coordinates?: any; error?: string }>;
  
  // Secrets/API Keys
  getSecret: (keyName: string) => Promise<string | null>;
  setSecret: (keyName: string, value: string) => Promise<{ success: boolean; error?: string }>;
  
  // Chat
  getChatData: (caseId: number) => Promise<any>;
  saveChatData: (data: any) => Promise<{ success: boolean; error?: string }>;
  saveChatIdentifier: (data: any) => Promise<{ success: boolean; error?: string }>;
  getChatIdentifiers: (caseId: number) => Promise<any[]>;
  deleteChatIdentifier: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // Other
  getOtherData: (caseId: number) => Promise<any>;
  saveOtherData: (data: any) => Promise<{ success: boolean; error?: string }>;
  saveOtherIdentifier: (data: any) => Promise<{ success: boolean; error?: string }>;
  getOtherIdentifiers: (caseId: number) => Promise<any[]>;
  deleteOtherIdentifier: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // Notes
  addNote: (caseId: number, noteText: string) => Promise<{ success: boolean; error?: string }>;
  getNotes: (caseId: number) => Promise<any[]>;
  deleteNote: (noteId: number) => Promise<{ success: boolean; error?: string }>;
  
  // Evidence
  addEvidence: (data: any) => Promise<{ success: boolean; error?: string }>;
  getEvidence: (caseId: number) => Promise<any[]>;
  deleteEvidence: (id: number) => Promise<{ success: boolean; error?: string }>;
  readFileSnippet: (relativePath: string, bytes: number) => Promise<string>;
  openChatViewer: (data: { filePath: string; title: string; evidenceId: number }) => Promise<void>;
  saveChatHighlights: (evidenceId: number, highlights: any[]) => Promise<{ success: boolean }>;
  loadChatHighlights: (evidenceId: number) => Promise<any[]>;
  
  // Warrants
  addWarrant: (data: any) => Promise<{ success: boolean; error?: string }>;
  getWarrants: (caseId: number) => Promise<any[]>;
  deleteWarrant: (id: number) => Promise<{ success: boolean; error?: string }>;
  uploadWarrantReturn: (data: any) => Promise<{ success: boolean; error?: string }>;
  getOverdueWarrants: () => Promise<any[]>;
  
  // Suspects
  saveSuspectData: (data: any) => Promise<{ success: boolean; suspectId?: number; error?: string }>;
  getSuspectData: (caseId: number) => Promise<any>;
  uploadSuspectPhoto: (data: any) => Promise<{ success: boolean; error?: string }>;
  getSuspectPhotos: (caseId: number) => Promise<any[]>;
  deleteSuspectPhoto: (id: number) => Promise<{ success: boolean; error?: string }>;
  addWeapon: (suspectId: number, description: string) => Promise<{ success: boolean; error?: string }>;
  getWeapons: (suspectId: number) => Promise<any[]>;
  deleteWeapon: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // Operations Plan
  saveOpsPlan: (caseId: number, filePath: string, caseNumber: string) => Promise<{ success: boolean; error?: string }>;
  getOpsPlan: (caseId: number) => Promise<any>;
  
  // Report
  saveReport: (caseId: number, content: string) => Promise<{ success: boolean; error?: string }>;
  getReport: (caseId: number) => Promise<any>;
  exportReportPDF: (data: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  
  // Prosecution
  saveProsecutionData: (data: any) => Promise<{ success: boolean; error?: string }>;
  getProsecutionData: (caseId: number) => Promise<any>;
  
  // Dashboard & Stats
  getCasesStats: () => Promise<any>;
  getCasesByFilter: (filterType: string, filterValue: string) => Promise<any[]>;
  generateDashboardReport: (startDate: string, endDate: string) => Promise<{ success: boolean; error?: string }>;
  
  // Search
  searchCases: (query: string) => Promise<any>;
  
  // Settings
  getCasesPath: () => Promise<string>;
  
  // DA Export
  exportDACase: (caseId: number, exportPath: string, exportOptions: any) => Promise<{ success: boolean; filesExported?: number; error?: string }>;
  
  // File dialogs
  openFileDialog: (options: any) => Promise<{ filePaths: string[]; canceled: boolean }>;
  openDirectoryDialog: (options: any) => Promise<{ filePaths: string[]; canceled: boolean }>;
  openInExplorer: (path: string) => Promise<void>;
  
  // Offense Reference
  getOffenseCategories: () => Promise<any[]>;
  getOffensesByCategory: (categoryId: number) => Promise<any[]>;
  addOffenseToCase: (caseId: number, offenseId: number, notes?: string) => Promise<{ success: boolean; error?: string }>;
  getCaseOffenses: (caseId: number) => Promise<any[]>;
  removeCaseOffense: (caseOffenseId: number) => Promise<{ success: boolean; error?: string }>;
  
  // Public Outreach
  getOutreachEvents: () => Promise<any[]>;
  addOutreachEvent: (data: any) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateOutreachEvent: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
  deleteOutreachEvent: (id: number) => Promise<{ success: boolean; error?: string }>;
  exportOutreachReport: (startDate: string, endDate: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  
  // Active Investigations
  getActiveInvestigations: () => Promise<any[]>;
  addInvestigation: (data: any) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateInvestigation: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
  deleteInvestigation: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // NCMEC PDF Parsing
  parseNCMECPDF: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // CDR Module
  getCDRRecords: (caseId: number) => Promise<any[]>;
  importCDRRecords: (data: { caseId: number; records: any[]; refLat?: number; refLon?: number }) => Promise<{ success: boolean; imported?: number; error?: string }>;
  deleteCDRRecords: (caseId: number) => Promise<{ success: boolean; error?: string }>;
  readEvidenceFile: (relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;

  // Aperture Module
  getApertureEmails: (caseId: number) => Promise<any[]>;
  importApertureEmails: (data: { caseId: number; fileData: string; fileName: string; sourceName?: string }) => Promise<{ success: boolean; imported?: number; error?: string }>;
  updateApertureEmail: (data: { id: number; flagged?: number }) => Promise<{ success: boolean; error?: string }>;
  deleteApertureEmails: (caseId: number) => Promise<{ success: boolean; error?: string }>;
  getApertureSources: (caseId: number) => Promise<{ name: string; count: number }[]>;
  getApertureNotes: (emailId: number) => Promise<{ id: number; content: string; created_at: string }[]>;
  addApertureNote: (data: { caseId: number; emailId: number; content: string }) => Promise<{ success: boolean; note?: { id: number; content: string; created_at: string } }>;
  deleteApertureNote: (noteId: number) => Promise<{ success: boolean }>;
  saveApertureReport: (data: { caseId: number; caseNumber: string; html: string }) => Promise<{ success: boolean; filePath?: string }>;

  // Media Player
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  popOutMediaPlayer: (url: string) => Promise<{ success: boolean; error?: string }>;
  onToggleMediaPlayer: (callback: () => void) => void;
  removeToggleMediaPlayerListener: (callback: () => void) => void;
  addMediaService: () => Promise<{ success: boolean; service?: { name: string; url: string; icon: string }; cancelled?: boolean }>;
  onMediaPopoutClosed: (callback: () => void) => void;
  removeMediaPopoutClosedListener: (callback: () => void) => void;

  // Field Security
  securityCheck: () => Promise<{ enabled: boolean; locked: boolean }>;
  securitySetup: (password: string) => Promise<{ success: boolean; recoveryKey?: string; error?: string }>;
  securityUnlock: (password: string) => Promise<{ success: boolean; error?: string }>;
  securityRecover: (recoveryKey: string) => Promise<{ success: boolean; error?: string }>;
  securityChangePw: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  securityNewRecovery: () => Promise<{ success: boolean; recoveryKey?: string; error?: string }>;
  securityDisable: () => Promise<{ success: boolean; error?: string }>;
  securityLock: () => Promise<{ success: boolean; error?: string }>;
}

interface Window {
  electronAPI: ElectronAPI;
}
