import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { WarrantsTab } from '../components/WarrantsTab';
import { SuspectTab } from '../components/SuspectTab';
import { OpPlanTab } from '../components/OpPlanTab';
import { ReportTab } from '../components/ReportTab';
import ProsecutionTab from '../components/ProsecutionTab';
import { EvidenceTab } from '../components/EvidenceTab';
import { EmailVerifier } from '../components/EmailVerifier';
import { CDRTab } from '../components/CDRTab';
import { ApertureTab } from '../components/ApertureTab';
import { OversightTab } from '../components/OversightTab';
import { RMSTab } from '../components/RMSTab';
import { 
  OverviewIcon, 
  NotesIcon, 
  EvidenceIcon, 
  WarrantsIcon, 
  SuspectIcon, 
  OpPlanIcon, 
  ReportIcon, 
  ProsecutionIcon,
  CDRIcon,
  ApertureIcon,
  OversightIcon,
  RMSIcon
} from '../components/CaseTabIcons';
import { useToast } from '../components/Toast';
import { ExportCaseDialog } from '../components/ExportCaseDialog';
import { CaseTimeline } from '../components/CaseTimeline';

interface CaseData {
  id: number;
  case_number: string;
  case_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CyberTipData {
  cybertip_number?: string;
  report_date?: string;
  occurrence_date?: string;
  reporting_company?: string;
  priority_level?: string;
  date_received_utc?: string;
  ncmec_folder_path?: string;
}

interface Identifier {
  id?: number;
  identifier_type: string;
  identifier_value: string;
  platform?: string; // For username - which platform (Facebook, Snapchat, etc.)
  provider?: string; // For IP address - ISP provider (Comcast, Verizon, etc.)
}

interface CyberTipFile {
  id?: number;
  filename?: string;
  ip_address?: string;
  datetime?: string;
  officer_description?: string;
  file_path?: string;
  ncmec_filename?: string;
  csam_description?: string;
}

interface P2PData {
  download_date?: string;
  platform?: string;
  suspect_ip?: string;
  ip_provider?: string;
  download_folder_path?: string;
}

interface ChatData {
  initial_contact_date?: string;
  platform?: string;
  identifiers?: string[];
}

interface OtherData {
  case_type_description?: string;
}

const DEFAULT_TAB_ORDER = [
  { id: 'overview', label: 'Overview', IconComponent: OverviewIcon },
  { id: 'notes', label: 'Notes', IconComponent: NotesIcon },
  { id: 'evidence', label: 'Evidence', IconComponent: EvidenceIcon },
  { id: 'warrants', label: 'Warrants', IconComponent: WarrantsIcon },
  { id: 'suspect', label: 'Suspect', IconComponent: SuspectIcon },
  { id: 'operations', label: 'OP Plan', IconComponent: OpPlanIcon },
  { id: 'report', label: 'Report', IconComponent: ReportIcon },
  { id: 'prosecution', label: 'Prosecution', IconComponent: ProsecutionIcon },
];

// Investigative add-on modules (can be added/removed per case)
const ADDON_MODULES = [
  { id: 'cdr', label: 'CDR Analysis', IconComponent: CDRIcon, description: 'Call Detail Record analysis & analytics' },
  { id: 'aperture', label: 'Aperture', IconComponent: ApertureIcon, description: 'Email forensics (.eml / .mbox)' },
  { id: 'oversight', label: 'Oversight', IconComponent: OversightIcon, description: 'Project Oversight case import' },
  { id: 'rms', label: 'RMS', IconComponent: RMSIcon, description: 'Report Management System imports' },
];

// Map addon module IDs to their tab definitions
const ADDON_TAB_MAP: Record<string, { id: string; label: string; IconComponent: any }> = {
  cdr: { id: 'cdr', label: 'CDR Analysis', IconComponent: CDRIcon },
  aperture: { id: 'aperture', label: 'Aperture', IconComponent: ApertureIcon },
  oversight: { id: 'oversight', label: 'Oversight', IconComponent: OversightIcon },
  rms: { id: 'rms', label: 'RMS', IconComponent: RMSIcon },
};

export function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [cyberTipData, setCyberTipData] = useState<CyberTipData | null>(null);
  const [p2pData, setP2PData] = useState<P2PData | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [otherData, setOtherData] = useState<OtherData | null>(null);
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]); // CyberTip identifiers
  const [chatIdentifiers, setChatIdentifiers] = useState<Identifier[]>([]);
  const [otherIdentifiers, setOtherIdentifiers] = useState<Identifier[]>([]);
  const [files, setFiles] = useState<CyberTipFile[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [managingTabOrder, setManagingTabOrder] = useState(false);
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const moduleMenuRef = useRef<HTMLDivElement>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>(() => {
    // Load enabled modules for this case from localStorage
    const saved = localStorage.getItem(`caseModules_${caseId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [tabs, setTabs] = useState(() => {
    // Load saved tab order from localStorage
    const saved = localStorage.getItem('caseTabOrder');
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved);
        // Map saved IDs to full tab objects (include both default and addon)
        const allTabMap = { ...Object.fromEntries(DEFAULT_TAB_ORDER.map(t => [t.id, t])), ...ADDON_TAB_MAP };
        return savedOrder.map((id: string) => allTabMap[id]).filter(Boolean);
      } catch (e) {
        return DEFAULT_TAB_ORDER;
      }
    }
    return DEFAULT_TAB_ORDER;
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showExportPulseDialog, setShowExportPulseDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState({
    cybertip: true,
    warrants: true,
    notes: true,
    evidence: true,
  });
  
  // Edit form state
  const [editedCyberTipData, setEditedCyberTipData] = useState<CyberTipData>({});
  const [editedP2PData, setEditedP2PData] = useState<P2PData>({});
  const [editedChatData, setEditedChatData] = useState<ChatData>({});
  const [editedOtherData, setEditedOtherData] = useState<OtherData>({});
  const [newIdentifier, setNewIdentifier] = useState({ 
    type: 'email', 
    value: '', 
    platform: '', 
    provider: '' 
  });
  const [newUsername, setNewUsername] = useState('');
  const [newCyberTipFile, setNewCyberTipFile] = useState({
    ncmec_filename: '',
    csam_description: ''
  });
  
  // Case notes state
  const [caseNotes, setCaseNotes] = useState<any[]>([]);
  
  // Check if carrier lookup is enabled
  const isCarrierLookupEnabled = () => {
    return localStorage.getItem('numverifyEnabled') === 'true';
  };
  
  // Toast notifications
  const { showToast, ToastContainer } = useToast();
  const [newNoteContent, setNewNoteContent] = useState('');

  useEffect(() => {
    loadCaseData();
    loadCaseNotes();
    
    // Check for tab query parameter
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [caseId, searchParams]);

  // Close module menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moduleMenuRef.current && !moduleMenuRef.current.contains(e.target as Node)) {
        setShowModuleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync enabled modules → tabs
  useEffect(() => {
    setTabs(prev => {
      const baseTabs = prev.filter(t => DEFAULT_TAB_ORDER.some(d => d.id === t.id));
      const addonTabs = enabledModules
        .filter(modId => !prev.some(t => t.id === modId))
        .map(modId => ADDON_TAB_MAP[modId])
        .filter(Boolean);
      const existingAddons = prev.filter(t => enabledModules.includes(t.id));
      const merged = [...baseTabs, ...existingAddons, ...addonTabs];
      const seen = new Set<string>();
      return merged.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
    });
  }, [enabledModules]);

  const loadCaseNotes = async () => {
    if (!caseId) return;
    try {
      const notes = await window.electronAPI.getCaseNotes(parseInt(caseId));
      setCaseNotes(notes || []);
    } catch (error) {
      console.error('Failed to load case notes:', error);
    }
  };

  const loadCaseData = async () => {
    if (!caseId) {
      console.error('No caseId provided');
      setLoading(false);
      return;
    }

    try {
      console.log('Loading case with ID:', caseId, 'type:', typeof caseId);
      const parsedCaseId = parseInt(caseId);
      console.log('Parsed case ID:', parsedCaseId);
      
      const data = await window.electronAPI.getCase(parsedCaseId);
      console.log('Case data received:', data);
      
      if (!data) {
        console.error('No data returned from getCase for ID:', parsedCaseId);
        setError(`Case #${parsedCaseId} not found. It may have been deleted.`);
        setLoading(false);
        return; // Exit gracefully instead of throwing
      }
      
      setCaseData(data);
      console.log('Case data set successfully');

      // Load type-specific data
      if (data.case_type === 'cybertip') {
        console.log('Loading CyberTip data for case:', parsedCaseId);
        try {
          const ctData = await window.electronAPI.getCyberTipData(parsedCaseId);
          console.log('CyberTip data received:', ctData);
          setCyberTipData(ctData);
          setEditedCyberTipData(ctData || {});
          
          // Load identifiers
          const idData = await window.electronAPI.getCyberTipIdentifiers(parsedCaseId);
          console.log('Identifiers received:', idData);
          setIdentifiers(idData || []);
          
          // Load files
          const fileData = await window.electronAPI.getCyberTipFiles(parsedCaseId);
          console.log('Files received:', fileData);
          setFiles(fileData || []);
        } catch (ctError) {
          console.error('Failed to load CyberTip data:', ctError);
          // Don't throw - case can still display without CyberTip data
        }
      } else if (data.case_type === 'p2p') {
        console.log('Loading P2P data for case:', parsedCaseId);
        try {
          const p2pDataResult = await window.electronAPI.getP2PData(parsedCaseId);
          console.log('P2P data received:', p2pDataResult);
          setP2PData(p2pDataResult);
          setEditedP2PData(p2pDataResult || {});
        } catch (p2pError) {
          console.error('Failed to load P2P data:', p2pError);
          // Don't throw - case can still display without P2P data
        }
      } else if (data.case_type === 'chat') {
        console.log('Loading Chat data for case:', parsedCaseId);
        try {
          const chatDataResult = await window.electronAPI.getChatData(parsedCaseId);
          console.log('Chat data received:', chatDataResult);
          setChatData(chatDataResult);
          setEditedChatData(chatDataResult || {});
          
          // Load chat identifiers
          const chatIdData = await window.electronAPI.getChatIdentifiers(parsedCaseId);
          console.log('Chat identifiers received:', chatIdData);
          setChatIdentifiers(chatIdData || []);
        } catch (chatError) {
          console.error('Failed to load Chat data:', chatError);
          // Don't throw - case can still display without Chat data
        }
      } else if (data.case_type === 'other') {
        console.log('Loading Other data for case:', parsedCaseId);
        try {
          const otherDataResult = await window.electronAPI.getOtherData(parsedCaseId);
          console.log('Other data received:', otherDataResult);
          setOtherData(otherDataResult);
          setEditedOtherData(otherDataResult || {});
          
          // Load other identifiers
          const otherIdData = await window.electronAPI.getOtherIdentifiers(parsedCaseId);
          console.log('Other identifiers received:', otherIdData);
          setOtherIdentifiers(otherIdData || []);
        } catch (otherError) {
          console.error('Failed to load Other data:', otherError);
          // Don't throw - case can still display without Other data
        }
      }
      
      console.log('loadCaseData completed successfully');
    } catch (error: any) {
      console.error('Failed to load case data:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      showToast(`Failed to load case: ${error?.message || error}`, 'error');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'text-status-success',              // Green - active case
      warrants_issued: 'text-status-warning',   // Yellow - warrants issued
      ready_residential: 'text-accent-cyan',    // Cyan - ready for residential
      arrest: 'text-accent-pink',               // Pink - arrest made
      closed_no_arrest: 'text-text-muted',      // Muted - closed
      referred: 'text-accent-cyan',             // Cyan - transferred
    };
    return colors[status] || 'text-text-primary';
  };

  const getStatusBgColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-status-success/10 border-status-success/30',           // Green background
      warrants_issued: 'bg-status-warning/10 border-status-warning/30', // Yellow background
      ready_residential: 'bg-accent-cyan/10 border-accent-cyan/30',    // Cyan background
      arrest: 'bg-accent-pink/10 border-accent-pink/30',               // Pink background
      closed_no_arrest: 'bg-text-muted/10 border-text-muted/30',      // Gray background
      referred: 'bg-accent-cyan/10 border-accent-cyan/30',             // Cyan background
    };
    return colors[status] || 'bg-background border-accent-cyan/30';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: '🟢 Open',
      warrants_issued: '🟡 Warrants Issued',
      ready_residential: '🔵 Ready for Residential',
      arrest: '🔴 Arrested',
      closed_no_arrest: '⚫ Closed',
      referred: '🔵 Transferred',
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return 'text-text-muted';
    const colors: Record<string, string> = {
      '1': 'text-accent-pink',      // High/Immediate
      '2': 'text-status-warning',   // Medium
      '3': 'text-status-success',   // Low
      'E': 'text-accent-cyan',      // Electronic
    };
    return colors[priority] || 'text-text-muted';
  };

  const getPriorityLabel = (priority?: string) => {
    if (!priority) return 'N/A';
    const labels: Record<string, string> = {
      '1': 'Priority Level 1 - High/Immediate',
      '2': 'Priority Level 2 - Medium',
      '3': 'Priority Level 3 - Low',
      'E': 'Priority Level E - Electronic',
    };
    return labels[priority] || priority;
  };

  const handleSave = async () => {
    if (!caseId) return;
    
    // Validate required fields for CyberTip cases
    if (caseData?.case_type === 'cybertip') {
      if (!editedCyberTipData.cybertip_number?.trim()) {
        showToast('CyberTipline number is required', 'error');
        return;
      }
      if (!editedCyberTipData.reporting_company?.trim()) {
        showToast('Reporting company is required', 'error');
        return;
      }
      if (!editedCyberTipData.report_date?.trim()) {
        showToast('Report date is required', 'error');
        return;
      }
    }
    
    setSaving(true);
    try {
      // Save CyberTip data - transform snake_case to camelCase for backend
      if (caseData?.case_type === 'cybertip') {
        await window.electronAPI.saveCyberTipData({
          caseId: parseInt(caseId),
          cybertipNumber: editedCyberTipData.cybertip_number,
          reportDate: editedCyberTipData.report_date,
          occurrenceDate: editedCyberTipData.occurrence_date,
          reportingCompany: editedCyberTipData.reporting_company,
          priorityLevel: editedCyberTipData.priority_level,
          dateReceivedUtc: editedCyberTipData.date_received_utc,
          ncmecFolderPath: editedCyberTipData.ncmec_folder_path,
        });
      } else if (caseData?.case_type === 'p2p') {
        // Save P2P data - transform snake_case to camelCase for backend
        await window.electronAPI.saveP2PData({
          caseId: parseInt(caseId),
          downloadDate: editedP2PData.download_date,
          platform: editedP2PData.platform,
          suspectIp: editedP2PData.suspect_ip,
          ipProvider: editedP2PData.ip_provider,
          downloadFolderPath: editedP2PData.download_folder_path,
        });
      } else if (caseData?.case_type === 'chat') {
        // Save Chat data - transform snake_case to camelCase for backend
        await window.electronAPI.saveChatData({
          caseId: parseInt(caseId),
          initialContactDate: editedChatData.initial_contact_date,
          platform: editedChatData.platform,
          identifiers: editedChatData.identifiers || [],
        });
      } else if (caseData?.case_type === 'other') {
        // Save Other data - transform snake_case to camelCase for backend
        await window.electronAPI.saveOtherData({
          caseId: parseInt(caseId),
          caseTypeDescription: editedOtherData.case_type_description,
        });
      }
      
      // Refresh data
      await loadCaseData();
      setEditMode(false);
      
      // Restore focus after async operations
      window.focus();
      
      // Use toast instead of alert - doesn't steal focus
      showToast('Changes saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save:', error);
      window.focus(); // Restore focus even on error
      showToast('Failed to save changes. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCyberTipData(cyberTipData || {});
    setEditedP2PData(p2pData || {});
    setEditedChatData(chatData || {});
    setEditedOtherData(otherData || {});
    setEditMode(false);
  };

  const handleAddIdentifier = async () => {
    if (!newIdentifier.value.trim() || !caseId) return;
    
    // Validate required fields
    if (newIdentifier.type === 'username' && !newIdentifier.platform.trim()) {
      showToast('Please specify the platform for this username', 'error');
      return;
    }
    if (newIdentifier.type === 'ip' && !newIdentifier.provider.trim()) {
      showToast('Please specify the ISP provider for this IP address', 'error');
      return;
    }
    // Only require carrier if Numverify is enabled
    if (newIdentifier.type === 'phone' && isCarrierLookupEnabled() && !newIdentifier.provider.trim()) {
      showToast('Please specify the carrier for this phone number', 'error');
      return;
    }
    
    try {
      await window.electronAPI.saveCyberTipIdentifier({
        caseId: parseInt(caseId),
        identifierType: newIdentifier.type,
        identifierValue: newIdentifier.value,
        platform: newIdentifier.platform || null,
        provider: newIdentifier.provider || null,
      });
      
      // Refresh identifiers
      const idData = await window.electronAPI.getCyberTipIdentifiers(parseInt(caseId));
      setIdentifiers(idData || []);
      
      // Reset form - create new object to ensure React detects the change
      const currentType = newIdentifier.type;
      setNewIdentifier({ 
        type: currentType, 
        value: '', 
        platform: '', 
        provider: '' 
      });
      
      // Restore focus
      window.focus();
    } catch (error) {
      console.error('Failed to add identifier:', error);
      showToast('Failed to add identifier', 'error');
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !caseId) return;
    
    try {
      await window.electronAPI.addCaseNote({
        case_id: parseInt(caseId),
        content: newNoteContent.trim(),
      });
      
      setNewNoteContent('');
      await loadCaseNotes();
      
      // Restore focus
      window.focus();
    } catch (error) {
      console.error('Failed to add note:', error);
      showToast('Failed to add note', 'error');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await window.electronAPI.deleteCaseNote(noteId);
      await loadCaseNotes();
      
      // Restore focus after async operations
      window.focus();
    } catch (error) {
      console.error('Failed to delete note:', error);
      window.focus(); // Restore focus even on error
      showToast('Failed to delete note', 'error');
    }
  };

  const handleDeleteIdentifier = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this identifier?')) return;
    
    try {
      await window.electronAPI.deleteCyberTipIdentifier(id);
      setIdentifiers(identifiers.filter(i => i.id !== id));
      
      // Restore focus
      window.focus();
    } catch (error) {
      console.error('Failed to delete identifier:', error);
      alert('Failed to delete identifier');
    }
  };

  const handleArinLookupForIdentifier = async () => {
    if (!newIdentifier.value) {
      showToast('Please enter an IP address first', 'error');
      return;
    }

    try {
      showToast('Looking up ISP provider via ARIN...', 'info');
      
      const result = await window.electronAPI.arinLookup(newIdentifier.value);
      
      // Restore focus after async operation
      window.focus();
      
      if (result.success && result.provider) {
        // Auto-fill the provider field
        setNewIdentifier({
          ...newIdentifier,
          provider: result.provider
        });
        
        showToast(`ISP Provider: ${result.provider}`, 'success');
      } else {
        showToast(`ARIN Lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('ARIN lookup error:', error);
      window.focus(); // Restore focus even on error
      showToast(`Failed to lookup ISP: ${error}`, 'error');
    }
  };

  const handleCarrierLookupForIdentifier = async () => {
    if (!newIdentifier.value) {
      showToast('Please enter a phone number first', 'error');
      return;
    }

    try {
      showToast('Looking up carrier via Numverify...', 'info');
      
      const result = await window.electronAPI.carrierLookup(newIdentifier.value);
      
      // Restore focus after async operation
      window.focus();
      
      if (result.success && result.carrier) {
        // Auto-fill the provider field with carrier name
        setNewIdentifier({
          ...newIdentifier,
          provider: result.carrier
        });
        
        const details = result.lineType ? ` (${result.lineType})` : '';
        showToast(`Carrier: ${result.carrier}${details}`, 'success');
      } else {
        showToast(`Carrier lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Carrier lookup error:', error);
      window.focus(); // Restore focus even on error
      showToast(`Failed to lookup carrier: ${error}`, 'error');
    }
  };

  const handlePingIdentifierIp = async (ipAddress: string) => {
    if (!ipAddress) {
      showToast('No IP address to ping', 'error');
      return;
    }

    try {
      showToast(`Pinging ${ipAddress}...`, 'info');
      
      const result = await window.electronAPI.pingIp(ipAddress);
      
      // Restore focus after async operation
      window.focus();
      
      if (result.success) {
        if (result.alive) {
          const message = result.avgTime 
            ? `Host is ALIVE! Average response time: ${result.avgTime}ms`
            : 'Host is ALIVE!';
          showToast(message, 'success');
        } else {
          showToast('Host is NOT responding (offline or blocked)', 'error');
        }
      } else {
        showToast(`Ping failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Ping error:', error);
      window.focus(); // Restore focus even on error
      showToast(`Failed to ping IP: ${error}`, 'error');
    }
  };

  const handleArinLookupForExistingIp = async (ipAddress: string, identifierId?: number) => {
    if (!ipAddress) {
      showToast('No IP address to look up', 'error');
      return;
    }

    try {
      showToast(`ARIN lookup for ${ipAddress}...`, 'info');
      
      const result = await window.electronAPI.arinLookup(ipAddress);
      
      window.focus();
      
      if (result.success && result.provider) {
        showToast(`ISP Provider: ${result.provider}`, 'success');
        
        // Persist the provider to DB and update local state so badge appears
        if (identifierId) {
          try {
            await window.electronAPI.updateIdentifierProvider(identifierId, result.provider);
            // Update local state immediately so the provider badge renders
            setIdentifiers(prev => prev.map(id => 
              id.id === identifierId ? { ...id, provider: result.provider } : id
            ));
          } catch (e) {
            console.warn('Could not update identifier provider:', e);
          }
        }
      } else {
        showToast(`ARIN Lookup: ${result.error || 'No provider found'}`, 'error');
      }
    } catch (error) {
      console.error('ARIN lookup error:', error);
      window.focus();
      showToast(`Failed ARIN lookup: ${error}`, 'error');
    }
  };



  // ========== Other Identifier Handlers ==========
  
  const handleAddOtherIdentifier = async () => {
    if (!newIdentifier.value.trim() || !caseId) return;
    
    // Validate required fields
    if (newIdentifier.type === 'username' && !newIdentifier.platform.trim()) {
      showToast('Please specify the platform for this username', 'error');
      return;
    }
    if (newIdentifier.type === 'ip' && !newIdentifier.provider.trim()) {
      showToast('Please specify the ISP provider for this IP address', 'error');
      return;
    }
    if (newIdentifier.type === 'phone' && isCarrierLookupEnabled() && !newIdentifier.provider.trim()) {
      showToast('Please specify the carrier for this phone number', 'error');
      return;
    }
    
    try {
      await window.electronAPI.saveOtherIdentifier({
        caseId: parseInt(caseId),
        identifierType: newIdentifier.type,
        identifierValue: newIdentifier.value,
        platform: newIdentifier.platform || null,
        provider: newIdentifier.provider || null,
      });
      
      // Refresh identifiers
      const idData = await window.electronAPI.getOtherIdentifiers(parseInt(caseId));
      setOtherIdentifiers(idData || []);
      
      // Reset form
      const currentType = newIdentifier.type;
      setNewIdentifier({ 
        type: currentType, 
        value: '', 
        platform: '', 
        provider: '' 
      });
      
      window.focus();
      showToast('Identifier added successfully', 'success');
    } catch (error) {
      console.error('Failed to add other identifier:', error);
      showToast('Failed to add identifier', 'error');
    }
  };

  const handleDeleteOtherIdentifier = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this identifier?')) return;
    
    try {
      await window.electronAPI.deleteOtherIdentifier(id);
      setOtherIdentifiers(otherIdentifiers.filter(i => i.id !== id));
      window.focus();
      showToast('Identifier deleted', 'success');
    } catch (error) {
      console.error('Failed to delete other identifier:', error);
      showToast('Failed to delete identifier', 'error');
    }
  };

  const handleAddCyberTipFile = async () => {
    try {
      if (!newCyberTipFile.ncmec_filename.trim() || !newCyberTipFile.csam_description.trim()) {
        alert('Please provide both NCMEC filename and CSAM description');
        return;
      }

      // Open folder dialog to select the NCMEC folder
      const result = await window.electronAPI.openFolderDialog({
        properties: ['openDirectory'],
        title: 'Select NCMEC Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const sourcePath = result.filePaths[0];
      console.log('Uploading CyberTip folder:', sourcePath);

      // Upload folder to cybertip folder
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber: caseData?.case_number,
        category: 'cybertip',
        sourcePath,
        filename: '', // Use original folder name
      });

      if (uploadResult.relativePath) {
        // Save folder metadata to database
        await window.electronAPI.saveCyberTipFile({
          caseId: parseInt(caseId!),
          ncmecFilename: newCyberTipFile.ncmec_filename,
          csamDescription: newCyberTipFile.csam_description,
          filePath: uploadResult.relativePath,
          filename: uploadResult.relativePath.split('/').pop() // Get folder name from path
        });

        // Reload files
        const fileData = await window.electronAPI.getCyberTipFiles(parseInt(caseId!));
        setFiles(fileData || []);

        // Clear form
        setNewCyberTipFile({
          ncmec_filename: '',
          csam_description: ''
        });

        showToast('NCMEC folder uploaded successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to upload CyberTip folder:', error);
      alert(`Failed to upload folder: ${error}`);
    }
  };

  const handleDeleteCyberTipFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this record? The actual files/folder will remain in the CyberTip folder.')) {
      return;
    }

    try {
      await window.electronAPI.deleteCyberTipFile(fileId);
      
      // Reload files
      const fileData = await window.electronAPI.getCyberTipFiles(parseInt(caseId!));
      setFiles(fileData || []);
      
      alert('Record deleted successfully');
    } catch (error) {
      console.error('Failed to delete record:', error);
      alert('Failed to delete record');
    }
  };

  const handleExportCase = async () => {
    if (!caseData) return;
    
    // Show export options dialog
    setShowExportDialog(true);
  };

  const handleConfirmExport = async () => {
    if (!caseData) return;

    setShowExportDialog(false);
    setExporting(true);

    try {
      const result = await window.electronAPI.exportDACase({
        caseId: parseInt(caseId!),
        caseNumber: caseData.case_number,
        caseType: caseData.case_type,
        exportOptions
      });

      if (result.success) {
        alert(
          `Case exported successfully!\n\n` +
          `Location: ${result.exportPath}\n` +
          `Files exported: ${result.filesCount || 'N/A'}\n\n` +
          `The folder has been opened for you.`
        );
      } else if (result.cancelled) {
        // User cancelled, do nothing
      } else {
        alert('Export was cancelled or failed');
      }
    } catch (error) {
      console.error('Failed to export case:', error);
      alert(`Failed to export case: ${error}`);
    } finally {
      setExporting(false);
    }
  };

  // Chat Identifier Handlers
  const [newChatIdentifier, setNewChatIdentifier] = useState({
    type: 'username',
    value: '',
    platform: '',
    provider: ''
  });

  const handleAddChatIdentifier = async () => {
    if (!newChatIdentifier.value.trim() || !caseId) return;
    
    // Validate required fields
    if (newChatIdentifier.type === 'username' && !newChatIdentifier.platform.trim()) {
      showToast('Please specify the platform for this username', 'error');
      return;
    }
    if (newChatIdentifier.type === 'ip' && !newChatIdentifier.provider.trim()) {
      showToast('Please specify the ISP provider for this IP address', 'error');
      return;
    }
    if (newChatIdentifier.type === 'phone' && isCarrierLookupEnabled() && !newChatIdentifier.provider.trim()) {
      showToast('Please specify the carrier for this phone number', 'error');
      return;
    }
    
    try {
      await window.electronAPI.saveChatIdentifier({
        caseId: parseInt(caseId),
        identifierType: newChatIdentifier.type,
        identifierValue: newChatIdentifier.value,
        platform: newChatIdentifier.platform || null,
        provider: newChatIdentifier.provider || null,
      });
      
      // Refresh identifiers
      const idData = await window.electronAPI.getChatIdentifiers(parseInt(caseId));
      setChatIdentifiers(idData || []);
      
      // Reset form
      const currentType = newChatIdentifier.type;
      setNewChatIdentifier({
        type: currentType,
        value: '',
        platform: '',
        provider: ''
      });
      
      // Restore focus
      window.focus();
      showToast('Identifier added successfully', 'success');
    } catch (error) {
      console.error('Failed to add identifier:', error);
      showToast('Failed to add identifier', 'error');
    }
  };

  const handleDeleteChatIdentifier = async (id: number) => {
    if (!confirm('Delete this identifier?')) return;
    
    try {
      await window.electronAPI.deleteChatIdentifier(id);
      
      // Refresh identifiers
      if (caseId) {
        const idData = await window.electronAPI.getChatIdentifiers(parseInt(caseId));
        setChatIdentifiers(idData || []);
      }
      
      showToast('Identifier deleted', 'success');
    } catch (error) {
      console.error('Failed to delete identifier:', error);
      showToast('Failed to delete identifier', 'error');
    }
  };

  const handleArinLookupForChatIdentifier = async () => {
    if (!newChatIdentifier.value) {
      showToast('Please enter an IP address first', 'error');
      return;
    }

    try {
      showToast('Looking up ISP provider via ARIN...', 'info');
      
      const result = await window.electronAPI.arinLookup(newChatIdentifier.value);
      
      if (result.success && result.provider) {
        // Auto-fill the provider field
        setNewChatIdentifier({
          ...newChatIdentifier,
          provider: result.provider
        });
        
        showToast(`ISP Provider: ${result.provider}`, 'success');
      } else {
        showToast(`ARIN Lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('ARIN lookup error:', error);
      showToast(`Failed to lookup ISP: ${error}`, 'error');
    }
  };

  const handleCarrierLookupForChatIdentifier = async () => {
    if (!newChatIdentifier.value) {
      showToast('Please enter a phone number first', 'error');
      return;
    }

    try {
      showToast('Looking up carrier via Numverify...', 'info');
      
      const result = await window.electronAPI.carrierLookup(newChatIdentifier.value);
      
      if (result.success && result.carrier) {
        // Auto-fill the provider field with carrier name
        setNewChatIdentifier({
          ...newChatIdentifier,
          provider: result.carrier
        });
        
        const details = result.lineType ? ` (${result.lineType})` : '';
        showToast(`Carrier: ${result.carrier}${details}`, 'success');
      } else {
        showToast(`Carrier lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Carrier lookup error:', error);
      showToast(`Failed to lookup carrier: ${error}`, 'error');
    }
  };

  const handleUploadP2PFolder = async () => {
    if (!caseId) return;
    
    try {
      const result = await window.electronAPI.openFolderDialog({
        properties: ['openDirectory'],
        title: 'Select P2P Download Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const sourcePath = result.filePaths[0];
      console.log('Uploading P2P folder:', sourcePath);

      // Upload folder to p2p_downloads category
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber: caseData?.case_number,
        category: 'p2p_downloads',
        sourcePath,
        filename: '', // Let it use original folder name
      });

      console.log('Upload result:', uploadResult);

      // Save P2P data with folder path immediately to database
      if (uploadResult.relativePath) {
        await window.electronAPI.saveP2PData({
          caseId: parseInt(caseId),
          downloadDate: p2pData?.download_date || editedP2PData.download_date,
          platform: p2pData?.platform || editedP2PData.platform,
          suspectIp: p2pData?.suspect_ip || editedP2PData.suspect_ip,
          ipProvider: p2pData?.ip_provider || editedP2PData.ip_provider,
          downloadFolderPath: uploadResult.relativePath,
        });
        
        // Reload P2P data to reflect changes
        await loadCaseData();
      }

      showToast('Successfully uploaded P2P download folder!', 'success');
    } catch (error) {
      console.error('Failed to upload P2P folder:', error);
      alert(`Failed to upload P2P folder: ${error}`);
    }
  };

  const handleArinLookup = async () => {
    if (!p2pData?.suspect_ip) {
      alert('No IP address to lookup');
      return;
    }

    try {
      showToast('Looking up ISP provider via ARIN...', 'info');
      
      const result = await window.electronAPI.arinLookup(p2pData.suspect_ip);
      
      if (result.success && result.provider) {
        // Update the IP provider in the database
        await window.electronAPI.saveP2PData({
          caseId: parseInt(caseId!),
          downloadDate: p2pData.download_date,
          platform: p2pData.platform,
          suspectIp: p2pData.suspect_ip,
          ipProvider: result.provider,
          downloadFolderPath: p2pData.download_folder_path,
        });
        
        // Reload case data to show updated provider
        await loadCaseData();
        
        showToast(`ISP Provider: ${result.provider}`, 'success');
      } else {
        showToast(`ARIN Lookup failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('ARIN lookup error:', error);
      showToast(`Failed to lookup ISP: ${error}`, 'error');
    }
  };

  const handlePingIp = async () => {
    if (!p2pData?.suspect_ip) {
      alert('No IP address to ping');
      return;
    }

    try {
      showToast(`Pinging ${p2pData.suspect_ip}...`, 'info');
      
      const result = await window.electronAPI.pingIp(p2pData.suspect_ip);
      
      if (result.success) {
        if (result.alive) {
          const message = result.avgTime 
            ? `Host is ALIVE! Average response time: ${result.avgTime}ms`
            : 'Host is ALIVE!';
          showToast(message, 'success');
        } else {
          showToast('Host is NOT responding (offline or blocked)', 'error');
        }
      } else {
        showToast(`Ping failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Ping error:', error);
      showToast(`Failed to ping IP: ${error}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-primary text-lg">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="bg-panel border border-accent-pink/30 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Case</h2>
            <p className="text-text-muted mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/cases')}
                className="px-6 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg hover:bg-accent-cyan/90 transition-colors"
              >
                View All Cases
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2.5 bg-panel border border-accent-cyan/20 text-text-primary font-semibold rounded-lg hover:bg-background transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="text-center">
          <p className="text-text-primary text-xl mb-4">Case not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-accent-cyan hover:underline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Export Dialog
  const ExportDialog = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel border border-accent-cyan/30 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Export DA Case</h2>
          <button
            onClick={() => setShowExportDialog(false)}
            className="text-text-muted hover:text-accent-cyan transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-text-muted text-sm mb-6">
          Case: <span className="text-text-primary font-medium">{caseData.case_number}</span>
          <br />
          Select which data sets to include in the export package for the District Attorney.
        </p>

        <div className="space-y-4 mb-6">
          {caseData.case_type === 'cybertip' && (
            <label className="flex items-start gap-3 p-3 bg-background rounded-lg border border-accent-cyan/20 cursor-pointer hover:border-accent-cyan/50 transition-colors">
              <input
                type="checkbox"
                checked={exportOptions.cybertip}
                onChange={(e) => setExportOptions({ ...exportOptions, cybertip: e.target.checked })}
                className="mt-1 w-4 h-4 text-accent-cyan bg-background border-accent-cyan/30 rounded focus:ring-accent-cyan"
              />
              <div className="flex-1">
                <div className="font-medium text-text-primary">CyberTip Files</div>
                <div className="text-sm text-text-muted">NCMEC report and all uploaded CyberTip evidence</div>
              </div>
            </label>
          )}

          <label className="flex items-start gap-3 p-3 bg-background rounded-lg border border-accent-cyan/20 cursor-pointer hover:border-accent-cyan/50 transition-colors">
            <input
              type="checkbox"
              checked={exportOptions.warrants}
              onChange={(e) => setExportOptions({ ...exportOptions, warrants: e.target.checked })}
              className="mt-1 w-4 h-4 text-accent-cyan bg-background border-accent-cyan/30 rounded focus:ring-accent-cyan"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Search Warrants</div>
              <div className="text-sm text-text-muted">All warrant PDFs and data return folders</div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-background rounded-lg border border-accent-cyan/20 cursor-pointer hover:border-accent-cyan/50 transition-colors">
            <input
              type="checkbox"
              checked={exportOptions.notes}
              onChange={(e) => setExportOptions({ ...exportOptions, notes: e.target.checked })}
              className="mt-1 w-4 h-4 text-accent-cyan bg-background border-accent-cyan/30 rounded focus:ring-accent-cyan"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Case Notes</div>
              <div className="text-sm text-text-muted">All case notes as a text file</div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-background rounded-lg border border-accent-cyan/20 cursor-pointer hover:border-accent-cyan/50 transition-colors">
            <input
              type="checkbox"
              checked={exportOptions.evidence}
              onChange={(e) => setExportOptions({ ...exportOptions, evidence: e.target.checked })}
              className="mt-1 w-4 h-4 text-accent-cyan bg-background border-accent-cyan/30 rounded focus:ring-accent-cyan"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Evidence Files</div>
              <div className="text-sm text-text-muted">All evidence files and folders</div>
            </div>
          </label>
        </div>

        <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4 mb-6">
          <p className="text-text-primary text-sm">
            <strong>Next Step:</strong> You will be asked to select a destination folder (USB drive, external drive, etc.)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowExportDialog(false)}
            className="flex-1 px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg 
                     hover:border-accent-cyan transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmExport}
            disabled={!exportOptions.cybertip && !exportOptions.warrants && !exportOptions.notes && !exportOptions.evidence}
            className="flex-1 px-4 py-2 bg-accent-cyan text-background rounded-lg font-medium
                     hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Continue to Export
          </button>
        </div>
      </div>
    </div>
  );

  // Move tab left or right
  const addModule = (moduleId: string) => {
    const updated = [...enabledModules, moduleId];
    setEnabledModules(updated);
    localStorage.setItem(`caseModules_${caseId}`, JSON.stringify(updated));
    setShowModuleMenu(false);
  };

  const removeModule = (moduleId: string) => {
    const updated = enabledModules.filter(m => m !== moduleId);
    setEnabledModules(updated);
    localStorage.setItem(`caseModules_${caseId}`, JSON.stringify(updated));
    // Remove from tabs
    setTabs(prev => prev.filter(t => t.id !== moduleId));
    // If active tab was removed, switch to overview
    if (activeTab === moduleId) setActiveTab('overview');
  };

  const moveTab = (index: number, direction: 'left' | 'right') => {
    const newTabs = [...tabs];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    // Swap tabs
    if (targetIndex >= 0 && targetIndex < newTabs.length) {
      [newTabs[index], newTabs[targetIndex]] = [newTabs[targetIndex], newTabs[index]];
      setTabs(newTabs);
    }
  };

  // Toggle manage order mode
  const toggleManageOrder = () => {
    if (managingTabOrder) {
      // Exiting manage mode - save to localStorage
      const tabOrder = tabs.map(tab => tab.id);
      localStorage.setItem('caseTabOrder', JSON.stringify(tabOrder));
    }
    setManagingTabOrder(!managingTabOrder);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Toast Notifications */}
      <ToastContainer />
      
      {/* Export Dialog */}
      {showExportDialog && <ExportDialog />}
      
      {/* Export PULSE File Dialog */}
      {showExportPulseDialog && caseData && (
        <ExportCaseDialog
          caseId={caseData.id}
          caseNumber={caseData.case_number}
          onClose={() => setShowExportPulseDialog(false)}
        />
      )}
      {/* Header */}
      <div className="bg-panel border-b border-accent-cyan/20 px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => navigate('/cases')}
              className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-2 mb-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Cases
            </button>
            <h1 className="text-3xl font-bold text-text-primary">
              Case {caseData.case_number}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border
                            ${getStatusColor(caseData.status)} ${getStatusBgColor(caseData.status)}`}>
              {getStatusLabel(caseData.status)}
            </span>
            
            {editMode ? (
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
                  disabled={saving}
                  className="px-4 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                           transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 bg-background border border-accent-cyan/30 text-text-primary rounded-lg 
                           hover:border-accent-cyan transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button 
                  onClick={() => setShowExportPulseDialog(true)}
                  className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                           hover:border-accent-cyan transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Export PULSE File
                </button>
                <button 
                  onClick={handleExportCase}
                  disabled={exporting}
                  className="px-4 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 
                           transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export DA Case
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 items-center">
          {tabs.map((tab, index) => {
            const IconComponent = tab.IconComponent;
            return (
              <div key={tab.id} className="flex items-center gap-1">
                {/* Left arrow */}
                {managingTabOrder && index > 0 && (
                  <button
                    onClick={() => moveTab(index, 'left')}
                    className="w-6 h-6 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 
                             flex items-center justify-center transition-colors"
                    title="Move left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                {/* Tab button */}
                <button
                  onClick={() => !managingTabOrder && setActiveTab(tab.id)}
                  className={`
                    px-4 py-2 rounded-lg transition-all flex items-center gap-2
                    ${managingTabOrder ? 'cursor-default' : 'cursor-pointer'}
                    ${activeTab === tab.id
                      ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                      : 'text-text-muted hover:text-text-primary hover:bg-accent-cyan/5'
                    }
                  `}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
                
                {/* Right arrow */}
                {managingTabOrder && index < tabs.length - 1 && (
                  <button
                    onClick={() => moveTab(index, 'right')}
                    className="w-6 h-6 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 
                             flex items-center justify-center transition-colors"
                    title="Move right"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          
          {/* Manage/Set Order button */}
          <button
            onClick={toggleManageOrder}
            className={`ml-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2
                     ${managingTabOrder 
                       ? 'bg-accent-cyan text-background hover:bg-accent-cyan/90' 
                       : 'text-text-muted hover:text-accent-cyan border border-text-muted/30 hover:border-accent-cyan/50'
                     }`}
          >
            {managingTabOrder ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Set Order
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Manage Order
              </>
            )}
          </button>

          {/* Add Module dropdown */}
          <div className="relative ml-1" ref={moduleMenuRef}>
            <button
              onClick={() => setShowModuleMenu(!showModuleMenu)}
              className="px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5
                       text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/50"
              title="Add investigative module"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Modules
            </button>
            {showModuleMenu && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-panel border border-accent-cyan/30 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-accent-cyan/20">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Investigative Modules</p>
                </div>
                {ADDON_MODULES.map(mod => {
                  const isEnabled = enabledModules.includes(mod.id);
                  return (
                    <div key={mod.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-accent-cyan/5 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <mod.IconComponent className="w-5 h-5 text-accent-cyan" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{mod.label}</p>
                          <p className="text-xs text-text-muted">{mod.description}</p>
                        </div>
                      </div>
                      {isEnabled ? (
                        <button
                          onClick={() => removeModule(mod.id)}
                          className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => addModule(mod.id)}
                          className="px-2 py-1 text-xs font-medium rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
              <h3 className="text-xl font-bold text-text-primary mb-4">Case Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Case Number</p>
                  <p className="text-text-primary font-medium">{caseData.case_number}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Case Type</p>
                  <p className="text-text-primary font-medium">
                    {caseData.case_type === 'p2p' ? 'P2P' : 
                     caseData.case_type === 'cybertip' ? 'CyberTip' : 
                     caseData.case_type.charAt(0).toUpperCase() + caseData.case_type.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Status</p>
                  <select
                    value={caseData.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        // Update backend first
                        await window.electronAPI.updateCase(caseData.id, {
                          status: newStatus
                        });
                        
                        // Update local state after successful backend update
                        setCaseData(prevData => {
                          if (!prevData) return prevData;
                          return { ...prevData, status: newStatus };
                        });
                        
                        console.log('Status updated successfully to:', newStatus);
                      } catch (error) {
                        console.error('Failed to update status:', error);
                        alert('Failed to update status');
                        
                        // Reload case data to revert UI to actual DB value
                        await loadCaseData();
                      }
                    }}
                    className={`px-3 py-2 rounded-lg font-medium border transition-all
                             focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 
                             ${getStatusColor(caseData.status)} ${getStatusBgColor(caseData.status)}`}
                  >
                    <option value="open" className="bg-background text-status-success">🟢 Open</option>
                    <option value="warrants_issued" className="bg-background text-status-warning">🟡 Warrants Issued</option>
                    <option value="ready_residential" className="bg-background text-accent-cyan">🔵 Ready for Residential</option>
                    <option value="arrest" className="bg-background text-accent-pink">🔴 Arrested</option>
                    <option value="closed_no_arrest" className="bg-background text-text-muted">⚫ Closed</option>
                    <option value="referred" className="bg-background text-accent-cyan">🔵 Transferred</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Created</p>
                  <p className="text-text-primary font-medium">
                    {new Date(caseData.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Case Timeline */}
            <CaseTimeline caseId={caseData.id} />

            {/* CyberTip Specific Data */}
            {caseData.case_type === 'cybertip' && (
              <>
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">CyberTip Information</h3>
                
                {!editMode ? (
                  // View Mode
                  <>
                  {!cyberTipData && (
                    <div className="text-text-muted italic mb-4">
                      No CyberTip data available for this case.
                    </div>
                  )}
                  
                  {cyberTipData && (
                    <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-muted mb-1">CyberTipline Report Number</p>
                    <p className="text-text-primary font-medium text-lg">
                      {cyberTipData.cybertip_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Priority Level</p>
                    <p className={`font-medium ${getPriorityColor(cyberTipData.priority_level)}`}>
                      {getPriorityLabel(cyberTipData.priority_level)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Reporting Company</p>
                    <p className="text-text-primary font-medium">
                      {cyberTipData.reporting_company || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Report Date</p>
                    <p className="text-text-primary font-medium">
                      {cyberTipData.report_date
                        ? new Date(cyberTipData.report_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Occurrence Date</p>
                    <p className="text-text-primary font-medium">
                      {cyberTipData.occurrence_date
                        ? new Date(cyberTipData.occurrence_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Date Received (UTC)</p>
                    <p className="text-text-primary font-medium">
                      {cyberTipData.date_received_utc
                        ? new Date(cyberTipData.date_received_utc).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {cyberTipData.ncmec_folder_path && (
                  <div className="mt-4 pt-4 border-t border-accent-cyan/20">
                    <button
                      onClick={() => window.electronAPI.openFileLocation(cyberTipData.ncmec_folder_path!)}
                      className="text-accent-cyan hover:underline flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Open NCMEC Folder
                    </button>
                  </div>
                )}
                </>
                )}
                </>
                ) : (
                  // Edit Mode
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        CyberTipline Report Number *
                      </label>
                      <input
                        type="text"
                        value={editedCyberTipData.cybertip_number || ''}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, cybertip_number: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Priority Level
                      </label>
                      <select
                        value={editedCyberTipData.priority_level || '2'}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, priority_level: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      >
                        <option value="1">Priority Level 1 - High/Immediate</option>
                        <option value="2">Priority Level 2 - Medium</option>
                        <option value="3">Priority Level 3 - Low</option>
                        <option value="E">Priority Level E - Electronic</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Reporting Company
                      </label>
                      <input
                        type="text"
                        value={editedCyberTipData.reporting_company || ''}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, reporting_company: e.target.value})}
                        placeholder="e.g., Facebook, Snapchat"
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Report Date
                      </label>
                      <input
                        type="date"
                        value={editedCyberTipData.report_date || ''}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, report_date: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Occurrence Date
                      </label>
                      <input
                        type="date"
                        value={editedCyberTipData.occurrence_date || ''}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, occurrence_date: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Date Received (UTC)
                      </label>
                      <input
                        type="datetime-local"
                        value={editedCyberTipData.date_received_utc || ''}
                        onChange={(e) => setEditedCyberTipData({...editedCyberTipData, date_received_utc: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Identifiers Section */}
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">Identifiers</h3>
                
                {/* Add New Identifier */}
                {editMode && (
                  <div className="mb-4 p-4 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg">
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={newIdentifier.type}
                        onChange={(e) => setNewIdentifier({...newIdentifier, type: e.target.value, platform: '', provider: ''})}
                        className="col-span-2 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      >
                        <option value="email">Email</option>
                        <option value="username">Username</option>
                        <option value="ip">IP Address</option>
                        <option value="phone">Phone</option>
                        <option value="userid">User ID</option>
                        <option value="name">Name</option>
                      </select>
                      
                      <input
                        type="text"
                        value={newIdentifier.value}
                        onChange={(e) => setNewIdentifier({...newIdentifier, value: e.target.value})}
                        placeholder={`Enter ${newIdentifier.type}...`}
                        className="col-span-4 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddIdentifier()}
                      />
                      
                      {/* Conditional field for username = platform */}
                      {newIdentifier.type === 'username' && (
                        <input
                          type="text"
                          value={newIdentifier.platform}
                          onChange={(e) => setNewIdentifier({...newIdentifier, platform: e.target.value})}
                          placeholder="Platform (Facebook, Snapchat, etc.)"
                          className="col-span-4 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                   text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddIdentifier()}
                        />
                      )}
                      
                      {/* Conditional field for IP = provider */}
                      {newIdentifier.type === 'ip' && (
                        <>
                          <input
                            type="text"
                            value={newIdentifier.provider}
                            onChange={(e) => setNewIdentifier({...newIdentifier, provider: e.target.value})}
                            placeholder="ISP Provider (Comcast, Verizon, etc.)"
                            className="col-span-3 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                     text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddIdentifier()}
                          />
                          <button
                            onClick={handleArinLookupForIdentifier}
                            disabled={!newIdentifier.value}
                            className="col-span-1 px-2 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                                     hover:bg-accent-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                     text-xs flex items-center justify-center gap-1"
                            title="Lookup ISP via ARIN"
                          >
                            <span>🔍</span> ARIN
                          </button>
                        </>
                      )}
                      
                      {/* Conditional field for phone = carrier */}
                      {newIdentifier.type === 'phone' && (
                        <>
                          <input
                            type="text"
                            value={newIdentifier.provider}
                            onChange={(e) => setNewIdentifier({...newIdentifier, provider: e.target.value})}
                            placeholder="Carrier (Verizon, AT&T, T-Mobile, etc.)"
                            className={`${isCarrierLookupEnabled() ? 'col-span-3' : 'col-span-4'} px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                     text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50`}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddIdentifier()}
                          />
                          {isCarrierLookupEnabled() && (
                            <button
                              onClick={handleCarrierLookupForIdentifier}
                              disabled={!newIdentifier.value}
                              className="col-span-1 px-2 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                                       hover:bg-accent-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                       text-xs flex items-center justify-center gap-1"
                              title="Lookup carrier via Numverify"
                            >
                              <span>📱</span> Lookup
                            </button>
                          )}
                        </>
                      )}
                      
                      {/* Spacer for other types */}
                      {newIdentifier.type !== 'username' && newIdentifier.type !== 'ip' && newIdentifier.type !== 'phone' && (
                        <div className="col-span-4"></div>
                      )}
                      
                      <button
                        onClick={handleAddIdentifier}
                        className="col-span-2 px-6 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Identifiers List */}
                {identifiers.length === 0 ? (
                  <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4 text-center">
                    <p className="text-accent-pink italic">No identifiers added yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {identifiers.map((identifier) => (
                      <div key={identifier.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-accent-cyan/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-text-muted uppercase">{identifier.identifier_type}</span>
                            {identifier.platform && (
                              <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded">
                                {identifier.platform}
                              </span>
                            )}
                            {identifier.provider && (
                              <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded">
                                {identifier.provider}
                              </span>
                            )}
                          </div>
                          <p className="text-text-primary font-medium break-all">{identifier.identifier_value}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {/* Email verification button for email identifiers */}
                          {identifier.identifier_type === 'email' && (
                            <EmailVerifier email={identifier.identifier_value} />
                          )}
                          {/* ARIN + Ping buttons for IP identifiers */}
                          {identifier.identifier_type === 'ip' && (
                            <>
                              <button
                                onClick={() => handleArinLookupForExistingIp(identifier.identifier_value, identifier.id)}
                                className="px-2 py-1 text-xs bg-background border border-orange-500/30 text-orange-400 rounded 
                                         hover:bg-orange-500/10 transition-colors flex items-center gap-1"
                                title="ARIN WHOIS lookup — find ISP provider"
                              >
                                <span>🌐</span> ARIN
                              </button>
                              <button
                                onClick={() => handlePingIdentifierIp(identifier.identifier_value)}
                                className="px-2 py-1 text-xs bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                         hover:bg-accent-cyan/10 transition-colors flex items-center gap-1"
                                title="Check if IP is still active"
                              >
                                <span>📡</span> Ping
                              </button>
                            </>
                          )}
                          {editMode && (
                            <button
                              onClick={() => handleDeleteIdentifier(identifier.id!)}
                              className="text-accent-pink hover:text-accent-pink/80 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Files Section */}
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">NCMEC Files</h3>
                
                {/* Add File/Folder Form */}
                {!editMode && (
                  <div className="bg-background/50 rounded-lg p-4 border border-accent-cyan/10 mb-4">
                    <div className="grid grid-cols-1 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          NCMEC Filename *
                        </label>
                        <input
                          type="text"
                          value={newCyberTipFile.ncmec_filename}
                          onChange={(e) => setNewCyberTipFile({ ...newCyberTipFile, ncmec_filename: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                   text-text-primary focus:outline-none focus:border-accent-cyan"
                          placeholder="Enter NCMEC-provided filename or folder name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          CSAM Description *
                        </label>
                        <textarea
                          value={newCyberTipFile.csam_description}
                          onChange={(e) => setNewCyberTipFile({ ...newCyberTipFile, csam_description: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                   text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                          placeholder="Describe the CSAM content"
                          rows={3}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddCyberTipFile}
                      disabled={!newCyberTipFile.ncmec_filename.trim() || !newCyberTipFile.csam_description.trim()}
                      className="px-4 py-2 bg-accent-cyan text-background rounded-lg 
                               hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Upload NCMEC Folder
                    </button>
                  </div>
                )}

                {/* Files/Folders List */}
                {files.length === 0 ? (
                  <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4 text-center">
                    <p className="text-accent-pink italic">No NCMEC files or folders added yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id} className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <p className="text-text-primary font-medium">{file.ncmec_filename || file.filename}</p>
                            </div>
                            {file.csam_description && (
                              <p className="text-sm text-text-muted mb-2">{file.csam_description}</p>
                            )}
                            {file.file_path && (
                              <button
                                onClick={() => window.electronAPI.openFileLocation(file.file_path)}
                                className="text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open in Explorer
                              </button>
                            )}
                          </div>
                          {!editMode && (
                            <button
                              onClick={() => handleDeleteCyberTipFile(file.id!)}
                              className="text-accent-pink hover:text-accent-pink/80 transition-colors ml-2"
                              title="Delete record (folder/file remains)"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-4">
                  <button
                    onClick={() => window.electronAPI.openFileLocation(`${caseData?.case_number}/cybertip`)}
                    className="px-4 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                             hover:border-accent-cyan transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    View CyberTip Folder
                  </button>
                </div>
              </div>
              </>
            )}

            {/* P2P Specific Data */}
            {caseData.case_type === 'p2p' && (
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">P2P Investigation Information</h3>
                
                {!editMode ? (
                  // View Mode
                  <>
                  {!p2pData && (
                    <div className="text-text-muted italic mb-4">
                      No P2P data available for this case.
                    </div>
                  )}
                  
                  {p2pData && (
                    <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-text-muted mb-1">Download Date</p>
                        <p className="text-text-primary font-medium">
                          {p2pData.download_date ? new Date(p2pData.download_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-text-muted mb-1">Network Platform</p>
                        <p className="text-text-primary font-medium capitalize">
                          {p2pData.platform || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-text-muted">Suspect IP Address</p>
                          {p2pData.suspect_ip && (
                            <div className="flex gap-2">
                              <button
                                onClick={handlePingIp}
                                className="px-2 py-1 text-xs bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                         hover:bg-accent-cyan/10 transition-colors flex items-center gap-1"
                                title="Check if IP is still active"
                              >
                                <span>📡</span> Ping
                              </button>
                              <button
                                onClick={handleArinLookup}
                                className="px-2 py-1 text-xs bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                         hover:bg-accent-cyan/10 transition-colors flex items-center gap-1"
                                title="Lookup ISP provider via ARIN"
                              >
                                <span>🔍</span> ARIN Lookup
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-text-primary font-medium font-mono">
                          {p2pData.suspect_ip || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-text-muted mb-1">ISP Provider</p>
                        <p className="text-text-primary font-medium">
                          {p2pData.ip_provider || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Download Folder Section - Always visible */}
                    <div className="border-t border-accent-cyan/20 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-text-muted">Download Folder</p>
                        <div className="flex gap-2">
                          {p2pData.download_folder_path && (
                            <button
                              onClick={() => window.electronAPI.openFileLocation(p2pData.download_folder_path)}
                              className="px-3 py-1.5 bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                       hover:bg-accent-cyan/10 transition-colors text-sm"
                            >
                              View Folder
                            </button>
                          )}
                          <button
                            onClick={handleUploadP2PFolder}
                            className="px-3 py-1.5 bg-accent-cyan text-background rounded hover:bg-accent-cyan/90 
                                     transition-colors text-sm"
                          >
                            {p2pData.download_folder_path ? 'Replace Folder' : 'Upload Folder'}
                          </button>
                        </div>
                      </div>
                      {p2pData.download_folder_path ? (
                        <p className="text-text-primary text-sm">{p2pData.download_folder_path}</p>
                      ) : (
                        <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-3 text-center">
                          <span className="text-accent-pink italic text-sm">No download folder uploaded yet</span>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                  </>
                ) : (
                  // Edit Mode
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Download Date *
                      </label>
                      <input
                        type="date"
                        value={editedP2PData.download_date || ''}
                        onChange={(e) => setEditedP2PData({...editedP2PData, download_date: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Network Platform *
                      </label>
                      <select
                        value={editedP2PData.platform || 'bittorrent'}
                        onChange={(e) => setEditedP2PData({...editedP2PData, platform: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      >
                        <option value="bittorrent">BitTorrent</option>
                        <option value="shareazza">Shareazza</option>
                        <option value="irc">IRC</option>
                        <option value="freenet">Freenet</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Suspect IP Address *
                      </label>
                      <input
                        type="text"
                        value={editedP2PData.suspect_ip || ''}
                        onChange={(e) => setEditedP2PData({...editedP2PData, suspect_ip: e.target.value})}
                        placeholder="e.g., 192.168.1.100"
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        ISP Provider *
                      </label>
                      <input
                        type="text"
                        value={editedP2PData.ip_provider || ''}
                        onChange={(e) => setEditedP2PData({...editedP2PData, ip_provider: e.target.value})}
                        placeholder="e.g., Comcast, Verizon, AT&T"
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>
                  </div>
                )}

                {/* Download Folder Section - Always visible outside edit mode */}
                {!editMode && p2pData && (
                  <div className="border-t border-accent-cyan/20 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-text-muted">Download Folder</p>
                      <div className="flex gap-2">
                        {p2pData.download_folder_path && (
                          <button
                            onClick={() => window.electronAPI.openFileLocation(p2pData.download_folder_path)}
                            className="px-3 py-1.5 bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                     hover:bg-accent-cyan/10 transition-colors text-sm"
                          >
                            View Folder
                          </button>
                        )}
                        <button
                          onClick={handleUploadP2PFolder}
                          className="px-3 py-1.5 bg-accent-cyan text-background rounded hover:bg-accent-cyan/90 
                                   transition-colors text-sm"
                        >
                          {p2pData.download_folder_path ? 'Replace Folder' : 'Upload Folder'}
                        </button>
                      </div>
                    </div>
                    {p2pData.download_folder_path ? (
                      <p className="text-text-primary text-sm">{p2pData.download_folder_path}</p>
                    ) : (
                      <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-3 text-center">
                        <span className="text-accent-pink italic text-sm">No download folder uploaded yet</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Chat Specific Data */}
            {caseData.case_type === 'chat' && (
              <>
              {/* Chat Investigation Information */}
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">Chat Investigation Information</h3>
                
                {!editMode ? (
                  // View Mode
                  <>
                  {!chatData && (
                    <div className="text-text-muted italic mb-4">
                      No Chat data available for this case.
                    </div>
                  )}
                  
                  {chatData && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-text-muted mb-1">Date Chat Started</p>
                        <p className="text-text-primary font-medium">
                          {chatData.initial_contact_date ? new Date(chatData.initial_contact_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-text-muted mb-1">Platform</p>
                        <p className="text-text-primary font-medium">
                          {chatData.platform || 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  // Edit Mode
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Date Chat Started *
                      </label>
                      <input
                        type="date"
                        value={editedChatData.initial_contact_date || ''}
                        onChange={(e) => setEditedChatData({...editedChatData, initial_contact_date: e.target.value})}
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-2">
                        Platform *
                      </label>
                      <input
                        type="text"
                        value={editedChatData.platform || ''}
                        onChange={(e) => setEditedChatData({...editedChatData, platform: e.target.value})}
                        placeholder="e.g., Discord, Snapchat, Instagram"
                        className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Identifiers Section - Matches CyberTip Pattern */}
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">Identifiers</h3>
                
                {/* Add New Identifier */}
                {editMode && (
                  <div className="mb-4 p-4 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg">
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={newChatIdentifier.type}
                        onChange={(e) => setNewChatIdentifier({...newChatIdentifier, type: e.target.value, platform: '', provider: ''})}
                        className="col-span-2 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                      >
                        <option value="email">Email</option>
                        <option value="username">Username</option>
                        <option value="ip">IP Address</option>
                        <option value="phone">Phone</option>
                        <option value="userid">User ID</option>
                        <option value="name">Name</option>
                      </select>
                      
                      <input
                        type="text"
                        value={newChatIdentifier.value}
                        onChange={(e) => setNewChatIdentifier({...newChatIdentifier, value: e.target.value})}
                        placeholder={`Enter ${newChatIdentifier.type}...`}
                        className="col-span-4 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddChatIdentifier()}
                      />
                      
                      {/* Conditional field for username = platform */}
                      {newChatIdentifier.type === 'username' && (
                        <input
                          type="text"
                          value={newChatIdentifier.platform}
                          onChange={(e) => setNewChatIdentifier({...newChatIdentifier, platform: e.target.value})}
                          placeholder="Platform (Discord, Snapchat, etc.)"
                          className="col-span-4 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                   text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddChatIdentifier()}
                        />
                      )}
                      
                      {/* Conditional field for IP = provider */}
                      {newChatIdentifier.type === 'ip' && (
                        <>
                          <input
                            type="text"
                            value={newChatIdentifier.provider}
                            onChange={(e) => setNewChatIdentifier({...newChatIdentifier, provider: e.target.value})}
                            placeholder="ISP Provider (Comcast, Verizon, etc.)"
                            className="col-span-3 px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                     text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddChatIdentifier()}
                          />
                          <button
                            onClick={handleArinLookupForChatIdentifier}
                            disabled={!newChatIdentifier.value}
                            className="col-span-1 px-2 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                                     hover:bg-accent-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                     text-xs flex items-center justify-center gap-1"
                            title="Lookup ISP via ARIN"
                          >
                            <span>🔍</span> ARIN
                          </button>
                        </>
                      )}
                      
                      {/* Conditional field for phone = carrier */}
                      {newChatIdentifier.type === 'phone' && (
                        <>
                          <input
                            type="text"
                            value={newChatIdentifier.provider}
                            onChange={(e) => setNewChatIdentifier({...newChatIdentifier, provider: e.target.value})}
                            placeholder="Carrier (Verizon, AT&T, T-Mobile, etc.)"
                            className={`${isCarrierLookupEnabled() ? 'col-span-3' : 'col-span-4'} px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                                     text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50`}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddChatIdentifier()}
                          />
                          {isCarrierLookupEnabled() && (
                            <button
                              onClick={handleCarrierLookupForChatIdentifier}
                              disabled={!newChatIdentifier.value}
                              className="col-span-1 px-2 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg 
                                       hover:bg-accent-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                       text-xs flex items-center justify-center gap-1"
                              title="Lookup carrier via Numverify"
                            >
                              <span>📱</span> Lookup
                            </button>
                          )}
                        </>
                      )}
                      
                      {/* Spacer for other types */}
                      {newChatIdentifier.type !== 'username' && newChatIdentifier.type !== 'ip' && newChatIdentifier.type !== 'phone' && (
                        <div className="col-span-4"></div>
                      )}
                      
                      <button
                        onClick={handleAddChatIdentifier}
                        className="col-span-2 px-6 py-2 bg-accent-cyan text-background rounded-lg hover:bg-accent-cyan/90 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Identifiers List */}
                {chatIdentifiers.length === 0 ? (
                  <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-lg p-4 text-center">
                    <p className="text-accent-pink italic">No identifiers added yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {chatIdentifiers.map((identifier) => (
                      <div key={identifier.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-accent-cyan/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-text-muted uppercase">{identifier.identifier_type}</span>
                            {identifier.platform && (
                              <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded">
                                {identifier.platform}
                              </span>
                            )}
                            {identifier.provider && (
                              <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded">
                                {identifier.provider}
                              </span>
                            )}
                          </div>
                          <p className="text-text-primary font-medium break-all">{identifier.identifier_value}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {/* Email verification button for email identifiers */}
                          {identifier.identifier_type === 'email' && (
                            <EmailVerifier email={identifier.identifier_value} />
                          )}
                          {/* ARIN + Ping buttons for IP identifiers */}
                          {identifier.identifier_type === 'ip' && (
                            <>
                              <button
                                onClick={() => handleArinLookupForExistingIp(identifier.identifier_value, identifier.id)}
                                className="px-2 py-1 text-xs bg-background border border-orange-500/30 text-orange-400 rounded 
                                         hover:bg-orange-500/10 transition-colors flex items-center gap-1"
                                title="ARIN WHOIS lookup — find ISP provider"
                              >
                                <span>🌐</span> ARIN
                              </button>
                              <button
                                onClick={() => handlePingIdentifierIp(identifier.identifier_value)}
                                className="px-2 py-1 text-xs bg-background border border-accent-cyan/30 text-accent-cyan rounded 
                                         hover:bg-accent-cyan/10 transition-colors flex items-center gap-1"
                                title="Check if IP is still active"
                              >
                                <span>📡</span> Ping
                              </button>
                            </>
                          )}
                          {editMode && (
                            <button
                              onClick={() => identifier.id && handleDeleteChatIdentifier(identifier.id)}
                              className="text-accent-pink hover:text-accent-pink/80 transition-colors text-xl"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
            )}

            {/* Other Case Type Data */}
            {caseData.case_type === 'other' && (
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-text-primary mb-4">Case Synopsis</h3>
                
                {!editMode ? (
                  // View Mode
                  <>
                  {!otherData && (
                    <div className="text-text-muted italic mb-4">
                      No synopsis available for this case.
                    </div>
                  )}
                  
                  {otherData && (
                    <div className="text-text-primary whitespace-pre-wrap">
                      {otherData.case_type_description || (
                        <span className="text-text-muted italic">No synopsis provided</span>
                      )}
                    </div>
                  )}
                  </>
                ) : (
                  // Edit Mode
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      Synopsis *
                    </label>
                    <textarea
                      value={editedOtherData.case_type_description || ''}
                      onChange={(e) => setEditedOtherData({...editedOtherData, case_type_description: e.target.value})}
                      placeholder="Brief description of the investigation..."
                      className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg 
                               text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 
                               min-h-[150px] resize-y"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Provide a brief overview of this investigation case.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && caseData && (
          <div className="space-y-6">
            {/* Case Notes Section */}
            <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
              <h3 className="text-xl font-bold text-text-primary mb-4">Case Notes & Updates</h3>
              
              {/* Add Note Input */}
              <div className="mb-6">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Add a case note or update..."
                  className="w-full px-4 py-3 bg-background text-text-primary border border-accent-cyan/30 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 min-h-[120px] resize-y"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleAddNote();
                    }
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-text-muted">Press Ctrl+Enter to save quickly</p>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                    className="px-4 py-2 bg-accent-cyan text-background font-medium rounded-lg 
                             hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {caseNotes.length === 0 ? (
                  <p className="text-text-muted italic text-center py-12">
                    No notes yet. Add your first case note above.
                  </p>
                ) : (
                  caseNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-background border border-accent-cyan/20 rounded-lg p-4 hover:border-accent-cyan/40 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-text-muted">
                          {new Date(note.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-accent-pink hover:text-accent-pink/80 transition-colors text-xs"
                          title="Delete note"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-text-primary whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && caseData && (
          <EvidenceTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'warrants' && caseData && (
          <WarrantsTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'suspect' && caseData && (
          <SuspectTab caseId={caseData.id} caseNumber={caseData.case_number} showToast={showToast} />
        )}

        {activeTab === 'operations' && caseData && (
          <OpPlanTab caseId={caseData.id} caseNumber={caseData.case_number} showToast={showToast} />
        )}

        {activeTab === 'report' && caseData && (
          <ReportTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'prosecution' && caseData && (
          <ProsecutionTab caseId={caseData.id} />
        )}

        {activeTab === 'cdr' && caseData && (
          <CDRTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'aperture' && caseData && (
          <ApertureTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'oversight' && caseData && (
          <OversightTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}

        {activeTab === 'rms' && caseData && (
          <RMSTab caseId={caseData.id} caseNumber={caseData.case_number} />
        )}
      </div>
    </div>
  );
}
