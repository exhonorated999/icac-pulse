// Shared type definitions across main and renderer processes

export type CaseType = 'cybertip' | 'p2p' | 'chat' | 'other';

export type CaseStatus = 
  | 'open' 
  | 'waiting_warrants' 
  | 'ready_residential' 
  | 'arrest' 
  | 'closed_no_arrest' 
  | 'referred';

export type Platform = 'shareazza' | 'bittorrent' | 'freenet' | 'other';

export type IdentifierType = 'email' | 'username' | 'ip' | 'phone' | 'userid' | 'name';

export interface User {
  id: number;
  username: string;
  hardwareId: string;
  createdAt: string;
  lastLogin: string;
}

export interface Case {
  id: number;
  caseNumber: string;
  caseType: CaseType;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  userId: number;
}

export interface CyberTipData {
  caseId: number;
  cybertipNumber: string;
  reportDate: string;
  occurrenceDate: string;
  reportingCompany: string;
  priorityLevel?: string;
  dateReceivedUtc?: string;
  ncmecFolderPath?: string;
}

export interface CyberTipIdentifier {
  id: number;
  caseId: number;
  identifierType: IdentifierType;
  identifierValue: string;
  platform?: string; // For username - which platform (Facebook, Snapchat, etc.)
  provider?: string; // For IP address - ISP provider (Comcast, Verizon, etc.)
}

export interface CyberTipFile {
  id: number;
  caseId: number;
  filename: string;
  ipAddress?: string;
  datetime?: string;
  officerDescription?: string;
}

export interface P2PData {
  caseId: number;
  downloadDate: string;
  platform: Platform;
  suspectIp: string;
  ipProvider: string;
  downloadFolderPath?: string;
}

export interface ChatData {
  caseId: number;
  initialContactDate: string;
  platform: string;
  identifiers: string[]; // JSON stored as string
}

export interface OtherData {
  caseId: number;
  caseTypeDescription: string;
}

export interface Suspect {
  id: number;
  caseId: number;
  name?: string;
  dob?: string;
  driversLicense?: string;
  photoPath?: string;
  address?: string;
  height?: string;
  weight?: string;
  phone?: string;
  workplace?: string;
  hasWeapons: boolean;
}

export interface Weapon {
  id: number;
  suspectId: number;
  weaponDescription: string;
}

export interface Warrant {
  id: number;
  caseId: number;
  companyName: string;
  dateIssued: string;
  dateDue: string;
  received: boolean;
  dateReceived?: string;
  signedWarrantPath?: string;
  warrantReturnPath?: string;
}

export interface OperationsPlan {
  id: number;
  caseId: number;
  planPdfPath?: string;
  approved: boolean;
  approverName?: string;
  approvalDate?: string;
  executionDate?: string;
}

export interface CaseReport {
  id: number;
  caseId: number;
  content: string; // HTML from Quill editor
  updatedAt: string;
}

export interface ProsecutionInfo {
  id: number;
  caseId: number;
  charges?: string; // JSON array stored as string
  courtCaseNumber?: string;
  assignedCourt?: string;
  daName?: string;
  daContact?: string;
}

export interface ProbableCause {
  id: number;
  caseId: number;
  content: string;
  updatedAt: string;
}

export interface Todo {
  id: number;
  caseId?: number; // null for dashboard todos
  content: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface PublicOutreach {
  id: number;
  date: string;
  location: string;
  num_attendees: number;
  is_law_enforcement: number; // 0 = public outreach, 1 = law enforcement training
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard statistics
export interface DashboardStats {
  totalCases: number;
  casesByType: Record<CaseType, number>;
  casesByStatus: Record<CaseStatus, number>;
  overdueWarrants: OverdueWarrant[];
  pendingWarrants: number;
}

export interface OverdueWarrant {
  warrantId: number;
  caseNumber: string;
  companyName: string;
  dateDue: string;
  daysOverdue: number;
}

// ARIN Lookup Result
export interface ArinLookupResult {
  success: boolean;
  provider?: string;
  network?: string;
  netRange?: string;
  organization?: string;
  error?: string;
}

// Ping Result
export interface PingResult {
  success: boolean;
  alive: boolean;
  host: string;
  avgTime?: number;
  packetLoss?: number;
  output?: string;
  error?: string;
}

// Phone Carrier Lookup Result (Numverify API)
export interface CarrierLookupResult {
  success: boolean;
  carrier?: string;
  lineType?: string; // mobile, landline, etc.
  location?: string;
  countryCode?: string;
  valid?: boolean;
  error?: string;
}

// IPC channel names for Electron communication
export const IPC_CHANNELS = {
  // User/Auth
  REGISTER_USER: 'register-user',
  GET_CURRENT_USER: 'get-current-user',
  VERIFY_HARDWARE: 'verify-hardware',
  
  // Security (USB binding for portable mode)
  IS_USER_REGISTERED: 'is-user-registered',
  REGISTER_SECURE_USER: 'register-secure-user',
  LOGIN_USER: 'login-user',
  CHANGE_PASSWORD: 'change-password',
  IS_PORTABLE_MODE: 'is-portable-mode',
  
  // Cases
  CREATE_CASE: 'create-case',
  GET_CASE: 'get-case',
  GET_ALL_CASES: 'get-all-cases',
  UPDATE_CASE: 'update-case',
  DELETE_CASE: 'delete-case',
  EXPORT_CASE: 'export-case',
  
  // Case-specific data
  SAVE_CYBERTIP_DATA: 'save-cybertip-data',
  GET_CYBERTIP_DATA: 'get-cybertip-data',
  SAVE_CYBERTIP_IDENTIFIER: 'save-cybertip-identifier',
  GET_CYBERTIP_IDENTIFIERS: 'get-cybertip-identifiers',
  DELETE_CYBERTIP_IDENTIFIER: 'delete-cybertip-identifier',
  SAVE_CYBERTIP_FILE: 'save-cybertip-file',
  GET_CYBERTIP_FILES: 'get-cybertip-files',
  DELETE_CYBERTIP_FILE: 'delete-cybertip-file',
  
  // P2P
  SAVE_P2P_DATA: 'save-p2p-data',
  GET_P2P_DATA: 'get-p2p-data',
  
  // Chat
  SAVE_CHAT_DATA: 'save-chat-data',
  GET_CHAT_DATA: 'get-chat-data',
  SAVE_CHAT_IDENTIFIER: 'save-chat-identifier',
  GET_CHAT_IDENTIFIERS: 'get-chat-identifiers',
  DELETE_CHAT_IDENTIFIER: 'delete-chat-identifier',
  
  // Other
  SAVE_OTHER_DATA: 'save-other-data',
  GET_OTHER_DATA: 'get-other-data',
  SAVE_OTHER_IDENTIFIER: 'save-other-identifier',
  GET_OTHER_IDENTIFIERS: 'get-other-identifiers',
  DELETE_OTHER_IDENTIFIER: 'delete-other-identifier',
  
  // Warrants
  ADD_WARRANT: 'add-warrant',
  UPDATE_WARRANT: 'update-warrant',
  GET_WARRANTS: 'get-warrants',
  DELETE_WARRANT: 'delete-warrant',
  
  // Suspects
  SAVE_SUSPECT: 'save-suspect',
  GET_SUSPECT: 'get-suspect',
  ADD_WEAPON: 'add-weapon',
  DELETE_WEAPON: 'delete-weapon',
  ADD_SUSPECT_PHOTO: 'add-suspect-photo',
  GET_SUSPECT_PHOTOS: 'get-suspect-photos',
  GET_SUSPECT_PHOTOS_BASE64: 'get-suspect-photos-base64',
  DELETE_SUSPECT_PHOTO: 'delete-suspect-photo',
  EXPORT_SUSPECT_PDF: 'export-suspect-pdf',
  
  // Operations Plans
  SAVE_OPS_PLAN: 'save-ops-plan',
  GET_OPS_PLAN: 'get-ops-plan',
  SAVE_OPS_ENTRY_TEAM: 'save-ops-entry-team',
  GET_OPS_ENTRY_TEAM: 'get-ops-entry-team',
  SAVE_OPS_RESIDENTS: 'save-ops-residents',
  GET_OPS_RESIDENTS: 'get-ops-residents',
  EXPORT_OPS_PLAN_PDF: 'export-ops-plan-pdf',
  
  // Reports
  SAVE_REPORT: 'save-report',
  GET_REPORT: 'get-report',
  EXPORT_REPORT_PDF: 'export-report-pdf',
  OPEN_REPORT_WINDOW: 'open-report-window',
  
  // Email Verification
  VERIFY_EMAIL: 'verify-email',
  
  // Prosecution
  SAVE_PROSECUTION: 'save-prosecution',
  GET_PROSECUTION: 'get-prosecution',
  
  // Probable Cause
  SAVE_PROBABLE_CAUSE: 'save-probable-cause',
  GET_PROBABLE_CAUSE: 'get-probable-cause',
  
  // Case Notes
  ADD_CASE_NOTE: 'add-case-note',
  GET_CASE_NOTES: 'get-case-notes',
  DELETE_CASE_NOTE: 'delete-case-note',
  
  // Evidence
  ADD_EVIDENCE: 'add-evidence',
  GET_EVIDENCE: 'get-evidence',
  DELETE_EVIDENCE: 'delete-evidence',
  
  // Todos
  ADD_TODO: 'add-todo',
  UPDATE_TODO: 'update-todo',
  GET_TODOS: 'get-todos',
  DELETE_TODO: 'delete-todo',
  
  // Public Outreach
  ADD_PUBLIC_OUTREACH: 'add-public-outreach',
  UPDATE_PUBLIC_OUTREACH: 'update-public-outreach',
  GET_ALL_PUBLIC_OUTREACH: 'get-all-public-outreach',
  GET_PUBLIC_OUTREACH: 'get-public-outreach',
  DELETE_PUBLIC_OUTREACH: 'delete-public-outreach',
  
  // Outreach Materials
  ADD_OUTREACH_MATERIAL: 'add-outreach-material',
  GET_OUTREACH_MATERIALS: 'get-outreach-materials',
  UPDATE_OUTREACH_MATERIAL: 'update-outreach-material',
  DELETE_OUTREACH_MATERIAL: 'delete-outreach-material',
  
  // Resources
  ADD_RESOURCE: 'add-resource',
  GET_ALL_RESOURCES: 'get-all-resources',
  GET_RESOURCE: 'get-resource',
  UPDATE_RESOURCE: 'update-resource',
  DELETE_RESOURCE: 'delete-resource',
  
  // Offense Reference
  ADD_OFFENSE: 'add-offense',
  EXPORT_OFFENSES: 'export-offenses',
  IMPORT_OFFENSES: 'import-offenses',
  GET_ALL_OFFENSES: 'get-all-offenses',
  GET_OFFENSE: 'get-offense',
  UPDATE_OFFENSE: 'update-offense',
  DELETE_OFFENSE: 'delete-offense',
  REORDER_OFFENSES: 'reorder-offenses',
  
  // Dashboard
  GET_DASHBOARD_STATS: 'get-dashboard-stats',
  EXPORT_DASHBOARD_REPORT: 'export-dashboard-report',
  GENERATE_DASHBOARD_REPORT: 'generate-dashboard-report',
  
  // Search
  SEARCH_CASES: 'search-cases',
  
  // Settings
  GET_CASES_PATH: 'get-cases-path',
  CHANGE_CASES_PATH: 'change-cases-path',
  MIGRATE_CASE_FILES: 'migrate-case-files',
  
  // Export
  EXPORT_DA_CASE: 'export-da-case',
  EXPORT_COMPLETE_CASE: 'export-complete-case',
  GET_EXPORT_SIZE: 'get-export-size',
  IMPORT_COMPLETE_CASE: 'import-complete-case',
  VALIDATE_IMPORT_FILE: 'validate-import-file',
  
  // File operations
  UPLOAD_FILE: 'upload-file',
  OPEN_FILE_LOCATION: 'open-file-location',
  GET_FILE_PATH: 'get-file-path',
  PARSE_NCMEC_PDF: 'parse-ncmec-pdf',
  
  // Export
  EXPORT_DASHBOARD_PDF: 'export-dashboard-pdf',
  
  // P2P Tools
  ARIN_LOOKUP: 'arin-lookup',
  PING_IP: 'ping-ip',
  
  // Phone Tools
  CARRIER_LOOKUP: 'carrier-lookup',
  
  // Geocoding
  GEOCODE_ADDRESS: 'geocode-address',
  
  // Secrets/API Keys
  GET_SECRET: 'get-secret',
  SET_SECRET: 'set-secret',
  
  // CDR Module
  GET_CDR_RECORDS: 'get-cdr-records',
  IMPORT_CDR_RECORDS: 'import-cdr-records',
  DELETE_CDR_RECORDS: 'delete-cdr-records',
  READ_EVIDENCE_FILE: 'read-evidence-file',

  // Aperture Module
  GET_APERTURE_EMAILS: 'get-aperture-emails',
  IMPORT_APERTURE_EMAILS: 'import-aperture-emails',
  UPDATE_APERTURE_EMAIL: 'update-aperture-email',
  DELETE_APERTURE_EMAILS: 'delete-aperture-emails',
  GET_APERTURE_SOURCES: 'get-aperture-sources',
  GET_APERTURE_NOTES: 'get-aperture-notes',
  ADD_APERTURE_NOTE: 'add-aperture-note',
  DELETE_APERTURE_NOTE: 'delete-aperture-note',
  SAVE_APERTURE_REPORT: 'save-aperture-report',

  // Media Player
  POP_OUT_MEDIA_PLAYER: 'pop-out-media-player',
  ADD_MEDIA_SERVICE: 'add-media-service',

  // Field Security
  SECURITY_CHECK: 'security-check',
  SECURITY_SETUP: 'security-setup',
  SECURITY_UNLOCK: 'security-unlock',
  SECURITY_RECOVER: 'security-recover',
  SECURITY_CHANGE_PW: 'security-change-pw',
  SECURITY_NEW_RECOVERY: 'security-new-recovery',
  SECURITY_DISABLE: 'security-disable',
  SECURITY_LOCK: 'security-lock',

  // Window management
  RESTORE_WINDOW_FOCUS: 'restore-window-focus',
} as const;
