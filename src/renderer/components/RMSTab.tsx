import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RmsOffense {
  number: number;
  status: string;
  statute: string;
  description: string;
  severity: string;
}

interface RmsPerson {
  involvement: string;
  name: string;
  dob: string;
  age: string;
  sex: string;
  race: string;
  ethnicity: string;
  address: string;
  phone: string;
  height: string;
  weight: string;
  hair: string;
  eyes: string;
  comments: string;
  guardian: string;
  detail: string;
}

interface RmsVehicle {
  status: string;
  colors: string;
  year: string;
  make: string;
  model: string;
  license: string;
  state: string;
  vin: string;
  type: string;
}

interface RmsProperty {
  holdReason: string;
  articleType: string;
  make: string;
  description: string;
  quantity: string;
  value: string;
  recoveredValue: string;
}

interface RmsNarrative {
  officer: string;
  badge: string;
  text: string;
}

interface RmsDigital {
  officer: string;
  badge: string;
  description: string;
}

interface RmsConfidentialPerson {
  involvement: string;
  name: string;
  dob: string;
  address: string;
  phone: string;
}

interface RmsReport {
  id: string;
  fileName: string;
  importedAt: string;
  reportNumber: string;
  reportDate: string;
  reportType: string;
  supplementNo: string;
  agencyName: string;
  location: string;
  beat: string;
  fromDateTime: string;
  toDateTime: string;
  pageCount: number;
  offenses: RmsOffense[];
  personsInvolved: RmsPerson[];
  vehicles: RmsVehicle[];
  property: RmsProperty[];
  narratives: RmsNarrative[];
  digital: RmsDigital[];
  confidentialPersons: RmsConfidentialPerson[];
  rawText: string;
}

interface RMSTabProps {
  caseId: number;
  caseNumber?: string;
}

type SortKey = 'date' | 'reportNumber' | 'agency' | 'fileName';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str: string | null | undefined): string {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString();
  } catch {
    return str;
  }
}

function reportTypeColor(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('prosecution')) return 'text-purple-400';
  if (t.includes('incident summary')) return 'text-blue-400';
  if (t.includes('field incident')) return 'text-green-400';
  return 'text-cyan-400';
}

function reportTypeBg(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('prosecution')) return 'bg-purple-500/20 text-purple-400';
  if (t.includes('incident summary')) return 'bg-blue-500/20 text-blue-400';
  if (t.includes('field incident')) return 'bg-green-500/20 text-green-400';
  return 'bg-cyan-500/20 text-cyan-400';
}

function severityBadge(severity: string): string {
  const s = (severity || '').toUpperCase();
  if (s === 'FELONY') return 'bg-red-500/20 text-red-400';
  if (s === 'MISDEMEANOR') return 'bg-amber-500/20 text-amber-400';
  return 'bg-gray-500/20 text-gray-400';
}

function involvementBadge(inv: string): string {
  const i = (inv || '').toUpperCase();
  if (i === 'SUSPECT' || i === 'ARRESTEE') return 'bg-red-500/20 text-red-400';
  if (i === 'VICTIM') return 'bg-blue-500/20 text-blue-400';
  if (i === 'WITNESS') return 'bg-green-500/20 text-green-400';
  return 'bg-gray-500/20 text-gray-400';
}

function hasValue(v: string | null | undefined): boolean {
  return v != null && v !== '' && v !== 'null' && v !== 'undefined';
}

// ── Icons ────────────────────────────────────────────────────────────────────

function DocumentIcon({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ReportTypeIcon({ type }: { type: string }) {
  const color = reportTypeColor(type);
  return (
    <svg className={`w-8 h-8 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function Section({ title, badge, children, defaultOpen = true }: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-cyan-400 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          {badge}
        </div>
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RMSTab({ caseId, caseNumber }: RMSTabProps) {
  const [reports, setReports] = useState<RmsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<RmsReport | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [toast, setToast] = useState<string | null>(null);

  // Auto-load on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await window.electronAPI.rmsLoadReports(caseId);
        if (!cancelled && result.success) {
          setReports(result.reports || []);
        }
      } catch { /* no saved data */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const result = await window.electronAPI.rmsImportReports(caseId);
      if (result.canceled) {
        setImporting(false);
        return;
      }
      if (!result.success) {
        setError(result.error || 'Import failed');
        setImporting(false);
        return;
      }
      setReports(result.reports || []);
      if (result.imported) {
        setToast(`Imported ${result.imported} report${result.imported !== 1 ? 's' : ''}`);
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    try {
      const result = await window.electronAPI.rmsDeleteReport(caseId, reportId);
      if (result.success) {
        setReports(result.reports || []);
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const sortedReports = [...reports].sort((a, b) => {
    switch (sortKey) {
      case 'date':
        return new Date(b.reportDate || b.importedAt).getTime() - new Date(a.reportDate || a.importedAt).getTime();
      case 'reportNumber':
        return (a.reportNumber || '').localeCompare(b.reportNumber || '');
      case 'agency':
        return (a.agencyName || '').localeCompare(b.agencyName || '');
      case 'fileName':
        return (a.fileName || '').localeCompare(b.fileName || '');
      default:
        return 0;
    }
  });

  // ── Detail View ───────────────────────────────────────────────────────────

  if (selectedReport) {
    const r = selectedReport;
    return (
      <div className="p-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
            {toast}
          </div>
        )}

        {/* Back */}
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Reports
        </button>

        {/* Header */}
        <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-white">{r.reportNumber || 'No Report Number'}</h1>
                {r.reportType && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reportTypeBg(r.reportType)}`}>
                    {r.reportType}
                  </span>
                )}
              </div>
              {r.agencyName && <p className="text-gray-300 text-sm">{r.agencyName}</p>}
            </div>
            <button
              onClick={() => handleDelete(r.id)}
              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >
              Delete
            </button>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-400">
            {r.reportDate && <span>Date: {formatDate(r.reportDate)}</span>}
            {r.location && <span>Location: {r.location}</span>}
            {r.beat && <span>Beat: {r.beat}</span>}
            {r.supplementNo && <span>Supplement: {r.supplementNo}</span>}
          </div>
          {r.fileName && <p className="text-gray-500 text-xs mt-2">{r.fileName}</p>}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {/* Offenses */}
          {r.offenses.length > 0 && (
            <Section title="Offenses" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.offenses.length}</span>}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-700/50">
                      <th className="pb-2 pr-4 font-medium">#</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Statute / Description</th>
                      <th className="pb-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.offenses.map((off, i) => (
                      <tr key={i} className="border-b border-gray-700/30">
                        <td className="py-2 pr-4 text-gray-400">{off.number || i + 1}</td>
                        <td className="py-2 pr-4 text-gray-300">{off.status || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className="text-cyan-400 font-mono text-xs">{off.statute}</span>
                          {off.description && <span className="text-gray-300 ml-2">{off.description}</span>}
                        </td>
                        <td className="py-2">
                          {off.severity && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityBadge(off.severity)}`}>
                              {off.severity.toUpperCase()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Persons Involved */}
          {r.personsInvolved.length > 0 && (
            <Section title="Persons Involved" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.personsInvolved.length}</span>}>
              <div className="space-y-3">
                {r.personsInvolved.map((p, i) => (
                  <div key={i} className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold text-sm">{p.name || 'Unknown'}</span>
                      {p.involvement && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${involvementBadge(p.involvement)}`}>
                          {p.involvement.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400">
                      {hasValue(p.dob) && <span>DOB: <span className="text-gray-300">{formatDate(p.dob)}</span></span>}
                      {hasValue(p.age) && <span>Age: <span className="text-gray-300">{p.age}</span></span>}
                      {hasValue(p.sex) && <span>Sex: <span className="text-gray-300">{p.sex}</span></span>}
                      {hasValue(p.race) && <span>Race: <span className="text-gray-300">{p.race}</span></span>}
                      {hasValue(p.ethnicity) && <span>Ethnicity: <span className="text-gray-300">{p.ethnicity}</span></span>}
                      {hasValue(p.height) && <span>Height: <span className="text-gray-300">{p.height}</span></span>}
                      {hasValue(p.weight) && <span>Weight: <span className="text-gray-300">{p.weight}</span></span>}
                      {hasValue(p.hair) && <span>Hair: <span className="text-gray-300">{p.hair}</span></span>}
                      {hasValue(p.eyes) && <span>Eyes: <span className="text-gray-300">{p.eyes}</span></span>}
                      {hasValue(p.address) && <span className="col-span-2">Address: <span className="text-gray-300">{p.address}</span></span>}
                      {hasValue(p.phone) && <span>Phone: <span className="text-gray-300">{p.phone}</span></span>}
                      {hasValue(p.guardian) && <span>Guardian: <span className="text-gray-300">{p.guardian}</span></span>}
                    </div>
                    {hasValue(p.comments) && (
                      <p className="text-xs text-gray-400 mt-2 italic">{p.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Vehicles */}
          {r.vehicles.length > 0 && (
            <Section title="Vehicles" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.vehicles.length}</span>}>
              <div className="space-y-3">
                {r.vehicles.map((v, i) => (
                  <div key={i} className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">
                        {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                      </span>
                      {v.status && (
                        <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">{v.status}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400">
                      {hasValue(v.colors) && <span>Color: <span className="text-gray-300">{v.colors}</span></span>}
                      {hasValue(v.license) && <span>License: <span className="text-gray-300">{v.license}{v.state ? ` (${v.state})` : ''}</span></span>}
                      {hasValue(v.vin) && <span>VIN: <span className="text-gray-300 font-mono">{v.vin}</span></span>}
                      {hasValue(v.type) && <span>Type: <span className="text-gray-300">{v.type}</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Property */}
          {r.property.length > 0 && (
            <Section title="Property" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.property.length}</span>}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-700/50">
                      <th className="pb-2 pr-4 font-medium">Hold Reason</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Description</th>
                      <th className="pb-2 pr-4 font-medium">Make</th>
                      <th className="pb-2 pr-4 font-medium">Qty</th>
                      <th className="pb-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.property.map((p, i) => (
                      <tr key={i} className="border-b border-gray-700/30">
                        <td className="py-2 pr-4 text-gray-300">{p.holdReason || '—'}</td>
                        <td className="py-2 pr-4 text-gray-300">{p.articleType || '—'}</td>
                        <td className="py-2 pr-4 text-gray-300">{p.description || '—'}</td>
                        <td className="py-2 pr-4 text-gray-300">{p.make || '—'}</td>
                        <td className="py-2 pr-4 text-gray-300">{p.quantity || '—'}</td>
                        <td className="py-2 text-gray-300">{p.value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Narratives */}
          {r.narratives.length > 0 && (
            <Section title="Narratives" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.narratives.length}</span>}>
              <div className="space-y-4">
                {r.narratives.map((n, i) => (
                  <div key={i} className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {n.officer && <span className="text-cyan-400 text-sm font-semibold">{n.officer}</span>}
                      {n.badge && <span className="text-gray-500 text-xs">Badge #{n.badge}</span>}
                    </div>
                    <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                      {n.text}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Digital Evidence */}
          {r.digital.length > 0 && (
            <Section title="Digital Evidence" badge={<span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{r.digital.length}</span>}>
              <div className="space-y-2">
                {r.digital.map((d, i) => (
                  <div key={i} className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-3 flex items-start gap-3">
                    <svg className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <div>
                      {d.officer && <span className="text-cyan-400 text-sm font-semibold">{d.officer}</span>}
                      {d.badge && <span className="text-gray-500 text-xs ml-2">Badge #{d.badge}</span>}
                      {d.description && <p className="text-gray-300 text-sm mt-1">{d.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Confidential Persons */}
          {r.confidentialPersons.length > 0 && (
            <Section
              title="Confidential Persons"
              badge={
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">CONFIDENTIAL</span>
              }
            >
              <div className="space-y-3">
                {r.confidentialPersons.map((cp, i) => (
                  <div key={i} className="bg-gray-900/40 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold text-sm">{cp.name || 'Unknown'}</span>
                      {cp.involvement && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${involvementBadge(cp.involvement)}`}>
                          {cp.involvement.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
                      {hasValue(cp.dob) && <span>DOB: <span className="text-gray-300">{formatDate(cp.dob)}</span></span>}
                      {hasValue(cp.address) && <span className="col-span-2">Address: <span className="text-gray-300">{cp.address}</span></span>}
                      {hasValue(cp.phone) && <span>Phone: <span className="text-gray-300">{cp.phone}</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <Spinner />
          <p className="text-gray-400 text-sm mt-3">Loading reports…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <div className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-10 max-w-lg w-full text-center">
            <div className="flex justify-center mb-5 text-cyan-400/60">
              <DocumentIcon />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Import RMS Reports</h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Import RMS report files to view detailed offense data, persons involved, narratives, and more directly within your case.
            </p>
            {importing ? (
              <div className="flex flex-col items-center gap-3">
                <Spinner />
                <p className="text-gray-400 text-sm">Importing reports…</p>
              </div>
            ) : (
              <button
                onClick={handleImport}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Import Reports
              </button>
            )}
            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports List */}
      {!loading && reports.length > 0 && (
        <>
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">RMS Reports</h1>
              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-semibold">
                {reports.length}
              </span>
            </div>
            {importing ? (
              <div className="flex items-center gap-2">
                <Spinner />
                <span className="text-gray-400 text-sm">Importing…</span>
              </div>
            ) : (
              <button
                onClick={handleImport}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Import Reports
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-500 text-xs">Sort by:</span>
            {([
              ['date', 'Date'],
              ['reportNumber', 'Report #'],
              ['agency', 'Agency'],
              ['fileName', 'File Name'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  sortKey === key
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Report Cards */}
          <div className="space-y-3">
            {sortedReports.map((r) => {
              const offenseCount = r.offenses?.length || 0;
              const personCount = r.personsInvolved?.length || 0;
              const narrativeCount = r.narratives?.length || 0;

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className="bg-gray-800/50 border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className="shrink-0 mt-0.5">
                      <ReportTypeIcon type={r.reportType} />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{r.reportNumber || 'No Number'}</span>
                        {r.reportType && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reportTypeBg(r.reportType)}`}>
                            {r.reportType}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                        {r.agencyName && <span>{r.agencyName}</span>}
                        {r.reportDate && <span>{formatDate(r.reportDate)}</span>}
                        {r.location && <span>{r.location}</span>}
                      </div>
                      {r.fileName && (
                        <p className="text-gray-500 text-xs mt-1 truncate">{r.fileName}</p>
                      )}
                    </div>

                    {/* Badges + Actions */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5">
                        {offenseCount > 0 && (
                          <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
                            {offenseCount} Off.
                          </span>
                        )}
                        {personCount > 0 && (
                          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
                            {personCount} Pers.
                          </span>
                        )}
                        {narrativeCount > 0 && (
                          <span className="text-xs bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-full">
                            {narrativeCount} Narr.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedReport(r); }}
                          className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
