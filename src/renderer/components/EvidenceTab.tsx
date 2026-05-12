import { useState, useEffect, useMemo } from 'react';
import { UploadProgress } from './UploadProgress';
import { ChatViewer } from './ChatViewer';
import '../styles/evidence.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface EvidenceFile {
  name: string;
  relPath: string;
  size: number;
  mimeType: string;
}

interface Evidence {
  id: number;
  case_id: number;
  description: string;
  file_path: string;
  category: string;
  type: string | null;
  tag: string | null;
  storage_mode: string | null;
  file_count: number | null;
  total_size: number | null;
  files_json: string | null;
  meta_json: string | null;
  uploaded_at: string;
  updated_at: string | null;
}

type EvidenceType =
  | 'digital' | 'document' | 'photo' | 'video' | 'audio' | 'physical'
  | 'forensic' | 'autopsy' | 'toxicology' | 'phone' | 'cellebrite'
  | 'datapilot' | 'meta_warrant' | 'other';

const TYPE_OPTIONS: { value: EvidenceType; label: string; icon: string }[] = [
  { value: 'digital',     label: 'Digital Evidence',    icon: '💾' },
  { value: 'document',    label: 'Document / Report',   icon: '📄' },
  { value: 'photo',       label: 'Photograph',          icon: '📷' },
  { value: 'video',       label: 'Video Recording',     icon: '🎥' },
  { value: 'audio',       label: 'Audio Recording',     icon: '🎵' },
  { value: 'physical',    label: 'Physical Evidence',   icon: '📦' },
  { value: 'forensic',    label: 'Forensic Analysis',   icon: '🔬' },
  { value: 'autopsy',     label: 'Autopsy Report',      icon: '⚕️' },
  { value: 'toxicology',  label: 'Toxicology Report',   icon: '🧪' },
  { value: 'phone',       label: 'Cell Phone Extraction', icon: '📱' },
  { value: 'cellebrite',  label: 'Cellebrite Report',   icon: '📱' },
  { value: 'datapilot',   label: 'Datapilot Extraction', icon: '📲' },
  { value: 'meta_warrant',label: 'Meta Warrant Bundle', icon: '📥' },
  { value: 'other',       label: 'Other',               icon: '📎' },
];

const TYPE_ICON: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.icon]));
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.label]));

interface EvidenceTabProps {
  caseId: number;
  caseNumber: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(n: number | null | undefined): string {
  if (!n || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parseJson<T = any>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function isImage(mime: string)  { return mime?.startsWith('image/'); }
function isVideo(mime: string)  { return mime?.startsWith('video/'); }
function isAudio(mime: string)  { return mime?.startsWith('audio/'); }
function isPdf(mime: string)    { return mime === 'application/pdf'; }
function isHtml(mime: string)   { return mime === 'text/html'; }
function isText(mime: string)   { return mime?.startsWith('text/') || mime === 'application/json' || mime === 'application/xml'; }

// ─── Main component ────────────────────────────────────────────────────────

export const EvidenceTab: React.FC<EvidenceTabProps> = ({ caseId, caseNumber }) => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' } | null>(null);

  // Legacy ChatViewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFilePath, setViewerFilePath] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerEvidenceId, setViewerEvidenceId] = useState(0);

  // Form state
  const [fType, setFType] = useState<EvidenceType>('other');
  const [fTag, setFTag] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fSourcePaths, setFSourcePaths] = useState<string[]>([]);
  const [fStorageMode, setFStorageMode] = useState<'copy' | 'reference'>('copy');
  const [fReferenceFolder, setFReferenceFolder] = useState<string>('');

  // Datapilot picker state
  const [dpScanning, setDpScanning] = useState(false);
  const [dpPreview, setDpPreview] = useState<DatapilotPreview | null>(null);
  const [dpError, setDpError] = useState<string | null>(null);

  useEffect(() => { loadEvidence(); }, [caseId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadEvidence() {
    setLoading(true);
    try {
      const rows = await window.electronAPI.getEvidence(caseId) as Evidence[];
      setEvidence(rows || []);
      // Auto-select first item if nothing selected
      if (rows && rows.length > 0 && selectedId === null) {
        setSelectedId(rows[0].id);
      }
    } catch (e: any) {
      setToast({ msg: `Failed to load evidence: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const selectedEvidence = useMemo(
    () => evidence.find(e => e.id === selectedId) || null,
    [evidence, selectedId]
  );

  // ─── Form actions ────────────────────────────────────────────────────────

  function resetForm() {
    setFType('other');
    setFTag('');
    setFDescription('');
    setFSourcePaths([]);
    setFStorageMode('copy');
    setFReferenceFolder('');
    setEditingId(null);
    setDpScanning(false);
    setDpPreview(null);
    setDpError(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(ev: Evidence) {
    setEditingId(ev.id);
    setFType((ev.type as EvidenceType) || 'other');
    setFTag(ev.tag || '');
    setFDescription(ev.description || '');
    setFSourcePaths([]);
    setFStorageMode((ev.storage_mode as any) || 'copy');
    setFReferenceFolder('');
    setShowForm(true);
  }

  async function pickFiles() {
    try {
      const r = await window.electronAPI.evidencePickFiles({ mode: 'files' });
      if (r.success && r.paths.length > 0) setFSourcePaths(prev => [...prev, ...r.paths]);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
    }
  }

  async function pickReferenceFolder() {
    try {
      const r = await window.electronAPI.evidencePickFiles({ mode: 'folder' });
      if (r.success && r.paths.length > 0) setFReferenceFolder(r.paths[0]);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
    }
  }

  // ─── Datapilot picker ───────────────────────────────────────────────────

  async function pickDatapilotFolder() {
    setDpError(null);
    try {
      const r = await window.electronAPI.evidencePickFiles({ mode: 'folder' });
      if (!r.success || r.paths.length === 0) return;
      const folder = r.paths[0];
      setDpScanning(true);
      const scan = await window.electronAPI.datapilotScan({ folderPath: folder });
      setDpScanning(false);
      if (!scan.success || !scan.preview) {
        setDpPreview(null);
        setDpError(scan.error || 'Folder is not a recognised Datapilot extraction.');
        return;
      }
      setDpPreview(scan.preview);
      // Auto-suggest tag if blank: e.g. "datapilot_<make>_<model>_<date>"
      if (!fTag) {
        const dev = scan.preview.deviceInfo;
        const baseName = folder.split(/[\\/]/).pop() || 'datapilot';
        const tag = dev?.model
          ? `${(dev.make || 'device').replace(/\s+/g, '_')}_${dev.model.replace(/\s+/g, '_')}`
          : baseName;
        setFTag(tag.replace(/[<>:"/\\|?*]/g, '_').slice(0, 64));
      }
      if (!fDescription) {
        const dev = scan.preview.deviceInfo;
        const parts: string[] = [`Datapilot ${scan.preview.format.toUpperCase()} extraction`];
        if (dev?.make || dev?.model) parts.push(`${dev?.make || ''} ${dev?.model || ''}`.trim());
        if (dev?.serial) parts.push(`SN ${dev.serial}`);
        setFDescription(parts.filter(Boolean).join(' — '));
      }
    } catch (e: any) {
      setDpScanning(false);
      setDpError(e?.message || String(e));
    }
  }

  function clearDatapilot() {
    setDpPreview(null);
    setDpError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fType || !fDescription.trim()) {
      setToast({ msg: 'Type and description are required', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const r = await window.electronAPI.evidenceUpdate({
          id: editingId,
          patch: { type: fType, tag: fTag || null, description: fDescription },
        });
        if (!r.success) throw new Error(r.error || 'Update failed');
        setToast({ msg: 'Evidence updated', type: 'info' });
      } else {
        // Datapilot-specific submit shape
        const isDp = fType === 'datapilot' && dpPreview;
        const subdir = isDp ? 'datapilot' : undefined;
        const copySources = isDp
          ? [dpPreview!.folderPath]
          : fSourcePaths;
        const refFolder = isDp
          ? dpPreview!.folderPath
          : fReferenceFolder;

        if (fType === 'datapilot' && !dpPreview) {
          throw new Error('Pick a Datapilot folder first.');
        }

        const r = await window.electronAPI.evidenceSave({
          caseId,
          caseNumber,
          type: fType,
          tag: fTag || null,
          description: fDescription,
          storageMode: fStorageMode,
          sourcePaths: fStorageMode === 'copy' ? copySources : [],
          referenceFolder: fStorageMode === 'reference' ? refFolder : undefined,
          subdir,
          meta: isDp ? { datapilot: dpPreview } : undefined,
        });
        if (!r.success) throw new Error(r.error || 'Save failed');
        setToast({ msg: 'Evidence added', type: 'info' });
        if (r.evidence?.id) setSelectedId(r.evidence.id);
      }
      setShowForm(false);
      resetForm();
      loadEvidence();
    } catch (err: any) {
      setToast({ msg: `Save failed: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev: Evidence) {
    const hasFiles = (ev.storage_mode || 'copy') === 'copy' && ev.file_path;
    const msg = hasFiles
      ? `Delete "${ev.tag || ev.description}" and remove its files from the case folder?`
      : `Delete "${ev.tag || ev.description}"?`;
    if (!window.confirm(msg)) return;
    try {
      const r = await window.electronAPI.evidenceDeleteV2({ id: ev.id, deleteFiles: true });
      if (!r.success) throw new Error(r.error || 'Delete failed');
      if (selectedId === ev.id) setSelectedId(null);
      loadEvidence();
      setToast({ msg: 'Deleted', type: 'info' });
    } catch (e: any) {
      setToast({ msg: `Delete failed: ${e.message}`, type: 'error' });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-text-muted">Loading evidence…</div>;
  }

  return (
    <div className="p-4 h-full">
      <div className="evd-root">
        {/* ── LEFT: header + form + list ──────────────────────────────────── */}
        <div className="evd-left">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <span>🗂️</span> Evidence
              <span className="text-sm font-normal text-text-muted">({evidence.length})</span>
            </h2>
            {!showForm && (
              <button className="evd-btn evd-btn-add" onClick={openAddForm}>
                + Add Evidence
              </button>
            )}
          </div>

          {/* Add/Edit form */}
          {showForm && (
            <form className="evd-form" onSubmit={handleSubmit}>
              <h3 className="text-base font-semibold text-text-primary mb-3">
                {editingId ? 'Edit Evidence' : 'Add New Evidence'}
              </h3>

              <div className="evd-form-row">
                <div>
                  <label className="evd-label">Evidence Type *</label>
                  <select className="evd-select" value={fType} onChange={e => {
                    const next = e.target.value as EvidenceType;
                    setFType(next);
                    if (next !== 'datapilot') clearDatapilot();
                  }} required>
                    {TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.icon}  {o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="evd-label">Evidence ID / Tag</label>
                  <input className="evd-input" type="text" value={fTag} onChange={e => setFTag(e.target.value)} placeholder="e.g. EVID-001" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="evd-label">Description *</label>
                <textarea
                  className="evd-textarea"
                  rows={3}
                  value={fDescription}
                  onChange={e => setFDescription(e.target.value)}
                  placeholder="Describe the evidence, chain of custody, collection details…"
                  required
                />
              </div>

              {!editingId && fType === 'datapilot' && (
                <div className="evd-dp-card" style={{ marginBottom: 12 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="evd-dp-title">📲 Datapilot Extraction</div>
                    {dpPreview && (
                      <button
                        type="button"
                        className="text-xs text-text-muted hover:text-red-400"
                        onClick={clearDatapilot}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  {!dpPreview && !dpScanning && (
                    <>
                      <button type="button" className="evd-uploader" onClick={pickDatapilotFolder}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                        Select Datapilot Folder…
                      </button>
                      <p className="text-xs text-text-muted mt-2">
                        Pick the folder containing <code>dptData.db</code> (DPX) or
                        <code> Summary_CaseAndAcquisitionInformation.csv</code> (legacy CSV).
                      </p>
                    </>
                  )}

                  {dpScanning && (
                    <div className="text-sm text-accent-cyan">⏳ Scanning folder…</div>
                  )}

                  {dpError && !dpScanning && (
                    <div className="p-2 rounded border border-red-500/40 bg-red-500/10 text-xs text-red-300 mt-2">
                      {dpError}
                    </div>
                  )}

                  {dpPreview && (
                    <div className="text-xs text-text-secondary space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="evd-chip" style={{ background: 'rgba(0,200,255,0.1)', borderColor: 'rgba(0,200,255,0.3)' }}>
                          {dpPreview.format === 'dpx' ? 'DPX (SQLite)' : 'CSV (Legacy)'}
                        </span>
                        <span className="text-text-muted">📁 {formatBytes(dpPreview.totalBytes)}</span>
                      </div>
                      <div className="opacity-80 break-all text-text-muted">{dpPreview.folderPath}</div>
                      {dpPreview.deviceInfo && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                          {dpPreview.deviceInfo.make && <div><span className="text-text-muted">Make:</span> {dpPreview.deviceInfo.make}</div>}
                          {dpPreview.deviceInfo.model && <div><span className="text-text-muted">Model:</span> {dpPreview.deviceInfo.model}</div>}
                          {dpPreview.deviceInfo.phoneNumber && <div><span className="text-text-muted">Phone:</span> {dpPreview.deviceInfo.phoneNumber}</div>}
                          {dpPreview.deviceInfo.carrier && <div><span className="text-text-muted">Carrier:</span> {dpPreview.deviceInfo.carrier}</div>}
                          {dpPreview.deviceInfo.serial && <div><span className="text-text-muted">Serial:</span> {dpPreview.deviceInfo.serial}</div>}
                          {dpPreview.deviceInfo.firmware && <div><span className="text-text-muted">OS:</span> {dpPreview.deviceInfo.firmware}</div>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        <span>👥 {dpPreview.counts.contacts} contacts</span>
                        <span>💬 {dpPreview.counts.messages} msgs</span>
                        <span>📞 {dpPreview.counts.calls} calls</span>
                        <span>📷 {dpPreview.counts.photos} photos</span>
                        <span>🎥 {dpPreview.counts.videos} videos</span>
                        <span>📱 {dpPreview.counts.apps} apps</span>
                        <span>📂 {dpPreview.counts.files} files</span>
                      </div>
                      {dpPreview.warnings.length > 0 && (
                        <ul className="text-yellow-300/80 list-disc list-inside mt-1">
                          {dpPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!editingId && fType === 'cellebrite' && (
                <div className="p-3 rounded border border-orange-500/30 bg-orange-500/5 text-xs text-orange-200 mb-3">
                  📱 Cellebrite folder-import flow not yet wired. Use copy mode and pick the Cellebrite folder contents, or use Reference mode.
                </div>
              )}

              {!editingId && (
                <div className="evd-storage-block">
                  <label className="evd-label">Storage Mode</label>
                  <label
                    className={`evd-storage-opt copy ${fStorageMode === 'copy' ? 'selected copy' : ''}`}
                    onClick={() => setFStorageMode('copy')}
                  >
                    <input type="radio" checked={fStorageMode === 'copy'} onChange={() => setFStorageMode('copy')} />
                    <div className="flex-1">
                      <div className="evd-storage-opt-title copy">📦 Copy into Evidence folder <span className="text-xs text-emerald-400 font-normal">(recommended)</span></div>
                      <div className="evd-storage-opt-desc">Files copied into <code>cases/{caseNumber}/evidence/&lt;tag&gt;/</code>. Included in DA exports.</div>
                    </div>
                  </label>
                  <label
                    className={`evd-storage-opt reference ${fStorageMode === 'reference' ? 'selected reference' : ''}`}
                    onClick={() => setFStorageMode('reference')}
                  >
                    <input type="radio" checked={fStorageMode === 'reference'} onChange={() => setFStorageMode('reference')} />
                    <div className="flex-1">
                      <div className="evd-storage-opt-title">🔗 Reference only — do not copy</div>
                      <div className="evd-storage-opt-desc">ICAC stores only the path. Saves time/disk space, but you are responsible for preserving the source folder.</div>
                    </div>
                  </label>
                </div>
              )}

              {/* File picker (copy mode) — hidden for datapilot, which has its own picker */}
              {!editingId && fStorageMode === 'copy' && fType !== 'datapilot' && (
                <div style={{ marginTop: 14 }}>
                  <label className="evd-label">Upload Files</label>
                  <button type="button" className="evd-uploader" onClick={pickFiles}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    Choose Files…
                  </button>
                  {fSourcePaths.length > 0 && (
                    <div className="evd-files-info">
                      <div className="evd-files-info-head">
                        <span className="text-sm font-medium text-accent-cyan">{fSourcePaths.length} file{fSourcePaths.length !== 1 ? 's' : ''} selected</span>
                        <button type="button" className="text-text-muted hover:text-red-400" onClick={() => setFSourcePaths([])}>✕</button>
                      </div>
                      <div className="evd-files-list">
                        {fSourcePaths.map((p, i) => (
                          <div key={i} className="evd-files-list-item">
                            <span title={p} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.split(/[\\/]/).pop()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-2">✓ All formats supported. Files preserved in original format.</p>
                </div>
              )}

              {/* Folder picker (reference mode) — hidden for datapilot */}
              {!editingId && fStorageMode === 'reference' && fType !== 'datapilot' && (
                <div style={{ marginTop: 14 }}>
                  <label className="evd-label">Reference Folder</label>
                  <button type="button" className="evd-uploader" onClick={pickReferenceFolder}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    Select Folder…
                  </button>
                  {fReferenceFolder && (
                    <div className="evd-ref-warning">
                      <strong className="text-yellow-300 block mb-1">⚠️ Reference-only mode</strong>
                      ICAC will NOT store these files. The data stays at:
                      <code className="block mt-1 break-all">{fReferenceFolder}</code>
                      If that folder is moved, deleted, or unplugged (USB), DA exports will fail.
                    </div>
                  )}
                </div>
              )}

              <div className="evd-form-actions">
                <button type="button" className="evd-btn evd-btn-cancel" onClick={() => { setShowForm(false); resetForm(); }} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="evd-btn evd-btn-save" disabled={saving}>
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Save Evidence')}
                </button>
              </div>
            </form>
          )}

          {/* Forensic Integrity tip */}
          {!showForm && evidence.length > 0 && (
            <div className="p-2.5 rounded border border-accent-cyan/30 bg-accent-cyan/5 text-xs text-text-muted mb-2">
              <span className="text-accent-cyan font-medium">Forensic Integrity:</span>{' '}
              Files preserved in original format. Folder: <code>cases/{caseNumber}/evidence/</code>
            </div>
          )}

          {/* List */}
          <div className="evd-list">
            {evidence.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <div className="text-5xl mb-3 opacity-50">📭</div>
                <p className="font-medium text-text-secondary mb-1">No Evidence</p>
                <p className="text-xs">Add evidence to begin</p>
              </div>
            ) : (
              evidence.map(item => {
                const icon = TYPE_ICON[item.type || 'other'] || '📎';
                const isRef = (item.storage_mode || 'copy') === 'reference';
                const fc = item.file_count || 0;
                return (
                  <div
                    key={item.id}
                    className={`evd-card ${selectedId === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="evd-card-row">
                      <div className="evd-icon-wrap">{icon}</div>
                      <div className="evd-card-body">
                        <div className="evd-card-title">{item.tag || item.description || `Evidence #${item.id}`}</div>
                        <div className="evd-card-sub">{TYPE_LABEL[item.type || 'other'] || item.category}</div>
                      </div>
                      <div className="evd-card-actions">
                        <button
                          className="evd-icon-btn"
                          title="Edit"
                          onClick={(e) => { e.stopPropagation(); openEditForm(item); }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button
                          className="evd-icon-btn danger"
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="evd-card-foot">
                      {fc > 0 && <span>📁 {fc} file{fc !== 1 ? 's' : ''}{item.total_size ? ` · ${formatBytes(item.total_size)}` : ''}</span>}
                      {isRef && <span className="evd-chip evd-chip-ref">⚠️ Reference only</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: viewer ────────────────────────────────────────────────── */}
        <div className="evd-right">
          <EvidenceViewer
            evidence={selectedEvidence}
            caseNumber={caseNumber}
            onOpenChatViewer={(filePath, title, evId) => {
              setViewerFilePath(filePath);
              setViewerTitle(title);
              setViewerEvidenceId(evId);
              setViewerOpen(true);
            }}
            onToast={(msg, type) => setToast({ msg, type })}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-sm z-50 ${
            toast.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/40' : 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <UploadProgress isVisible={saving} />

      {viewerOpen && (
        <ChatViewer
          filePath={viewerFilePath}
          title={viewerTitle}
          evidenceId={viewerEvidenceId}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Viewer (right pane) ───────────────────────────────────────────────────

interface EvidenceViewerProps {
  evidence: Evidence | null;
  caseNumber: string;
  onOpenChatViewer: (filePath: string, title: string, evId: number) => void;
  onToast: (msg: string, type: 'info' | 'error') => void;
}

function EvidenceViewer({ evidence, caseNumber: _caseNumber, onOpenChatViewer, onToast }: EvidenceViewerProps) {
  const [activeFile, setActiveFile] = useState<EvidenceFile | null>(null);
  const [filePreview, setFilePreview] = useState<{ dataUrl?: string; text?: string; mimeType?: string; size?: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const files: EvidenceFile[] = useMemo(() => {
    if (!evidence) return [];
    return parseJson<EvidenceFile[]>(evidence.files_json, []);
  }, [evidence]);

  const meta = useMemo(() => parseJson<any>(evidence?.meta_json, {}), [evidence]);

  // Reset preview when evidence changes
  useEffect(() => {
    setActiveFile(null);
    setFilePreview(null);
    setPreviewError(null);
  }, [evidence?.id]);

  // Auto-preview the first image/pdf/html file
  useEffect(() => {
    if (!evidence || files.length === 0) return;
    const auto = files.find(f =>
      isImage(f.mimeType) || isPdf(f.mimeType) || isHtml(f.mimeType)
    );
    if (auto && !activeFile) {
      void openFile(auto);
    }
  }, [evidence?.id, files]);

  async function openFile(f: EvidenceFile) {
    if (!evidence) return;
    setActiveFile(f);
    setPreviewError(null);
    setFilePreview(null);
    setPreviewing(true);
    try {
      const asText = isHtml(f.mimeType) || isText(f.mimeType);
      const r = await window.electronAPI.evidenceReadFile({ id: evidence.id, relPath: f.relPath, asText });
      if (!r.success) {
        setPreviewError(r.error || 'Failed to read file');
        return;
      }
      setFilePreview({ dataUrl: r.dataUrl, text: r.text, mimeType: r.mimeType, size: r.size });
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function openExternally(f: EvidenceFile) {
    if (!evidence) return;
    const r = await window.electronAPI.evidenceOpenFile({ id: evidence.id, relPath: f.relPath });
    if (!r.success) onToast(r.error || 'Failed to open file', 'error');
  }

  async function revealFolder() {
    if (!evidence) return;
    const r = await window.electronAPI.evidenceRevealFolder({ id: evidence.id });
    if (!r.success) onToast(r.error || 'Failed to open folder', 'error');
  }

  // ─── Empty state ──────────────────────────────────────────────────────
  if (!evidence) {
    return (
      <>
        <div className="evd-viewer-head">
          <div className="evd-viewer-title">Evidence Viewer</div>
          <div className="evd-viewer-sub">Select evidence from the list to view details</div>
        </div>
        <div className="evd-viewer-body">
          <div className="evd-viewer-empty">
            <div>
              <div className="text-5xl mb-3 opacity-40">👁️</div>
              <p className="text-base">No evidence selected</p>
              <p className="text-xs mt-1">Click any evidence item on the left</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const icon = TYPE_ICON[evidence.type || 'other'] || '📎';
  const isRef = (evidence.storage_mode || 'copy') === 'reference';
  const isMetaBundle = evidence.type === 'meta_warrant';
  const isDatapilot = evidence.type === 'datapilot';

  // Legacy chat: route to ChatViewer modal
  const isLegacyChat = !evidence.type && evidence.category === 'Chat (SingleFile)';

  return (
    <>
      <div className="evd-viewer-head">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="evd-viewer-title truncate">
              <span style={{ marginRight: 6 }}>{icon}</span>{evidence.tag || evidence.description || `Evidence #${evidence.id}`}
            </div>
            <div className="evd-viewer-sub">
              {TYPE_LABEL[evidence.type || 'other'] || evidence.category}
              {evidence.file_count ? ` · ${evidence.file_count} file${evidence.file_count !== 1 ? 's' : ''}` : ''}
              {evidence.total_size ? ` · ${formatBytes(evidence.total_size)}` : ''}
              {isRef && <span className="ml-2 evd-chip evd-chip-ref">⚠️ Reference only</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {!isRef && evidence.file_path && (
              <button className="evd-btn evd-btn-cancel text-xs" onClick={revealFolder} title="Reveal in Explorer">
                📂 Reveal
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="evd-viewer-body">
        {/* Description */}
        {evidence.description && evidence.tag && (
          <div className="mb-4 p-3 rounded border border-white/5 bg-white/[0.02] text-sm text-text-secondary whitespace-pre-wrap">
            {evidence.description}
          </div>
        )}

        {/* Legacy chat shortcut */}
        {isLegacyChat && evidence.file_path && (
          <div className="mb-4">
            <button
              className="evd-btn evd-btn-save"
              onClick={() => onOpenChatViewer(evidence.file_path, evidence.description || 'Chat', evidence.id)}
            >
              💬 Open in Chat Viewer (legacy)
            </button>
          </div>
        )}

        {/* Datapilot detail card */}
        {isDatapilot && (() => {
          const dp: any = (meta && meta.datapilot) ? meta.datapilot : meta || {};
          const dev = dp.deviceInfo || {};
          const c = dp.counts || dp.stats || {};
          return (
          <div className="evd-dp-card">
            <div className="evd-dp-title">📲 Datapilot Extraction</div>
            <div className="evd-dp-row"><div className="evd-dp-key">Format</div><div className="evd-dp-val">{(dp.format || '—').toString().toUpperCase()}</div></div>
            <div className="evd-dp-row"><div className="evd-dp-key">Make / Model</div><div className="evd-dp-val">{[dev.make, dev.model].filter(Boolean).join(' ') || '—'}</div></div>
            <div className="evd-dp-row"><div className="evd-dp-key">Phone</div><div className="evd-dp-val">{dev.phoneNumber || '—'}</div></div>
            <div className="evd-dp-row"><div className="evd-dp-key">Carrier</div><div className="evd-dp-val">{dev.carrier || '—'}</div></div>
            <div className="evd-dp-row"><div className="evd-dp-key">Serial / IMEI</div><div className="evd-dp-val">{dev.serial || '—'}</div></div>
            <div className="evd-dp-row"><div className="evd-dp-key">Firmware / OS</div><div className="evd-dp-val">{dev.firmware || '—'}</div></div>
            {dp.folderPath && (
              <div className="evd-dp-row"><div className="evd-dp-key">Source</div><div className="evd-dp-val truncate" title={dp.folderPath}>{dp.folderPath}</div></div>
            )}
            <div className="evd-dp-stats">
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{c.contacts || 0}</div><div className="evd-dp-stat-label">Contacts</div></div>
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{c.messages || 0}</div><div className="evd-dp-stat-label">Messages</div></div>
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{c.calls || 0}</div><div className="evd-dp-stat-label">Calls</div></div>
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{(c.photos || 0) + (c.videos || 0) || c.media || 0}</div><div className="evd-dp-stat-label">Media</div></div>
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{c.apps || 0}</div><div className="evd-dp-stat-label">Apps</div></div>
              <div className="evd-dp-stat-tile"><div className="evd-dp-stat-num">{c.files || 0}</div><div className="evd-dp-stat-label">Files</div></div>
            </div>
          </div>
          );
        })()}

        {/* Meta bundle iframe */}
        {isMetaBundle && evidence.file_path && (
          <MetaBundleInlinePreview evidence={evidence} files={files} />
        )}

        {/* File list */}
        {!isMetaBundle && files.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-text-secondary mb-2">Files ({files.length})</h4>
            <div className="evd-files-grid mb-4">
              {files.map((f, i) => {
                const isSelected = activeFile?.relPath === f.relPath;
                const fileIcon =
                  isImage(f.mimeType) ? '🖼️' :
                  isVideo(f.mimeType) ? '🎬' :
                  isAudio(f.mimeType) ? '🎵' :
                  isPdf(f.mimeType)   ? '📄' :
                  isHtml(f.mimeType)  ? '🌐' :
                  isText(f.mimeType)  ? '📝' : '📎';
                return (
                  <div
                    key={i}
                    className={`evd-file-tile ${isSelected ? 'ring-1 ring-accent-cyan' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openFile(f)}
                  >
                    <div className="evd-file-icon">{fileIcon}</div>
                    <div className="evd-file-info">
                      <div className="evd-file-name" title={f.name}>{f.name}</div>
                      <div className="evd-file-meta">{formatBytes(f.size)}</div>
                    </div>
                    <div className="evd-file-actions">
                      <button
                        className="evd-icon-btn"
                        title="Open externally"
                        onClick={(e) => { e.stopPropagation(); openExternally(f); }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Inline preview */}
        {activeFile && (
          <div className="mt-4 p-4 rounded border border-white/5 bg-black/20">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-secondary truncate" title={activeFile.name}>
                Preview · <span className="text-text-primary">{activeFile.name}</span>
              </div>
              <button className="evd-btn evd-btn-cancel text-xs" onClick={() => openExternally(activeFile)}>
                ↗ Open externally
              </button>
            </div>
            {previewing && <div className="text-text-muted text-sm">Loading…</div>}
            {previewError && <div className="text-red-300 text-sm">{previewError}</div>}
            {!previewing && !previewError && filePreview && (
              <>
                {isImage(filePreview.mimeType || '') && filePreview.dataUrl && (
                  <img src={filePreview.dataUrl} alt={activeFile.name} className="evd-preview-img" />
                )}
                {isVideo(filePreview.mimeType || '') && filePreview.dataUrl && (
                  <video src={filePreview.dataUrl} controls className="evd-preview-video" />
                )}
                {isAudio(filePreview.mimeType || '') && filePreview.dataUrl && (
                  <audio src={filePreview.dataUrl} controls className="w-full" />
                )}
                {isPdf(filePreview.mimeType || '') && filePreview.dataUrl && (
                  <iframe src={filePreview.dataUrl} className="evd-preview-iframe" title={activeFile.name} />
                )}
                {isHtml(filePreview.mimeType || '') && filePreview.text && (
                  <iframe
                    srcDoc={filePreview.text}
                    className="evd-preview-iframe"
                    sandbox="allow-same-origin"
                    title={activeFile.name}
                  />
                )}
                {isText(filePreview.mimeType || '') && !isHtml(filePreview.mimeType || '') && filePreview.text && (
                  <pre className="text-xs text-text-secondary bg-black/40 p-3 rounded max-h-96 overflow-auto whitespace-pre-wrap">{filePreview.text}</pre>
                )}
                {!isImage(filePreview.mimeType || '') &&
                 !isVideo(filePreview.mimeType || '') &&
                 !isAudio(filePreview.mimeType || '') &&
                 !isPdf(filePreview.mimeType || '') &&
                 !isHtml(filePreview.mimeType || '') &&
                 !isText(filePreview.mimeType || '') && (
                  <div className="text-text-muted text-sm">No inline preview for {filePreview.mimeType}. Use "Open externally".</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Empty: no files (description-only legacy row) */}
        {files.length === 0 && !isMetaBundle && (
          <div className="mt-2">
            {evidence.file_path && (
              <div className="p-3 rounded border border-white/5 bg-white/[0.02] text-sm">
                <div className="text-text-muted text-xs mb-1">Legacy file path</div>
                <div className="text-text-primary text-sm truncate" title={evidence.file_path}>{evidence.file_path}</div>
                {!isLegacyChat && (
                  <button
                    className="evd-btn evd-btn-cancel text-xs mt-2"
                    onClick={async () => {
                      const r = await window.electronAPI.evidenceOpenFile({ id: evidence.id, relPath: evidence.file_path });
                      if (!r.success) onToast(r.error || 'Open failed', 'error');
                    }}
                  >
                    ↗ Open file
                  </button>
                )}
              </div>
            )}
            {!evidence.file_path && (
              <div className="text-text-muted text-sm py-8 text-center">No files attached to this evidence record.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Meta bundle inline preview ────────────────────────────────────────────

function MetaBundleInlinePreview({ evidence, files }: { evidence: Evidence; files: EvidenceFile[] }) {
  const [htmlText, setHtmlText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const htmlFile = files.find(f => f.mimeType === 'text/html') ||
                     // Fallback: assume the evidence.file_path itself is the .html
                     null;
    const relPath = htmlFile?.relPath || evidence.file_path;
    if (!relPath) { setError('No HTML file in this bundle'); return; }
    void (async () => {
      try {
        const r = await window.electronAPI.evidenceReadFile({ id: evidence.id, relPath, asText: true, maxBytes: 100 * 1024 * 1024 });
        if (!r.success) { setError(r.error || 'Failed to read bundle'); return; }
        setHtmlText(r.text || '');
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [evidence.id]);

  if (error) return <div className="text-red-300 text-sm">{error}</div>;
  if (!htmlText) return <div className="text-text-muted text-sm">Loading bundle…</div>;
  return (
    <iframe
      srcDoc={htmlText}
      className="evd-preview-iframe"
      sandbox="allow-same-origin"
      title="Meta Warrant Bundle"
      style={{ height: 'calc(100vh - 240px)' }}
    />
  );
}
