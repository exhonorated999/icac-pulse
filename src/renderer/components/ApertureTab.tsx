import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface EmailRecord {
  id?: number;
  case_id: number;
  message_id: string;
  from_address: string;
  to_addresses: string;
  cc_addresses?: string;
  subject: string;
  date_sent: string;
  body_text?: string;
  body_html?: string;
  headers_raw?: string;
  source_file?: string;
  source_name?: string;
  flagged: number;
  ip_addresses?: string;       // JSON array of extracted IPs
  attachments_json?: string;   // JSON array of { filename, size, mime_type, content_id, content }
}

interface NoteRecord {
  id: number;
  content: string;
  created_at: string;
}

interface SourceRecord {
  name: string;
  count: number;
}

interface AttachmentInfo {
  filename: string;
  size: number;
  mime_type?: string;
  content_id?: string;
  content?: string; // base64
}

interface IpInfo {
  ip_address: string;
  classification: string;
  confidence: number;
}

interface ApertureTabProps {
  caseId: number;
  caseNumber?: string;
}

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function parseAttachments(json?: string): AttachmentInfo[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function parseIpAddresses(json?: string): IpInfo[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function processHtmlBody(html: string, attachments: AttachmentInfo[]): string {
  if (!html) return '';
  let processed = html;
  attachments.forEach(att => {
    if (att.content_id && att.content) {
      const dataUrl = `data:${att.mime_type};base64,${att.content}`;
      const cid = att.content_id.replace(/[<>]/g, '');
      const re = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      processed = processed.replace(re, dataUrl);
    }
  });
  return processed;
}

function formatDateStr(d: string): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export function ApertureTab({ caseId, caseNumber }: ApertureTabProps) {
  // ── Data state ───────────────────────────────
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Selection & view state ───────────────────
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [showHeaders, setShowHeaders] = useState(false);

  // ── Filters ──────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'flagged' | 'attachments'>('all');

  // ── Dialogs ──────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [importSourceName, setImportSourceName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Evidence auto-scan ───────────────────────
  const [evidenceFiles, setEvidenceFiles] = useState<{ id: number; description: string; file_path: string }[]>([]);
  const [importingEvidence, setImportingEvidence] = useState<number | null>(null);

  // ── Notes ────────────────────────────────────
  const [noteInput, setNoteInput] = useState('');

  // ── IP lookup ────────────────────────────────
  const [ipGeoInfo, setIpGeoInfo] = useState<Record<string, any> | null>(null);
  const [lookingUpIp, setLookingUpIp] = useState(false);

  // ── Report notice ──────────────────────────
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  /* ═══════════════════════════════════════════════════
     DATA LOADING
  ═══════════════════════════════════════════════════ */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [emailData, sourceData] = await Promise.all([
        window.electronAPI.getApertureEmails(caseId),
        window.electronAPI.getApertureSources(caseId),
      ]);
      setEmails(emailData || []);
      setSources(sourceData || []);
    } catch (e) {
      console.error('Aperture load error:', e);
    }
    setLoading(false);
  }, [caseId]);

  const loadEvidence = useCallback(async () => {
    try {
      const allEvidence = await window.electronAPI.getEvidence(caseId);
      const emailFiles = (allEvidence || []).filter((e: any) =>
        /\.(eml|mbox)$/i.test(e.file_path)
      );
      setEvidenceFiles(emailFiles);
    } catch (e) { console.error('Evidence scan error:', e); }
  }, [caseId]);

  useEffect(() => { loadAll(); loadEvidence(); }, [loadAll, loadEvidence]);

  /* ═══════════════════════════════════════════════════
     FILTERING
  ═══════════════════════════════════════════════════ */
  const filtered = useMemo(() => {
    let result = [...emails];
    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter(e => (e.source_name || e.source_file) === sourceFilter);
    }
    // Type filter
    if (typeFilter === 'flagged') {
      result = result.filter(e => e.flagged);
    } else if (typeFilter === 'attachments') {
      result = result.filter(e => {
        const atts = parseAttachments(e.attachments_json);
        return atts.length > 0;
      });
    }
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.subject || '').toLowerCase().includes(q) ||
        (e.from_address || '').toLowerCase().includes(q) ||
        (e.to_addresses || '').toLowerCase().includes(q) ||
        (e.body_text || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [emails, sourceFilter, typeFilter, searchQuery]);

  /* ═══════════════════════════════════════════════════
     STATISTICS
  ═══════════════════════════════════════════════════ */
  const stats = useMemo(() => ({
    totalEmails: emails.length,
    sourceCount: sources.length,
    flaggedEmails: emails.filter(e => e.flagged).length,
    withAttachments: emails.filter(e => parseAttachments(e.attachments_json).length > 0).length,
  }), [emails, sources]);

  /* ═══════════════════════════════════════════════════
     EMAIL SELECTION
  ═══════════════════════════════════════════════════ */
  const selectEmail = async (email: EmailRecord) => {
    setSelectedEmail(email);
    setShowHeaders(false);
    setIpGeoInfo(null);
    setLookingUpIp(false);
    setNoteInput('');
    // Load notes
    if (email.id) {
      try {
        const n = await window.electronAPI.getApertureNotes(email.id);
        setNotes(n || []);
      } catch { setNotes([]); }
    }
  };

  /* ═══════════════════════════════════════════════════
     FLAG TOGGLE
  ═══════════════════════════════════════════════════ */
  const toggleFlag = async (email: EmailRecord) => {
    if (!email.id) return;
    const newFlagged = email.flagged ? 0 : 1;
    await window.electronAPI.updateApertureEmail({ id: email.id, flagged: newFlagged });
    const updated = emails.map(e => e.id === email.id ? { ...e, flagged: newFlagged } : e);
    setEmails(updated);
    if (selectedEmail?.id === email.id) {
      setSelectedEmail({ ...email, flagged: newFlagged });
    }
  };

  /* ═══════════════════════════════════════════════════
     NOTES
  ═══════════════════════════════════════════════════ */
  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedEmail?.id) return;
    try {
      const result = await window.electronAPI.addApertureNote({
        caseId,
        emailId: selectedEmail.id,
        content: noteInput.trim()
      });
      if (result.success && result.note) {
        setNotes(prev => [result.note!, ...prev]);
        setNoteInput('');
        // Auto-flag
        if (!selectedEmail.flagged) {
          toggleFlag(selectedEmail);
        }
      }
    } catch (e) { console.error('Add note error:', e); }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await window.electronAPI.deleteApertureNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e) { console.error('Delete note error:', e); }
  };

  /* ═══════════════════════════════════════════════════
     IMPORT (FILE DIALOG)
  ═══════════════════════════════════════════════════ */
  const handleImport = async () => {
    const fileInput = importFileRef.current;
    if (!importSourceName.trim()) { setImportError('Please enter a source name'); return; }
    if (!fileInput?.files?.length) { setImportError('Please select a file'); return; }
    
    const file = fileInput.files[0];
    setImporting(true);
    setImportError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await window.electronAPI.importApertureEmails({
        caseId,
        fileData: base64,
        fileName: file.name,
        sourceName: importSourceName.trim()
      });

      if (result?.imported) {
        setShowImportDialog(false);
        setImportSourceName('');
        if (fileInput) fileInput.value = '';
        await loadAll();
      } else {
        setImportError('No emails were imported');
      }
    } catch (e: any) {
      setImportError(e.message || 'Import failed');
    }
    setImporting(false);
  };

  /* ═══════════════════════════════════════════════════
     IMPORT FROM EVIDENCE
  ═══════════════════════════════════════════════════ */
  const importFromEvidence = async (ev: { id: number; file_path: string; description: string }) => {
    setImportingEvidence(ev.id);
    try {
      const result = await window.electronAPI.readEvidenceFile(ev.file_path);
      if (result.success && result.content) {
        const base64 = btoa(unescape(encodeURIComponent(result.content)));
        const fileName = ev.file_path.split(/[/\\]/).pop() || 'unknown';
        const sourceName = fileName.replace(/\.[^.]+$/, '');

        const importResult = await window.electronAPI.importApertureEmails({
          caseId,
          fileData: base64,
          fileName,
          sourceName
        });

        if (importResult?.imported) {
          await loadAll();
          setEvidenceFiles(prev => prev.filter(e => e.id !== ev.id));
        }
      }
    } catch (e) {
      console.error('Evidence import error:', e);
    }
    setImportingEvidence(null);
  };

  const importAllEvidence = async () => {
    for (const ev of evidenceFiles) {
      await importFromEvidence(ev);
    }
  };

  /* ═══════════════════════════════════════════════════
     CLEAR ALL
  ═══════════════════════════════════════════════════ */
  const handleClear = async () => {
    if (!confirm('Delete all imported emails for this case?')) return;
    await window.electronAPI.deleteApertureEmails(caseId);
    setEmails([]);
    setSources([]);
    setSelectedEmail(null);
    setNotes([]);
  };

  /* ═══════════════════════════════════════════════════
     IP LOOKUP
  ═══════════════════════════════════════════════════ */
  const handleIpLookup = async (ip: string) => {
    setLookingUpIp(true);
    try {
      const resp = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,lat,lon,timezone`);
      const data = await resp.json();
      if (data.status === 'success') {
        setIpGeoInfo({
          city: data.city,
          region: data.regionName,
          country: data.country,
          isp: data.isp,
          org: data.org,
          asn: data.as,
          latitude: data.lat,
          longitude: data.lon,
          timezone: data.timezone,
        });
      }
    } catch (e) { console.error('IP lookup error:', e); }
    setLookingUpIp(false);
  };

  /* ═══════════════════════════════════════════════════
     RENDER: LOADING
  ═══════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
          Loading Aperture...
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     PARSED DATA FOR SELECTED EMAIL
  ═══════════════════════════════════════════════════ */
  const selAttachments = selectedEmail ? parseAttachments(selectedEmail.attachments_json) : [];
  const selIps = selectedEmail ? parseIpAddresses(selectedEmail.ip_addresses) : [];
  const selOriginIp = selIps.length > 0 ? selIps[0] : null;

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Header ────────────────────────────────────── */}
      <div className="bg-panel p-4 rounded-lg mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-accent-cyan bg-clip-text text-transparent">
            APERTURE
          </div>
          <div className="text-text-muted text-sm">Investigative Email Parser</div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowReportDialog(true)}
            className="px-3 py-2 rounded-lg text-sm bg-panel border border-purple-500/50 text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center space-x-1"
          >
            <span>📊</span><span>Report</span>
          </button>
          <button
            onClick={() => { setShowImportDialog(true); setImportError(null); }}
            className="px-4 py-2 rounded-lg text-sm bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30 transition-colors flex items-center space-x-2"
          >
            <span>📁</span><span>Import</span>
          </button>
          <button
            onClick={() => { loadAll(); loadEvidence(); }}
            className="px-3 py-2 rounded-lg text-sm bg-panel border border-accent-cyan/20 text-text-muted hover:text-text-primary transition-colors"
            title="Refresh"
          >
            🔄
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Evidence Auto-Scan Bar ────────────────────── */}
      {evidenceFiles.length > 0 && (
        <div className="bg-gradient-to-r from-accent-cyan/10 to-green-500/10 border border-accent-cyan/30 rounded-lg p-3 mb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-accent-cyan text-lg">📬</span>
              <span className="text-accent-cyan font-semibold text-sm">Email files detected in evidence</span>
              <span className="text-xs text-text-muted">({evidenceFiles.length} file{evidenceFiles.length !== 1 ? 's' : ''})</span>
            </div>
            <button
              onClick={importAllEvidence}
              className="px-3 py-1 rounded text-xs bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30"
            >
              Import All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {evidenceFiles.map(ev => (
              <div key={ev.id} className="flex items-center space-x-2 bg-background/60 rounded px-3 py-1.5 border border-accent-cyan/20">
                <span className="text-xs font-mono text-text-muted truncate" style={{ maxWidth: 200 }}>
                  {ev.file_path.split(/[/\\]/).pop()}
                </span>
                <button
                  onClick={() => importFromEvidence(ev)}
                  disabled={importingEvidence === ev.id}
                  className="text-green-400 hover:text-white text-xs font-semibold"
                >
                  {importingEvidence === ev.id ? '...' : 'Import'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats Bar ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="bg-panel p-3 rounded-lg border border-accent-cyan/10 hover:border-accent-cyan/30 transition-colors">
          <div className="text-text-muted text-xs mb-1">Total Emails</div>
          <div className="text-2xl font-bold text-accent-cyan">{stats.totalEmails}</div>
        </div>
        <div className="bg-panel p-3 rounded-lg border border-green-500/10 hover:border-green-500/30 transition-colors">
          <div className="text-text-muted text-xs mb-1">Sources</div>
          <div className="text-2xl font-bold text-green-400">{stats.sourceCount}</div>
        </div>
        <div className="bg-panel p-3 rounded-lg border border-orange-500/10 hover:border-orange-500/30 transition-colors">
          <div className="text-text-muted text-xs mb-1">Flagged</div>
          <div className="text-2xl font-bold text-orange-400">{stats.flaggedEmails}</div>
        </div>
        <div className="bg-panel p-3 rounded-lg border border-purple-500/10 hover:border-purple-500/30 transition-colors">
          <div className="text-text-muted text-xs mb-1">Attachments</div>
          <div className="text-2xl font-bold text-purple-400">{stats.withAttachments}</div>
        </div>
      </div>

      {/* ── Main 3-Panel Layout ───────────────────────── */}
      <div className="flex-1 flex gap-4 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: Email List Sidebar ────────────────── */}
        <div className="bg-panel rounded-lg p-4 flex flex-col" style={{ width: 380, minWidth: 320 }}>
          {/* Search + Filters */}
          <div className="mb-3 space-y-2 flex-shrink-0">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-background text-text-primary rounded-lg border border-accent-cyan/30 focus:border-accent-cyan outline-none text-sm"
            />
            <div className="flex gap-2">
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="w-1/2 px-2 py-1.5 bg-background text-text-primary rounded-lg border border-accent-cyan/30 outline-none text-xs"
              >
                <option value="all">All Sources</option>
                {sources.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 bg-background text-text-primary rounded-lg border border-accent-cyan/30 outline-none text-xs"
              >
                <option value="all">All Emails</option>
                <option value="flagged">🚩 Flagged</option>
                <option value="attachments">📎 With Attachments</option>
              </select>
            </div>
          </div>

          {/* Email List */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center text-text-muted py-10">
                <div className="text-5xl mb-3">📭</div>
                <div className="font-medium">No emails to display</div>
                <div className="text-sm mt-1 text-text-muted/70">Import an .mbox or .eml file to get started</div>
              </div>
            ) : (
              filtered.map(email => {
                const isSelected = selectedEmail?.id === email.id;
                const hasAtt = parseAttachments(email.attachments_json).length > 0;
                return (
                  <div
                    key={email.id}
                    className={`rounded-r-lg p-2.5 cursor-pointer transition-all border-l-2 ${
                      isSelected
                        ? 'bg-accent-cyan/10 border-l-accent-cyan'
                        : 'border-l-transparent hover:border-l-accent-cyan/30 hover:bg-background/50'
                    }`}
                    onClick={() => selectEmail(email)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className={`text-sm font-medium truncate flex-1 ${isSelected ? 'text-text-primary' : 'text-text-muted'}`}>
                        {email.subject || '(No Subject)'}
                      </h4>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {email.flagged ? <span className="text-sm">🚩</span> : null}
                        {hasAtt ? <span className="text-xs text-purple-400">📎</span> : null}
                      </div>
                    </div>
                    <div className="text-xs text-accent-cyan truncate mt-0.5">{email.from_address}</div>
                    <div className="text-xs text-text-muted/60 mt-0.5">{formatDateStr(email.date_sent)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── CENTER: Email Detail ────────────────────── */}
        <div className="flex-1 bg-panel rounded-lg overflow-y-auto" style={{ minWidth: 0 }}>
          <div className="p-6">
            {!selectedEmail ? (
              <div className="text-center text-text-muted py-20">
                <div className="text-6xl mb-4">📧</div>
                <div className="text-xl font-medium">Select an email to view details</div>
                <div className="text-sm text-text-muted/70 mt-2">Choose from the list on the left</div>
              </div>
            ) : (
              <div>
                {/* Subject + Flag */}
                <div className="flex items-start justify-between mb-4 gap-3">
                  <h2 className="text-xl font-bold text-text-primary flex-1">{selectedEmail.subject || '(No Subject)'}</h2>
                  <button
                    onClick={() => toggleFlag(selectedEmail)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all flex-shrink-0 ${
                      selectedEmail.flagged
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                        : 'bg-background text-text-muted border border-gray-600 hover:border-orange-500'
                    }`}
                  >
                    {selectedEmail.flagged ? '🚩 Flagged' : '⚑ Flag'}
                  </button>
                </div>

                {/* Meta */}
                <div className="space-y-1.5 text-sm mb-4">
                  <div className="flex">
                    <span className="text-text-muted/60 w-16 font-medium">From:</span>
                    <span className="text-accent-cyan">{selectedEmail.from_address}</span>
                  </div>
                  <div className="flex">
                    <span className="text-text-muted/60 w-16 font-medium">To:</span>
                    <span className="text-text-primary">{selectedEmail.to_addresses}</span>
                  </div>
                  {selectedEmail.cc_addresses && (
                    <div className="flex">
                      <span className="text-text-muted/60 w-16 font-medium">CC:</span>
                      <span className="text-text-muted">{selectedEmail.cc_addresses}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-text-muted/60 w-16 font-medium">Date:</span>
                    <span className="text-text-primary">{formatDateStr(selectedEmail.date_sent)}</span>
                  </div>
                  {selectedEmail.source_name && (
                    <div className="flex">
                      <span className="text-text-muted/60 w-16 font-medium">Source:</span>
                      <span className="text-purple-400">{selectedEmail.source_name}</span>
                    </div>
                  )}
                </div>

                {/* Headers Toggle */}
                {selectedEmail.headers_raw && (
                  <>
                    <button
                      onClick={() => setShowHeaders(!showHeaders)}
                      className="text-xs text-accent-cyan hover:text-green-400 mb-3 inline-block"
                    >
                      {showHeaders ? '▼ Hide Headers' : '▶ Show Full Headers'}
                    </button>
                    {showHeaders && (
                      <div className="mb-4 bg-background p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                        {selectedEmail.headers_raw.split('\n').map((line, i) => {
                          const colonIdx = line.indexOf(':');
                          if (colonIdx > 0) {
                            return (
                              <div key={i} className="mb-0.5">
                                <span className="text-accent-cyan">{line.slice(0, colonIdx)}:</span>
                                <span className="text-text-muted">{line.slice(colonIdx + 1)}</span>
                              </div>
                            );
                          }
                          return <div key={i} className="text-text-muted mb-0.5">{line}</div>;
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* IP Analysis */}
                {selOriginIp && (
                  <div className="mb-4 p-3 bg-gradient-to-br from-background to-panel rounded-lg border border-accent-cyan/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                        <span className="text-text-muted text-xs font-semibold uppercase tracking-wide">IP Analysis</span>
                      </div>
                      <button
                        onClick={() => handleIpLookup(selOriginIp.ip_address)}
                        disabled={lookingUpIp}
                        className={`px-2 py-1 text-xs bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50 rounded hover:bg-accent-cyan/30 transition-all ${lookingUpIp ? 'opacity-50' : ''}`}
                      >
                        {lookingUpIp ? '...' : '🌐 Lookup'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-text-muted/60">IP Address</div>
                        <div className="font-mono text-text-primary text-sm">{selOriginIp.ip_address}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted/60">Type</div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          selOriginIp.classification === 'public'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {(selOriginIp.classification || '').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted/60">Confidence</div>
                        <div className="text-sm text-text-primary">{Math.round((selOriginIp.confidence || 0) * 100)}%</div>
                      </div>
                    </div>
                    {/* Geo info */}
                    {ipGeoInfo && (
                      <div className="mt-3 pt-3 border-t border-accent-cyan/20 grid grid-cols-2 gap-2 text-xs">
                        {ipGeoInfo.city && <div><span className="text-text-muted/60">City:</span> <span className="text-text-primary">{ipGeoInfo.city}</span></div>}
                        {ipGeoInfo.region && <div><span className="text-text-muted/60">Region:</span> <span className="text-text-primary">{ipGeoInfo.region}</span></div>}
                        {ipGeoInfo.country && <div><span className="text-text-muted/60">Country:</span> <span className="text-text-primary">{ipGeoInfo.country}</span></div>}
                        {ipGeoInfo.isp && <div><span className="text-text-muted/60">ISP:</span> <span className="text-text-primary">{ipGeoInfo.isp}</span></div>}
                        {ipGeoInfo.org && <div><span className="text-text-muted/60">Org:</span> <span className="text-text-primary">{ipGeoInfo.org}</span></div>}
                        {ipGeoInfo.timezone && <div><span className="text-text-muted/60">Timezone:</span> <span className="text-text-primary">{ipGeoInfo.timezone}</span></div>}
                        {ipGeoInfo.latitude && <div><span className="text-text-muted/60">Coords:</span> <span className="text-text-primary">{ipGeoInfo.latitude}, {ipGeoInfo.longitude}</span></div>}
                        {ipGeoInfo.asn && <div><span className="text-text-muted/60">ASN:</span> <span className="text-text-primary">{ipGeoInfo.asn}</span></div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {selAttachments.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-purple-400 mb-2">📎 Attachments ({selAttachments.length})</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selAttachments.map((att, idx) => (
                        <div key={idx} className="bg-background p-2.5 rounded-lg flex items-center justify-between border border-gray-700/50 hover:border-purple-500/30 transition-colors">
                          <div className="flex-1 min-w-0 mr-2">
                            <div className="text-sm font-medium text-text-primary truncate">{att.filename}</div>
                            <div className="text-xs text-text-muted">{formatBytes(att.size)} · {att.mime_type || 'unknown'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email Body */}
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Message Body</h3>
                  <div className="email-body rounded-lg overflow-hidden">
                    {selectedEmail.body_html ? (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={processHtmlBody(selectedEmail.body_html, selAttachments)}
                        style={{ width: '100%', border: 'none', minHeight: 400, background: '#fff' }}
                        onLoad={e => {
                          const frame = e.target as HTMLIFrameElement;
                          try {
                            if (frame.contentDocument) {
                              frame.style.height = frame.contentDocument.documentElement.scrollHeight + 'px';
                            }
                          } catch {}
                        }}
                      />
                    ) : (
                      <div className="p-4 bg-background text-text-muted prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                        {selectedEmail.body_text || <span className="text-text-muted/50">No content</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Notes Panel ──────────────────────── */}
        {selectedEmail && (
          <div className="bg-panel rounded-lg flex flex-col overflow-hidden" style={{ width: 280, minWidth: 240 }}>
            <div className="p-3 border-b border-accent-cyan/20 flex-shrink-0">
              <h3 className="text-sm font-semibold text-orange-400">📝 Notes</h3>
            </div>
            <div className="p-3 flex-shrink-0">
              <textarea
                rows={3}
                placeholder="Add investigator note..."
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                className="w-full px-3 py-2 bg-background text-text-primary rounded-lg border border-accent-cyan/30 focus:border-orange-400 outline-none text-sm resize-none"
              />
              <button
                onClick={handleAddNote}
                className="mt-1 w-full px-3 py-1.5 rounded-lg text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors font-semibold"
              >
                Add Note
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notes.length === 0 ? (
                <p className="text-text-muted/50 text-xs text-center py-4">No notes yet</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-background/80 rounded-lg p-2.5 border border-orange-500/10 group">
                    <p className="text-sm text-text-muted">{note.content}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-text-muted/50">{formatDateStr(note.created_at)}</span>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
         IMPORT DIALOG
      ═══════════════════════════════════════════════════ */}
      {showImportDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowImportDialog(false); }}
        >
          <div className="bg-panel rounded-xl p-6 max-w-md w-full mx-4 border border-accent-cyan/30">
            <h3 className="text-xl font-bold mb-4 text-accent-cyan">Import Email Data</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Source Name</label>
                <input
                  type="text"
                  placeholder='e.g., Suspect Gmail, Warrant Return'
                  value={importSourceName}
                  onChange={e => setImportSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-background text-text-primary rounded-lg border border-accent-cyan/30 focus:border-accent-cyan outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Select File</label>
                <input
                  type="file"
                  ref={importFileRef}
                  accept=".mbox,.eml,.emlx,.msg"
                  className="w-full px-3 py-2 bg-background text-text-primary rounded-lg border border-accent-cyan/30 text-sm"
                />
                <p className="text-xs text-text-muted/50 mt-1">Supports: .mbox, .eml, .emlx, .msg</p>
              </div>
              {importError && (
                <p className="text-sm text-red-400">{importError}</p>
              )}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => { setShowImportDialog(false); setImportError(null); }}
                  className="px-4 py-2 rounded-lg text-sm bg-background text-text-muted border border-accent-cyan/20 hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 rounded-lg text-sm bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30 transition-colors"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
         REPORT DIALOG
      ═══════════════════════════════════════════════════ */}
      {showReportDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowReportDialog(false); }}
        >
          <div className="bg-panel rounded-xl p-6 max-w-sm w-full mx-4 border border-purple-500/30">
            <h3 className="text-xl font-bold mb-4 text-purple-400">📊 Generate Report</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" id="report-flagged-only" defaultChecked className="w-4 h-4 accent-purple-500" />
                <span className="text-text-muted">Flagged emails only</span>
              </label>
              <p className="text-xs text-text-muted/50">Report includes email headers, body content, IP analysis, and investigator notes.</p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowReportDialog(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-background text-text-muted border border-purple-500/20 hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const flaggedOnly = (document.getElementById('report-flagged-only') as HTMLInputElement)?.checked ?? true;
                    setShowReportDialog(false);
                    const reportEmails = flaggedOnly ? emails.filter(e => e.flagged) : emails;
                    if (reportEmails.length === 0) {
                      alert(flaggedOnly ? 'No flagged emails to report.' : 'No emails to report.');
                      return;
                    }
                    // Build HTML report
                    const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aperture Report</title>
<style>body{font-family:Arial,sans-serif;background:#1a1a2e;color:#e0e0ff;padding:2rem;max-width:900px;margin:0 auto}
h1{background:linear-gradient(90deg,#9d4edd,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem}
.stats{display:flex;gap:1rem;margin:1rem 0}.stat{background:#121a2c;padding:1rem;border-radius:8px;flex:1;text-align:center}
.stat .val{font-size:1.5rem;font-weight:bold;color:#00d4ff}.stat .lbl{font-size:.75rem;color:#94a3c0}
.email-card{background:#121a2c;border-radius:8px;padding:1.5rem;margin:1rem 0;border-left:3px solid #9d4edd}
.email-card.flagged{border-left-color:#f59e0b}.meta{font-size:.85rem;color:#94a3c0;margin:.5rem 0}
.meta span{margin-right:1.5rem}.cyan{color:#00d4ff}.body-content{background:#fff;color:#111;padding:1rem;border-radius:6px;margin-top:1rem}
.notes{background:#1e293b;padding:1rem;border-radius:6px;margin-top:.75rem}.notes h4{color:#f59e0b;margin:0 0 .5rem}
.note-item{padding:.5rem;border-bottom:1px solid #334155;font-size:.85rem}.footer{text-align:center;color:#94a3c0;margin-top:2rem;font-size:.75rem}</style></head>
<body><h1>📧 APERTURE — Email Analysis Report</h1>
<p style="color:#94a3c0">Case: ${esc(caseNumber || String(caseId))} | Generated: ${new Date().toLocaleString()} | ${flaggedOnly ? 'Flagged Only' : 'All Emails'}</p>
<div class="stats">
<div class="stat"><div class="val">${reportEmails.length}</div><div class="lbl">Emails</div></div>
<div class="stat"><div class="val">${reportEmails.filter(e => e.flagged).length}</div><div class="lbl">Flagged</div></div>
<div class="stat"><div class="val">${sources.length}</div><div class="lbl">Sources</div></div>
</div>`;
                    // Load notes for each email
                    for (const email of reportEmails) {
                      let emailNotes: NoteRecord[] = [];
                      if (email.id) {
                        try { emailNotes = await window.electronAPI.getApertureNotes(email.id); } catch {}
                      }
                      const ips = parseIpAddresses(email.ip_addresses);
                      html += `<div class="email-card${email.flagged ? ' flagged' : ''}">
<h3>${email.flagged ? '🚩 ' : ''}${esc(email.subject || '(No Subject)')}</h3>
<div class="meta">
<span>From: <span class="cyan">${esc(email.from_address)}</span></span>
<span>To: ${esc(email.to_addresses)}</span>
<span>Date: ${formatDateStr(email.date_sent)}</span>
${ips.length > 0 ? `<span>IP: <span class="cyan">${ips[0].ip_address}</span> (${ips[0].classification})</span>` : ''}
</div>
<div class="body-content">${email.body_html || (email.body_text || '').replace(/\n/g, '<br>') || '<em>No content</em>'}</div>`;
                      if (emailNotes.length > 0) {
                        html += `<div class="notes"><h4>📝 Investigator Notes (${emailNotes.length})</h4>`;
                        for (const note of emailNotes) {
                          html += `<div class="note-item">${esc(note.content)}<br><small style="color:#94a3c0">${new Date(note.created_at).toLocaleString()}</small></div>`;
                        }
                        html += `</div>`;
                      }
                      html += `</div>`;
                    }
                    html += `<div class="footer">Generated by Aperture I.E.P. — Integrated in P.U.L.S.E.</div></body></html>`;
                    // Open in new window
                    const result = await window.electronAPI.saveApertureReport({
                      caseId,
                      caseNumber: caseNumber || String(caseId),
                      html,
                    });
                    if (result.success) {
                      setReportNotice('Report saved to Evidence tab and case folder.');
                      setTimeout(() => setReportNotice(null), 5000);
                    } else {
                      setReportNotice('Failed to save report.');
                      setTimeout(() => setReportNotice(null), 4000);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:shadow-lg transition-all"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
         REPORT SAVED TOAST
      ═══════════════════════════════════════════════════ */}
      {reportNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-panel border border-green-500/40 rounded-lg px-5 py-4 shadow-2xl flex items-center gap-3 animate-in">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <p className="text-text-primary font-medium text-sm">{reportNotice}</p>
            <p className="text-text-muted text-xs mt-0.5">Check the Evidence tab to view or share.</p>
          </div>
          <button onClick={() => setReportNotice(null)} className="text-text-muted hover:text-text-primary ml-2">✕</button>
        </div>
      )}
    </div>
  );
}
