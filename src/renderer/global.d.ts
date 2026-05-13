// Global type declarations for Electron API exposed via preload

interface DatapilotDeviceInfo {
  make: string;
  model: string;
  phoneNumber: string;
  carrier: string;
  serial: string;
  firmware: string;
  clockUtc: string;
  timeZone: string;
}

interface DatapilotPreview {
  folderPath: string;
  format: 'csv' | 'dpx';
  scannedAt: string;
  deviceInfo: DatapilotDeviceInfo | null;
  counts: {
    contacts: number;
    apps: number;
    messages: number;
    calls: number;
    files: number;
    media: number;
    photos: number;
    videos: number;
  };
  signatures: {
    summaryCsvSize?: number;
    dptDataDbSize?: number;
  };
  totalBytes: number;
  warnings: string[];
}

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

  // Flock Safety
  flockSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  flockSetVisible: (visible: boolean) => void;
  flockSearchPlate: (params: { plate: string; state?: string }) => Promise<{ success: boolean; error?: string }>;
  flockReset: () => Promise<void>;

  // TLO / TransUnion
  tloSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  tloSetVisible: (visible: boolean) => void;
  tloSearchPerson: (params: { firstName?: string; lastName?: string; state?: string }) => Promise<{ success: boolean; error?: string }>;
  tloReset: () => Promise<void>;

  // ICAC Cops
  icaccopsSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  icaccopsSetVisible: (visible: boolean) => void;
  icaccopsReset: () => Promise<void>;

  // GridCop
  gridcopSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  gridcopSetVisible: (visible: boolean) => void;
  gridcopReset: () => Promise<void>;

  // Vigilant LPR
  vigilantSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  vigilantSetVisible: (visible: boolean) => void;
  vigilantReset: () => Promise<void>;

  // Thomson Reuters CLEAR
  trclearSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  trclearSetVisible: (visible: boolean) => void;
  trclearReset: () => Promise<void>;

  // Accurint (LexisNexis)
  accurintSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  accurintSetVisible: (visible: boolean) => void;
  accurintReset: () => Promise<void>;

  // ICAC Data System
  icacdsSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  icacdsSetVisible: (visible: boolean) => void;
  icacdsReset: () => Promise<void>;

  // Project Oversight Import
  // Project Oversight Import
  importOversightFile: () => Promise<{
    success: boolean;
    canceled?: boolean;
    error?: string;
    fileName?: string;
    data?: {
      manifest: { version: string; export_date: string; offender_count: number; app_version: string; export_type: string };
      offenders: Array<{
        id: number; full_name: string; first_name: string; middle_name: string | null; last_name: string;
        jurisdiction: string | null; dob: string; sex: string; race: string;
        height_ft: number; height_in: number; weight: number;
        hair_color: string; eye_color: string; scars_marks_tattoos: string;
        address: string; city: string; state: string; zip: string;
        phone: string; email: string; employer: string; employer_address: string;
        profile_photo_path: string | null; residence_photo_path: string | null;
        emergency_contact_name: string | null; emergency_contact_phone: string | null;
        emergency_contact_address: string | null; emergency_contact_relationship: string | null;
        is_homeless: boolean; is_visiting: boolean; advised_departure_date: string | null;
        status: string; inactive_reason: string | null;
        tier_status: string; on_supervision: boolean;
        static_99_score: number | null; stable_2007_score: number | null;
        latitude: number | null; longitude: number | null;
        created_at: string; updated_at: string;
        _profilePhotoDataUrl?: string | null; _residencePhotoDataUrl?: string | null;
      }>;
      convictions: Array<{
        id: number; offender_id: number; conviction_date: string; offenses: string; tier_status: string; created_at: string;
      }>;
      compliance_checks: Array<{
        id: number; offender_id: number; check_date: string; officer_name: string | null;
        in_compliance: boolean; notes: string; document_path: string | null; sweep_id: string | null; created_at: string;
      }>;
      registration_events: Array<{
        id: number; offender_id: number; registration_date: string; registering_officer: string;
        in_compliance: boolean; notes: string; document_path: string | null;
        next_registration_date: string | null; created_at: string;
      }>;
      officer_notes: Array<{
        id: number; offender_id: number; note_text: string; officer_name: string;
        document_path: string | null; created_at: string;
      }>;
      supervision: Array<any>;
      vehicles: Array<any>;
      drug_tests: Array<any>;
      polygraph_tests: Array<any>;
    };
    photoData?: Record<string, string>;
  }>;
  saveOversightData: (caseId: number, data: any) => Promise<{ success: boolean; error?: string }>;
  loadOversightData: (caseId: number) => Promise<{ success: boolean; data: any | null; error?: string }>;

  // RMS Report Import
  rmsImportReports: (caseId: number) => Promise<{ success: boolean; canceled?: boolean; error?: string; reports: any[]; imported?: number }>;
  rmsLoadReports: (caseId: number) => Promise<{ success: boolean; reports: any[]; error?: string }>;
  rmsDeleteReport: (caseId: number, reportId: string) => Promise<{ success: boolean; reports: any[]; error?: string }>;

  // Meta Warrant Parser (ported from VIPER)
  metaWarrantScan: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    candidates: { filePath: string; sourceKind: 'warrant' | 'evidence'; sourceRefId: number; hint?: string; size: number }[];
  }>;
  metaWarrantPickFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  metaWarrantImport: (args: { caseId: number; filePath: string; sourceKind?: string; sourceRefId?: number | null; label?: string }) =>
    Promise<{ success: boolean; importId?: number; label?: string; recordsCount?: number; mediaCount?: number; error?: string }>;
  metaWarrantListImports: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    imports: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      mediaCount: number; createdAt: string; updatedAt: string;
    }[];
  }>;
  metaWarrantGetImport: (importId: number) => Promise<{
    success: boolean;
    error?: string;
    import?: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      records: any[]; mediaIndex: Record<string, { size: number; mimeType: string; originalPath: string }>;
      createdAt: string; updatedAt: string;
    };
  }>;
  metaWarrantDeleteImport: (importId: number) => Promise<{ success: boolean; error?: string }>;
  metaWarrantReadMedia: (args: { importId: number; fileName: string }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; mimeType?: string; size?: number }>;
  metaWarrantExportBundle: (args: { importId: number; mode?: 'flagged-only' | 'full'; officer?: string }) =>
    Promise<{ success: boolean; error?: string; filePath?: string; relativePath?: string; flaggedCount?: number; mode?: 'flagged-only' | 'full' }>;

  // Google Warrant Parser (ported from VIPER)
  googleWarrantScan: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    candidates: { filePath: string; sourceKind: 'warrant' | 'evidence'; sourceRefId: number; hint?: string; size: number }[];
  }>;
  googleWarrantPickFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  googleWarrantImport: (args: { caseId: number; filePath: string; sourceKind?: string; sourceRefId?: number | null; label?: string }) =>
    Promise<{
      success: boolean;
      importId?: number;
      label?: string;
      recordsCount?: number;
      mediaCount?: number;
      summary?: { categories: number; emails: number; locations: number; devices: number; installs: number; driveFiles: number };
      error?: string;
    }>;
  googleWarrantListImports: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    imports: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      mediaCount: number; createdAt: string; updatedAt: string;
    }[];
  }>;
  googleWarrantGetImport: (importId: number) => Promise<{
    success: boolean;
    error?: string;
    import?: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      records: any[]; mediaIndex: Record<string, { size: number; mimeType: string; originalPath: string }>;
      createdAt: string; updatedAt: string;
    };
  }>;
  googleWarrantDeleteImport: (importId: number) => Promise<{ success: boolean; error?: string }>;
  googleWarrantReadMedia: (args: { importId: number; fileName: string }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; mimeType?: string; size?: number }>;
  googleWarrantExportBundle: (args: { importId: number; mode?: 'flagged-only' | 'full'; officer?: string }) =>
    Promise<{ success: boolean; error?: string; filePath?: string; relativePath?: string; flaggedCount?: number; mode?: 'flagged-only' | 'full' }>;

  // Kik Warrant Parser (ported from VIPER)
  kikWarrantScan: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    candidates: { filePath: string; sourceKind: 'warrant' | 'evidence'; sourceRefId: number; hint?: string; size: number }[];
  }>;
  kikWarrantPickFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  kikWarrantImport: (args: { caseId: number; filePath: string; sourceKind?: string; sourceRefId?: number | null; label?: string }) =>
    Promise<{
      success: boolean;
      importId?: number;
      label?: string;
      recordsCount?: number;
      mediaCount?: number;
      summary?: {
        totalRecords: number;
        uniqueContacts: number;
        uniqueGroups: number;
        uniqueIps: number;
        contentFiles: number;
        binds: number;
        friends: number;
      };
      error?: string;
    }>;
  kikWarrantListImports: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    imports: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      mediaCount: number; createdAt: string; updatedAt: string;
    }[];
  }>;
  kikWarrantGetImport: (importId: number) => Promise<{
    success: boolean;
    error?: string;
    import?: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      records: any[]; mediaIndex: Record<string, { size: number; mimeType: string; originalPath: string }>;
      createdAt: string; updatedAt: string;
    };
  }>;
  kikWarrantDeleteImport: (importId: number) => Promise<{ success: boolean; error?: string }>;
  kikWarrantReadMedia: (args: { importId: number; fileName: string }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; mimeType?: string; size?: number }>;
  kikWarrantExportBundle: (args: { importId: number; mode?: 'flagged-only' | 'full'; officer?: string }) =>
    Promise<{ success: boolean; error?: string; filePath?: string; relativePath?: string; flaggedCount?: number; mode?: 'flagged-only' | 'full' }>;

  // Snapchat Warrant Parser (ported from VIPER)
  snapWarrantScan: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    candidates: { filePath: string; sourceKind: 'warrant' | 'evidence'; sourceRefId: number; hint?: string; size: number; isFolder?: boolean }[];
  }>;
  snapWarrantPickFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; isFolder?: boolean; error?: string }>;
  snapWarrantImport: (args: { caseId: number; filePath: string; sourceKind?: string; sourceRefId?: number | null; label?: string }) =>
    Promise<{
      success: boolean;
      importId?: number;
      label?: string;
      recordsCount?: number;
      mediaCount?: number;
      summary?: {
        partCount: number;
        conversationCount: number;
        geoLocationCount: number;
        memoryCount: number;
        mediaCount: number;
        loginCount: number;
        friendCount: number;
      };
      error?: string;
    }>;
  snapWarrantListImports: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    imports: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      mediaCount: number; createdAt: string; updatedAt: string;
    }[];
  }>;
  snapWarrantGetImport: (importId: number) => Promise<{
    success: boolean;
    error?: string;
    import?: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      result: any; mediaIndex: Record<string, { size: number; mimeType: string; originalPath: string }>;
      createdAt: string; updatedAt: string;
    };
  }>;
  snapWarrantDeleteImport: (importId: number) => Promise<{ success: boolean; error?: string }>;
  snapWarrantReadMedia: (args: { importId: number; fileName: string }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; mimeType?: string; size?: number }>;
  snapWarrantExportBundle: (args: { importId: number; mode?: 'flagged-only' | 'full'; officer?: string }) =>
    Promise<{ success: boolean; error?: string; filePath?: string; relativePath?: string; flaggedCount?: number; mode?: 'flagged-only' | 'full' }>;

  // Discord Warrant Parser (ported from VIPER)
  discordWarrantScan: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    candidates: { filePath: string; sourceKind: 'warrant' | 'evidence'; sourceRefId: number; hint?: string; size: number; isFolder?: boolean }[];
  }>;
  discordWarrantPickFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; isFolder?: boolean; error?: string }>;
  discordWarrantImport: (args: { caseId: number; filePath: string; sourceKind?: string; sourceRefId?: number | null; label?: string }) =>
    Promise<{
      success: boolean;
      importId?: number;
      label?: string;
      recordsCount?: number;
      mediaCount?: number;
      summary?: {
        messageCount: number;
        channelCount: number;
        serverCount: number;
        sessionCount: number;
        ipCount: number;
        deviceCount: number;
        eventCount: number;
        mediaCount: number;
      };
      error?: string;
    }>;
  discordWarrantListImports: (caseId: number) => Promise<{
    success: boolean;
    error?: string;
    imports: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      mediaCount: number; createdAt: string; updatedAt: string;
    }[];
  }>;
  discordWarrantGetImport: (importId: number) => Promise<{
    success: boolean;
    error?: string;
    import?: {
      id: number; caseId: number; label: string; sourcePath: string;
      sourceKind: string; sourceRefId: number | null;
      result: any; mediaIndex: Record<string, { size: number; mimeType: string; originalPath: string; kind?: string }>;
      createdAt: string; updatedAt: string;
    };
  }>;
  discordWarrantDeleteImport: (importId: number) => Promise<{ success: boolean; error?: string }>;
  discordWarrantReadMedia: (args: { importId: number; fileName: string }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; mimeType?: string; size?: number }>;
  discordWarrantExportBundle: (args: { importId: number; mode?: 'flagged-only' | 'full'; officer?: string }) =>
    Promise<{ success: boolean; error?: string; filePath?: string; relativePath?: string; flaggedCount?: number; mode?: 'flagged-only' | 'full' }>;

  // Evidence v2
  evidencePickFiles: (opts: { mode?: 'files' | 'folder' }) =>
    Promise<{ success: boolean; canceled?: boolean; error?: string; paths: string[] }>;
  evidenceSave: (args: {
    caseId: number; caseNumber: string; type: string; tag?: string | null;
    description: string; storageMode: 'copy' | 'reference'; sourcePaths: string[];
    referenceFolder?: string; meta?: any; category?: string; subdir?: string;
  }) => Promise<{ success: boolean; error?: string; evidence?: any }>;
  evidenceUpdate: (args: { id: number; patch: { type?: string; tag?: string | null; description?: string; category?: string; meta?: any } }) =>
    Promise<{ success: boolean; error?: string }>;
  evidenceDeleteV2: (args: { id: number; deleteFiles?: boolean }) =>
    Promise<{ success: boolean; error?: string }>;
  evidenceOpenFile: (args: { id: number; relPath: string }) =>
    Promise<{ success: boolean; error?: string }>;
  evidenceRevealFolder: (args: { id: number; relPath?: string }) =>
    Promise<{ success: boolean; error?: string }>;
  evidenceReadFile: (args: { id: number; relPath: string; asText?: boolean; maxBytes?: number }) =>
    Promise<{ success: boolean; error?: string; dataUrl?: string; text?: string; mimeType?: string; size?: number }>;

  // Datapilot
  datapilotScan: (args: { folderPath: string }) =>
    Promise<{ success: boolean; error?: string; preview?: DatapilotPreview }>;
  datapilotScanRoot: (args: { rootPath: string; maxDepth?: number }) =>
    Promise<{ success: boolean; error?: string; hits: { folderPath: string; format: 'csv' | 'dpx' }[] }>;

  // Warrant Return Flags (shared by all warrant parsers)
  warrantFlagToggle: (args: { caseId: number; provider: string; importId?: number | null; section: string; flagKey: string; notes?: string }) =>
    Promise<{ success: boolean; flagged?: boolean; error?: string }>;
  warrantFlagList: (args: { caseId: number; provider: string; importId?: number | null }) =>
    Promise<{ success: boolean; error?: string; flags: { id: number; caseId: number; provider: string; importId: number | null; section: string; flagKey: string; notes: string | null; createdAt: string }[] }>;
  warrantFlagClear: (args: { caseId: number; provider: string; importId?: number | null }) =>
    Promise<{ success: boolean; error?: string }>;

  // BYOA (Bring Your Own Application)
  byoaCreateView: (id: string, url: string) => Promise<{ success: boolean }>;
  byoaSetBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  byoaSetVisible: (id: string, visible: boolean) => void;
  byoaReset: (id: string) => Promise<void>;
  byoaDestroyView: (id: string) => Promise<{ success: boolean }>;
  
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
  getSuspectPhotosBase64: (suspectId: number) => Promise<any[]>;
  deleteSuspectPhoto: (id: number) => Promise<{ success: boolean; error?: string }>;
  addWeapon: (suspectId: number, description: string) => Promise<{ success: boolean; error?: string }>;
  getWeapons: (suspectId: number) => Promise<any[]>;
  deleteWeapon: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // Operations Plan
  saveOpsPlan: (data: any) => Promise<any>;
  getOpsPlan: (caseId: number) => Promise<any>;
  saveOpsEntryTeam: (opsPlanId: number, team: any[]) => Promise<boolean>;
  getOpsEntryTeam: (opsPlanId: number) => Promise<any[]>;
  saveOpsResidents: (opsPlanId: number, residents: any[]) => Promise<boolean>;
  getOpsResidents: (opsPlanId: number) => Promise<any[]>;
  exportOpsPlanPdf: (data: any) => Promise<{ success: boolean; filePath?: string }>;
  
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
  parseNCMECPDF: (filePath: string, password?: string) => Promise<any>;
  copyCybertipPDF: (sourcePath: string, caseNumber: string) => Promise<{ success: boolean; relativePath?: string; error?: string }>;
  updateIdentifierProvider: (id: number, provider: string) => Promise<{ success: boolean }>;

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

  // Timeline
  getTimelineEvents: (caseId: number) => Promise<any[]>;
  addTimelineEvent: (event: any) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateTimelineEvent: (eventId: number, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteTimelineEvent: (eventId: number) => Promise<{ success: boolean; error?: string }>;
  generateTimelineEvents: (caseId: number) => Promise<{ success: boolean; events: any[]; count: number; error?: string }>;

  // In-App Updater
  getAppVersion: () => Promise<string>;
  downloadAppUpdate: (url: string) => Promise<{ success: boolean; installerPath: string }>;
  installAppUpdate: (installerPath: string) => Promise<{ success: boolean; error?: string; installerPath?: string }>;
  showUpdateInFolder: (installerPath: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateDownloadProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => void;
  removeUpdateDownloadProgressListener: () => void;

  // Resource Download Capture
  onResourceDownloadComplete: (cb: (info: {
    id: string; partition: string; provider: string; filename: string;
    mimeType: string; totalBytes: number; tempPath: string; sourceUrl: string; startedAt: string;
  }) => void) => () => void;
  onResourceDownloadProgress: (cb: (info: { id: string; state: string; received: number; total: number }) => void) => () => void;
  onResourceDownloadFailed: (cb: (info: { id: string; state: string }) => void) => () => void;
  resourceDownloadRouteToEvidence: (args: {
    downloadId: string; caseId: number; caseNumber: string;
    type?: string; tag?: string | null; description?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  resourceDownloadRouteToCybertip: (args: {
    downloadId: string; caseId: number; caseNumber: string;
    officerDescription?: string; ipAddress?: string; datetime?: string;
    ncmecFilename?: string; csamDescription?: string;
  }) => Promise<{ success: boolean; relativePath?: string; error?: string }>;
  resourceDownloadMoveToDownloads: (downloadId: string) => Promise<{ success: boolean; finalPath?: string; error?: string }>;
  resourceDownloadDiscard: (downloadId: string) => Promise<{ success: boolean; error?: string }>;
  resourceDownloadRouteToWarrantProduction: (args: {
    downloadId: string; caseId: number; caseNumber: string;
    subfolder?: string | null; description?: string;
  }) => Promise<{ success: boolean; relativePath?: string; error?: string }>;
  resourceCapturePdf: (resourceId: string) => Promise<{ success: boolean; filename?: string; error?: string }>;
  resourceCaptureHtml: (resourceId: string) => Promise<{ success: boolean; filename?: string; error?: string }>;

  // ===== Audit Log =====
  auditLogGet: (limit?: number) => Promise<{
    success: boolean;
    error?: string;
    entries: Array<{
      id: number;
      seq: number;
      event_type: string;
      event_data: Record<string, any> | null;
      prev_hash: string | null;
      hash: string;
      timestamp: string;
      user: string | null;
      host: string | null;
      app_version: string | null;
    }>;
    total: number;
  }>;
  auditLogVerify: () => Promise<{ valid: boolean; totalEntries: number; firstBreakSeq?: number; reason?: string }>;
  auditLogExport: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  auditLogEvent: (eventType: string, data?: Record<string, any>) => Promise<{ success: boolean }>;
  auditLogWindowsGet: () => Promise<{ supported: boolean; enabled: boolean; sourceRegistered: boolean; source: string }>;
  auditLogWindowsSet: (enabled: boolean) => Promise<{ success: boolean; error?: string; needsAdmin?: boolean }>;

  // ===== UC Chat Operations =====
  ucPersonaList: (args?: { includeArchived?: boolean }) => Promise<UcPersona[]>;
  ucPersonaGet: (id: number) => Promise<UcPersona | null>;
  ucPersonaCreate: (input: Partial<UcPersona>) => Promise<UcPersona>;
  ucPersonaUpdate: (id: number, input: Partial<UcPersona>) => Promise<UcPersona>;
  ucPersonaArchive: (id: number) => Promise<boolean>;
  ucPersonaUnarchive: (id: number) => Promise<boolean>;

  ucChatList: (args?: { includeArchived?: boolean; personaId?: number }) => Promise<UcChat[]>;
  ucChatGet: (id: number) => Promise<UcChat | null>;
  ucChatCreate: (input: Partial<UcChat>) => Promise<UcChat>;
  ucChatUpdate: (id: number, input: Partial<UcChat>) => Promise<UcChat>;
  ucChatArchive: (id: number) => Promise<boolean>;
  ucChatUnarchive: (id: number) => Promise<boolean>;
  ucChatMarkRead: (id: number) => Promise<boolean>;

  ucChatLinkCase: (chatId: number, caseId: number, role?: 'primary' | 'secondary') => Promise<UcChatCaseLink[]>;
  ucChatUnlinkCase: (chatId: number, caseId: number) => Promise<UcChatCaseLink[]>;
  ucChatCaseLinks: (chatId: number) => Promise<UcChatCaseLink[]>;
  ucChatEvents: (chatId: number, limit?: number) => Promise<UcChatEvent[]>;

  ucChatBvCreate: (chatId: number, personaId: number, url: string) => Promise<boolean>;
  ucChatBvSetBounds: (chatId: number, bounds: { x: number; y: number; width: number; height: number }) => void;
  ucChatBvSetVisible: (chatId: number, visible: boolean) => void;
  ucChatBvLoadUrl: (chatId: number, url: string) => void;
  ucChatBvReload: (chatId: number) => void;
  ucChatBvBack: (chatId: number) => void;
  ucChatBvDestroy: (chatId: number) => void;
  ucChatBvHideAll: () => void;

  ucOnAlert: (cb: (payload: UcAlertPayload) => void) => () => void;
  ucDiscreetModeGet: () => Promise<boolean>;
  ucDiscreetModeSet: (on: boolean) => Promise<boolean>;

  ucEvidenceLogList: (filter?: { caseId?: number; chatId?: number; limit?: number }) => Promise<UcEvidenceLogRow[]>;
  ucEvidenceLogVerify: (id: number) => Promise<{ match: boolean; expected: string | null; actual: string | null }>;

  ucPhotoList: (personaId: number, includeArchived?: boolean) => Promise<UcPersonaPhoto[]>;
  ucPhotoAdd: (input: { personaId: number; srcPath: string; caption?: string }) => Promise<UcPersonaPhoto>;
  ucPhotoUpdate: (id: number, input: { caption?: string | null; sort_order?: number }) => Promise<UcPersonaPhoto>;
  ucPhotoArchive: (id: number) => Promise<boolean>;
  ucPhotoUnarchive: (id: number) => Promise<boolean>;
  ucPhotoUses: (photoId: number) => Promise<UcPhotoUse[]>;
  ucPhotoCopyToClipboard: (photoId: number, chatId: number) => Promise<{ ok: true }>;
  ucPhotoPickAndAdd: (personaId: number) => Promise<UcPersonaPhoto[]>;
  ucPhotoPickFiles: () => Promise<Array<{ path: string; name: string }>>;
}

// ===== UC Chat Operations types =====
interface UcPersona {
  id: number;
  display_name: string;
  real_age: number | null;
  displayed_age: number | null;
  gender: string | null;
  hometown: string | null;
  bio: string | null;
  backstory: string | null;
  avatar_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

type UcChatPlatform = 'discord' | 'telegram' | 'instagram' | 'whatsapp' | 'snapchat' | 'messenger' | 'meetme' | 'sniffies' | 'custom';

interface UcChat {
  id: number;
  persona_id: number;
  platform: UcChatPlatform;
  platform_url: string | null;
  suspect_handle: string | null;
  suspect_display_name: string | null;
  status: 'active' | 'archived';
  primary_case_id: number | null;
  unread_count: number;
  last_activity_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined fields when present
  persona_name?: string;
  persona_avatar?: string | null;
}

interface UcChatCaseLink {
  chat_id: number;
  case_id: number;
  role: 'primary' | 'secondary';
  linked_at: string;
}

interface UcChatEvent {
  id: number;
  chat_id: number;
  ts: string;
  kind: 'incoming' | 'outgoing' | 'capture' | 'alert' | 'panic' | 'link' | 'note';
  payload_json: string | null;
}

interface UcAlertPayload {
  chatId: number;
  kind: 'notification' | 'title' | 'activity';
  title?: string;
  body?: string;
  icon?: string;
  ts: number;
}

interface UcEvidenceLogRow {
  id: number;
  evidence_id: number | null;
  case_id: number | null;
  chat_id: number | null;
  action: 'create' | 'export' | 'hash' | 'verify' | 'route';
  sha256: string | null;
  file_path: string | null;
  size_bytes: number | null;
  operator_user_id: number | null;
  ts: string;
  meta_json: string | null;
}

interface UcPersonaPhoto {
  id: number;
  persona_id: number;
  file_path: string;
  original_filename: string | null;
  caption: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
  src_url?: string;
  use_count?: number;
  last_used_chat_id?: number | null;
  last_used_at?: string | null;
}

interface UcPhotoUse {
  id: number;
  photo_id: number;
  chat_id: number;
  ts: string;
  action: string;
  notes: string | null;
}

interface Window {
  electronAPI: ElectronAPI;
}
