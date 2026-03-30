import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Logo } from './components/Logo';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateCase } from './pages/CreateCase';
import { CyberTipForm } from './pages/CyberTipForm';
import { P2PForm } from './pages/P2PForm';
import { ChatForm } from './pages/ChatForm';
import { OtherForm } from './pages/OtherForm';
import { CaseDetail } from './pages/CaseDetail';
import { CasesList } from './pages/CasesList';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';
import { OutreachList } from './pages/OutreachList';
import { OutreachForm } from './pages/OutreachForm';
import { Resources } from './pages/Resources';
import { OffenseReference } from './pages/OffenseReference';
import { ReportWindow } from './pages/ReportWindow';
import { LicenseProvider, useLicense } from './lib/LicenseContext';
import { LicenseRegistrationModal } from './components/LicenseRegistrationModal';

// Define the window.electronAPI interface
declare global {
  interface Window {
    electronAPI: {
      registerUser: (username: string) => Promise<any>;
      getCurrentUser: () => Promise<any>;
      verifyHardware: () => Promise<boolean>;
      getDashboardStats: () => Promise<any>;
      createCase: (caseData: any) => Promise<any>;
      getCase: (caseId: number) => Promise<any>;
      getAllCases: () => Promise<any>;
      saveCyberTipData: (data: any) => Promise<any>;
      getCyberTipData: (caseId: number) => Promise<any>;
      saveCyberTipIdentifier: (data: any) => Promise<any>;
      getCyberTipIdentifiers: (caseId: number) => Promise<any>;
      deleteCyberTipIdentifier: (id: number) => Promise<any>;
      saveCyberTipFile: (data: any) => Promise<any>;
      getCyberTipFiles: (caseId: number) => Promise<any>;
      uploadCaseFile: (data: any) => Promise<any>;
      parseNCMECPDF: (filePath: string) => Promise<any>;
      openFileDialog: (options: any) => Promise<any>;
      openFolderDialog: (options: any) => Promise<any>;
      openFileLocation: (path: string) => Promise<void>;
      getFilePath: (relativePath: string) => Promise<string>;
      getWarrants: (caseId: number) => Promise<any>;
      addWarrant: (warrant: any) => Promise<any>;
      updateWarrant: (warrantId: number, updates: any) => Promise<any>;
      deleteWarrant: (warrantId: number) => Promise<any>;
      getSuspect: (caseId: number) => Promise<any>;
      saveSuspect: (suspectData: any) => Promise<any>;
      addSuspectPhoto: (photoData: any) => Promise<any>;
      getSuspectPhotos: (suspectId: number) => Promise<any>;
      deleteSuspectPhoto: (photoId: number) => Promise<any>;
      getOpsPlan: (caseId: number) => Promise<any>;
      saveOpsPlan: (opPlanData: any) => Promise<any>;
      getReport: (caseId: number) => Promise<any>;
      saveReport: (reportData: any) => Promise<any>;
      exportReportPDF: (data: any) => Promise<any>;
      openReportWindow: (data: any) => Promise<any>;
      verifyEmail: (email: string) => Promise<any>;
      getAllPublicOutreach: () => Promise<any>;
      getPublicOutreach: (id: number) => Promise<any>;
      addPublicOutreach: (data: any) => Promise<any>;
      updatePublicOutreach: (id: number, data: any) => Promise<any>;
      deletePublicOutreach: (id: number) => Promise<any>;
      getP2PData: (caseId: number) => Promise<any>;
      saveP2PData: (data: any) => Promise<any>;
      arinLookup: (ipAddress: string) => Promise<any>;
      pingIp: (ipAddress: string) => Promise<any>;
      carrierLookup: (phoneNumber: string) => Promise<any>;
      geocodeAddress: (address: string, suspectId: number) => Promise<any>;
      getSecret: (keyName: string) => Promise<any>;
      setSecret: (keyName: string, value: string) => Promise<any>;
      updateCase: (caseId: number, updates: any) => Promise<any>;
      deleteCase: (caseId: number) => Promise<any>;
      exportDACase: (caseId: number, exportOptions: any) => Promise<any>;
      addCaseNote: (note: any) => Promise<any>;
      getCaseNotes: (caseId: number) => Promise<any>;
      deleteCaseNote: (noteId: number) => Promise<any>;
      addEvidence: (evidence: any) => Promise<any>;
      getEvidence: (caseId: number) => Promise<any>;
      deleteEvidence: (evidenceId: number) => Promise<any>;
      getChatData: (caseId: number) => Promise<any>;
      saveChatData: (data: any) => Promise<any>;
      saveChatIdentifier: (data: any) => Promise<any>;
      getChatIdentifiers: (caseId: number) => Promise<any>;
      deleteChatIdentifier: (id: number) => Promise<any>;
      getOtherData: (caseId: number) => Promise<any>;
      saveOtherData: (data: any) => Promise<any>;
      saveOtherIdentifier: (data: any) => Promise<any>;
      getOtherIdentifiers: (caseId: number) => Promise<any>;
      deleteOtherIdentifier: (id: number) => Promise<any>;
      getProsecution: (caseId: number) => Promise<any>;
      saveProsecution: (data: any) => Promise<any>;
      deleteCyberTipFile: (id: number) => Promise<any>;
      addWeapon: (weapon: any) => Promise<any>;
      deleteWeapon: (weaponId: number) => Promise<any>;
      exportSuspectPDF: (data: any) => Promise<any>;
      searchCases: (query: string) => Promise<any>;
      getCasesPath: () => Promise<string>;
      addTodo: (todo: any) => Promise<any>;
      getTodos: (caseId?: number) => Promise<any>;
      updateTodo: (todoId: number, updates: any) => Promise<any>;
      deleteTodo: (todoId: number) => Promise<any>;
      exportDashboardPDF: (data: any) => Promise<any>;
      restoreWindowFocus: () => Promise<void>;
      getAllResources: () => Promise<any>;
      getResource: (id: number) => Promise<any>;
      addResource: (data: any) => Promise<any>;
      updateResource: (id: number, data: any) => Promise<any>;
      deleteResource: (id: number) => Promise<any>;
      getAllOffenses: () => Promise<any>;
      getOffense: (id: number) => Promise<any>;
      addOffense: (data: any) => Promise<any>;
      updateOffense: (id: number, data: any) => Promise<any>;
      deleteOffense: (id: number) => Promise<any>;
      exportOffenses: () => Promise<any>;
      importOffenses: (options: { overwriteDuplicates: boolean }) => Promise<any>;
      getOutreachMaterials: () => Promise<any>;
      addOutreachMaterial: (data: any) => Promise<any>;
      updateOutreachMaterial: (id: number, data: any) => Promise<any>;
      deleteOutreachMaterial: (id: number) => Promise<any>;
      reorderOffenses: (offenseIds: number[]) => Promise<any>;
      // Case Transfer
      getExportSize: (caseId: number) => Promise<{ success: boolean; size?: number; error?: string }>;
      exportCompleteCase: (data: { caseId: number; password: string }) => Promise<any>;
      validateImportFile: (data: { filePath: string; password: string }) => Promise<any>;
      importCompleteCase: (data: { filePath: string; password: string }) => Promise<any>;
      onExportProgress: (callback: (progress: any) => void) => void;
      onImportProgress: (callback: (progress: any) => void) => void;
      // CDR Module
      getCDRRecords: (caseId: number) => Promise<any[]>;
      importCDRRecords: (data: { caseId: number; records: any[]; refLat?: number; refLon?: number }) => Promise<any>;
      deleteCDRRecords: (caseId: number) => Promise<any>;
      readEvidenceFile: (relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      // Aperture Module
      getApertureEmails: (caseId: number) => Promise<any[]>;
      importApertureEmails: (data: { caseId: number; fileData: string; fileName: string }) => Promise<any>;
      updateApertureEmail: (data: { id: number; flagged?: number }) => Promise<any>;
      deleteApertureEmails: (caseId: number) => Promise<any>;
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
    };
  }
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [hardwareValid, setHardwareValid] = useState(true);

  useEffect(() => {
    // Apply saved theme on startup
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-mode');
      document.body.classList.add('light-mode');
    }
    
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // Verify hardware ID
      const isValid = await window.electronAPI.verifyHardware();
      setHardwareValid(isValid);

      if (!isValid) {
        setLoading(false);
        return;
      }

      // Check if we're in portable mode
      const isPortable = await window.electronAPI.isPortableMode();
      
      if (!isPortable) {
        // Installed mode - no login required
        setUser({ username: 'Officer', usbBound: false });
        setLoading(false);
        return;
      }

      // Portable mode - check if user is registered
      const isRegistered = await window.electronAPI.isUserRegistered();
      
      if (isRegistered) {
        // User needs to login
        setNeedsLogin(true);
      } else {
        // First time setup
        setNeedsLogin(true);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setNeedsLogin(true); // Default to login screen if check fails
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setNeedsLogin(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background relative overflow-hidden">
        {/* Starfield background effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-panel to-background">
          <div className="stars-small"></div>
          <div className="stars-medium"></div>
          <div className="stars-large"></div>
        </div>

        <div className="text-center relative z-10">
          <div className="mb-8 animate-pulse-slow">
            <Logo size="large" showFullText={true} />
          </div>
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-primary text-lg">Initializing secure system...</p>
        </div>

        <style>{`
          @keyframes pulse-slow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .animate-pulse-slow {
            animation: pulse-slow 2s ease-in-out infinite;
          }
          
          .stars-small, .stars-medium, .stars-large {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
              radial-gradient(2px 2px at 20px 30px, rgba(0, 212, 255, 0.3), transparent),
              radial-gradient(2px 2px at 60px 70px, rgba(0, 212, 255, 0.2), transparent),
              radial-gradient(1px 1px at 50px 50px, rgba(0, 212, 255, 0.4), transparent),
              radial-gradient(1px 1px at 80px 10px, rgba(0, 212, 255, 0.3), transparent),
              radial-gradient(2px 2px at 90px 60px, rgba(0, 212, 255, 0.2), transparent),
              radial-gradient(1px 1px at 30px 80px, rgba(0, 212, 255, 0.3), transparent);
            background-size: 100px 100px;
            animation: twinkle 3s ease-in-out infinite;
          }
          
          .stars-medium {
            background-image: 
              radial-gradient(1px 1px at 40px 20px, rgba(255, 184, 0, 0.3), transparent),
              radial-gradient(1px 1px at 70px 50px, rgba(255, 184, 0, 0.2), transparent),
              radial-gradient(1px 1px at 10px 70px, rgba(255, 184, 0, 0.4), transparent);
            background-size: 150px 150px;
            animation: twinkle 4s ease-in-out infinite 0.5s;
          }
          
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  if (!hardwareValid) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="bg-panel p-8 rounded-lg shadow-2xl border border-accent-pink/30 max-w-md text-center">
          <div className="mb-6">
            <Logo size="medium" showFullText={true} />
          </div>
          <div className="w-16 h-16 bg-accent-pink/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-accent-pink mb-4">Hardware Mismatch</h1>
          <p className="text-text-muted mb-6">
            This application is bound to a different computer. It cannot be run on this machine for security reasons.
          </p>
          <p className="text-sm text-text-muted">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Check if this is the report pop-out window
  const isReportWindow = window.location.hash.includes('report-window');
  
  if (isReportWindow) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/report-window" element={<ReportWindow />} />
        </Routes>
      </HashRouter>
    );
  }

  // Main app with routing — wrapped in LicenseProvider
  return (
    <LicenseProvider>
      <AppContent user={user} />
    </LicenseProvider>
  );
}

function AppContent({ user }: { user: any }) {
  const { showRegistration, completeRegistration } = useLicense();

  return (
    <>
      {showRegistration && (
        <LicenseRegistrationModal onComplete={completeRegistration} />
      )}
      <HashRouter>
        <Layout user={user}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cases" element={<CasesList />} />
            <Route path="/cases/new" element={<CreateCase />} />
            <Route path="/cases/new/cybertip" element={<CyberTipForm />} />
            <Route path="/cases/new/p2p" element={<P2PForm />} />
            <Route path="/cases/new/chat" element={<ChatForm />} />
            <Route path="/cases/new/other" element={<OtherForm />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/outreach" element={<OutreachList />} />
            <Route path="/outreach/new" element={<OutreachForm />} />
            <Route path="/outreach/edit/:id" element={<OutreachForm />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/offense-reference" element={<OffenseReference />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
    </>
  );
}

export default App;
