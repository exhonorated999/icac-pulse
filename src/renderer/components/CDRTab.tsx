import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Types ───────────────────────────────────────────────────────
interface CDRRecord {
  id?: number;
  case_id?: number;
  phone_a: string;
  phone_b: string;
  date_val: string;
  time_val: string;
  timestamp: string;
  call_type: string;
  duration_seconds: number;
  imei?: string;
  imsi?: string;
  tower_a?: string;
  tower_b?: string;
  source?: string;
  raw_line?: string;
}

interface CDRDump {
  id: string;
  name: string;
  uploadDate: string;
  records: CDRRecord[];
  stats: CDRStats;
  refLat: number | null;
  refLon: number | null;
  columnMapping: Record<string, string>;
}

interface CDRStats {
  totalRecords: number;
  uniquePhonesA: number;
  uniquePhonesB: number;
  uniqueIMEIs: number;
  callTypes: Record<string, number>;
  totalDuration: number;
  dateRange: { start: string; end: string; days: number };
}

interface CDRTabProps {
  caseId: number;
  caseNumber?: string;
}

type AnalyticsMode = 'dashboard' | 'map' | 'timeline' | 'table';

interface EvidenceFile {
  id: number;
  description: string;
  file_path: string;
  category: string;
}

// ─── Component ───────────────────────────────────────────────────
export function CDRTab({ caseId }: CDRTabProps) {
  const [records, setRecords] = useState<CDRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AnalyticsMode>('dashboard');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [filterPhone, setFilterPhone] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterCallType, setFilterCallType] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showMapper, setShowMapper] = useState(false);
  const [mapperData, setMapperData] = useState<{ headers: string[]; rows: string[][]; rawText: string; fileName: string; formatType: string; refLat: number | null; refLon: number | null } | null>(null);
  const [evidenceCSVs, setEvidenceCSVs] = useState<EvidenceFile[]>([]);
  const [importingEvidence, setImportingEvidence] = useState<number | null>(null);
  const [refLat, setRefLat] = useState<number | null>(null);
  const [refLon, setRefLon] = useState<number | null>(null);
  const [timelineGroupBy, setTimelineGroupBy] = useState<'hour' | 'day'>('day');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => { loadRecords(); loadEvidenceFiles(); }, [caseId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getCDRRecords(caseId);
      setRecords(data || []);
    } catch (e) { console.error('CDR load error:', e); }
    setLoading(false);
  };

  const loadEvidenceFiles = async () => {
    try {
      const allEvidence = await window.electronAPI.getEvidence(caseId);
      const csvFiles = (allEvidence || []).filter((e: EvidenceFile) =>
        /\.(csv|tsv|txt)$/i.test(e.file_path)
      );
      setEvidenceCSVs(csvFiles);
    } catch (e) { console.error('Evidence scan error:', e); }
  };

  // ─── File parsing ──────────────────────────────────────────────
  const processFileText = (text: string, fileName: string) => {
    const lines = text.split('\n');

    // Extract reference lat/lon from AT&T header preamble
    let parsedRefLat: number | null = null, parsedRefLon: number | null = null;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const latMatch = lines[i].match(/LAT:\s*([-\d.]+)/i);
      const lonMatch = lines[i].match(/LON:\s*([-\d.]+)/i);
      if (latMatch) parsedRefLat = parseFloat(latMatch[1]);
      if (lonMatch) parsedRefLon = parseFloat(lonMatch[1]);
    }

    // Detect AT&T format
    let headerLineIndex = 0;
    let formatType = 'STANDARD';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.includes('Source,') && line.includes('Conn Date')) {
        headerLineIndex = i;
        formatType = 'ATT';
        break;
      }
      if (/MSIDN|Phone|Number/i.test(line) && line.includes(',')) {
        headerLineIndex = i;
        break;
      }
    }

    // Parse with Papa starting from header line
    const cleanedText = lines.slice(headerLineIndex).join('\n');
    Papa.parse(cleanedText, {
      header: false,
      skipEmptyLines: true,
      preview: 5,
      complete: (preview) => {
        if (!preview.data.length) {
          setImportError('Could not parse the file. Check that it is a valid CSV/TSV.');
          return;
        }
        const headers = (preview.data[0] as string[]).map(h => h.trim());
        const rows = preview.data.slice(1, 4) as string[][];
        setMapperData({
          headers,
          rows,
          rawText: cleanedText,
          fileName,
          formatType,
          refLat: parsedRefLat,
          refLon: parsedRefLon,
        });
        setShowMapper(true);
      }
    });
  };

  const handleFileUpload = async () => {
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    setImportError(null);
    const file = input.files[0];
    const text = await file.text();
    processFileText(text, file.name);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const importFromEvidence = async (ev: EvidenceFile) => {
    setImportingEvidence(ev.id);
    setImportError(null);
    try {
      const result = await window.electronAPI.readEvidenceFile(ev.file_path);
      if (!result.success || !result.content) {
        setImportError(`Could not read file: ${result.error || 'empty'}`);
        setImportingEvidence(null);
        return;
      }
      const fileName = ev.file_path.split(/[/\\]/).pop() || 'evidence.txt';
      processFileText(result.content, fileName);
    } catch (e: any) {
      setImportError(`Read failed: ${e.message}`);
    }
    setImportingEvidence(null);
  };

  const submitMapping = async (mapping: Record<string, string>) => {
    if (!mapperData) return;
    setShowMapper(false);
    setImporting(true);
    setImportError(null);

    try {
      // Full parse
      const parsed = Papa.parse(mapperData.rawText, {
        header: true,
        skipEmptyLines: true,
      });

      const rawData = parsed.data as Record<string, string>[];
      const formatType = mapperData.formatType;

      const normalized: any[] = rawData.map((row) => {
        // Duration
        let duration = 0;
        if (row[mapping.duration]) {
          const val = parseFloat(row[mapping.duration]);
          duration = formatType === 'ATT' ? Math.round(val * 60) : Math.round(val);
          if (isNaN(duration)) duration = 0;
        }

        // Call type
        const rawCallType = row[mapping.callType] || '';
        const rawSource = mapping.source ? (row[mapping.source] || '') : '';
        const callType = normalizeCallType(rawCallType, formatType, rawSource);

        // Timestamp
        const ts = parseTimestamp(row[mapping.date], row[mapping.time]);

        return {
          phoneA: row[mapping.phoneA] || null,
          phoneB: row[mapping.phoneB] || null,
          date: row[mapping.date] || null,
          time: row[mapping.time] || null,
          timestamp: ts,
          callType,
          duration,
          imei: row[mapping.imei] || null,
          imsi: row[mapping.imsi] || null,
          towerA: row[mapping.towerA] || null,
          towerB: row[mapping.towerB] || null,
          source: rawSource || rawCallType || null,
          raw: null, // skip raw to save IPC bandwidth
        };
      }).filter(r => r.phoneA || r.phoneB || r.timestamp);

      if (normalized.length === 0) {
        setImportError('No valid records found after parsing.');
        setImporting(false);
        return;
      }

      const result = await window.electronAPI.importCDRRecords({
        caseId,
        records: normalized,
        refLat: mapperData.refLat,
        refLon: mapperData.refLon,
      });

      if (mapperData.refLat) setRefLat(mapperData.refLat);
      if (mapperData.refLon) setRefLon(mapperData.refLon);

      await loadRecords();
      console.log(`CDR import complete: ${result?.imported} records`);
    } catch (e: any) {
      console.error('CDR import error:', e);
      setImportError(`Import failed: ${e.message}`);
    }
    setImporting(false);
    setMapperData(null);
  };

  // ─── Helpers ───────────────────────────────────────────────────
  const normalizeCallType = (rawType: string, formatType: string, rawSource: string): string => {
    const type = (rawType || '').toUpperCase().trim();
    const source = (rawSource || '').toUpperCase().trim();

    if (source && (type === 'MO' || type === 'M0' || type === 'MT')) {
      const direction = (type === 'MO' || type === 'M0') ? 'outgoing' : 'incoming';
      if (/VOICE|CALL/.test(source)) return `voice-${direction}`;
      if (/SMS|MMS|TEXT/.test(source)) return `sms-${direction}`;
      if (/DATA|GPRS/.test(source)) return `data-${direction}`;
      return `voice-${direction}`;
    }
    const map: Record<string, string> = {
      MOC: 'voice-outgoing', MTC: 'voice-incoming',
      'SMS-MO': 'sms-outgoing', 'SMS-MT': 'sms-incoming',
      MO: 'voice-outgoing', M0: 'voice-outgoing', MT: 'voice-incoming',
      CALL: 'voice', SMS: 'sms', DATA: 'data', MMS: 'sms',
    };
    return map[type] || type.toLowerCase() || 'unknown';
  };

  const parseTimestamp = (dateStr?: string, timeStr?: string): string => {
    if (!dateStr) return '';
    try {
      const dateParts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
      const timeParts = timeStr ? timeStr.split(':').map(Number) : [0, 0, 0];
      let year: number, month: number, day: number;
      if (dateStr.includes('/')) {
        [month, day, year] = dateParts.map(Number); // MM/DD/YYYY
      } else {
        [year, month, day] = dateParts.map(Number); // YYYY-MM-DD
      }
      const d = new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0);
      return isNaN(d.getTime()) ? dateStr : d.toISOString();
    } catch { return dateStr; }
  };

  const formatDuration = (sec: number): string => {
    if (!sec) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h.toLocaleString()}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  };

  const formatDate = (iso: string): string => {
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  };

  // ─── Filtered records ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...records];
    if (filterPhone) {
      const pf = filterPhone.replace(/[-\s()]/g, '');
      data = data.filter(r => r.phone_a?.includes(pf) || r.phone_b?.includes(pf));
    }
    if (filterDateStart) {
      const ds = new Date(filterDateStart);
      data = data.filter(r => r.timestamp && new Date(r.timestamp) >= ds);
    }
    if (filterDateEnd) {
      const de = new Date(filterDateEnd + 'T23:59:59');
      data = data.filter(r => r.timestamp && new Date(r.timestamp) <= de);
    }
    if (filterCallType) {
      data = data.filter(r => r.call_type?.includes(filterCallType));
    }
    return data;
  }, [records, filterPhone, filterDateStart, filterDateEnd, filterCallType]);

  // ─── Statistics ────────────────────────────────────────────────
  const stats = useMemo((): CDRStats | null => {
    if (records.length === 0) return null;
    const phonesA = new Set(records.map(r => r.phone_a).filter(Boolean));
    const phonesB = new Set(records.map(r => r.phone_b).filter(Boolean));
    const imeis = new Set(records.filter(r => r.imei).map(r => r.imei));
    const callTypes: Record<string, number> = {};
    let totalDur = 0;
    records.forEach(r => {
      callTypes[r.call_type] = (callTypes[r.call_type] || 0) + 1;
      totalDur += r.duration_seconds || 0;
    });
    const timestamps = records.map(r => new Date(r.timestamp)).filter(d => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    const days = start && end ? Math.ceil((end.getTime() - start.getTime()) / 86400000) : 0;
    return {
      totalRecords: records.length,
      uniquePhonesA: phonesA.size,
      uniquePhonesB: phonesB.size,
      uniqueIMEIs: imeis.size,
      callTypes,
      totalDuration: totalDur,
      dateRange: {
        start: start?.toISOString() || '',
        end: end?.toISOString() || '',
        days,
      },
    };
  }, [records]);

  // ─── Phone details ─────────────────────────────────────────────
  const phoneDetails = useMemo(() => {
    if (!selectedPhone) return null;
    const matching = filtered.filter(r => r.phone_a === selectedPhone || r.phone_b === selectedPhone);
    let outgoing = 0, incoming = 0, smsOut = 0, smsIn = 0, dur = 0;
    const contacts = new Set<string>();
    matching.forEach(r => {
      if (r.call_type?.includes('outgoing')) outgoing++;
      if (r.call_type?.includes('incoming')) incoming++;
      if (r.call_type?.includes('sms') && r.call_type?.includes('outgoing')) smsOut++;
      if (r.call_type?.includes('sms') && r.call_type?.includes('incoming')) smsIn++;
      dur += r.duration_seconds || 0;
      if (r.phone_a && r.phone_a !== selectedPhone) contacts.add(r.phone_a);
      if (r.phone_b && r.phone_b !== selectedPhone) contacts.add(r.phone_b);
    });

    const contactCounts = Array.from(contacts).map(c => ({
      phone: c,
      count: matching.filter(r => r.phone_a === c || r.phone_b === c).length,
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    return { total: matching.length, outgoing, incoming, smsOut, smsIn, duration: dur, topContacts: contactCounts };
  }, [selectedPhone, filtered]);

  // ─── Clear all ─────────────────────────────────────────────────
  const handleClear = async () => {
    if (!confirm(`Delete all ${records.length} CDR records for this case?`)) return;
    try {
      await window.electronAPI.deleteCDRRecords(caseId);
      setRecords([]);
      setSelectedPhone(null);
    } catch (e) { console.error(e); }
  };

  // ─── Render: Loading ───────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Loading CDR data...</div>;

  // ─── Render: Empty state ───────────────────────────────────────
  if (records.length === 0 && !showMapper && !importing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg className="w-16 h-16 text-accent-cyan/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <h3 className="text-text-primary font-semibold text-xl mb-2">No CDR Data</h3>
        <p className="text-text-muted text-sm mb-6">Upload Call Detail Records or Tower Dump files to begin analysis</p>

        {evidenceCSVs.length > 0 && (
          <div className="w-full max-w-md mb-4">
            <p className="text-text-muted text-xs uppercase tracking-wider mb-2 font-semibold">Detected in Evidence</p>
            <div className="space-y-2">
              {evidenceCSVs.map(ev => (
                <div key={ev.id} className="flex items-center justify-between bg-panel border border-accent-cyan/20 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-accent-cyan text-lg">📄</span>
                    <div className="text-left min-w-0">
                      <p className="text-sm text-text-primary truncate">{ev.description || ev.file_path.split(/[/\\]/).pop()}</p>
                      <p className="text-xs text-text-muted truncate">{ev.file_path}</p>
                    </div>
                  </div>
                  <button onClick={() => importFromEvidence(ev)} disabled={importingEvidence === ev.id}
                    className="ml-3 px-3 py-1 text-xs font-medium rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors disabled:opacity-50">
                    {importingEvidence === ev.id ? 'Reading...' : 'Import'}
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-accent-cyan/10 mt-4 pt-3">
              <p className="text-text-muted text-xs mb-2">Or import from file:</p>
            </div>
          </div>
        )}

        <label className="px-5 py-2.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-lg cursor-pointer hover:bg-accent-cyan/20 transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
          Upload CDR/Tower Dump
        </label>

        {importError && (
          <div className="mt-4 w-full max-w-md bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{importError}</div>
        )}
      </div>
    );
  }

  // ─── Render: Column Mapping Modal ──────────────────────────────
  if (showMapper && mapperData) {
    return <ColumnMappingModal
      headers={mapperData.headers}
      sampleRows={mapperData.rows}
      fileName={mapperData.fileName}
      formatType={mapperData.formatType}
      onSubmit={submitMapping}
      onCancel={() => { setShowMapper(false); setMapperData(null); }}
    />;
  }

  // ─── Render: Importing spinner ─────────────────────────────────
  if (importing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin mb-4" />
        <p className="text-text-primary font-semibold">Parsing CDR file...</p>
        <p className="text-text-muted text-sm">This may take a moment for large datasets</p>
      </div>
    );
  }

  // ─── Render: Main Analytics Layout ─────────────────────────────
  return (
    <div className="flex h-full overflow-hidden -mx-4 -mt-2" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Left Panel */}
      <div className="w-64 border-r border-accent-cyan/10 p-3 overflow-y-auto flex-shrink-0">
        {/* Dump Info */}
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3 mb-3">
          <h3 className="text-xs font-semibold text-accent-cyan mb-2 uppercase tracking-wider">📁 CDR Dumps</h3>
          <div className="bg-background rounded p-2 text-sm">
            <p className="text-text-primary font-medium truncate">{stats?.totalRecords.toLocaleString()} records</p>
            <p className="text-text-muted text-xs">{formatDate(stats?.dateRange.start || '')}</p>
          </div>
        </div>

        {/* Analysis Mode */}
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3 mb-3">
          <h3 className="text-xs font-semibold text-accent-cyan mb-2 uppercase tracking-wider">🔍 Analysis Mode</h3>
          <div className="space-y-1">
            {([
              ['dashboard', '📊 Dashboard'],
              ['map', '🗺️ Map View'],
              ['timeline', '📈 Timeline'],
              ['table', '📋 Table'],
            ] as [AnalyticsMode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${mode === m ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30' : 'text-text-muted hover:text-text-primary hover:bg-background'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3 mb-3">
          <h3 className="text-xs font-semibold text-accent-cyan mb-2 uppercase tracking-wider">🔎 Filters</h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-text-muted block mb-1">Phone Number</label>
              <input value={filterPhone} onChange={e => setFilterPhone(e.target.value)} placeholder="555-123-4567"
                className="w-full px-2 py-1.5 bg-background border border-accent-cyan/10 rounded text-sm text-text-primary placeholder-text-muted/50 focus:border-accent-cyan/30 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Date Range</label>
              <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                className="w-full px-2 py-1.5 bg-background border border-accent-cyan/10 rounded text-xs text-text-primary focus:border-accent-cyan/30 focus:outline-none mb-1" />
              <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                className="w-full px-2 py-1.5 bg-background border border-accent-cyan/10 rounded text-xs text-text-primary focus:border-accent-cyan/30 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Call Type</label>
              <select value={filterCallType} onChange={e => setFilterCallType(e.target.value)}
                className="w-full px-2 py-1.5 bg-background border border-accent-cyan/10 rounded text-sm text-text-primary focus:border-accent-cyan/30 focus:outline-none">
                <option value="">All</option>
                <option value="voice">Voice</option>
                <option value="sms">SMS</option>
                <option value="data">Data</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-1">
          <label className="w-full px-3 py-2 bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan rounded text-sm text-center cursor-pointer hover:bg-accent-cyan/20 transition-colors block">
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
            + Add Another Dump
          </label>
          <button onClick={handleClear} className="w-full px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/20 transition-colors">
            Clear All Records
          </button>
        </div>
      </div>

      {/* Center Panel */}
      <div className="flex-1 p-4 overflow-y-auto">
        {mode === 'dashboard' && <DashboardView stats={stats} filtered={filtered} records={records} onSelectPhone={setSelectedPhone} />}
        {mode === 'map' && <MapView records={filtered} refLat={refLat} refLon={refLon} mapRef={mapRef} mapInstance={mapInstance} />}
        {mode === 'timeline' && <TimelineView records={filtered} groupBy={timelineGroupBy} setGroupBy={setTimelineGroupBy} />}
        {mode === 'table' && <TableView records={filtered} onSelectPhone={setSelectedPhone} />}
      </div>

      {/* Right Panel */}
      <div className="w-72 border-l border-accent-cyan/10 p-3 overflow-y-auto flex-shrink-0">
        <StatsPanel stats={stats} filtered={filtered} isFiltered={filtered.length !== records.length} />
        <PhoneDetailsPanel phone={selectedPhone} details={phoneDetails} onClear={() => setSelectedPhone(null)} />
      </div>
    </div>
  );
}

// ─── Column Mapping Modal ────────────────────────────────────────
function ColumnMappingModal({ headers, sampleRows, fileName, formatType, onSubmit, onCancel }: {
  headers: string[];
  sampleRows: string[][];
  fileName: string;
  formatType: string;
  onSubmit: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}) {
  // Auto-detect AT&T mappings
  const autoMap: Record<string, string> = {};
  if (formatType === 'ATT') {
    headers.forEach(h => {
      const hl = h.toLowerCase();
      if (hl === 'source') autoMap.source = h;
      if (hl.includes('originating number')) autoMap.phoneA = h;
      if (hl.includes('terminating number') || hl.includes('dialed number')) autoMap.phoneB = h;
      if (hl.includes('conn date')) autoMap.date = h;
      if (hl.includes('conn time')) autoMap.time = h;
      if (hl.includes('call type')) autoMap.callType = h;
      if (hl.includes('minutes')) autoMap.duration = h;
      if (hl.includes('imei')) autoMap.imei = h;
      if (hl.includes('imsi')) autoMap.imsi = h;
      if (hl.includes('tower') || hl.includes('lac')) autoMap.towerA = h;
    });
  } else {
    // Generic auto-detect
    headers.forEach(h => {
      const hl = h.toLowerCase();
      if (/phone.*a|caller|originating|source.*num/i.test(hl) && !autoMap.phoneA) autoMap.phoneA = h;
      if (/phone.*b|called|dialed|destination|terminating/i.test(hl) && !autoMap.phoneB) autoMap.phoneB = h;
      if (/^date$|start.*date/i.test(hl) && !autoMap.date) autoMap.date = h;
      if (/^time$|start.*time/i.test(hl) && !autoMap.time) autoMap.time = h;
      if (/duration|minutes|seconds/i.test(hl) && !autoMap.duration) autoMap.duration = h;
      if (/type|direction/i.test(hl) && !autoMap.callType) autoMap.callType = h;
      if (/tower|cell|lac|cgi/i.test(hl) && !autoMap.towerA) autoMap.towerA = h;
      if (/imei/i.test(hl)) autoMap.imei = h;
      if (/imsi/i.test(hl)) autoMap.imsi = h;
    });
  }

  const [mapping, setMapping] = useState<Record<string, string>>(autoMap);
  const updateField = (field: string, value: string) => setMapping(prev => ({ ...prev, [field]: value }));

  const fields = [
    { name: 'phoneA', label: 'Phone A (Caller)', required: true },
    { name: 'phoneB', label: 'Phone B (Callee)', required: true },
    { name: 'date', label: 'Date', required: true },
    { name: 'time', label: 'Time', required: true },
    { name: 'callType', label: 'Call Type / Direction', required: false },
    { name: 'duration', label: 'Duration', required: false },
    { name: 'imei', label: 'IMEI', required: false },
    { name: 'imsi', label: 'IMSI', required: false },
    { name: 'towerA', label: 'Tower / Cell ID', required: false },
    { name: 'towerB', label: 'Tower B (optional)', required: false },
    { name: 'source', label: 'Source (Voice/SMS/Data)', required: false },
  ];

  return (
    <div className="max-w-4xl mx-auto py-4">
      <h3 className="text-xl font-bold text-text-primary mb-2">Map CSV Columns</h3>
      <p className="text-text-muted text-sm mb-4">Match your CSV columns to standard CDR fields. Required fields are marked with *</p>

      {/* File info + preview */}
      <div className="bg-panel border border-accent-cyan/10 rounded-lg p-4 mb-4">
        <p className="text-sm font-semibold text-accent-cyan mb-2">File: {fileName}</p>
        <div className="overflow-x-auto">
          <table className="text-xs text-text-muted">
            <thead>
              <tr className="border-b border-accent-cyan/10">
                {headers.map((h, i) => <th key={i} className="px-2 py-1 text-left whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, ri) => (
                <tr key={ri} className="border-b border-accent-cyan/5">
                  {row.map((cell, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formatType === 'ATT' && (
        <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg px-4 py-3 mb-4">
          <p className="text-accent-cyan text-sm font-semibold">✓ AT&T Format Detected</p>
          <p className="text-text-muted text-xs">Columns auto-mapped for AT&T tower dump format</p>
        </div>
      )}

      {/* Column mapping fields */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {fields.map(f => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-text-muted mb-1">
              {f.label} {f.required && <span className="text-red-400">*</span>}
              {mapping[f.name] && <span className="text-green-400 text-xs ml-2">✓</span>}
            </label>
            <select value={mapping[f.name] || ''} onChange={e => updateField(f.name, e.target.value)}
              className="w-full px-3 py-2 bg-background border border-accent-cyan/10 rounded text-sm text-text-primary focus:border-accent-cyan/30 focus:outline-none">
              <option value="">-- Select Column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 bg-background border border-accent-cyan/10 rounded-lg text-text-muted hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button onClick={() => onSubmit(mapping)}
          disabled={!mapping.phoneA || !mapping.date}
          className="px-4 py-2 bg-accent-cyan/20 border border-accent-cyan/30 rounded-lg text-accent-cyan hover:bg-accent-cyan/30 transition-colors disabled:opacity-40">
          Parse CDR File
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard View ──────────────────────────────────────────────
function DashboardView({ stats, filtered, records, onSelectPhone }: {
  stats: CDRStats | null;
  filtered: CDRRecord[];
  records: CDRRecord[];
  onSelectPhone: (p: string) => void;
}) {
  if (!stats) return null;

  // Top contacted numbers
  const contactCounts = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      if (r.phone_a) map[r.phone_a] = (map[r.phone_a] || 0) + 1;
      if (r.phone_b) map[r.phone_b] = (map[r.phone_b] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  const callTypeBar = (label: string, key: string, color: string) => {
    const count = stats.callTypes[key] || 0;
    const pct = stats.totalRecords > 0 ? (count / stats.totalRecords * 100) : 0;
    return (
      <div key={key}>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{label}</span>
          <span>{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-text-primary">📊 CDR Overview Dashboard</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3">
          <p className="text-xs text-text-muted mb-1">Records</p>
          <p className="text-2xl font-bold text-accent-cyan">{stats.totalRecords.toLocaleString()}</p>
        </div>
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3">
          <p className="text-xs text-text-muted mb-1">Unique Phones</p>
          <p className="text-2xl font-bold text-green-400">{stats.uniquePhonesA.toLocaleString()}</p>
        </div>
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3">
          <p className="text-xs text-text-muted mb-1">IMEIs</p>
          <p className="text-2xl font-bold text-text-primary">{stats.uniqueIMEIs.toLocaleString()}</p>
        </div>
        <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3">
          <p className="text-xs text-text-muted mb-1">Duration</p>
          <p className="text-xl font-bold text-purple-400">{formatDurationStatic(stats.totalDuration)}</p>
        </div>
      </div>

      {/* Call Type Breakdown */}
      <div className="bg-panel border border-accent-cyan/10 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-accent-cyan mb-3">📞 Call Type Breakdown</h4>
        <div className="space-y-2">
          {callTypeBar('Voice Outgoing', 'voice-outgoing', '#00d9ff')}
          {callTypeBar('Voice Incoming', 'voice-incoming', '#00ff88')}
          {callTypeBar('SMS Outgoing', 'sms-outgoing', '#9d4edd')}
          {callTypeBar('SMS Incoming', 'sms-incoming', '#ffa726')}
          {callTypeBar('Data Outgoing', 'data-outgoing', '#607d8b')}
          {callTypeBar('Data Incoming', 'data-incoming', '#78909c')}
        </div>
      </div>

      {/* Top Contacts */}
      <div className="bg-panel border border-accent-cyan/10 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-accent-cyan mb-3">📱 Most Active Numbers</h4>
        <div className="grid grid-cols-2 gap-1">
          {contactCounts.map(([phone, count]) => (
            <button key={phone} onClick={() => onSelectPhone(phone)}
              className="flex justify-between px-2 py-1.5 bg-background rounded text-xs hover:bg-accent-cyan/10 transition-colors">
              <span className="text-text-primary font-mono truncate">{phone}</span>
              <span className="text-accent-cyan ml-2">{count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Map View ────────────────────────────────────────────────────
function MapView({ records, refLat, refLon, mapRef, mapInstance }: {
  records: CDRRecord[];
  refLat: number | null;
  refLon: number | null;
  mapRef: React.RefObject<HTMLDivElement>;
  mapInstance: React.MutableRefObject<L.Map | null>;
}) {
  const [selectedTower, setSelectedTower] = useState<string | null>(null);

  const towerCounts = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      if (r.tower_a) {
        const ids = r.tower_a.split(':');
        ids.forEach(tid => {
          const t = tid.trim();
          if (t) map.set(t, (map.get(t) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const lat = refLat || 30.242504;
    const lon = refLon || -97.728162;

    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    // Reference point
    L.circleMarker([lat, lon], {
      radius: 10, fillColor: '#ffa726', color: '#fff', weight: 2, fillOpacity: 0.9
    }).addTo(map).bindPopup(`<strong>Reference Point</strong><br>LAT: ${lat}<br>LON: ${lon}`);

    // Distribute towers around reference
    const topTowers = towerCounts.slice(0, 50);
    topTowers.forEach(([towerId, count], i) => {
      const ring = Math.floor(i / 12);
      const angle = (i % 12) * (Math.PI * 2 / 12) + ring * 0.3;
      const radius = 0.008 + ring * 0.006;
      const tLat = lat + Math.cos(angle) * radius;
      const tLon = lon + Math.sin(angle) * radius;
      const size = Math.min(16, 6 + Math.sqrt(count) * 0.5);
      const color = count > 1000 ? '#ff4444' : count > 100 ? '#ffa726' : '#00d9ff';

      L.circleMarker([tLat, tLon], {
        radius: size, fillColor: color, color: '#fff', weight: 1, fillOpacity: 0.8
      }).addTo(map)
        .bindPopup(`<strong>Tower: ${towerId}</strong><br>Records: ${count.toLocaleString()}`)
        .on('click', () => setSelectedTower(towerId));
    });

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [records, refLat, refLon, towerCounts]);

  const towerDetail = useMemo(() => {
    if (!selectedTower) return null;
    const matching = records.filter(r => r.tower_a?.includes(selectedTower));
    const phones = new Set<string>();
    matching.forEach(r => { if (r.phone_a) phones.add(r.phone_a); if (r.phone_b) phones.add(r.phone_b); });
    return { records: matching.length, phones: phones.size };
  }, [selectedTower, records]);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-text-primary">🗺️ Geographic View</h3>
      <div ref={mapRef} className="bg-background rounded-lg" style={{ height: 450 }} />

      {selectedTower && towerDetail ? (
        <div className="bg-panel border border-accent-cyan/20 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-accent-cyan font-semibold text-sm">Tower: {selectedTower}</span>
            <button onClick={() => setSelectedTower(null)} className="text-xs text-text-muted hover:text-text-primary">✕ Back</button>
          </div>
          <div className="text-xs text-text-muted space-y-1">
            <div>Records: <span className="text-text-primary">{towerDetail.records.toLocaleString()}</span></div>
            <div>Unique phones: <span className="text-text-primary">{towerDetail.phones.toLocaleString()}</span></div>
          </div>
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <p className="text-xs text-text-muted mb-2 font-semibold">{towerCounts.length} unique tower IDs — Top 20:</p>
          <div className="grid grid-cols-2 gap-1">
            {towerCounts.slice(0, 20).map(([tid, count]) => (
              <button key={tid} onClick={() => setSelectedTower(tid)}
                className="flex justify-between px-2 py-1 bg-background rounded text-xs hover:bg-accent-cyan/10 transition-colors">
                <span className="text-text-primary font-mono">{tid}</span>
                <span className="text-accent-cyan">{count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline View ───────────────────────────────────────────────
function TimelineView({ records, groupBy, setGroupBy }: {
  records: CDRRecord[];
  groupBy: 'hour' | 'day';
  setGroupBy: (g: 'hour' | 'day') => void;
}) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const data = useMemo(() => {
    const map: Record<string, { voice: number; sms: number; data: number }> = {};
    for (const r of records) {
      const ts = r.timestamp || r.date_val;
      if (!ts) continue;
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) continue;
        const key = groupBy === 'hour'
          ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:00`
          : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!map[key]) map[key] = { voice: 0, sms: 0, data: 0 };
        const ct = (r.call_type || '').toLowerCase();
        if (ct.includes('sms') || ct.includes('text')) map[key].sms++;
        else if (ct.includes('data') || ct.includes('gprs')) map[key].data++;
        else map[key].voice++;
      } catch {}
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [records, groupBy]);

  const maxVal = useMemo(() => {
    let max = 1;
    for (const [, v] of data) {
      const t = v.voice + v.sms + v.data;
      if (t > max) max = t;
    }
    return max;
  }, [data]);

  const chartH = 220;
  const barW = data.length <= 1 ? 60 : Math.max(4, Math.min(32, Math.floor(800 / data.length)));
  const gap = data.length <= 30 ? 2 : 1;
  const totalW = data.length * (barW + gap);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-text-primary">📈 Activity Timeline</h3>
        <div className="flex gap-1">
          <button onClick={() => setGroupBy('hour')}
            className={`px-3 py-1 text-xs rounded border transition ${groupBy === 'hour' ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan' : 'bg-background text-text-muted border-accent-cyan/10'}`}>
            Hourly
          </button>
          <button onClick={() => setGroupBy('day')}
            className={`px-3 py-1 text-xs rounded border transition ${groupBy === 'day' ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan' : 'bg-background text-text-muted border-accent-cyan/10'}`}>
            Daily
          </button>
        </div>
      </div>

      <div className="bg-panel border border-accent-cyan/10 rounded-lg p-4">
        {data.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No timeline data available</p>
        ) : (
          <div className="overflow-x-auto">
            <svg width={Math.max(totalW, 200)} height={chartH + 40} className="block">
              {/* Y-axis labels */}
              <text x={0} y={12} fill="#94A3C0" fontSize={10}>{maxVal.toLocaleString()}</text>
              <text x={0} y={chartH + 2} fill="#94A3C0" fontSize={10}>0</text>
              <line x1={40} y1={0} x2={40} y2={chartH} stroke="#1e293b" strokeWidth={1} />

              {/* Bars */}
              {data.map(([label, counts], i) => {
                const total = counts.voice + counts.sms + counts.data;
                const x = 44 + i * (barW + gap);

                const totalH = (total / maxVal) * chartH;
                const voiceH = total > 0 ? (counts.voice / total) * totalH : 0;
                const smsH = total > 0 ? (counts.sms / total) * totalH : 0;
                const dataH = total > 0 ? (counts.data / total) * totalH : 0;

                // Stack: voice at bottom, sms above, data on top
                const voiceY = chartH - voiceH;
                const smsY = voiceY - smsH;
                const dataY = smsY - dataH;

                return (
                  <g key={label}
                    onMouseEnter={() => setHoveredBar(label)}
                    onMouseLeave={() => setHoveredBar(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hit area */}
                    <rect x={x} y={0} width={barW} height={chartH} fill="transparent" />
                    {voiceH > 0 && <rect x={x} y={voiceY} width={barW} height={voiceH} fill="#00D4FF" rx={1} />}
                    {smsH > 0 && <rect x={x} y={smsY} width={barW} height={smsH} fill="#9d4edd" rx={1} />}
                    {dataH > 0 && <rect x={x} y={dataY} width={barW} height={dataH} fill="#607d8b" rx={1} />}

                    {/* Tooltip */}
                    {hoveredBar === label && (
                      <g>
                        <rect x={x - 30} y={Math.max(0, dataY - 38)} width={barW + 60} height={34} rx={4} fill="#121A2C" stroke="#00D4FF" strokeWidth={0.5} opacity={0.95} />
                        <text x={x + barW / 2} y={Math.max(14, dataY - 22)} textAnchor="middle" fill="#E0E0FF" fontSize={10} fontWeight="bold">{label}</text>
                        <text x={x + barW / 2} y={Math.max(28, dataY - 8)} textAnchor="middle" fill="#94A3C0" fontSize={9}>
                          {total.toLocaleString()} records
                        </text>
                      </g>
                    )}

                    {/* X-axis label (show every N) */}
                    {(data.length <= 31 || i % Math.ceil(data.length / 20) === 0) && (
                      <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fill="#94A3C0" fontSize={8}
                        transform={data.length > 15 ? `rotate(-45 ${x + barW / 2} ${chartH + 14})` : ''}>
                        {groupBy === 'hour' ? label.split(' ')[1] : label.substring(5)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        <div className="flex gap-4 mt-3 text-xs text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#00D4FF' }} /> Voice</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#9d4edd' }} /> SMS</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#607d8b' }} /> Data</span>
        </div>
      </div>
    </div>
  );
}

// ─── Table View ──────────────────────────────────────────────────
function TableView({ records, onSelectPhone }: { records: CDRRecord[]; onSelectPhone: (p: string) => void }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const totalPages = Math.ceil(records.length / pageSize);
  const paged = records.slice(page * pageSize, (page + 1) * pageSize);

  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? ts : d.toLocaleString();
    } catch { return ts; }
  };

  const fmtDur = (s: number) => {
    if (!s) return '-';
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : m > 0 ? `${m}m${s % 60}s` : `${s}s`;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-text-primary">📋 Records ({records.length.toLocaleString()})</h3>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2 py-1 bg-background rounded disabled:opacity-30">← Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="px-2 py-1 bg-background rounded disabled:opacity-30">Next →</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-accent-cyan/10 text-text-muted text-left">
              <th className="px-2 py-2">Timestamp</th>
              <th className="px-2 py-2">Phone A</th>
              <th className="px-2 py-2">Phone B</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Duration</th>
              <th className="px-2 py-2">Tower</th>
              <th className="px-2 py-2">IMEI</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={r.id || i} className="border-b border-accent-cyan/5 hover:bg-accent-cyan/5">
                <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">{fmtDate(r.timestamp)}</td>
                <td className="px-2 py-1.5 text-text-primary font-mono cursor-pointer hover:text-accent-cyan" onClick={() => r.phone_a && onSelectPhone(r.phone_a)}>{r.phone_a || '-'}</td>
                <td className="px-2 py-1.5 text-text-primary font-mono cursor-pointer hover:text-accent-cyan" onClick={() => r.phone_b && onSelectPhone(r.phone_b)}>{r.phone_b || '-'}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    r.call_type?.includes('voice') ? 'bg-accent-cyan/20 text-accent-cyan' :
                    r.call_type?.includes('sms') ? 'bg-purple-500/20 text-purple-400' :
                    r.call_type?.includes('data') ? 'bg-gray-500/20 text-gray-400' :
                    'bg-background text-text-muted'
                  }`}>{r.call_type}</span>
                </td>
                <td className="px-2 py-1.5 text-text-muted">{fmtDur(r.duration_seconds)}</td>
                <td className="px-2 py-1.5 text-text-muted font-mono">{r.tower_a || '-'}</td>
                <td className="px-2 py-1.5 text-text-muted font-mono text-[10px]">{r.imei || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stats Panel ─────────────────────────────────────────────────
function StatsPanel({ stats, filtered, isFiltered }: { stats: CDRStats | null; filtered: CDRRecord[]; isFiltered: boolean }) {
  if (!stats) return null;
  const phones = new Set<string>();
  const imeis = new Set<string>();
  let dur = 0;
  filtered.forEach(r => {
    if (r.phone_a) phones.add(r.phone_a);
    if (r.phone_b) phones.add(r.phone_b);
    if (r.imei) imeis.add(r.imei);
    dur += r.duration_seconds || 0;
  });

  return (
    <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3 mb-3">
      <h3 className="text-xs font-semibold text-accent-cyan mb-2 uppercase tracking-wider">
        📊 Statistics {isFiltered && <span className="text-orange-400">(filtered)</span>}
      </h3>
      <div className="space-y-1.5 text-sm">
        {[
          ['Records', filtered.length.toLocaleString()],
          ['Phones', phones.size.toLocaleString()],
          ['IMEIs', imeis.size.toLocaleString()],
          ['Duration', formatDurationStatic(dur)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-text-muted">{k}:</span>
            <span className="text-text-primary font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Phone Details Panel ─────────────────────────────────────────
function PhoneDetailsPanel({ phone, details, onClear }: {
  phone: string | null;
  details: { total: number; outgoing: number; incoming: number; smsOut: number; smsIn: number; duration: number; topContacts: { phone: string; count: number }[] } | null;
  onClear: () => void;
}) {
  return (
    <div className="bg-panel border border-accent-cyan/10 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-accent-cyan mb-2 uppercase tracking-wider">📱 Phone Details</h3>
      {!phone || !details ? (
        <p className="text-text-muted text-xs text-center py-4">Click a phone number to see details</p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-text-primary font-mono font-bold text-sm">{phone}</p>
            <button onClick={onClear} className="text-xs text-text-muted hover:text-text-primary">✕</button>
          </div>
          <div className="space-y-1 text-xs">
            {[
              ['Total Activity', details.total],
              ['Outgoing Calls', details.outgoing],
              ['Incoming Calls', details.incoming],
              ['Outgoing SMS', details.smsOut],
              ['Incoming SMS', details.smsIn],
              ['Talk Time', formatDurationStatic(details.duration)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-text-muted">{k}:</span>
                <span className="text-text-primary font-medium">{v}</span>
              </div>
            ))}
          </div>
          {details.topContacts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-accent-cyan/10">
              <p className="text-xs text-accent-cyan font-semibold mb-1">🔥 Most Contacted</p>
              {details.topContacts.slice(0, 5).map(c => (
                <div key={c.phone} className="flex justify-between text-xs">
                  <span className="text-text-primary font-mono truncate">{c.phone}</span>
                  <span className="text-accent-cyan ml-2">{c.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Static helper (used outside hooks) ──────────────────────────
function formatDurationStatic(sec: number): string {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h.toLocaleString()}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}
