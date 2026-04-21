import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Manifest {
  version: string;
  export_date: string;
  offender_count: number;
  app_version: string;
  export_type: string;
}

interface Offender {
  id: number;
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  jurisdiction: string | null;
  dob: string;
  sex: string;
  race: string;
  height_ft: number;
  height_in: number;
  weight: number;
  hair_color: string;
  eye_color: string;
  scars_marks_tattoos: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  employer: string;
  employer_address: string;
  is_homeless: boolean;
  is_visiting: boolean;
  advised_departure_date: string | null;
  status: string;
  inactive_reason: string | null;
  tier_status: string;
  on_supervision: boolean;
  static_99_score: number | null;
  stable_2007_score: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  _profilePhotoDataUrl?: string | null;
  _residencePhotoDataUrl?: string | null;
}

interface Conviction {
  id: number;
  offender_id: number;
  conviction_date: string;
  offenses: string;
  tier_status: string;
  created_at: string;
}

interface ComplianceCheck {
  id: number;
  offender_id: number;
  check_date: string;
  officer_name: string | null;
  in_compliance: boolean;
  notes: string;
  document_path: string | null;
  sweep_id: string | null;
  created_at: string;
}

interface RegistrationEvent {
  id: number;
  offender_id: number;
  registration_date: string;
  registering_officer: string;
  in_compliance: boolean;
  notes: string;
  document_path: string | null;
  next_registration_date: string | null;
  created_at: string;
}

interface OfficerNote {
  id: number;
  offender_id: number;
  note_text: string;
  officer_name: string;
  document_path: string | null;
  created_at: string;
}

interface OversightData {
  manifest: Manifest;
  offenders: Offender[];
  convictions: Conviction[];
  compliance_checks: ComplianceCheck[];
  registration_events: RegistrationEvent[];
  officer_notes: OfficerNote[];
  supervision: Array<any>;
  vehicles: Array<any>;
  drug_tests: Array<any>;
  polygraph_tests: Array<any>;
}

interface ImportResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  fileName?: string;
  data?: OversightData;
  photoData?: Record<string, string>;
}

interface PreviousImport {
  fileName: string;
  importDate: string;
  offenderName: string;
}

type TabId = 'convictions' | 'compliance' | 'registrations' | 'notes';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function tierColor(tier: string): string {
  const t = tier.toLowerCase();
  if (t === 'svp') return 'bg-red-600 text-white';
  if (t.includes('3')) return 'bg-orange-600 text-white';
  if (t.includes('2')) return 'bg-amber-600 text-white';
  if (t.includes('1')) return 'bg-yellow-500 text-black';
  return 'bg-gray-600 text-gray-200';
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active') return 'bg-green-600 text-white';
  if (s === 'visiting') return 'bg-blue-600 text-white';
  if (s === 'inactive') return 'bg-gray-600 text-gray-300';
  return 'bg-gray-600 text-gray-200';
}

function static99Color(score: number): string {
  if (score <= 1) return 'bg-green-600 text-white';
  if (score <= 3) return 'bg-amber-600 text-white';
  if (score <= 5) return 'bg-orange-600 text-white';
  return 'bg-red-600 text-white';
}

function static99Label(score: number): string {
  if (score <= 1) return 'Low';
  if (score <= 3) return 'Moderate-Low';
  if (score <= 5) return 'Moderate-High';
  return 'High';
}

function stable2007Color(score: number): string {
  if (score <= 3) return 'bg-green-600 text-white';
  if (score <= 7) return 'bg-amber-600 text-white';
  return 'bg-red-600 text-white';
}

function stable2007Label(score: number): string {
  if (score <= 3) return 'Low';
  if (score <= 7) return 'Moderate';
  return 'High';
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function loadPreviousImports(caseId?: number): PreviousImport[] {
  try {
    const key = caseId ? `oversight_imports_${caseId}` : 'oversight_imports';
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveImport(entry: PreviousImport, caseId?: number) {
  const key = caseId ? `oversight_imports_${caseId}` : 'oversight_imports';
  const existing = loadPreviousImports(caseId);
  const updated = [entry, ...existing.filter(e => e.fileName !== entry.fileName)].slice(0, 20);
  localStorage.setItem(key, JSON.stringify(updated));
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

function FileUploadIcon() {
  return (
    <svg className="w-16 h-16 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function UserSilhouette() {
  return (
    <div className="w-28 h-28 rounded-xl bg-gray-700 flex items-center justify-center border border-cyan-500/20">
      <svg className="w-14 h-14 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface OversightTabProps {
  caseId: number;
  caseNumber?: string;
}

export function OversightTab({ caseId, caseNumber }: OversightTabProps) {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('convictions');
  const [selectedOffenderIdx, setSelectedOffenderIdx] = useState(0);
  const [previousImports, setPreviousImports] = useState<PreviousImport[]>([]);

  // Auto-load saved oversight data on mount
  useEffect(() => {
    setPreviousImports(loadPreviousImports(caseId));
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const saved = await window.electronAPI.loadOversightData(caseId);
        if (!cancelled && saved.success && saved.data) {
          setImportResult(saved.data);
        }
      } catch { /* no saved data */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: ImportResult = await window.electronAPI.importOversightFile();
      if (result.canceled) {
        setLoading(false);
        return;
      }
      if (!result.success) {
        setError(result.error || 'Import failed');
        setLoading(false);
        return;
      }
      setImportResult(result);
      setSelectedOffenderIdx(0);
      // Persist to disk
      await window.electronAPI.saveOversightData(caseId, result);
      if (result.data && result.fileName) {
        const offenderName = result.data.offenders[0]?.full_name || 'Unknown';
        saveImport({
          fileName: result.fileName,
          importDate: new Date().toISOString(),
          offenderName,
        }, caseId);
        setPreviousImports(loadPreviousImports(caseId));
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportAnother = () => {
    setImportResult(null);
    setError(null);
    setActiveTab('convictions');
  };

  // ── Landing State ────────────────────────────────────────────────────────

  if (loading && !importResult?.data) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <Spinner />
          <p className="text-gray-400 text-sm mt-3">Loading oversight data…</p>
        </div>
      </div>
    );
  }

  if (!importResult?.data) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-10 max-w-lg w-full text-center">
            <div className="flex justify-center mb-5">
              <FileUploadIcon />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Import Oversight File</h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Import a <span className="text-cyan-400 font-mono">.oversight</span> file from the Project Oversight sex offender management system to view offender data, compliance history, and registration events.
            </p>

            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Spinner />
                <p className="text-gray-400 text-sm">Importing file…</p>
              </div>
            ) : (
              <button
                onClick={handleImport}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Import .oversight File
              </button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Previous Imports */}
          {previousImports.length > 0 && (
            <div className="mt-8 max-w-lg w-full">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Previously Imported</h2>
              <div className="space-y-2">
                {previousImports.map((imp, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 border border-cyan-500/10 rounded-lg px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{imp.offenderName}</p>
                      <p className="text-gray-500 text-xs">{imp.fileName}</p>
                    </div>
                    <p className="text-gray-500 text-xs">{formatDate(imp.importDate)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard State ──────────────────────────────────────────────────────

  const { data, fileName } = importResult;
  const offender = data.offenders[selectedOffenderIdx];
  const offenderConvictions = data.convictions.filter(c => c.offender_id === offender.id);
  const offenderCompliance = data.compliance_checks.filter(c => c.offender_id === offender.id);
  const offenderRegistrations = data.registration_events.filter(r => r.offender_id === offender.id);
  const offenderNotes = data.officer_notes
    .filter(n => n.offender_id === offender.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const offenderVehicles = data.vehicles?.filter((v: any) => v.offender_id === offender.id) || [];
  const offenderSupervision = data.supervision?.filter((s: any) => s.offender_id === offender.id) || [];

  const compliantCount = offenderCompliance.filter(c => c.in_compliance).length;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'convictions', label: 'Convictions', count: offenderConvictions.length },
    { id: 'compliance', label: 'Compliance', count: offenderCompliance.length },
    { id: 'registrations', label: 'Registrations', count: offenderRegistrations.length },
    { id: 'notes', label: 'Notes', count: offenderNotes.length },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{fileName}</h1>
          <p className="text-gray-500 text-sm">
            Imported {formatDate(new Date().toISOString())} · {data.manifest.offender_count} offender{data.manifest.offender_count !== 1 ? 's' : ''} · v{data.manifest.version}
          </p>
        </div>
        <button
          onClick={handleImportAnother}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          Import Another
        </button>
      </div>

      {/* Offender Selector (if multiple) */}
      {data.offenders.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {data.offenders.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setSelectedOffenderIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                i === selectedOffenderIdx
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {o.full_name}
            </button>
          ))}
        </div>
      )}

      {/* ── Offender Profile Card ─────────────────────────────────────────── */}
      <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-6 mb-6">

        {/* Row 1: Photo + Identity + Physical + Risk Scores */}
        <div className="flex gap-5 items-start">
          {/* Profile Photo */}
          {offender._profilePhotoDataUrl ? (
            <img
              src={offender._profilePhotoDataUrl}
              alt={offender.full_name}
              className="w-28 h-28 rounded-xl object-cover border border-cyan-500/20 flex-shrink-0"
            />
          ) : (
            <UserSilhouette />
          )}

          {/* Identity + Demographics */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{offender.full_name}</h2>
            <p className="text-gray-400 text-sm mt-1">
              DOB: {formatDate(offender.dob)} <span className="text-gray-500">(Age {calculateAge(offender.dob)})</span>
            </p>
            {(offender.sex || offender.race) && (
              <p className="text-gray-400 text-sm">
                {offender.sex && <>Sex: <span className="text-gray-300">{offender.sex}</span></>}
                {offender.sex && offender.race && ' · '}
                {offender.race && <>Race: <span className="text-gray-300">{offender.race}</span></>}
              </p>
            )}
            {offender.jurisdiction && (
              <p className="text-gray-400 text-sm">Jurisdiction: <span className="text-gray-300">{offender.jurisdiction}</span></p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${tierColor(offender.tier_status)}`}>
                {offender.tier_status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(offender.status)}`}>
                {offender.status}
              </span>
              {offender.on_supervision && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white">On Supervision</span>
              )}
              {!offender.on_supervision && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-600 text-gray-300">Not on Supervision</span>
              )}
              {offender.is_homeless && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-600 text-gray-200">Homeless</span>
              )}
              {offender.is_visiting && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">Visiting</span>
              )}
            </div>

            {offender.is_visiting && offender.advised_departure_date && (
              <p className="text-blue-400 text-sm mt-1">Advised Departure: {formatDate(offender.advised_departure_date)}</p>
            )}
            {offender.status.toLowerCase() === 'inactive' && offender.inactive_reason && (
              <p className="text-gray-500 text-sm mt-1">Reason: {offender.inactive_reason}</p>
            )}
          </div>
        </div>

        {/* Row 2: Detail grid — Physical, Risk, Contact, Employer, Supervision, Convictions */}
        <div className="mt-5 pt-5 border-t border-gray-700 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          {/* Physical Description */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Physical Description</p>
            {(offender.height_ft > 0 || offender.height_in > 0) && (
              <p className="text-gray-300">Height: {offender.height_ft}'{offender.height_in}"</p>
            )}
            {offender.weight > 0 && <p className="text-gray-300">Weight: {offender.weight} lbs</p>}
            {offender.hair_color && <p className="text-gray-300">Hair: {offender.hair_color}</p>}
            {offender.eye_color && <p className="text-gray-300">Eyes: {offender.eye_color}</p>}
            {offender.scars_marks_tattoos && (
              <p className="text-gray-300 mt-1">SMT: {offender.scars_marks_tattoos}</p>
            )}
          </div>

          {/* Risk Scores */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Risk Assessment</p>
            {offender.static_99_score !== null && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400 text-xs w-20">Static-99:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${static99Color(offender.static_99_score)}`}>
                  {offender.static_99_score}
                </span>
                <span className="text-gray-500 text-xs">{static99Label(offender.static_99_score)}</span>
              </div>
            )}
            {offender.stable_2007_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-20">STABLE-2007:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stable2007Color(offender.stable_2007_score)}`}>
                  {offender.stable_2007_score}
                </span>
                <span className="text-gray-500 text-xs">{stable2007Label(offender.stable_2007_score)}</span>
              </div>
            )}
            {offender.static_99_score === null && offender.stable_2007_score === null && (
              <p className="text-gray-500">No scores</p>
            )}
          </div>

          {/* Contact */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Contact</p>
            {offender.phone ? <p className="text-gray-300">{offender.phone}</p> : null}
            {offender.email ? <p className="text-gray-300">{offender.email}</p> : null}
            {!offender.phone && !offender.email && <p className="text-gray-500">Not listed</p>}
          </div>

          {/* Employer */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Employer</p>
            {offender.employer ? (
              <>
                <p className="text-gray-300">{offender.employer}</p>
                {offender.employer_address && <p className="text-gray-300">{offender.employer_address}</p>}
              </>
            ) : (
              <p className="text-gray-500">Not listed</p>
            )}
          </div>

          {/* Supervision */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Supervision</p>
            {offenderSupervision.length > 0 ? (
              offenderSupervision.map((s: any, i: number) => (
                <div key={i} className="text-gray-300">
                  {s.officer_name && <p>Officer: {s.officer_name}</p>}
                  {s.supervision_type && <p>Type: {s.supervision_type}</p>}
                  {s.start_date && <p>Start: {formatDate(s.start_date)}</p>}
                  {s.end_date && <p>End: {formatDate(s.end_date)}</p>}
                </div>
              ))
            ) : (
              <p className="text-gray-500">{offender.on_supervision ? 'Details not available' : 'Not on supervision'}</p>
            )}
          </div>

          {/* Convictions (inline summary) */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Convictions</p>
            {offenderConvictions.length > 0 ? (
              offenderConvictions.map(c => (
                <div key={c.id} className="mb-1">
                  <p className="text-gray-300 text-xs">{c.offenses}</p>
                  {c.conviction_date && <p className="text-gray-500 text-xs">{formatDate(c.conviction_date)}</p>}
                </div>
              ))
            ) : (
              <p className="text-gray-500">None listed</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Residence & Vehicle Cards (side by side) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Residence Card */}
        <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Residence</p>
          <div className="text-sm mb-3">
            {offender.address ? (
              <>
                <p className="text-gray-300">{offender.address}</p>
                <p className="text-gray-300">{offender.city}, {offender.state} {offender.zip}</p>
              </>
            ) : (
              <p className="text-gray-500">Address not listed</p>
            )}
          </div>
          {offender._residencePhotoDataUrl ? (
            <div className="bg-gray-900 border border-cyan-500/10 rounded-lg overflow-hidden">
              <img
                src={offender._residencePhotoDataUrl}
                alt="Residence"
                className="w-full max-h-52 object-cover"
              />
            </div>
          ) : (
            <div className="bg-gray-900 border border-cyan-500/10 rounded-lg h-36 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
          )}
        </div>

        {/* Vehicle Card */}
        <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Vehicle</p>
          {offenderVehicles.length > 0 ? (
            offenderVehicles.map((v: any, i: number) => (
              <div key={i} className={`${i > 0 ? 'mt-4 pt-4 border-t border-gray-700' : ''}`}>
                <div className="text-sm mb-3">
                  <p className="text-gray-300 font-medium">
                    {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                  </p>
                  {v.color && <p className="text-gray-400">Color: {v.color}</p>}
                  {v.license_plate && (
                    <p className="text-gray-400">Plate: {v.license_plate}{v.plate_state ? ` (${v.plate_state})` : ''}</p>
                  )}
                  {v.vin && <p className="text-gray-400">VIN: {v.vin}</p>}
                </div>
                {v._vehiclePhotoDataUrl ? (
                  <div className="bg-gray-900 border border-cyan-500/10 rounded-lg overflow-hidden">
                    <img
                      src={v._vehiclePhotoDataUrl}
                      alt="Vehicle"
                      className="w-full max-h-52 object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-cyan-500/10 rounded-lg h-36 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875M3.375 14.25V6.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.375m-12 4.5h12m0 0l1.5-5.625h3.375c.621 0 1.125.504 1.125 1.125v4.5" />
                    </svg>
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-3">No vehicles listed</p>
              <div className="bg-gray-900 border border-cyan-500/10 rounded-lg h-36 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875M3.375 14.25V6.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.375m-12 4.5h12m0 0l1.5-5.625h3.375c.621 0 1.125.504 1.125 1.125v4.5" />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-700 mb-4">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === tab.id
                  ? 'text-cyan-400 bg-gray-800/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-700 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}

      {/* Convictions */}
      {activeTab === 'convictions' && (
        offenderConvictions.length === 0 ? (
          <EmptyState message="No conviction records found for this offender." />
        ) : (
          <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Offenses</th>
                  <th className="text-left px-4 py-3">Tier Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {offenderConvictions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(c.conviction_date)}</td>
                    <td className="px-4 py-3 text-gray-300">{c.offenses}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierColor(c.tier_status)}`}>
                        {c.tier_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Compliance Checks */}
      {activeTab === 'compliance' && (
        offenderCompliance.length === 0 ? (
          <EmptyState message="No compliance check records found for this offender." />
        ) : (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {compliantCount} of {offenderCompliance.length} checks compliant
              </span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden max-w-xs">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(compliantCount / offenderCompliance.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Officer</th>
                    <th className="text-left px-4 py-3">Compliant</th>
                    <th className="text-left px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {offenderCompliance.map(c => (
                    <tr key={c.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {formatDate(c.check_date)}
                        {c.sweep_id && <span className="ml-2 text-xs text-cyan-500">Sweep</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.officer_name || '—'}</td>
                      <td className="px-4 py-3">
                        {c.in_compliance ? (
                          <span className="text-green-400 font-semibold">✓</span>
                        ) : (
                          <span className="text-red-400 font-semibold">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Registration Events */}
      {activeTab === 'registrations' && (
        offenderRegistrations.length === 0 ? (
          <EmptyState message="No registration event records found for this offender." />
        ) : (
          <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Registration Date</th>
                  <th className="text-left px-4 py-3">Officer</th>
                  <th className="text-left px-4 py-3">Compliant</th>
                  <th className="text-left px-4 py-3">Notes</th>
                  <th className="text-left px-4 py-3">Next Registration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {offenderRegistrations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(r.registration_date)}</td>
                    <td className="px-4 py-3 text-gray-300">{r.registering_officer}</td>
                    <td className="px-4 py-3">
                      {r.in_compliance ? (
                        <span className="text-green-400 font-semibold">✓</span>
                      ) : (
                        <span className="text-red-400 font-semibold">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.next_registration_date ? (
                        <span className={isOverdue(r.next_registration_date) ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          {formatDate(r.next_registration_date)}
                          {isOverdue(r.next_registration_date) && (
                            <span className="ml-1 text-xs text-red-500">OVERDUE</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Officer Notes */}
      {activeTab === 'notes' && (
        offenderNotes.length === 0 ? (
          <EmptyState message="No officer notes found for this offender." />
        ) : (
          <div className="space-y-3">
            {offenderNotes.map(n => (
              <div key={n.id} className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-cyan-400 text-sm font-medium">{n.officer_name}</span>
                  <span className="text-gray-500 text-xs">{formatDate(n.created_at)}</span>
                </div>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{n.note_text}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Empty State Sub-component ────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-10 text-center">
      <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}
