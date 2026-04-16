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
  // In-app updater states
  const [updatePhase, setUpdatePhase] = useState<'idle' | 'downloading' | 'ready' | 'installing'>('idle');
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, transferred: 0, total: 0 });
  const [updateError, setUpdateError] = useState('');
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

  // ICAC Cops state
  const [icaccopsEnabled, setIcaccopsEnabled] = useState(() => localStorage.getItem('icaccopsEnabled') === 'true');
  const [icaccopsUsername, setIcaccopsUsername] = useState('');
  const [icaccopsPassword, setIcaccopsPassword] = useState('');
  const [icaccopsHasCredentials, setIcaccopsHasCredentials] = useState(false);
  const [showIcaccopsPassword, setShowIcaccopsPassword] = useState(false);

  // GridCop state
  const [gridcopEnabled, setGridcopEnabled] = useState(() => localStorage.getItem('gridcopEnabled') === 'true');
  const [gridcopUsername, setGridcopUsername] = useState('');
  const [gridcopPassword, setGridcopPassword] = useState('');
  const [gridcopHasCredentials, setGridcopHasCredentials] = useState(false);
  const [showGridcopPassword, setShowGridcopPassword] = useState(false);

  // Vigilant LPR state
  const [vigilantEnabled, setVigilantEnabled] = useState(() => localStorage.getItem('vigilantEnabled') === 'true');
  const [vigilantUsername, setVigilantUsername] = useState('');
  const [vigilantPassword, setVigilantPassword] = useState('');
  const [vigilantHasCredentials, setVigilantHasCredentials] = useState(false);
  const [showVigilantPassword, setShowVigilantPassword] = useState(false);

  // Thomson Reuters CLEAR state
  const [trclearEnabled, setTrclearEnabled] = useState(() => localStorage.getItem('trclearEnabled') === 'true');
  const [trclearUsername, setTrclearUsername] = useState('');
  const [trclearPassword, setTrclearPassword] = useState('');
  const [trclearHasCredentials, setTrclearHasCredentials] = useState(false);
  const [showTrclearPassword, setShowTrclearPassword] = useState(false);

  // Accurint (LexisNexis) state
  const [accurintEnabled, setAccurintEnabled] = useState(() => localStorage.getItem('accurintEnabled') === 'true');
  const [accurintUsername, setAccurintUsername] = useState('');
  const [accurintPassword, setAccurintPassword] = useState('');
  const [accurintHasCredentials, setAccurintHasCredentials] = useState(false);
  const [showAccurintPassword, setShowAccurintPassword] = useState(false);

  // BYOA state
  interface ByoaApp { id: string; label: string; url: string; }
  const [byoaApps, setByoaApps] = useState<ByoaApp[]>(() => {
    try { return JSON.parse(localStorage.getItem('byoaApps') || '[]'); } catch { return []; }
  });

  // Section collapse state
  const [resourcesExpanded, setResourcesExpanded] = useState(true);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [byoaShowAdd, setByoaShowAdd] = useState(false);
  const [byoaNewLabel, setByoaNewLabel] = useState('');
  const [byoaNewUrl, setByoaNewUrl] = useState('');
  const [byoaNewUsername, setByoaNewUsername] = useState('');
  const [byoaNewPassword, setByoaNewPassword] = useState('');
  const [byoaShowNewPassword, setByoaShowNewPassword] = useState(false);

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

  // ── OPS Plan Templates state ──
  const [opsTemplateOpen, setOpsTemplateOpen] = useState(true);

  // ── Registered User profile state ──
  const [profileFullName, setProfileFullName] = useState(() => localStorage.getItem('userProfile_fullName') || '');
  const [profileBadge, setProfileBadge] = useState(() => localStorage.getItem('userProfile_badgeNumber') || '');
  const [profileAgency, setProfileAgency] = useState(() => localStorage.getItem('userProfile_agency') || '');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('userProfile_email') || '');
  const [profileBadgeLogo, setProfileBadgeLogo] = useState(() => localStorage.getItem('userProfile_badgeLogo') || '');
  const [profileRegistered, setProfileRegistered] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  interface OpsTeamMember { name: string; assignment: string; vehicle: string; callSign: string; }
  const [opsTeam, setOpsTeam] = useState<OpsTeamMember[]>(() => {
    try { return JSON.parse(localStorage.getItem('opsTemplate_entryTeam') || '[]'); } catch { return []; }
  });
  const [opsHospitalName, setOpsHospitalName] = useState(() => localStorage.getItem('opsTemplate_hospitalName') || '');
  const [opsHospitalAddr, setOpsHospitalAddr] = useState(() => localStorage.getItem('opsTemplate_hospitalAddr') || '');
  const [opsHospitalPhone, setOpsHospitalPhone] = useState(() => localStorage.getItem('opsTemplate_hospitalPhone') || '');
  const [opsBriefingName, setOpsBriefingName] = useState(() => localStorage.getItem('opsTemplate_briefingName') || '');
  const [opsBriefingAddr, setOpsBriefingAddr] = useState(() => localStorage.getItem('opsTemplate_briefingAddr') || '');
  const [opsCommsChannel, setOpsCommsChannel] = useState(() => localStorage.getItem('opsTemplate_commsChannel') || '');
  const [opsNotifications, setOpsNotifications] = useState(() => localStorage.getItem('opsTemplate_notifications') || '');
  const [opsTacticalPlan, setOpsTacticalPlan] = useState(() => localStorage.getItem('opsTemplate_tacticalPlan') || '');
  const [opsPursuitPlan, setOpsPursuitPlan] = useState(() => localStorage.getItem('opsTemplate_pursuitPlan') || '');
  const [opsMedicalPlan, setOpsMedicalPlan] = useState(() => localStorage.getItem('opsTemplate_medicalPlan') || '');
  const [opsBarricadePlan, setOpsBarricadePlan] = useState(() => localStorage.getItem('opsTemplate_barricadePlan') || '');
  const [opsContingencyPlan, setOpsContingencyPlan] = useState(() => localStorage.getItem('opsTemplate_contingencyPlan') || '');
  const [opsTemplateSaved, setOpsTemplateSaved] = useState(false);

  // Restore OPS template from file backup if localStorage was wiped (e.g. corrupted during update)
  useEffect(() => {
    const hasLocalData = localStorage.getItem('opsTemplate_hospitalName') || localStorage.getItem('opsTemplate_entryTeam');
    if (hasLocalData) return; // localStorage is fine, nothing to restore
    (window as any).electronAPI.loadOpsTemplateBackup().then((result: any) => {
      if (!result?.success || !result.data) return;
      const d = result.data;
      if (d.entryTeam) { setOpsTeam(d.entryTeam); localStorage.setItem('opsTemplate_entryTeam', JSON.stringify(d.entryTeam)); }
      if (d.hospitalName) { setOpsHospitalName(d.hospitalName); localStorage.setItem('opsTemplate_hospitalName', d.hospitalName); }
      if (d.hospitalAddr) { setOpsHospitalAddr(d.hospitalAddr); localStorage.setItem('opsTemplate_hospitalAddr', d.hospitalAddr); }
      if (d.hospitalPhone) { setOpsHospitalPhone(d.hospitalPhone); localStorage.setItem('opsTemplate_hospitalPhone', d.hospitalPhone); }
      if (d.briefingName) { setOpsBriefingName(d.briefingName); localStorage.setItem('opsTemplate_briefingName', d.briefingName); }
      if (d.briefingAddr) { setOpsBriefingAddr(d.briefingAddr); localStorage.setItem('opsTemplate_briefingAddr', d.briefingAddr); }
      if (d.commsChannel) { setOpsCommsChannel(d.commsChannel); localStorage.setItem('opsTemplate_commsChannel', d.commsChannel); }
      if (d.notifications) { setOpsNotifications(d.notifications); localStorage.setItem('opsTemplate_notifications', d.notifications); }
      if (d.tacticalPlan) { setOpsTacticalPlan(d.tacticalPlan); localStorage.setItem('opsTemplate_tacticalPlan', d.tacticalPlan); }
      if (d.pursuitPlan) { setOpsPursuitPlan(d.pursuitPlan); localStorage.setItem('opsTemplate_pursuitPlan', d.pursuitPlan); }
      if (d.medicalPlan) { setOpsMedicalPlan(d.medicalPlan); localStorage.setItem('opsTemplate_medicalPlan', d.medicalPlan); }
      if (d.barricadePlan) { setOpsBarricadePlan(d.barricadePlan); localStorage.setItem('opsTemplate_barricadePlan', d.barricadePlan); }
      if (d.contingencyPlan) { setOpsContingencyPlan(d.contingencyPlan); localStorage.setItem('opsTemplate_contingencyPlan', d.contingencyPlan); }
    }).catch(() => {});
  }, []);

  const saveOpsTemplate = () => {
    localStorage.setItem('opsTemplate_entryTeam', JSON.stringify(opsTeam));
    localStorage.setItem('opsTemplate_hospitalName', opsHospitalName);
    localStorage.setItem('opsTemplate_hospitalAddr', opsHospitalAddr);
    localStorage.setItem('opsTemplate_hospitalPhone', opsHospitalPhone);
    localStorage.setItem('opsTemplate_briefingName', opsBriefingName);
    localStorage.setItem('opsTemplate_briefingAddr', opsBriefingAddr);
    localStorage.setItem('opsTemplate_commsChannel', opsCommsChannel);
    localStorage.setItem('opsTemplate_notifications', opsNotifications);
    localStorage.setItem('opsTemplate_tacticalPlan', opsTacticalPlan);
    localStorage.setItem('opsTemplate_pursuitPlan', opsPursuitPlan);
    localStorage.setItem('opsTemplate_medicalPlan', opsMedicalPlan);
    localStorage.setItem('opsTemplate_barricadePlan', opsBarricadePlan);
    localStorage.setItem('opsTemplate_contingencyPlan', opsContingencyPlan);
    // Also persist to file backup in data directory (survives localStorage corruption)
    (window as any).electronAPI.saveOpsTemplateBackup({
      entryTeam: opsTeam, hospitalName: opsHospitalName, hospitalAddr: opsHospitalAddr,
      hospitalPhone: opsHospitalPhone, briefingName: opsBriefingName, briefingAddr: opsBriefingAddr,
      commsChannel: opsCommsChannel, notifications: opsNotifications, tacticalPlan: opsTacticalPlan,
      pursuitPlan: opsPursuitPlan, medicalPlan: opsMedicalPlan, barricadePlan: opsBarricadePlan,
      contingencyPlan: opsContingencyPlan,
    }).catch(() => {});
    setOpsTemplateSaved(true);
    setTimeout(() => setOpsTemplateSaved(false), 2000);
  };

  const addOpsTeamMember = () => setOpsTeam(prev => [...prev, { name: '', assignment: '', vehicle: '', callSign: '' }]);

  const saveUserProfile = () => {
    localStorage.setItem('userProfile_fullName', profileFullName);
    localStorage.setItem('userProfile_badgeNumber', profileBadge);
    localStorage.setItem('userProfile_agency', profileAgency);
    localStorage.setItem('userProfile_email', profileEmail);
    localStorage.setItem('userProfile_badgeLogo', profileBadgeLogo);
    if (!localStorage.getItem('userProfile_registeredDate')) {
      localStorage.setItem('userProfile_registeredDate', new Date().toISOString());
    }
    // Dispatch event so Layout sidebar updates without page reload
    window.dispatchEvent(new Event('userProfileUpdated'));
    setProfileEditing(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const uploadBadgeLogo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setProfileBadgeLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };
  const removeOpsTeamMember = (idx: number) => setOpsTeam(prev => prev.filter((_, i) => i !== idx));
  const updateOpsTeamMember = (idx: number, field: keyof OpsTeamMember, value: string) =>
    setOpsTeam(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

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
      
      // Load credential status for investigative resources
      setFlockHasCredentials(!!(localStorage.getItem('flockEmail')));
      setTloHasCredentials(!!(localStorage.getItem('tloUsername')));
      setIcaccopsHasCredentials(!!(localStorage.getItem('icaccopsUsername')));
      setGridcopHasCredentials(!!(localStorage.getItem('gridcopUsername')));
      setVigilantHasCredentials(!!(localStorage.getItem('vigilantUsername')));
      setTrclearHasCredentials(!!(localStorage.getItem('trclearUsername')));
      setAccurintHasCredentials(!!(localStorage.getItem('accurintUsername')));

      // Check if in portable mode
      const portable = await window.electronAPI.isPortableMode();
      setIsPortable(portable);

      // Check field security state
      const secState = await window.electronAPI.securityCheck();
      setSecEnabled(secState.enabled);

      // Load registered date from user record
      try {
        const currentUser = await window.electronAPI.getCurrentUser();
        if (currentUser?.created_at) {
          setProfileRegistered(new Date(currentUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
        } else {
          // Fallback: use stored date or today
          const stored = localStorage.getItem('userProfile_registeredDate');
          setProfileRegistered(stored || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
        }
      } catch { /* non-critical */ }
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
    setUpdateError('');
    const info = await checkUpdate();
    setUpdateInfo({ checked: true, available: info.available, version: info.latestVersion, url: info.downloadUrl, changelog: info.changelog });
    setCheckingUpdate(false);
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo.url) return;
    setUpdateError('');
    setUpdatePhase('downloading');
    setDownloadProgress({ percent: 0, transferred: 0, total: 0 });

    // Listen for progress events
    window.electronAPI.onUpdateDownloadProgress((data) => {
      setDownloadProgress(data);
    });

    try {
      const result = await window.electronAPI.downloadAppUpdate(updateInfo.url);
      window.electronAPI.removeUpdateDownloadProgressListener();

      if (result.success && result.installerPath) {
        setUpdatePhase('installing');

        // Auto-proceed to install — launches silent NSIS + batch restart script, then quits app
        await window.electronAPI.installAppUpdate(result.installerPath);
        // If we get here, app is about to quit — show status
      } else {
        setUpdatePhase('idle');
        setUpdateError('Download failed. Please try again.');
      }
    } catch (err: any) {
      window.electronAPI.removeUpdateDownloadProgressListener();
      setUpdatePhase('idle');
      setUpdateError(err?.message || 'Download failed. Please try again.');
    }
  };

  // Auto-check for updates on mount
  useEffect(() => { handleCheckUpdate(); }, []);

  // Cleanup progress listener on unmount
  useEffect(() => {
    return () => { window.electronAPI?.removeUpdateDownloadProgressListener?.(); };
  }, []);

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

            {/* Current version + check */}
            <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-text-primary font-semibold">Current Version: v{appVersion}</p>
                  {updateInfo.checked && !updateInfo.available && updatePhase === 'idle' && (
                    <p className="text-status-success text-sm mt-1">✅ You're running the latest version</p>
                  )}
                  {updateInfo.checked && updateInfo.available && updatePhase === 'idle' && (
                    <p className="text-status-warning text-sm mt-1">⬆️ Version {updateInfo.version} is available</p>
                  )}
                </div>
                {updatePhase === 'idle' && (
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium hover:border-accent-cyan transition-colors disabled:opacity-50 shrink-0"
                  >
                    {checkingUpdate ? 'Checking...' : 'Check for Updates'}
                  </button>
                )}
              </div>

              {/* Changelog */}
              {updateInfo.available && updateInfo.changelog && updatePhase === 'idle' && (
                <div className="mt-3 p-3 bg-panel/50 rounded border border-accent-cyan/10 text-text-muted text-sm">
                  <span className="text-text-secondary font-medium">What's new:</span> {updateInfo.changelog}
                </div>
              )}

              {/* Download & Install button */}
              {updateInfo.available && updateInfo.url && updatePhase === 'idle' && (
                <button
                  onClick={handleDownloadAndInstall}
                  className="mt-4 w-full py-3 bg-gradient-to-r from-accent-cyan/80 to-accent-cyan rounded-lg text-background font-bold text-lg hover:from-accent-cyan hover:to-accent-cyan/90 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download &amp; Install v{updateInfo.version}
                </button>
              )}

              {/* Download progress */}
              {updatePhase === 'downloading' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-accent-cyan font-medium">Downloading update...</span>
                    <span className="text-text-muted">
                      {downloadProgress.percent >= 0
                        ? `${downloadProgress.percent}%`
                        : `${(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB`}
                      {downloadProgress.total > 0 && ` of ${(downloadProgress.total / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  </div>
                  <div className="w-full bg-panel rounded-full h-3 overflow-hidden border border-accent-cyan/20">
                    <div
                      className="h-full bg-gradient-to-r from-accent-cyan to-accent-cyan/70 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(downloadProgress.percent, 0)}%` }}
                    />
                  </div>
                  <p className="text-text-muted text-xs mt-2">⚠️ Do not close the application during update</p>
                </div>
              )}

              {/* Installing phase */}
              {updatePhase === 'installing' && (
                <div className="mt-4">
                  <div className="flex items-center gap-3 text-accent-cyan font-medium mb-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Installing update — app will restart automatically...
                  </div>
                  <div className="w-full bg-panel rounded-full h-3 overflow-hidden border border-accent-cyan/20">
                    <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-cyan/70 rounded-full animate-pulse" style={{ width: '100%' }} />
                  </div>
                  <p className="text-text-muted text-xs mt-2">Your case data and settings are safe. The application will restart momentarily.</p>
                </div>
              )}

              {/* Error message */}
              {updateError && (
                <div className="mt-3 p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm">
                  {updateError}
                </div>
              )}
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

          {/* ═══════════════ Registered User ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Registered User
              </h2>
              {!profileEditing && (
                <button onClick={() => setProfileEditing(true)}
                  className="px-4 py-1.5 bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 rounded-lg text-accent-cyan text-sm font-medium transition flex items-center gap-1.5">
                  ✏️ Edit
                </button>
              )}
            </div>

            {profileEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Officer Name</label>
                    <input value={profileFullName} onChange={e => setProfileFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="Full Name" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Badge Number</label>
                    <input value={profileBadge} onChange={e => setProfileBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. 771" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Agency</label>
                    <input value={profileAgency} onChange={e => setProfileAgency(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. Fontana PD" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Email</label>
                    <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} type="email"
                      className="w-full px-3 py-2 bg-background border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. officer@agency.gov" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wide block mb-2">Badge / Logo</label>
                  <div className="flex items-center gap-3">
                    {profileBadgeLogo ? (
                      <img src={profileBadgeLogo} alt="Badge" className="w-16 h-16 rounded-lg object-cover border border-accent-cyan/20" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-background border border-dashed border-accent-cyan/30 flex items-center justify-center text-text-muted/50 text-xs">No image</div>
                    )}
                    <button onClick={uploadBadgeLogo}
                      className="px-3 py-1.5 bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 rounded text-accent-cyan text-xs transition">Upload Image</button>
                    {profileBadgeLogo && (
                      <button onClick={() => setProfileBadgeLogo('')}
                        className="px-3 py-1.5 bg-accent-pink/10 hover:bg-accent-pink/20 border border-accent-pink/30 rounded text-accent-pink text-xs transition">Remove</button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={saveUserProfile}
                    className="px-5 py-2 bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 rounded-lg text-accent-cyan text-sm font-semibold transition">
                    💾 Save Profile
                  </button>
                  <button onClick={() => setProfileEditing(false)}
                    className="px-4 py-2 text-text-muted hover:text-text-primary text-sm transition">Cancel</button>
                  {profileSaved && <span className="text-status-success text-sm animate-pulse">✓ Profile saved</span>}
                </div>
              </div>
            ) : (
              <div className="bg-background rounded-lg p-5 border border-accent-cyan/10">
                <div className="flex items-center gap-5">
                  {/* Initials avatar */}
                  <div className="w-14 h-14 rounded-full bg-accent-cyan flex items-center justify-center text-background font-bold text-xl shrink-0">
                    {profileFullName ? profileFullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                  </div>
                  {/* Badge/Logo */}
                  {profileBadgeLogo && (
                    <img src={profileBadgeLogo} alt="Badge/Logo" className="w-14 h-14 rounded-lg object-cover border border-accent-cyan/20 shrink-0" />
                  )}
                  {/* Info grid */}
                  <div className="flex-1 grid grid-cols-2 gap-x-12 gap-y-2">
                    <div>
                      <p className="text-xs text-text-muted">Officer Name</p>
                      <p className="text-text-primary font-semibold">{profileFullName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Badge Number</p>
                      <p className="text-text-primary font-semibold">{profileBadge || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Agency</p>
                      <p className="text-text-primary font-semibold">{profileAgency || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Email</p>
                      <p className="text-text-primary font-semibold">{profileEmail || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Registered</p>
                      <p className="text-text-primary font-semibold">{profileRegistered || '—'}</p>
                    </div>
                  </div>
                </div>
                {!profileFullName && (
                  <p className="text-text-muted/60 text-sm mt-3 italic">Click "Edit" to set up your officer profile. This info populates OPS Plans, reports, and the sidebar.</p>
                )}
              </div>
            )}
          </div>

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

          {/* ═══════════════ OPS Plan Templates ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <button
              onClick={() => setOpsTemplateOpen(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                OPS Plan Templates
              </h2>
              <svg className={`w-5 h-5 text-text-muted transition-transform ${opsTemplateOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <p className="text-text-muted text-sm mt-1 mb-4">
              Reusable data imported into Operations Plans across cases. Fill once, use everywhere.
            </p>

            {opsTemplateOpen && (
              <div className="space-y-5">
                {/* Entry Team Roster */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <span>👥</span> Entry Team Roster
                    </h3>
                    <button onClick={addOpsTeamMember}
                      className="px-3 py-1 text-xs bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 rounded-lg text-accent-cyan font-medium transition">
                      + Add Member
                    </button>
                  </div>
                  {opsTeam.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2 text-xs text-text-muted uppercase tracking-wide px-1">
                        <span>Name</span><span>Assignment</span><span>Vehicle</span><span>Call Sign</span><span></span>
                      </div>
                      {opsTeam.map((m, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2">
                          <input value={m.name} onChange={e => updateOpsTeamMember(i, 'name', e.target.value)}
                            className="px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="Name" />
                          <input value={m.assignment} onChange={e => updateOpsTeamMember(i, 'assignment', e.target.value)}
                            className="px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="Assignment" />
                          <input value={m.vehicle} onChange={e => updateOpsTeamMember(i, 'vehicle', e.target.value)}
                            className="px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="Vehicle" />
                          <input value={m.callSign} onChange={e => updateOpsTeamMember(i, 'callSign', e.target.value)}
                            className="px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="Call Sign" />
                          <button onClick={() => removeOpsTeamMember(i)}
                            className="text-accent-pink hover:text-red-400 transition text-lg flex items-center justify-center">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {opsTeam.length === 0 && (
                    <p className="text-text-muted/50 text-sm italic">No team members added. Click "+ Add Member" to start building your roster.</p>
                  )}
                </div>

                {/* Hospital Information */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <span>🏥</span> Hospital Information
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Hospital Name</label>
                      <input value={opsHospitalName} onChange={e => setOpsHospitalName(e.target.value)}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. ARMC" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Address</label>
                      <input value={opsHospitalAddr} onChange={e => setOpsHospitalAddr(e.target.value)}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="400 N Pepper Ave, Colton, CA 92324" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Phone</label>
                      <input value={opsHospitalPhone} onChange={e => setOpsHospitalPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. (909) 427-5000" />
                    </div>
                  </div>
                </div>

                {/* Briefing Location */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <span>📍</span> Briefing Location
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Location Name</label>
                      <input value={opsBriefingName} onChange={e => setOpsBriefingName(e.target.value)}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. Fontana Police Department" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Address</label>
                      <input value={opsBriefingAddr} onChange={e => setOpsBriefingAddr(e.target.value)}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="17005 Upland Ave. Fontana, Ca. 92336" />
                    </div>
                  </div>
                </div>

                {/* Communications / Radio */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <span>📻</span> Communications / Radio
                  </h3>
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Primary Channel / Frequency</label>
                    <input value={opsCommsChannel} onChange={e => setOpsCommsChannel(e.target.value)}
                      className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none" placeholder="e.g. 2FPD1" />
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <span>📞</span> Notifications
                  </h3>
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Who to notify prior to operation (one per line)</label>
                    <textarea value={opsNotifications} onChange={e => setOpsNotifications(e.target.value)} rows={3}
                      className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-none" placeholder="Watch Commander&#10;Dispatch" />
                  </div>
                </div>

                {/* Boilerplate Plans */}
                <div className="bg-background rounded-lg p-4 border border-accent-cyan/10">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
                    <span>📋</span> Boilerplate Plans
                  </h3>
                  <p className="text-text-muted/60 text-xs mb-4">Default text auto-filled into OPS Plans. Edit per-case as needed.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Tactical Plan</label>
                      <textarea value={opsTacticalPlan} onChange={e => setOpsTacticalPlan(e.target.value)} rows={4}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-y" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Pursuit Plan / Runners</label>
                      <textarea value={opsPursuitPlan} onChange={e => setOpsPursuitPlan(e.target.value)} rows={4}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-y" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Medical Plan / Officer Down</label>
                      <textarea value={opsMedicalPlan} onChange={e => setOpsMedicalPlan(e.target.value)} rows={4}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-y" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Barricade Plan</label>
                      <textarea value={opsBarricadePlan} onChange={e => setOpsBarricadePlan(e.target.value)} rows={4}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-y" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted uppercase tracking-wide block mb-1">Contingency Plan</label>
                      <textarea value={opsContingencyPlan} onChange={e => setOpsContingencyPlan(e.target.value)} rows={3}
                        className="w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded text-text-primary text-sm focus:border-accent-cyan focus:outline-none resize-y" />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <button onClick={saveOpsTemplate}
                    className="px-5 py-2.5 bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 rounded-lg text-accent-cyan text-sm font-semibold transition flex items-center gap-2">
                    💾 Save Templates
                  </button>
                  {opsTemplateSaved && (
                    <span className="text-status-success text-sm animate-pulse">✓ Templates saved</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════ Investigative Resources ═══════════════ */}
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
            <button
              onClick={() => setResourcesExpanded(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Investigative Resources
              </h2>
              <svg className={`w-5 h-5 text-text-muted transition-transform ${resourcesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <p className="text-text-muted text-sm mt-1 mb-4">
              Enable external investigative platforms. When enabled, a magnifying glass button appears in the lower-right corner of the app — click it to open the resources drawer.
            </p>

            {resourcesExpanded && (
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

              {/* ── ICAC Cops ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">ICAC Cops — Case & Intelligence Portal</h3>
                      <p className="text-text-muted text-sm">
                        Access the ICAC Task Force Operations portal directly in the resources drawer. Manage ICAC case data, intelligence sharing, and coordination across task forces. Requires an active ICACCops account.
                      </p>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://www.icaccops.com'); }}
                        className="inline-block mt-1 text-xs text-amber-400 hover:text-amber-300 underline"
                      >
                        Register at icaccops.com →
                      </a>
                      {icaccopsEnabled && (
                        <span className="inline-block mt-1 ml-3 text-xs text-amber-400">
                          {icaccopsHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !icaccopsEnabled;
                      localStorage.setItem('icaccopsEnabled', String(next));
                      setIcaccopsEnabled(next);
                      window.dispatchEvent(new Event('resourceToggle'));
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                      icaccopsEnabled ? 'bg-amber-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                      icaccopsEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {icaccopsEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Email / Username</label>
                        <input
                          type="text"
                          placeholder="your.email@agency.gov"
                          value={icaccopsUsername}
                          onChange={e => setIcaccopsUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showIcaccopsPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={icaccopsPassword}
                            onChange={e => setIcaccopsPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-amber-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowIcaccopsPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-amber-400 transition"
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
                            localStorage.setItem('icaccopsUsername', icaccopsUsername);
                            localStorage.setItem('icaccopsPassword', icaccopsPassword);
                            setIcaccopsHasCredentials(true);
                            setIcaccopsUsername('');
                            setIcaccopsPassword('');
                          }}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500 rounded-lg text-amber-400 text-xs font-medium transition"
                        >
                          Save Credentials
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('icaccopsUsername');
                            localStorage.removeItem('icaccopsPassword');
                            setIcaccopsHasCredentials(false);
                            setIcaccopsUsername('');
                            setIcaccopsPassword('');
                          }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Credentials are stored locally and used to auto-fill the ICACCops login form. They are never sent anywhere else.
                      </p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── GridCop ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">GridCop — P2P Investigation Platform</h3>
                      <p className="text-text-muted text-sm">
                        Access GridCop's peer-to-peer network investigation platform directly from the resources drawer. Monitor and investigate file-sharing activity across P2P networks for CSAM investigations. Requires an active GridCop account.
                      </p>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://www.gridcop.com'); }}
                        className="inline-block mt-1 text-xs text-emerald-400 hover:text-emerald-300 underline"
                      >
                        Register at gridcop.com →
                      </a>
                      {gridcopEnabled && (
                        <span className="inline-block mt-1 ml-3 text-xs text-emerald-400">
                          {gridcopHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !gridcopEnabled;
                      localStorage.setItem('gridcopEnabled', String(next));
                      setGridcopEnabled(next);
                      window.dispatchEvent(new Event('resourceToggle'));
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                      gridcopEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                      gridcopEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {gridcopEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                        <input
                          type="text"
                          placeholder="GridCop username"
                          value={gridcopUsername}
                          onChange={e => setGridcopUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showGridcopPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={gridcopPassword}
                            onChange={e => setGridcopPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-emerald-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGridcopPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-emerald-400 transition"
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
                            localStorage.setItem('gridcopUsername', gridcopUsername);
                            localStorage.setItem('gridcopPassword', gridcopPassword);
                            setGridcopHasCredentials(true);
                            setGridcopUsername('');
                            setGridcopPassword('');
                          }}
                          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 rounded-lg text-emerald-400 text-xs font-medium transition"
                        >
                          Save Credentials
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('gridcopUsername');
                            localStorage.removeItem('gridcopPassword');
                            setGridcopHasCredentials(false);
                            setGridcopUsername('');
                            setGridcopPassword('');
                          }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Credentials are stored locally and used to auto-fill the GridCop login form. They are never sent anywhere else.
                      </p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── Vigilant LPR ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0H9m10 0a2 2 0 002-2V9a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0014.586 5H13" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">Vigilant — License Plate Recognition</h3>
                      <p className="text-text-muted text-sm">
                        Access Motorola Solutions' Vigilant LEARN/PlateSearch platform directly from the resources drawer. Search license plates, run hot lists, and view real-time LPR alerts across the nationwide network. Requires an active Vigilant/VehicleManager account.
                      </p>
                      <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://vm.motorolasolutions.com'); }}
                        className="inline-block mt-1 text-xs text-rose-400 hover:text-rose-300 underline">
                        Access at motorolasolutions.com →
                      </a>
                      {vigilantEnabled && (
                        <span className="inline-block mt-1 ml-3 text-xs text-rose-400">
                          {vigilantHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { const next = !vigilantEnabled; localStorage.setItem('vigilantEnabled', String(next)); setVigilantEnabled(next); window.dispatchEvent(new Event('resourceToggle')); }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${vigilantEnabled ? 'bg-rose-500' : 'bg-gray-600'}`}>
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${vigilantEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>
                {vigilantEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-rose-400 hover:text-rose-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                        <input type="text" placeholder="Vigilant username" value={vigilantUsername} onChange={e => setVigilantUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-rose-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input type={showVigilantPassword ? 'text' : 'password'} placeholder="••••••••" value={vigilantPassword} onChange={e => setVigilantPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-rose-500 focus:outline-none pr-10" />
                          <button type="button" onClick={() => setShowVigilantPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-rose-400 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { localStorage.setItem('vigilantUsername', vigilantUsername); localStorage.setItem('vigilantPassword', vigilantPassword); setVigilantHasCredentials(true); setVigilantUsername(''); setVigilantPassword(''); }}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500 rounded-lg text-rose-400 text-xs font-medium transition">Save Credentials</button>
                        <button onClick={() => { localStorage.removeItem('vigilantUsername'); localStorage.removeItem('vigilantPassword'); setVigilantHasCredentials(false); setVigilantUsername(''); setVigilantPassword(''); }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition">Clear</button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">Credentials are stored locally and used to auto-fill the Vigilant login form. They are never sent anywhere else.</p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── Thomson Reuters CLEAR ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">Thomson Reuters CLEAR — People & Business Intelligence</h3>
                      <p className="text-text-muted text-sm">
                        Access Thomson Reuters CLEAR directly from the resources drawer. Run comprehensive people searches, locate individuals, verify identities, uncover assets, and map associations using public records, proprietary data, and analytics. Requires an active CLEAR subscription.
                      </p>
                      <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://legal.thomsonreuters.com/en/products/clear-investigation-software'); }}
                        className="inline-block mt-1 text-xs text-sky-400 hover:text-sky-300 underline">
                        Learn more at thomsonreuters.com →
                      </a>
                      {trclearEnabled && (
                        <span className="inline-block mt-1 ml-3 text-xs text-sky-400">
                          {trclearHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { const next = !trclearEnabled; localStorage.setItem('trclearEnabled', String(next)); setTrclearEnabled(next); window.dispatchEvent(new Event('resourceToggle')); }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${trclearEnabled ? 'bg-sky-500' : 'bg-gray-600'}`}>
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${trclearEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>
                {trclearEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-sky-400 hover:text-sky-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-sky-500/5 border border-sky-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                        <input type="text" placeholder="CLEAR username" value={trclearUsername} onChange={e => setTrclearUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-sky-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input type={showTrclearPassword ? 'text' : 'password'} placeholder="••••••••" value={trclearPassword} onChange={e => setTrclearPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-sky-500 focus:outline-none pr-10" />
                          <button type="button" onClick={() => setShowTrclearPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-sky-400 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { localStorage.setItem('trclearUsername', trclearUsername); localStorage.setItem('trclearPassword', trclearPassword); setTrclearHasCredentials(true); setTrclearUsername(''); setTrclearPassword(''); }}
                          className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500 rounded-lg text-sky-400 text-xs font-medium transition">Save Credentials</button>
                        <button onClick={() => { localStorage.removeItem('trclearUsername'); localStorage.removeItem('trclearPassword'); setTrclearHasCredentials(false); setTrclearUsername(''); setTrclearPassword(''); }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition">Clear</button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">Credentials are stored locally and used to auto-fill the CLEAR login form. They are never sent anywhere else.</p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── Accurint (LexisNexis) ── */}
              <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-semibold mb-1">Accurint — LexisNexis People & Business Intelligence</h3>
                      <p className="text-text-muted text-sm">
                        Access LexisNexis Accurint directly from the resources drawer. Search comprehensive public records, locate individuals, investigate businesses, verify identities, and uncover connections. Requires an active Accurint subscription.
                      </p>
                      <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://www.lexisnexis.com/en-us/products/accurint-for-law-enforcement.page'); }}
                        className="inline-block mt-1 text-xs text-orange-400 hover:text-orange-300 underline">
                        Learn more at lexisnexis.com →
                      </a>
                      {accurintEnabled && (
                        <span className="inline-block mt-1 ml-3 text-xs text-orange-400">
                          {accurintHasCredentials ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { const next = !accurintEnabled; localStorage.setItem('accurintEnabled', String(next)); setAccurintEnabled(next); window.dispatchEvent(new Event('resourceToggle')); }}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${accurintEnabled ? 'bg-orange-500' : 'bg-gray-600'}`}>
                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${accurintEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>
                {accurintEnabled && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-orange-400 hover:text-orange-300 select-none flex items-center gap-1.5 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Login Credentials (auto-fill)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                        <input type="text" placeholder="Accurint username" value={accurintUsername} onChange={e => setAccurintUsername(e.target.value)}
                          className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Password</label>
                        <div className="relative">
                          <input type={showAccurintPassword ? 'text' : 'password'} placeholder="••••••••" value={accurintPassword} onChange={e => setAccurintPassword(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-orange-500 focus:outline-none pr-10" />
                          <button type="button" onClick={() => setShowAccurintPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-orange-400 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { localStorage.setItem('accurintUsername', accurintUsername); localStorage.setItem('accurintPassword', accurintPassword); setAccurintHasCredentials(true); setAccurintUsername(''); setAccurintPassword(''); }}
                          className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500 rounded-lg text-orange-400 text-xs font-medium transition">Save Credentials</button>
                        <button onClick={() => { localStorage.removeItem('accurintUsername'); localStorage.removeItem('accurintPassword'); setAccurintHasCredentials(false); setAccurintUsername(''); setAccurintPassword(''); }}
                          className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition">Clear</button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">Credentials are stored locally and used to auto-fill the Accurint login form. They are never sent anywhere else.</p>
                    </div>
                  </details>
                )}
              </div>

              {/* ── BYOA Divider ── */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-accent-cyan/10" /></div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs font-bold text-accent-cyan uppercase tracking-widest" style={{ background: 'var(--color-panel, #0d1117)' }}>
                    Bring Your Own Application
                  </span>
                </div>
              </div>

              <p className="text-text-muted text-sm mb-4">
                Add any web-based investigative tool or resource. Once enabled, it will appear as a tab in the resources drawer with its own persistent session.
              </p>

              {/* ── Saved BYOA Apps ── */}
              {byoaApps.map((app) => {
                const enabledKey = `byoa_${app.id}_enabled`;
                const isEnabled = localStorage.getItem(enabledKey) === 'true';
                const hasCreds = !!(localStorage.getItem(`byoa_${app.id}_username`));
                return (
                  <div key={app.id} className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-text-primary font-semibold mb-0.5">{app.label}</h3>
                          <p className="text-text-muted text-xs truncate max-w-md">{app.url}</p>
                          {isEnabled && (
                            <span className="inline-block mt-1 text-xs text-purple-400">
                              {hasCreds ? '✓ Credentials saved' : 'No credentials saved — you\'ll log in manually'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            // Destroy BrowserView
                            window.electronAPI.byoaDestroyView(app.id);
                            // Remove from localStorage
                            localStorage.removeItem(`byoa_${app.id}_enabled`);
                            localStorage.removeItem(`byoa_${app.id}_username`);
                            localStorage.removeItem(`byoa_${app.id}_password`);
                            const updated = byoaApps.filter(a => a.id !== app.id);
                            localStorage.setItem('byoaApps', JSON.stringify(updated));
                            setByoaApps(updated);
                            window.dispatchEvent(new Event('resourceToggle'));
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition"
                          title="Remove application"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            const next = !isEnabled;
                            localStorage.setItem(enabledKey, String(next));
                            setByoaApps([...byoaApps]); // force re-render
                            window.dispatchEvent(new Event('resourceToggle'));
                          }}
                          className={`relative w-14 h-7 rounded-full transition-colors ${
                            isEnabled ? 'bg-purple-500' : 'bg-gray-600'
                          }`}
                        >
                          <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                            isEnabled ? 'translate-x-8' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {isEnabled && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 select-none flex items-center gap-1.5 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Login Credentials (auto-fill)
                        </summary>
                        <div className="mt-3 space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                          <div>
                            <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                            <input
                              type="text"
                              placeholder="Username or email"
                              defaultValue=""
                              id={`byoa-user-${app.id}`}
                              className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-text-muted mb-1">Password</label>
                            <input
                              type="password"
                              placeholder="••••••••"
                              defaultValue=""
                              id={`byoa-pass-${app.id}`}
                              className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none pr-10"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const userEl = document.getElementById(`byoa-user-${app.id}`) as HTMLInputElement;
                                const passEl = document.getElementById(`byoa-pass-${app.id}`) as HTMLInputElement;
                                if (userEl?.value) localStorage.setItem(`byoa_${app.id}_username`, userEl.value);
                                if (passEl?.value) localStorage.setItem(`byoa_${app.id}_password`, passEl.value);
                                userEl.value = '';
                                passEl.value = '';
                                setByoaApps([...byoaApps]); // re-render for status
                              }}
                              className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500 rounded-lg text-purple-400 text-xs font-medium transition"
                            >
                              Save Credentials
                            </button>
                            <button
                              onClick={() => {
                                localStorage.removeItem(`byoa_${app.id}_username`);
                                localStorage.removeItem(`byoa_${app.id}_password`);
                                setByoaApps([...byoaApps]);
                              }}
                              className="px-3 py-1.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-xs font-medium transition"
                            >
                              Clear
                            </button>
                          </div>
                          <p className="text-xs text-text-muted leading-relaxed">
                            Credentials are stored locally and used to auto-fill the login form. They are never sent anywhere else.
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}

              {/* ── Add BYOA Button / Form ── */}
              {!byoaShowAdd ? (
                <button
                  onClick={() => setByoaShowAdd(true)}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 text-purple-400 hover:text-purple-300 text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Custom Application (BYOA)
                </button>
              ) : (
                <div className="bg-background rounded-lg p-5 border border-purple-500/30">
                  <h4 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    New Application
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Application Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Palantir, ClearView AI, RISS"
                        value={byoaNewLabel}
                        onChange={e => setByoaNewLabel(e.target.value)}
                        className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Login / Home URL *</label>
                      <input
                        type="url"
                        placeholder="https://example.com/login"
                        value={byoaNewUrl}
                        onChange={e => setByoaNewUrl(e.target.value)}
                        className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 select-none flex items-center gap-1.5 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Add Credentials (optional)
                      </summary>
                      <div className="mt-3 space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Username / Email</label>
                          <input
                            type="text"
                            placeholder="Username or email"
                            value={byoaNewUsername}
                            onChange={e => setByoaNewUsername(e.target.value)}
                            className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Password</label>
                          <div className="relative">
                            <input
                              type={byoaShowNewPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={byoaNewPassword}
                              onChange={e => setByoaNewPassword(e.target.value)}
                              className="w-full bg-background border border-accent-cyan/20 rounded-lg px-3 py-2 text-text-primary text-sm focus:border-purple-500 focus:outline-none pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setByoaShowNewPassword(v => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-purple-400 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </details>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (!byoaNewLabel.trim() || !byoaNewUrl.trim()) return;
                          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                          const newApp: ByoaApp = { id, label: byoaNewLabel.trim(), url: byoaNewUrl.trim() };
                          const updated = [...byoaApps, newApp];
                          localStorage.setItem('byoaApps', JSON.stringify(updated));
                          // Auto-enable the new app
                          localStorage.setItem(`byoa_${id}_enabled`, 'true');
                          // Save credentials if provided
                          if (byoaNewUsername) localStorage.setItem(`byoa_${id}_username`, byoaNewUsername);
                          if (byoaNewPassword) localStorage.setItem(`byoa_${id}_password`, byoaNewPassword);
                          setByoaApps(updated);
                          // Reset form
                          setByoaNewLabel('');
                          setByoaNewUrl('');
                          setByoaNewUsername('');
                          setByoaNewPassword('');
                          setByoaShowNewPassword(false);
                          setByoaShowAdd(false);
                          window.dispatchEvent(new Event('resourceToggle'));
                        }}
                        disabled={!byoaNewLabel.trim() || !byoaNewUrl.trim()}
                        className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500 rounded-lg text-purple-400 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save Application
                      </button>
                      <button
                        onClick={() => {
                          setByoaShowAdd(false);
                          setByoaNewLabel('');
                          setByoaNewUrl('');
                          setByoaNewUsername('');
                          setByoaNewPassword('');
                          setByoaShowNewPassword(false);
                        }}
                        className="px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600 rounded-lg text-text-muted text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
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
            <button
              onClick={() => setToolsExpanded(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Investigative Tools & Features
              </h2>
              <svg className={`w-5 h-5 text-text-muted transition-transform ${toolsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <p className="text-text-muted text-sm mt-1 mb-4">
              P.U.L.S.E. includes several investigative tools to assist with case work. Understanding their capabilities and limitations is important for effective use.
            </p>
            
            {toolsExpanded && (
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
            )}
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
