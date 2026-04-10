import { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { useLicense } from '../lib/LicenseContext';

export function Settings() {
  const { status: licenseStatus, activate, checkUpdate, appVersion } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ checked: boolean; available: boolean; version?: string; url?: string; changelog?: string }>({ checked: false, available: false });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [casesPath, setCasesPath] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mediaEnabled, setMediaEnabled] = useState(() => localStorage.getItem('mediaPlayerEnabled') === 'true');
  const [showLicense, setShowLicense] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<any>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [veriphoneKey, setVeriphoneKey] = useState('');
  const [savedVeriphoneKey, setSavedVeriphoneKey] = useState('');
  const [veriphoneEnabled, setVeriphoneEnabled] = useState(false);
  
  // Flock Safety state
  const [flockEnabled, setFlockEnabled] = useState(() => localStorage.getItem('flockEnabled') === 'true');
  const [flockEmail, setFlockEmail] = useState('');
  const [flockPassword, setFlockPassword] = useState('');
  const [flockHasCredentials, setFlockHasCredentials] = useState(false);
  const [showFlockPassword, setShowFlockPassword] = useState(false);

  // TLO / TransUnion state
  const [tloEnabled, setTloEnabled] = useState(() => localStorage.getItem('tloEnabled') === 'true');
  const [tloUsername, setTloUsername] = useState('');
  const [tloPassword, setTloPassword] = useState('');
  const [tloHasCredentials, setTloHasCredentials] = useState(false);
  const [showTloPassword, setShowTloPassword] = useState(false);

  // Password change state
  const [isPortable, setIsPortable] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Field Security state
  const [secEnabled, setSecEnabled] = useState(false);
  const [secSetupMode, setSecSetupMode] = useState(false);
  const [secPw, setSecPw] = useState('');
  const [secPwConfirm, setSecPwConfirm] = useState('');
  const [secRecoveryKey, setSecRecoveryKey] = useState('');
  const [secRecoveryAck, setSecRecoveryAck] = useState(false);
  const [secError, setSecError] = useState('');
  const [secChangePwMode, setSecChangePwMode] = useState(false);
  const [secNewPw, setSecNewPw] = useState('');
  const [secNewPwConfirm, setSecNewPwConfirm] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const path = await window.electronAPI.getCasesPath();
      setCasesPath(path);
      
      // Load theme from localStorage
      const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
      setTheme(savedTheme);
      applyTheme(savedTheme);
      
      // Load Veriphone toggle state
      const enabledState = localStorage.getItem('veriphoneEnabled') === 'true';
      setVeriphoneEnabled(enabledState);
      
      // Load Veriphone API key
      const key = await window.electronAPI.getSecret('VERIPHONE_API_KEY');
      if (key) {
        setSavedVeriphoneKey(key);
      }
      
      // Load Flock/TLO credential status
      setFlockHasCredentials(!!(localStorage.getItem('flockEmail')));
      setTloHasCredentials(!!(localStorage.getItem('tloUsername')));

      // Check if in portable mode
      const portable = await window.electronAPI.isPortableMode();
      setIsPortable(portable);

      // Check field security state
      const secState = await window.electronAPI.securityCheck();
      setSecEnabled(secState.enabled);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const applyTheme = (newTheme: 'dark' | 'light') => {
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-mode');
      document.body.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.body.classList.remove('light-mode');
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const handleOpenCasesFolder = () => {
    window.electronAPI.openFileLocation(casesPath);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(casesPath);
    alert('Path copied to clipboard!');
  };

  const handleSaveVeriphoneKey = async () => {
    try {
      await window.electronAPI.setSecret('VERIPHONE_API_KEY', veriphoneKey);
      setSavedVeriphoneKey(veriphoneKey);
      setVeriphoneKey('');
      
      // Restore focus after async operation
      window.focus();
      
      alert('Veriphone API key saved successfully!');
    } catch (error) {
      console.error('Failed to save API key:', error);
      window.focus(); // Restore focus even on error
      alert('Failed to save API key');
    }
  };

  const handleClearVeriphoneKey = async () => {
    if (!confirm('Are you sure you want to remove your Veriphone API key?')) return;
    
    try {
      await window.electronAPI.setSecret('VERIPHONE_API_KEY', '');
      setSavedVeriphoneKey('');
      setVeriphoneKey('');
      alert('Veriphone API key removed');
    } catch (error) {
      console.error('Failed to clear API key:', error);
      alert('Failed to clear API key');
    }
  };

  const handleToggleVeriphone = () => {
    const newState = !veriphoneEnabled;
    setVeriphoneEnabled(newState);
    localStorage.setItem('veriphoneEnabled', newState.toString());
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('All fields are required');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    setPasswordChanging(true);
    
    try {
      // Get current user to retrieve username
      const currentUser = await window.electronAPI.getCurrentUser();
      if (!currentUser) {
        setPasswordError('Could not retrieve current user');
        setPasswordChanging(false);
        return;
      }
      
      const result = await window.electronAPI.changePassword(
        currentUser.username,
        currentPassword,
        newPassword
      );
      
      if (result.success !== false) {
        alert('Password changed successfully!');
        setShowPasswordChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordError(result.error || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Password change failed:', error);
      setPasswordError(error.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleChangeStorageLocation = async () => {
    try {
      // Open folder selection dialog
      const result = await window.electronAPI.openFolderDialog({
        title: 'Select New Case Files Storage Location',
        buttonLabel: 'Select Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const newPath = result.filePaths[0];

      // Validate the new path
      const validation = await window.electronAPI.changeCasesPath(newPath);
      
      if (!validation.success) {
        alert('Invalid path selected. Please choose a valid directory with write permissions.');
        return;
      }

      // Ask user if they want to migrate existing files
      const shouldMigrate = confirm(
        `New storage location selected:\n${newPath}\n\n` +
        `Do you want to copy all existing case files to the new location?\n\n` +
        `This will:\n` +
        `• Copy all case files from:\n  ${casesPath}\n` +
        `• To the new location:\n  ${newPath}\n\n` +
        `Your original files will remain intact.\n\n` +
        `Click OK to proceed with migration, or Cancel to just change the path.`
      );

      if (shouldMigrate) {
        setShowMigrationDialog(true);
        setIsMigrating(true);
        setMigrationProgress({ percentage: 0, currentFolder: '', foldersCompleted: 0, totalFolders: 0 });

        // Listen for progress updates
        const progressHandler = (_event: any, progress: any) => {
          setMigrationProgress(progress);
        };
        window.electronAPI.onMigrationProgress(progressHandler);

        // Start migration
        const result = await window.electronAPI.migrateCaseFiles({
          oldPath: casesPath,
          newPath: newPath
        });

        setIsMigrating(false);

        if (result.success) {
          alert(
            `Migration completed successfully!\n\n` +
            `${result.foldersCopied} case folders copied\n` +
            `${result.filesCopied} files copied\n\n` +
            `The application will now use the new storage location.`
          );
          
          // Reload settings to show new path
          await loadSettings();
          setShowMigrationDialog(false);
        }
      } else {
        // Just update the path without migrating - will be handled on backend
        alert('Storage location updated. New cases will be saved to the new location.\n\nNote: Existing case files remain at the old location.');
        
        // Reload settings to show new path
        await loadSettings();
      }
    } catch (error) {
      console.error('Failed to change storage location:', error);
      alert(`Failed to change storage location: ${error}`);
      setIsMigrating(false);
      setShowMigrationDialog(false);
    }
  };

  const licenseText = `END-USER LICENSE AGREEMENT (EULA) FOR ICAC PULSE

EFFECTIVE DATE: December 25, 2025

This End-User License Agreement (the "Agreement") is a binding legal agreement between you, the End-User (referred to as "Licensee" or "You"), and Intellect LE, LLC (referred to as "Licensor" or "Intellect LE") for the use of the software product "ICAC Pulse" (the "Software").

BY INSTALLING, COPYING, OR OTHERWISE USING THE SOFTWARE, YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO THE TERMS OF THIS AGREEMENT, DO NOT INSTALL OR USE THE SOFTWARE.

────────────────────────────────────────────────────────────────────────────────

1. GRANT OF PERPETUAL LICENSE

Intellect LE, LLC grants you a perpetual, non-exclusive, non-transferable, and revocable license to install and use the Software on a single device strictly in accordance with the terms and conditions set forth in this Agreement.

• Offline Nature: Licensee acknowledges that the Software is designed for local, offline operation. No internet connection is required for functionality, and no web-based features are included in this license.

2. RESTRICTIONS AND INTELLECTUAL PROPERTY

The Software is licensed, not sold. All title, ownership rights, and intellectual property rights in and to the Software (including but not limited to any images, photographs, animations, video, audio, music, text, and applets incorporated into the Software) are and shall remain the sole property of Intellect LE, LLC.

• 2.1. Prohibition on Duplication and Distribution: You are expressly and strictly forbidden from copying, duplicating, reproducing, sublicensing, publishing, redistributing, or otherwise transferring the Software, or any part thereof, to any third party without the express prior written permission of Intellect LE, LLC. Any unauthorized duplication or distribution constitutes a material breach of this Agreement and a violation of applicable copyright law.

• 2.2. Prohibited Functional Modifications: You shall not modify, adapt, translate, reverse engineer, decompile, disassemble, or create derivative works based on the Software.

3. DATA SECURITY AND END-USER RESPONSIBILITIES

Because ICAC Pulse is a local-install, offline tool, the Licensee maintains absolute control over the environment in which it operates.

• 3.1. Local Storage and Data Responsibility: The Software is designed to operate locally and store all data, including sensitive investigative case files, evidence, and related information, directly on the device or local storage media where it is installed.

• 3.2. Disclaimer of Security Liability: INTELLECT LE, LLC IS NOT RESPONSIBLE FOR THE SECURITY, INTEGRITY, OR PRIVACY OF ANY DATA STORED OR PROCESSED BY THE SOFTWARE ON YOUR DEVICE. The security of the data is solely the responsibility of the Licensee.

• 3.3. Licensee Precautions: You are solely responsible for taking all necessary and adequate precautions to secure your data and the device on which the Software is installed. This includes, but is not limited to:
  ○ Implementing strong passwords and multi-factor authentication for the host device.
  ○ Ensuring full-disk encryption for hardware.
  ○ Maintaining robust physical and network security for the environment.
  ○ Regularly backing up critical data to prevent loss due to hardware failure.

• 3.4. Professional Use: The Software is a tool for Law Enforcement professionals. Licensee assumes all responsibility for the use of the Software in the course of investigations, including adherence to legal standards, chain of custody, and privacy laws.

4. SOFTWARE UPDATES AND MAINTENANCE

• 4.1. No Updates Provided: Due to the offline, self-contained nature and operational design of the Software, Intellect LE, LLC explicitly does not provide, and is not obligated to provide, any software updates, maintenance releases, patches, bug fixes, or new versions of the Software as part of this license.

• 4.2. "AS IS" Basis: The Software is provided to you "AS IS" and without any warranty of any kind, whether express, implied, statutory, or otherwise, except as expressly set forth herein. Intellect LE, LLC does not warrant that the Software will meet your requirements or that the operation of the Software will be uninterrupted or error-free.

5. LIMITATION OF LIABILITY

In no event shall Intellect LE, LLC be liable for any special, incidental, indirect, or consequential damages whatsoever (including, without limitation, damages for loss of business profits, business interruption, loss of business information, loss of investigative data, or any other pecuniary loss) arising out of the use of or inability to use the Software, even if Intellect LE, LLC has been advised of the possibility of such damages.

Licensee acknowledges that the entire risk as to the quality and performance of the Software is with the Licensee.

6. TERMINATION

This Agreement is effective until terminated. Your rights under this license will terminate immediately and without notice from Intellect LE, LLC if you fail to comply with any term(s) of this Agreement, including but not limited to unauthorized distribution of the Software. Upon termination, you must cease all use of the Software and destroy all copies of the Software in your possession.

7. GOVERNING LAW AND JURISDICTION

This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which Intellect LE, LLC is incorporated, without regard to its conflict of law principles.

8. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between you and Intellect LE, LLC concerning the Software and supersedes all prior or contemporaneous oral or written communications, proposals, and representations with respect to the Software or any other subject matter covered by this Agreement.

9. CONTACT INFORMATION

For questions regarding this Agreement, please contact:
Intellect LE, LLC
Email: Justin@intellect-le.com

────────────────────────────────────────────────────────────────────────────────

BY INSTALLING, COPYING, OR USING THE SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS AGREEMENT, UNDERSTAND IT, AND AGREE TO BE BOUND BY ITS TERMS AND CONDITIONS.

© 2025 Intellect LE, LLC. All Rights Reserved.`;

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setActivateMsg(null);
    const result = await activate(licenseKey.trim());
    setActivateMsg({ ok: result.success, text: result.message });
    setActivating(false);
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const info = await checkUpdate();
    setUpdateInfo({ checked: true, available: info.available, version: info.latestVersion, url: info.downloadUrl, changelog: info.changelog });
    setCheckingUpdate(false);
  };

  // Auto-check for updates on mount
  useEffect(() => { handleCheckUpdate(); }, []);

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Settings</h1>
          <p className="text-text-muted">Configure application preferences and view system information</p>
        </div>

        <div className="space-y-6">

          {/* ═══════════════ License & Status ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              License &amp; Status
            </h2>

            {/* Status badge + countdown */}
            <div className="bg-background rounded-lg p-4 border border-accent-cyan/10 mb-4 flex items-center justify-between">
              <div>
                {licenseStatus.state === 'licensed' && (
                  <span className="inline-flex items-center gap-2 text-status-success font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse" /> Licensed
                  </span>
                )}
                {licenseStatus.state === 'demo_active' && (
                  <span className="inline-flex items-center gap-2 text-status-warning font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-warning" /> Demo Mode
                  </span>
                )}
                {licenseStatus.state === 'demo_expired' && (
                  <span className="inline-flex items-center gap-2 text-accent-pink font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-pink" /> Demo Expired
                  </span>
                )}
                {licenseStatus.registration && (
                  <div className="mt-1 flex gap-6 text-sm text-text-muted">
                    <span><span className="text-accent-pink">Registered:</span> {licenseStatus.registration.name}</span>
                    <span><span className="text-text-muted">Agency:</span> {licenseStatus.registration.agency}</span>
                  </div>
                )}
              </div>
              {licenseStatus.state === 'demo_active' && licenseStatus.demoDaysLeft >= 0 && (
                <div className="text-right border border-status-warning/30 rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold text-status-warning">{licenseStatus.demoDaysLeft}</span>
                  <span className="text-sm text-text-muted ml-1">days remaining</span>
                </div>
              )}
            </div>

            {/* License activation (only show if not licensed) */}
            {licenseStatus.state !== 'licensed' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-muted mb-2">Activate License Key</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    placeholder="INT-ICACPULS-XXXX-XXXX-XXXX"
                    className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-2 text-text-primary font-mono focus:border-accent-cyan focus:outline-none"
                  />
                  <button
                    onClick={handleActivate}
                    disabled={activating || !licenseKey.trim()}
                    className="px-6 py-2 bg-accent-cyan text-background font-semibold rounded-lg hover:bg-accent-cyan/80 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    🔑 Activate
                  </button>
                </div>
                {activateMsg && (
                  <p className={`mt-2 text-sm ${activateMsg.ok ? 'text-status-success' : 'text-accent-pink'}`}>
                    {activateMsg.ok ? '✅' : '⚠️'} {activateMsg.text}
                  </p>
                )}
              </div>
            )}

            {/* Demo expired explainer */}
            {licenseStatus.state === 'demo_expired' && (
              <div className="p-4 rounded-lg border border-status-warning/30 bg-status-warning/5 mb-4">
                <p className="text-sm text-text-muted">
                  Your demo period has ended. <strong className="text-text-primary">All existing cases and features remain fully accessible</strong> — only creating new cases is restricted until a license is activated.
                </p>
              </div>
            )}

            {/* Pricing box */}
            {licenseStatus.state !== 'licensed' && (
              <div className="p-4 rounded-lg border border-accent-cyan/20 bg-accent-cyan/5">
                <p className="text-sm text-text-primary">
                  Lifetime licenses are available for <strong>$600 per user</strong> — a one-time purchase with no recurring fees.
                  Attendees of the <em>Investigator Network Sex Offender Management Symposium</em> (past or present) are eligible to receive a complimentary license.
                </p>
                <p className="text-sm text-text-muted mt-2">
                  For purchasing or eligibility inquiries, contact:
                  <br />
                  <a href="mailto:Justin@intellect-le.com" className="text-accent-cyan underline">✉ Justin@intellect-le.com</a>
                </p>
              </div>
            )}
          </div>

          {/* ═══════════════ Software Updates ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              Software Updates
            </h2>
            <div className="bg-background rounded-lg p-4 border border-accent-cyan/10 flex items-center justify-between">
              <div>
                <p className="text-text-primary font-semibold">Current Version: {appVersion}</p>
                {updateInfo.checked && !updateInfo.available && (
                  <p className="text-status-success text-sm mt-1">✅ You're running the latest version</p>
                )}
                {updateInfo.checked && updateInfo.available && (
                  <div className="mt-1">
                    <p className="text-status-warning text-sm">⬆️ Version {updateInfo.version} available</p>
                    {updateInfo.url && (
                      <a href={updateInfo.url} target="_blank" rel="noopener noreferrer"
                         className="text-accent-cyan underline text-sm">Download update</a>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium hover:border-accent-cyan transition-colors disabled:opacity-50"
              >
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>
          </div>

          {/* File Storage Location */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Case File Storage Location
            </h2>
            <p className="text-text-muted text-sm mb-4">
              All case files, evidence, warrants, and reports are stored in this directory
            </p>
            
            <div className="bg-background rounded-lg p-4 border border-accent-cyan/20 mb-4">
              <p className="text-text-primary font-mono text-sm break-all">{casesPath || 'Loading...'}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenCasesFolder}
                className="px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                         hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Folder
              </button>
              <button
                onClick={handleCopyPath}
                className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium
                         hover:border-accent-cyan transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Path
              </button>
              <button
                onClick={handleChangeStorageLocation}
                className="px-4 py-2 bg-accent-pink text-white rounded-lg font-medium
                         hover:bg-accent-pink/90 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Change Location
              </button>
            </div>
            
            <div className="mt-4 bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-accent-pink flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-text-muted">
                  <p className="font-medium text-text-primary mb-1">Moving Storage Location</p>
                  <p>You can move all case files to a different drive if you're running low on space. The application will copy all existing cases to the new location.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Progress Dialog */}
          {showMigrationDialog && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full mx-4">
                <h3 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-3">
                  <svg className={`w-8 h-8 text-accent-cyan ${isMigrating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isMigrating ? 'Migrating Case Files...' : 'Migration Complete'}
                </h3>
                
                {migrationProgress && (
                  <div className="space-y-4">
                    <div className="bg-background rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-muted">Progress</span>
                        <span className="text-accent-cyan font-bold">{migrationProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-background-elevated rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-accent-cyan to-accent-pink transition-all duration-300"
                          style={{ width: `${migrationProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-background rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Folders Completed:</span>
                        <span className="text-text-primary font-medium">
                          {migrationProgress.foldersCompleted} / {migrationProgress.totalFolders}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Current Folder:</span>
                        <span className="text-text-primary font-medium truncate ml-4">
                          {migrationProgress.currentFolder || 'Preparing...'}
                        </span>
                      </div>
                      {migrationProgress.currentFile && (
                        <div className="flex justify-between">
                          <span className="text-text-muted">Current File:</span>
                          <span className="text-text-primary font-medium truncate ml-4">
                            {migrationProgress.currentFile}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {!isMigrating && (
                      <button
                        onClick={() => setShowMigrationDialog(false)}
                        className="w-full px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                                 hover:bg-accent-cyan/90 transition-colors"
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Theme Toggle */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Appearance
            </h2>
            <p className="text-text-muted text-sm mb-4">
              Choose between dark and light color themes
            </p>
            
            <div className="flex items-center justify-between bg-background rounded-lg p-4 border border-accent-cyan/20">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  theme === 'dark' ? 'bg-[#0B1120]' : 'bg-gray-100'
                }`}>
                  {theme === 'dark' ? (
                    <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-text-primary font-medium">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="text-text-muted text-xs">
                    {theme === 'dark' ? 'Neon Midnight Theme (Default)' : 'Light Color Palette'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleThemeToggle}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-accent-cyan' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                  theme === 'dark' ? 'translate-x-1' : 'translate-x-8'
                }`} />
              </button>
            </div>
          </div>

          {/* Media Player Toggle */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              Media Player
            </h2>
            <p className="text-text-muted text-sm mb-4">
              Embedded streaming player for Spotify, SiriusXM, YouTube and more. Appears as a floating drawer in the bottom-right corner.
            </p>
            <div className="flex items-center justify-between bg-background rounded-lg p-4 border border-accent-cyan/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
                  <span className="text-2xl">🎵</span>
                </div>
                <div>
                  <p className="text-text-primary font-medium">
                    {mediaEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-text-muted text-xs">
                    Toggle to show/hide the media player overlay. Boss key: Ctrl+Alt+M
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !mediaEnabled;
                  localStorage.setItem('mediaPlayerEnabled', String(next));
                  setMediaEnabled(next);
                  window.dispatchEvent(new Event('mediaPlayerToggle'));
                }}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  mediaEnabled ? 'bg-accent-cyan' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                  mediaEnabled ? 'translate-x-8' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* ═══════════════ Investigative Resources ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-2 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Investigative Resources
            </h2>
            <p className="text-text-muted text-sm mb-5">
              Enable external investigative platforms. When enabled, a magnifying glass button appears in the lower-right corner of the app — click it to open the resources drawer.
            </p>

            <div className="space-y-4">
              {/* ── Flock Safety ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">Flock Safety — LPR Search</h3>
                      <p className="text-text-muted text-sm">
                        Search Flock Safety's license plate reader (LPR) network directly from the resources drawer. Run plates from suspect vehicles to get sighting history, locations, and timestamps. Requires an active Flock Safety account — you'll log in once and your session persists.
                      </p>
                      {flockEnabled && (
                        <span className="inline-block mt-1 text-xs text-teal-400">
                          {flockHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !flockEnabled;
                      localStorage.setItem('flockEnabled', String(next));
                      setFlockEnabled(next);
                      window.dispatchEvent(new Event('resourceToggle'));
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                      flockEnabled ? 'bg-teal-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                      flockEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {flockEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-teal-400 hover:text-teal-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-teal-500/5 border border-teal-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Email</label>
                        <input
                          type="email"
                          placeholder="your.email@agency.gov"
                          value={flockEmail}
                          onChange={e => setFlockEmail(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showFlockPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={flockPassword}
                            onChange={e => setFlockPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-teal-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowFlockPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-teal-400 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            localStorage.setItem('flockEmail', flockEmail);
                            localStorage.setItem('flockPassword', flockPassword);
                            setFlockHasCredentials(true);
                            setFlockEmail('');
                            setFlockPassword('');
                          }}
                          className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500 rounded-lg text-teal-400 text-xs font-medium transition"
                        >
                          Save Credentials
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('flockEmail');
                            localStorage.removeItem('flockPassword');
                            setFlockHasCredentials(false);
                            setFlockEmail('');
                            setFlockPassword('');
                          }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Credentials are stored locally and used to auto-fill the Flock login form. They are never sent anywhere else.
                      </p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── TLO / TransUnion ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">TLO — TransUnion People Search</h3>
                      <p className="text-text-muted text-sm">
                        Search TLO's comprehensive people database directly from the resources drawer. Look up individuals by name for addresses, phone numbers, associates, assets, and more. Requires an active TLOxp account.
                      </p>
                      {tloEnabled && (
                        <span className="inline-block mt-1 text-xs text-indigo-400">
                          {tloHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !tloEnabled;
                      localStorage.setItem('tloEnabled', String(next));
                      setTloEnabled(next);
                      window.dispatchEvent(new Event('resourceToggle'));
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                      tloEnabled ? 'bg-indigo-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                      tloEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {tloEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Username</label>
                        <input
                          type="text"
                          placeholder="TLOxp username"
                          value={tloUsername}
                          onChange={e => setTloUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showTloPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={tloPassword}
                            onChange={e => setTloPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-indigo-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTloPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-indigo-400 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            localStorage.setItem('tloUsername', tloUsername);
                            localStorage.setItem('tloPassword', tloPassword);
                            setTloHasCredentials(true);
                            setTloUsername('');
                            setTloPassword('');
                          }}
                          className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500 rounded-lg text-indigo-400 text-xs font-medium transition"
                        >
                          Save Credentials
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('tloUsername');
                            localStorage.removeItem('tloPassword');
                            setTloHasCredentials(false);
                            setTloUsername('');
                            setTloPassword('');
                          }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Credentials are stored locally and used to auto-fill the TLO login form. They are never sent anywhere else.
                      </p>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* Password Change (Portable Mode Only) */}
          {isPortable && (
            <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security
              </h2>
              <p className="text-text-muted text-sm mb-4">
                Update your password for portable USB installation
              </p>
              
              {!showPasswordChange ? (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                           hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Change Password
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordError && (
                    <div className="p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg">
                      <p className="text-accent-pink text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {passwordError}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-text-primary mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                               focus:outline-none focus:border-accent-cyan text-text-primary"
                      placeholder="Enter current password"
                      disabled={passwordChanging}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                               focus:outline-none focus:border-accent-cyan text-text-primary"
                      placeholder="Enter new password (min. 6 characters)"
                      disabled={passwordChanging}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-text-primary mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmNewPassword"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                               focus:outline-none focus:border-accent-cyan text-text-primary"
                      placeholder="Confirm new password"
                      disabled={passwordChanging}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={passwordChanging}
                      className="flex-1 px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                               hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2"
                    >
                      {passwordChanging ? (
                        <>
                          <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                          <span>Changing...</span>
                        </>
                      ) : (
                        <span>Save New Password</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswordError('');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                      disabled={passwordChanging}
                      className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg
                               hover:border-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-3">
                    <p className="text-sm text-text-muted">
                      <span className="font-semibold text-accent-cyan">💡 Tip:</span> Use a strong password that you'll remember. 
                      The master recovery password is <code className="bg-background px-1 py-0.5 rounded">Ipreventcrime1!</code>
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* API Keys & Integrations */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              API Keys & Optional Features
            </h2>
            <p className="text-text-muted text-sm mb-6">
              Configure optional third-party integrations for enhanced functionality
            </p>
            
            {/* Veriphone Section */}
            <div className="bg-background rounded-lg p-4 border border-accent-cyan/20 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📱</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold mb-1">
                      Veriphone Phone Carrier Lookup
                    </h3>
                    <p className="text-text-muted text-sm mb-2">
                      Automatically identify phone carriers when adding suspect phone numbers
                    </p>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <button
                  onClick={handleToggleVeriphone}
                  className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                    veriphoneEnabled ? 'bg-accent-cyan' : 'bg-gray-600'
                  }`}
                  title={veriphoneEnabled ? 'Disable carrier lookup' : 'Enable carrier lookup'}
                >
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                    veriphoneEnabled ? 'translate-x-8' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              {veriphoneEnabled && (
                <div>
                  {!savedVeriphoneKey && (
                    <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded p-3 text-xs text-text-muted mb-3">
                      <p className="mb-2"><strong className="text-text-primary">Setup Instructions:</strong></p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Visit <a href="https://veriphone.io/cp" target="_blank" rel="noopener noreferrer" 
                             className="text-accent-cyan hover:underline">veriphone.io</a></li>
                        <li>Sign up for a free account (1,000 lookups/month)</li>
                        <li>Copy your API Key from your dashboard</li>
                        <li>Paste it below and click Save</li>
                      </ol>
                      <p className="mt-2 text-accent-pink">
                        ⚠️ Your personal API key is stored securely and only used for your lookups
                      </p>
                    </div>
                  )}
                  
                  {savedVeriphoneKey ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-panel rounded px-3 py-2 border border-accent-cyan/30">
                        <p className="text-text-primary font-mono text-sm">
                          ••••••••••••{savedVeriphoneKey.slice(-4)}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          ✓ API key configured
                        </p>
                      </div>
                      <button
                        onClick={handleClearVeriphoneKey}
                        className="px-4 py-2 bg-accent-pink/10 text-accent-pink rounded-lg border border-accent-pink/30
                                 hover:bg-accent-pink/20 transition-colors text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={veriphoneKey}
                        onChange={(e) => setVeriphoneKey(e.target.value)}
                        placeholder="Paste your Veriphone API key here"
                        className="flex-1 px-4 py-2 bg-panel border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 font-mono text-sm"
                      />
                      <button
                        onClick={handleSaveVeriphoneKey}
                        disabled={!veriphoneKey.trim()}
                        className="px-6 py-2 bg-accent-cyan text-background rounded-lg font-medium
                                 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-text-muted italic">
              Note: API integrations are optional. The app works fully offline without them.
            </p>
          </div>

          {/* Investigative Tools Information */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Investigative Tools & Features
            </h2>
            <p className="text-text-muted text-sm mb-6">
              P.U.L.S.E. includes several investigative tools to assist with case work. Understanding their capabilities and limitations is important for effective use.
            </p>
            
            <div className="space-y-6">
              {/* Email Verification */}
              <div className="bg-accent-cyan/5 rounded-lg p-4 border border-accent-cyan/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">📧</div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">Email Verification (Built-In)</h3>
                    <p className="text-sm text-text-muted mb-2">
                      Validates email addresses and checks deliverability in the Identifiers section.
                    </p>
                  </div>
                </div>
                <div className="ml-11 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Validates email syntax (RFC 5322 compliant)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Checks for common typos and suggests corrections</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Verifies domain has valid MX (mail server) records</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Tests SMTP connectivity to verify deliverability</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Detects disposable/temporary email addresses</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted"><strong className="text-success">No API key required - works offline!</strong></span>
                  </div>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-accent-cyan/10">
                    <span className="text-accent-pink mt-0.5">⚠</span>
                    <span className="text-text-muted"><strong className="text-accent-pink">Limitation:</strong> Some email servers block SMTP verification checks for security. Catch-all domains may show as valid even if specific addresses don't exist. Results are marked as "risky" or "unknown" when verification is inconclusive.</span>
                  </div>
                </div>
              </div>

              {/* Phone Lookup */}
              <div className="bg-accent-cyan/5 rounded-lg p-4 border border-accent-cyan/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">📱</div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">Phone Carrier Lookup (Veriphone)</h3>
                    <p className="text-sm text-text-muted mb-2">
                      Identifies phone carrier and line type when adding phone identifiers.
                    </p>
                  </div>
                </div>
                <div className="ml-11 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Identifies carrier (Verizon, AT&T, T-Mobile, etc.)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Determines line type (mobile, landline, VOIP)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Provides phone region and country code</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Works with U.S. and international numbers</span>
                  </div>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-accent-cyan/10">
                    <span className="text-accent-pink mt-0.5">⚠</span>
                    <span className="text-text-muted"><strong className="text-accent-pink">Limitation:</strong> Requires Veriphone API key (configure above). Free tier has rate limits (1,000 requests/month). May not identify carriers for all numbers, especially prepaid or ported numbers. Enable in settings to use this feature.</span>
                  </div>
                </div>
              </div>

              {/* IP Address Lookup */}
              <div className="bg-accent-cyan/5 rounded-lg p-4 border border-accent-cyan/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🌐</div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">IP Address Lookup (ARIN)</h3>
                    <p className="text-sm text-text-muted mb-2">
                      Looks up ISP provider for IP addresses using ARIN registry.
                    </p>
                  </div>
                </div>
                <div className="ml-11 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Identifies ISP provider (Comcast, Spectrum, etc.)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Free service - no API key required</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Works for all IP addresses registered with ARIN</span>
                  </div>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-accent-cyan/10">
                    <span className="text-accent-pink mt-0.5">⚠</span>
                    <span className="text-text-muted"><strong className="text-accent-pink">Limitation:</strong> ARIN only covers North American IP addresses. For international IPs, manual lookup may be required. Results show organization name which may not always match the ISP's consumer brand.</span>
                  </div>
                </div>
              </div>

              {/* IP Ping */}
              <div className="bg-accent-cyan/5 rounded-lg p-4 border border-accent-cyan/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">📡</div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">IP Address Ping Test</h3>
                    <p className="text-sm text-text-muted mb-2">
                      Tests if an IP address is reachable and responsive.
                    </p>
                  </div>
                </div>
                <div className="ml-11 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Sends ICMP echo requests to test connectivity</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">Shows response time if reachable</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-cyan mt-0.5">✓</span>
                    <span className="text-text-muted">No configuration required - works offline</span>
                  </div>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-accent-cyan/10">
                    <span className="text-accent-pink mt-0.5">⚠</span>
                    <span className="text-text-muted"><strong className="text-accent-pink">Important:</strong> Many hosts block ICMP ping requests for security. A failed ping does NOT mean the IP is inactive or invalid. It may simply mean the host has ICMP disabled. Use this tool as one indicator, not conclusive evidence.</span>
                  </div>
                </div>
              </div>

              {/* General Note */}
              <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-accent-cyan flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-text-muted">
                    <p className="font-semibold text-text-primary mb-2">Investigative Best Practices</p>
                    <p className="mb-2">
                      These tools are provided as aids for investigative work. Always verify critical information through official channels and legal processes. API-based services may have availability issues or rate limits.
                    </p>
                    <p>
                      <strong className="text-accent-cyan">Email Verification, ARIN Lookup, and Ping work offline without API keys.</strong> Phone Carrier Lookup requires internet connectivity and a Veriphone API key (configure above to enable).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Field Security */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Field Security
            </h2>
            <p className="text-text-muted text-sm mb-4">
              AES-256-GCM encryption for data at rest. Ideal for portable/field deployments.
            </p>

            {secError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{secError}</div>
            )}

            {/* Recovery Key Display */}
            {secRecoveryKey && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-amber-400 font-semibold mb-2">⚠️ Recovery Key — Save This Now</p>
                <p className="text-text-muted text-xs mb-3">This is the ONLY way to recover your data if you forget your password. Store it securely offline.</p>
                <div className="bg-background font-mono text-lg text-text-primary text-center p-3 rounded border border-amber-500/40 tracking-wider select-all mb-3">
                  {secRecoveryKey}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(secRecoveryKey)}
                    className="px-3 py-1.5 text-sm rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  >
                    Copy to Clipboard
                  </button>
                  <label className="flex items-center gap-2 text-sm text-text-muted">
                    <input type="checkbox" checked={secRecoveryAck} onChange={(e) => setSecRecoveryAck(e.target.checked)} className="accent-amber-500" />
                    I have saved this recovery key
                  </label>
                </div>
                {secRecoveryAck && (
                  <button
                    onClick={() => { setSecRecoveryKey(''); setSecRecoveryAck(false); }}
                    className="mt-3 px-4 py-2 text-sm font-medium rounded bg-accent-cyan text-background hover:bg-accent-cyan/90"
                  >
                    Done
                  </button>
                )}
              </div>
            )}

            {!secEnabled && !secSetupMode && (
              <div className="flex items-center justify-between bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                  <span className="text-text-primary">Security is <strong>disabled</strong></span>
                </div>
                <button
                  onClick={() => setSecSetupMode(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                >
                  Enable Field Security
                </button>
              </div>
            )}

            {!secEnabled && secSetupMode && (
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20 space-y-3">
                <div>
                  <label className="text-sm text-text-muted">Create Password</label>
                  <input type="password" value={secPw} onChange={(e) => setSecPw(e.target.value)} placeholder="Min 8 characters"
                    className="w-full mt-1 px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary focus:border-accent-cyan/50 focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-text-muted">Confirm Password</label>
                  <input type="password" value={secPwConfirm} onChange={(e) => setSecPwConfirm(e.target.value)} placeholder="Re-enter password"
                    className="w-full mt-1 px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary focus:border-accent-cyan/50 focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSecError('');
                      if (secPw.length < 8) { setSecError('Password must be at least 8 characters'); return; }
                      if (secPw !== secPwConfirm) { setSecError('Passwords do not match'); return; }
                      const res = await window.electronAPI.securitySetup(secPw);
                      if (res.success) {
                        setSecEnabled(true);
                        setSecSetupMode(false);
                        setSecRecoveryKey(res.recoveryKey || '');
                        setSecPw(''); setSecPwConfirm('');
                      } else {
                        setSecError(res.error || 'Setup failed');
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded bg-accent-cyan text-background hover:bg-accent-cyan/90"
                  >
                    Enable
                  </button>
                  <button
                    onClick={() => { setSecSetupMode(false); setSecPw(''); setSecPwConfirm(''); setSecError(''); }}
                    className="px-4 py-2 text-sm font-medium rounded text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {secEnabled && !secRecoveryKey && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-background rounded-lg p-4 border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="text-text-primary">Field Security is <strong className="text-amber-400">active</strong></span>
                  </div>
                </div>

                {/* Change Password */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                  <button onClick={() => setSecChangePwMode(!secChangePwMode)} className="text-sm text-accent-cyan hover:underline">
                    {secChangePwMode ? '▾ Change Password' : '▸ Change Password'}
                  </button>
                  {secChangePwMode && (
                    <div className="mt-3 space-y-2">
                      <input type="password" value={secNewPw} onChange={(e) => setSecNewPw(e.target.value)} placeholder="New password (min 8 chars)"
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary focus:border-accent-cyan/50 focus:outline-none text-sm" />
                      <input type="password" value={secNewPwConfirm} onChange={(e) => setSecNewPwConfirm(e.target.value)} placeholder="Confirm new password"
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary focus:border-accent-cyan/50 focus:outline-none text-sm" />
                      <button
                        onClick={async () => {
                          setSecError('');
                          if (secNewPw.length < 8) { setSecError('Password must be at least 8 characters'); return; }
                          if (secNewPw !== secNewPwConfirm) { setSecError('Passwords do not match'); return; }
                          const res = await window.electronAPI.securityChangePw(secNewPw);
                          if (res.success) {
                            setSecChangePwMode(false); setSecNewPw(''); setSecNewPwConfirm('');
                            setSecError('');
                          } else {
                            setSecError(res.error || 'Failed to change password');
                          }
                        }}
                        className="px-3 py-1.5 text-sm rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30"
                      >
                        Update Password
                      </button>
                    </div>
                  )}
                </div>

                {/* Generate New Recovery Key */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                  <button
                    onClick={async () => {
                      if (confirm('This will invalidate your current recovery key. Continue?')) {
                        const res = await window.electronAPI.securityNewRecovery();
                        if (res.success) {
                          setSecRecoveryKey(res.recoveryKey || '');
                        } else {
                          setSecError(res.error || 'Failed to generate new key');
                        }
                      }
                    }}
                    className="text-sm text-amber-400 hover:underline"
                  >
                    ▸ Generate New Recovery Key
                  </button>
                </div>

                {/* Disable */}
                <div className="bg-background rounded-lg p-4 border border-red-500/20">
                  <button
                    onClick={async () => {
                      if (confirm('Disable field security? Data will be stored unencrypted.')) {
                        const res = await window.electronAPI.securityDisable();
                        if (res.success) {
                          setSecEnabled(false);
                        } else {
                          setSecError(res.error || 'Failed to disable');
                        }
                      }
                    }}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Disable Field Security
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* License Agreement */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Legal Information
            </h2>
            <p className="text-text-muted text-sm mb-4">
              View the End User License Agreement (EULA)
            </p>
            
            <button
              onClick={() => setShowLicense(!showLicense)}
              className="px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showLicense ? 'Hide' : 'View'} License Agreement
            </button>

            {showLicense && (
              <div className="mt-4 bg-background rounded-lg p-6 border border-accent-cyan/20 max-h-96 overflow-y-auto">
                <pre className="text-text-muted text-sm whitespace-pre-wrap font-mono">{licenseText}</pre>
              </div>
            )}
          </div>

          {/* Application Info */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </h2>
            
            <div className="flex justify-center my-6">
              <Logo size="medium" showFullText={true} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Application Name:</span>
                <span className="text-text-primary font-medium">ICAC P.U.L.S.E.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Full Name:</span>
                <span className="text-text-primary font-medium">Prosecution & Unit Lead Support Engine</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Version:</span>
                <span className="text-text-primary font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Purpose:</span>
                <span className="text-text-primary font-medium">ICAC Case Management</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Data Storage:</span>
                  <span className="text-text-primary font-medium">100% Offline & Local</span>
                </div>
                <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-3 text-xs text-text-muted">
                  <p className="mb-1">
                    <strong className="text-accent-cyan">All case data stays on your machine.</strong> No case information, evidence, or suspect details are ever transmitted.
                  </p>
                  <p>
                    Optional investigative tools (Email Verification, Phone Lookup) transmit only the specific identifier you choose to verify (e.g., email address, phone number) when you click the lookup button. These are user-initiated requests, not automatic uploads.
                  </p>
                </div>
              </div>
              <div className="flex justify-between pt-4 mt-4 border-t border-accent-cyan/20">
                <span className="text-text-muted">Developer:</span>
                <span className="text-text-primary font-medium">Intellect LE, LLC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Copyright:</span>
                <span className="text-text-primary font-medium">© 2025 Intellect LE, LLC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Contact:</span>
                <span className="text-text-primary font-medium">Justin@intellect-le.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
