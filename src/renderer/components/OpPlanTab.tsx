import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toPng } from 'html-to-image';

/* ─────────────────────────── Types ─────────────────────────── */

interface EntryTeamMember {
  name: string;
  assignment: string;
  vehicle: string;
  callSign: string;
}

interface OtherResident {
  name: string;
  dob: string;
  photo: string | null;
  hasFirearms: boolean;
  firearms: string;
  hasCrimHistory: boolean;
  crimHistory: string;
}

interface OpsPlanData {
  id?: number;
  case_id: number;
  plan_pdf_path?: string;
  approved?: boolean;
  approver_name?: string;
  approval_date?: string;
  execution_date?: string;
  // Full form fields
  date: string;
  time: string;
  report_number: string;
  case_agent: string;
  operation_type: Record<string, boolean>;
  location: string;
  briefing_location: string;
  fortifications: string;
  cameras: string;
  dogs: string;
  children: string;
  notifications: string;
  comms: string;
  hospital: string;
  rally_point: string;
  suspect_info: string;
  case_summary: string;
  tactical_plan: string;
  pursuit_plan: string;
  medical_plan: string;
  barricade_plan: string;
  contingency_plan: string;
  directions: string;
  location_photos: { data: string; caption: string }[];
  route_data: any;
}

interface OpPlanTabProps {
  caseId: number;
  caseNumber: string;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const OP_TYPES = [
  'Search Warrant', 'Arrest Warrant', 'Undercover Op',
  'Probation/Parole Search', 'Knock & Talk', 'Surveillance', 'Other'
];

const DEFAULT_PLAN: Omit<OpsPlanData, 'case_id'> = {
  date: '', time: '', report_number: '', case_agent: '',
  operation_type: {},
  location: '', briefing_location: '',
  fortifications: '', cameras: '', dogs: '', children: '',
  notifications: '', comms: '', hospital: '', rally_point: '',
  suspect_info: '', case_summary: '',
  tactical_plan: '', pursuit_plan: '', medical_plan: '',
  barricade_plan: '', contingency_plan: '',
  directions: '', location_photos: [], route_data: null,
};

/* ─────────────────────────── Component ─────────────────────────── */

export function OpPlanTab({ caseId, caseNumber, showToast }: OpPlanTabProps) {
  const [plan, setPlan] = useState<OpsPlanData>({ ...DEFAULT_PLAN, case_id: caseId });
  const [entryTeam, setEntryTeam] = useState<EntryTeamMember[]>([]);
  const [residents, setResidents] = useState<OtherResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opsPlanIdRef = useRef<number | null>(null);

  // Route maps state
  const map1Ref = useRef<HTMLDivElement>(null);
  const map2Ref = useRef<HTMLDivElement>(null);
  const leafletMap1 = useRef<L.Map | null>(null);
  const leafletMap2 = useRef<L.Map | null>(null);
  const routeDataRestored = useRef(false);
  const [routeInfo1, setRouteInfo1] = useState<{ distance: string; duration: string } | null>(null);
  const [routeInfo2, setRouteInfo2] = useState<{ distance: string; duration: string } | null>(null);
  const [generatingRoutes, setGeneratingRoutes] = useState(false);

  /* ── Load ── */
  useEffect(() => {
    routeDataRestored.current = false;
    loadOpsPlan();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (leafletMap1.current) { leafletMap1.current.remove(); leafletMap1.current = null; }
      if (leafletMap2.current) { leafletMap2.current.remove(); leafletMap2.current = null; }
    };
  }, [caseId]);

  const loadOpsPlan = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getOpsPlan(caseId);
      if (data) {
        opsPlanIdRef.current = data.id;
        const opType = data.operation_type ? (typeof data.operation_type === 'string' ? JSON.parse(data.operation_type) : data.operation_type) : {};
        const photos = data.location_photos ? (typeof data.location_photos === 'string' ? JSON.parse(data.location_photos) : data.location_photos) : [];
        // Sanitize nulls from DB — every string field must be '' not null
        const sanitized: any = { ...data };
        for (const key of Object.keys(DEFAULT_PLAN)) {
          if (typeof (DEFAULT_PLAN as any)[key] === 'string' && (sanitized[key] === null || sanitized[key] === undefined)) {
            sanitized[key] = '';
          }
        }
        setPlan({
          ...DEFAULT_PLAN,
          ...sanitized,
          operation_type: opType,
          location_photos: photos,
          approved: !!data.approved,
        });
        // Parse and restore route_data
        let parsedRouteData = null;
        if (data.route_data) {
          try {
            parsedRouteData = typeof data.route_data === 'string' ? JSON.parse(data.route_data) : data.route_data;
          } catch { /* ignore bad JSON */ }
        }
        // Load entry team & residents
        if (data.id) {
          const team = await window.electronAPI.getOpsEntryTeam(data.id);
          setEntryTeam(team.map((m: any) => ({ name: m.name || '', assignment: m.assignment || '', vehicle: m.vehicle || '', callSign: m.call_sign || '' })));
          const res = await window.electronAPI.getOpsResidents(data.id);
          setResidents(res.map((r: any) => ({
            name: r.name || '', dob: r.dob || '', photo: r.photo || null,
            hasFirearms: !!r.has_firearms, firearms: r.firearms || '',
            hasCrimHistory: !!r.has_crim_history, crimHistory: r.crim_history || '',
          })));
        }
      } else {
        setPlan({ ...DEFAULT_PLAN, case_id: caseId, report_number: caseNumber,
          case_agent: localStorage.getItem('userProfile_fullName') || '' });
      }
    } catch (err) {
      console.error('Failed to load ops plan:', err);
    } finally {
      setLoading(false);
    }
  };

  // Restore maps when plan.route_data changes and refs are ready
  useEffect(() => {
    if (!loading && plan.route_data && !routeDataRestored.current && map1Ref.current) {
      routeDataRestored.current = true;
      const rd = typeof plan.route_data === 'string' ? JSON.parse(plan.route_data) : plan.route_data;
      // Small delay to ensure Leaflet containers are fully rendered
      setTimeout(() => restoreRoutes(rd), 100);
    }
  }, [loading, plan.route_data]);

  /* ── Auto-save with debounce ── */
  const scheduleAutoSave = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePlan(), 2000);
  }, [plan, entryTeam, residents]);

  const savePlan = async () => {
    try {
      setSaving(true);
      const result = await window.electronAPI.saveOpsPlan({ ...plan, case_id: caseId });
      if (result?.id) {
        opsPlanIdRef.current = result.id;
        await window.electronAPI.saveOpsEntryTeam(result.id, entryTeam);
        await window.electronAPI.saveOpsResidents(result.id, residents);
      }
      setDirty(false);
    } catch (err) {
      console.error('Failed to save ops plan:', err);
      showToast?.('Failed to save operations plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Field helpers ── */
  const updateField = (field: keyof OpsPlanData, value: any) => {
    setPlan(prev => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  };

  const toggleOpType = (type: string) => {
    setPlan(prev => {
      const ot = { ...prev.operation_type };
      ot[type] = !ot[type];
      return { ...prev, operation_type: ot };
    });
    scheduleAutoSave();
  };

  /* ── Entry team ── */
  const addTeamMember = () => {
    setEntryTeam(prev => [...prev, { name: '', assignment: '', vehicle: '', callSign: '' }]);
    scheduleAutoSave();
  };

  const updateTeamMember = (idx: number, field: keyof EntryTeamMember, value: string) => {
    setEntryTeam(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
    scheduleAutoSave();
  };

  const removeTeamMember = (idx: number) => {
    setEntryTeam(prev => prev.filter((_, i) => i !== idx));
    scheduleAutoSave();
  };

  /* ── Residents ── */
  const addResident = () => {
    setResidents(prev => [...prev, { name: '', dob: '', photo: null, hasFirearms: false, firearms: '', hasCrimHistory: false, crimHistory: '' }]);
    scheduleAutoSave();
  };

  const updateResident = (idx: number, field: keyof OtherResident, value: any) => {
    setResidents(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    scheduleAutoSave();
  };

  const removeResident = (idx: number) => {
    setResidents(prev => prev.filter((_, i) => i !== idx));
    scheduleAutoSave();
  };

  const uploadResidentPhoto = (idx: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        updateResident(idx, 'photo', ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  /* ── Location photos ── */
  const addLocationPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPlan(prev => ({
            ...prev,
            location_photos: [...prev.location_photos, { data: ev.target?.result as string, caption: file.name }]
          }));
          scheduleAutoSave();
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  };

  const removeLocationPhoto = (idx: number) => {
    setPlan(prev => ({
      ...prev,
      location_photos: prev.location_photos.filter((_, i) => i !== idx)
    }));
    scheduleAutoSave();
  };

  /* ── Upload signed PDF ── */
  const uploadSignedPdf = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        title: 'Select Signed Operations Plan PDF'
      });
      if (result.canceled || !result.filePaths?.length) return;
      const uploadResult = await window.electronAPI.uploadCaseFile({
        caseNumber, category: 'operations_plan', sourcePath: result.filePaths[0], filename: 'ops_plan.pdf',
      });
      updateField('plan_pdf_path', uploadResult.relativePath);
      showToast?.('Signed PDF uploaded', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Failed to upload PDF', 'error');
    }
  };

  const viewSignedPdf = () => {
    if (plan.plan_pdf_path) {
      window.electronAPI.openFileLocation(plan.plan_pdf_path);
    }
  };

  /* ── Route Maps helpers ── */
  const geocodeAddress = async (address: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ICAC-PULSE-App' } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
  };

  const getRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes.length) return null;
    return data.routes[0];
  };

  const formatDuration = (seconds: number) => {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const formatDistance = (meters: number) => `${(meters * 0.000621371).toFixed(1)} mi`;

  const renderTurnByTurn = (steps: any[]) =>
    steps.map((s: any, i: number) => `${i + 1}. ${s.maneuver?.instruction || s.name} (${formatDistance(s.distance)})`).join('\n');

  const buildRouteMap = (
    container: HTMLDivElement, from: { lat: number; lng: number }, to: { lat: number; lng: number },
    route: any, fromLabel: string, toLabel: string, color: string
  ) => {
    // Clear any existing map
    container.innerHTML = '';
    const map = L.map(container, { zoomControl: true, attributionControl: false }).fitWorld();
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

    // Route line
    const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    L.polyline(coords, { color, weight: 5, opacity: 0.8 }).addTo(map);

    // Markers
    const fromIcon = L.divIcon({ className: '', html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
    const toIcon = L.divIcon({ className: '', html: `<div style="width:18px;height:18px;border-radius:50%;background:#00D4FF;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
    L.marker([from.lat, from.lng], { icon: fromIcon }).addTo(map).bindTooltip(fromLabel);
    L.marker([to.lat, to.lng], { icon: toIcon }).addTo(map).bindTooltip(toLabel);

    // Fit bounds
    const bounds = L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]);
    map.fitBounds(bounds, { padding: [40, 40] });

    return map;
  };

  /* ── Restore maps from saved route_data ── */
  const restoreRoutes = (routeData: any) => {
    if (!routeData) return;
    try {
      if (routeData.route1 && map1Ref.current) {
        const { from, to, route } = routeData.route1;
        if (leafletMap1.current) { leafletMap1.current.remove(); leafletMap1.current = null; }
        leafletMap1.current = buildRouteMap(map1Ref.current, from, to, route, 'Briefing', 'Operation', '#FF2A6D');
        setRouteInfo1({ distance: formatDistance(route.distance), duration: formatDuration(route.duration) });
      }
      if (routeData.route2 && map2Ref.current) {
        const { from, to, route } = routeData.route2;
        if (leafletMap2.current) { leafletMap2.current.remove(); leafletMap2.current = null; }
        leafletMap2.current = buildRouteMap(map2Ref.current, from, to, route, 'Operation', 'Hospital', '#FFA726');
        setRouteInfo2({ distance: formatDistance(route.distance), duration: formatDuration(route.duration) });
      }
    } catch (err) {
      console.error('Failed to restore routes from saved data:', err);
    }
  };

  const generateRoutes = async () => {
    const briefingAddr = plan.briefing_location;
    const operationAddr = plan.location;
    const hospitalAddr = plan.hospital;

    if (!operationAddr) {
      showToast?.('Enter an Operation Location first', 'info');
      return;
    }

    setGeneratingRoutes(true);
    try {
      const opGeo = await geocodeAddress(operationAddr);
      if (!opGeo) { showToast?.('Could not geocode operation location', 'error'); return; }

      let directionsText = '';
      const savedRouteData: any = {};

      // Route 1: Briefing → Operation
      if (briefingAddr && map1Ref.current) {
        const briefGeo = await geocodeAddress(briefingAddr);
        if (briefGeo) {
          if (leafletMap1.current) { leafletMap1.current.remove(); leafletMap1.current = null; }
          const route1 = await getRoute(briefGeo, opGeo);
          if (route1) {
            leafletMap1.current = buildRouteMap(map1Ref.current, briefGeo, opGeo, route1, 'Briefing', 'Operation', '#FF2A6D');
            setRouteInfo1({ distance: formatDistance(route1.distance), duration: formatDuration(route1.duration) });
            const steps1 = route1.legs[0]?.steps || [];
            directionsText += `BRIEFING → OPERATION (${formatDistance(route1.distance)}, ${formatDuration(route1.duration)}):\n${renderTurnByTurn(steps1)}\n\n`;
            savedRouteData.route1 = { from: briefGeo, to: opGeo, route: route1 };
          }
        }
      }

      // Route 2: Operation → Hospital
      if (hospitalAddr && map2Ref.current) {
        const hospGeo = await geocodeAddress(hospitalAddr);
        if (hospGeo) {
          if (leafletMap2.current) { leafletMap2.current.remove(); leafletMap2.current = null; }
          const route2 = await getRoute(opGeo, hospGeo);
          if (route2) {
            leafletMap2.current = buildRouteMap(map2Ref.current, opGeo, hospGeo, route2, 'Operation', 'Hospital', '#FFA726');
            setRouteInfo2({ distance: formatDistance(route2.distance), duration: formatDuration(route2.duration) });
            const steps2 = route2.legs[0]?.steps || [];
            directionsText += `OPERATION → HOSPITAL (${formatDistance(route2.distance)}, ${formatDuration(route2.duration)}):\n${renderTurnByTurn(steps2)}`;
            savedRouteData.route2 = { from: opGeo, to: hospGeo, route: route2 };
          }
        }
      }

      if (directionsText) updateField('directions', directionsText);
      // Persist route data so maps survive navigation
      updateField('route_data', savedRouteData);
      showToast?.('Routes generated', 'success');
    } catch (err) {
      console.error('Route generation failed:', err);
      showToast?.('Failed to generate routes', 'error');
    } finally {
      setGeneratingRoutes(false);
    }
  };

  // Cleanup maps on unmount
  useEffect(() => {
    return () => {
      if (leafletMap1.current) { leafletMap1.current.remove(); leafletMap1.current = null; }
      if (leafletMap2.current) { leafletMap2.current.remove(); leafletMap2.current = null; }
    };
  }, []);

  /* ── Generate Report (VIPER-style format) ── */
  const generateReport = async () => {
    // Save first
    await savePlan();

    // Load suspect data for the report
    let suspect: any = null;
    try { suspect = await window.electronAPI.getSuspect(caseId); } catch { /* no suspect data */ }

    // Capture map images as base64 using html-to-image
    let mapImage1 = '';
    let mapImage2 = '';
    try {
      if (map1Ref.current && leafletMap1.current) {
        mapImage1 = await toPng(map1Ref.current, { cacheBust: true, quality: 0.9 });
      }
    } catch (e) { console.warn('Map 1 capture failed:', e); }
    try {
      if (map2Ref.current && leafletMap2.current) {
        mapImage2 = await toPng(map2Ref.current, { cacheBust: true, quality: 0.9 });
      }
    } catch (e) { console.warn('Map 2 capture failed:', e); }

    const d = plan;
    const allOpTypes = ['Search Warrant', 'Arrest Warrant', 'Undercover Op', 'Surveillance', 'Buy/Bust', 'Probation/Parole', 'Knock & Talk', 'Other'];
    const opTypeStr = Object.entries(d.operation_type).filter(([, v]) => v).map(([k]) => k).join(', ') || '—';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const nowStr = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const agency = localStorage.getItem('userProfile_agency') || '';
    const badgeLogo = localStorage.getItem('userProfile_badgeLogo') || '';

    // Build TOC entries — each plan section is its own entry (VIPER style)
    const toc: { id: string; label: string }[] = [];
    toc.push({ id: 'sec-opinfo', label: 'Operation Information' });
    toc.push({ id: 'sec-hazards', label: 'Location & Hazards' });
    if (d.suspect_info) toc.push({ id: 'sec-suspinfo', label: 'Suspect Information' });
    if (residents.length > 0) toc.push({ id: 'sec-residents', label: 'Other Residents at Location' });
    if (entryTeam.length > 0) toc.push({ id: 'sec-team', label: 'Entry Team / Assignments' });
    toc.push({ id: 'sec-summary', label: 'Case Summary' });
    if (d.tactical_plan) toc.push({ id: 'sec-tactical', label: 'Tactical Plan' });
    if (d.pursuit_plan) toc.push({ id: 'sec-pursuit', label: 'Pursuit Plan / Runners' });
    if (d.medical_plan) toc.push({ id: 'sec-medical', label: 'Medical Plan / Officer Down' });
    if (d.barricade_plan) toc.push({ id: 'sec-barricade', label: 'Barricade Plan' });
    if (d.contingency_plan) toc.push({ id: 'sec-contingency', label: 'Contingency Plan' });
    if (d.directions) toc.push({ id: 'sec-directions', label: 'Directions & Routes' });
    if (d.location_photos?.length > 0) toc.push({ id: 'sec-photos', label: 'Location Photos' });
    if (suspect) toc.push({ id: 'sec-suspect', label: 'Suspect Intelligence Report (Attached)' });

    const esc = (s: string) => (s || '—').replace(/</g, '&lt;').replace(/\n/g, '<br>');

    // Helper: section heading with numbered cyan badge
    const secHead = (num: number, title: string, id: string, pageBreak = false) =>
      `<div id="${id}" style="display:flex;align-items:center;gap:10px;margin:${pageBreak ? '0' : '36px'} 0 14px;${pageBreak ? 'page-break-before:always;padding-top:10px;' : ''}">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#00D4FF;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">${num}</span>
        <span style="font-size:20px;font-weight:700;color:#1a1a1a">${title}</span>
      </div>
      <hr style="border:none;border-top:3px solid #00D4FF;margin:0 0 16px">`;

    // Helper: blockquote card (left cyan/red border)
    const blockCard = (content: string, borderColor = '#00D4FF') =>
      `<div style="border-left:4px solid ${borderColor};padding:14px 18px;margin:10px 0;background:#f8f9fa;border-radius:0 6px 6px 0">${content}</div>`;

    // Parse route directions into two blocks
    const dirLines = (d.directions || '').split('\n');
    let dir1Lines: string[] = [];
    let dir2Lines: string[] = [];
    let currentBlock = 1;
    for (const line of dirLines) {
      if (line.includes('OPERATION → HOSPITAL') || line.includes('OPERATION →')) currentBlock = 2;
      if (currentBlock === 1) dir1Lines.push(line);
      else dir2Lines.push(line);
    }

    let secNum = 0;
    const nextSec = () => ++secNum;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: letter; margin: 0.75in; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.5; }
      .cover { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center; }
      .cover h1 { font-size:38px;font-weight:900;color:#1a1a1a;margin-bottom:8px;letter-spacing:1px; }
      .cover .agency { font-size:18px;color:#666;margin-bottom:30px; }
      .cover .meta-box { border-left:4px solid #333;padding:16px 24px;text-align:left;margin:20px auto;max-width:480px;width:100%; }
      .cover .meta-box .ml { font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px; }
      .cover .meta-box .mv { font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:12px; }
      .cover .les { display:inline-block;padding:8px 28px;border:2px solid #dc2626;color:#dc2626;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-top:30px; }
      .toc-page { page-break-before:always;padding:40px 0; }
      .toc-title { font-size:22px;font-weight:700;border-bottom:3px solid #1a1a1a;padding-bottom:8px;margin-bottom:24px; }
      .toc-item { display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dotted #ccc;font-size:14px; }
      .toc-num { color:#00D4FF;font-weight:700;font-size:15px;min-width:24px; }
      .field-row { display:flex;gap:16px;margin-bottom:10px; }
      .field-box { flex:1; }
      .fl { font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px; }
      .fv { font-size:14px;padding:6px 0;border-bottom:1px solid #e0e0e0;min-height:24px; }
      .chk { display:inline-flex;align-items:center;gap:6px;margin-right:16px;margin-bottom:4px;font-size:13px; }
      .chk-box { width:16px;height:16px;border:2px solid #333;border-radius:3px;display:inline-flex;align-items:center;justify-content:center; }
      .chk-box.on { background:#00D4FF;border-color:#00D4FF; }
      .chk-box.on::after { content:'✓';color:#fff;font-size:11px;font-weight:700; }
      table { width:100%;border-collapse:collapse;margin:12px 0; }
      th { text-align:left;font-size:11px;text-transform:uppercase;color:#fff;background:#00D4FF;padding:8px;font-weight:700; }
      td { padding:8px;border-bottom:1px solid #eee;font-size:13px; }
      tr:nth-child(even) td { background:#f8f9fa; }
      .photo-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:12px 0; }
      .photo-grid img { width:100%;height:220px;object-fit:cover;border-radius:6px;border:1px solid #ddd; }
      .photo-cap { text-align:center;font-size:11px;color:#666;margin-top:4px; }
      .warning-red { color:#dc2626;font-weight:700; }
      .warning-amber { color:#d97706;font-weight:700; }
      .suspect-card { background:#f8f9fa;border-radius:8px;padding:20px;margin:16px 0; }
      .suspect-header { background:#333;color:#fff;padding:12px 18px;border-radius:6px 6px 0 0;font-size:16px;font-weight:700; }
      .sus-grid { display:flex;gap:20px;margin:16px 0; }
      .sus-photo { width:140px;height:170px;object-fit:cover;border-radius:8px;border:2px solid #ddd; }
      .sus-fields { flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px; }
      .id-row { display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #eee;font-size:13px; }
      .id-badge { display:inline-block;padding:2px 8px;border-radius:4px;background:#00D4FF;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;min-width:44px;text-align:center; }
      .veh-card { display:flex;gap:14px;border:1px solid #ddd;border-radius:8px;padding:14px;margin:8px 0; }
      .veh-photo { width:100px;height:70px;object-fit:cover;border-radius:6px; }
      .sub-header { font-size:14px;font-weight:700;color:#00D4FF;text-transform:uppercase;border-bottom:2px solid #00D4FF;padding-bottom:4px;margin:20px 0 10px; }
      .footer { text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:20px;border-top:2px solid #333; }
      .route-pair { display:flex;gap:16px;margin:14px 0; }
      .route-col { flex:1; }
      .route-card { border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:10px; }
      .route-card h4 { font-size:13px;font-weight:700;margin-bottom:6px; }
      .route-card img { width:100%;height:200px;object-fit:cover;border-radius:6px;margin-bottom:8px; }
      .dir-list { font-size:12px;line-height:1.7; }
    </style></head><body>

    <!-- COVER PAGE -->
    <div class="cover">
      ${badgeLogo ? `<img src="${badgeLogo}" style="width:100px;height:100px;object-fit:contain;margin:0 auto 16px;display:block;border-radius:12px;" />` : ''}
      <h1>OPERATIONS PLAN</h1>
      <p class="agency">${esc(agency)}</p>
      <div class="meta-box">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">
          <div><div class="ml">Case Number</div><div class="mv">${esc(d.report_number || caseNumber)}</div></div>
          <div><div class="ml">Date / Time</div><div class="mv">${esc(d.date || today)} ${d.time || ''}</div></div>
          <div><div class="ml">Case Agent</div><div class="mv">${esc(d.case_agent)}</div></div>
          <div><div class="ml">Operation Type</div><div class="mv">${esc(opTypeStr)}</div></div>
          <div><div class="ml">Location</div><div class="mv">${esc(d.location)}</div></div>
          <div><div class="ml">Generated</div><div class="mv">${today}</div></div>
        </div>
      </div>
      <div class="les">LAW ENFORCEMENT SENSITIVE</div>
    </div>

    <!-- TABLE OF CONTENTS -->
    <div class="toc-page">
      <div class="toc-title">Table of Contents</div>
      ${toc.map((t, i) => `<div class="toc-item"><span class="toc-num">${i + 1}</span><span>${t.label}</span></div>`).join('')}
    </div>

    <!-- 1. Operation Information -->
    ${secHead(nextSec(), 'Operation Information', 'sec-opinfo', true)}
    <div class="field-row">
      <div class="field-box"><div class="fl">Date</div><div class="fv">${esc(d.date)}</div></div>
      <div class="field-box"><div class="fl">Time</div><div class="fv">${esc(d.time)}</div></div>
    </div>
    <div class="field-row">
      <div class="field-box"><div class="fl">Report Number</div><div class="fv">${esc(d.report_number || caseNumber)}</div></div>
      <div class="field-box"><div class="fl">Case Agent</div><div class="fv">${esc(d.case_agent)}</div></div>
    </div>
    <div class="field-row">
      <div class="field-box"><div class="fl">Communications</div><div class="fv">${esc(d.comms)}</div></div>
      <div class="field-box"><div class="fl">Hospital</div><div class="fv">${esc(d.hospital)}</div></div>
    </div>
    <div style="margin:12px 0"><div class="fl">Type of Operation</div><div style="margin-top:6px;display:flex;flex-wrap:wrap">
      ${allOpTypes.map(t => `<span class="chk"><span class="chk-box${d.operation_type[t] ? ' on' : ''}"></span>${t}</span>`).join('')}
    </div></div>
    ${d.notifications ? `<div style="margin:12px 0"><div class="fl">Notifications</div>${blockCard(esc(d.notifications))}</div>` : ''}

    <!-- 2. Location & Hazards -->
    ${secHead(nextSec(), 'Location & Hazards', 'sec-hazards')}
    <div class="field-row">
      <div class="field-box"><div class="fl">Operation Location</div><div class="fv">${esc(d.location)}</div></div>
      <div class="field-box"><div class="fl">Briefing Location</div><div class="fv">${esc(d.briefing_location)}</div></div>
    </div>
    <div class="field-row">
      <div class="field-box"><div class="fl">Fortifications</div><div class="fv">${esc(d.fortifications)}</div></div>
      <div class="field-box"><div class="fl">Cameras</div><div class="fv">${esc(d.cameras)}</div></div>
      <div class="field-box"><div class="fl">Dogs</div><div class="fv">${esc(d.dogs)}</div></div>
      <div class="field-box"><div class="fl">Children Present</div><div class="fv">${esc(d.children)}</div></div>
    </div>
    <div class="field-row">
      <div class="field-box"><div class="fl">Rally Point</div><div class="fv">${esc(d.rally_point)}</div></div>
    </div>

    ${d.suspect_info ? `
    <!-- Suspect Information -->
    ${secHead(nextSec(), 'Suspect Information', 'sec-suspinfo')}
    ${blockCard(`<div style="white-space:pre-wrap;font-size:13px">${esc(d.suspect_info)}</div>`, '#dc2626')}
    ` : ''}

    ${residents.length > 0 ? `
    <!-- Other Residents -->
    ${secHead(nextSec(), 'Other Residents at Location', 'sec-residents')}
    ${residents.map(r => `
      <div style="border:1px solid #ddd;border-radius:8px;padding:14px;margin:10px 0;display:flex;gap:14px">
        ${r.photo ? `<img src="${r.photo}" style="width:70px;height:70px;border-radius:8px;object-fit:cover" />` : ''}
        <div style="flex:1">
          <p style="font-weight:700">${esc(r.name)}</p>
          ${r.dob ? `<p style="font-size:12px;color:#666">DOB: ${esc(r.dob)}</p>` : ''}
          ${r.hasFirearms ? `<p class="warning-red">⚠ Firearms: ${esc(r.firearms)}</p>` : ''}
          ${r.hasCrimHistory ? `<p class="warning-amber">Criminal History: ${esc(r.crimHistory)}</p>` : ''}
        </div>
      </div>
    `).join('')}
    ` : ''}

    ${entryTeam.length > 0 ? `
    <!-- Entry Team -->
    ${secHead(nextSec(), 'Entry Team / Assignments', 'sec-team')}
    <table>
      <thead><tr><th>Name</th><th>Assignment</th><th>Vehicle</th><th>Call Sign</th></tr></thead>
      <tbody>${entryTeam.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.assignment)}</td><td>${esc(m.vehicle)}</td><td>${esc(m.callSign)}</td></tr>`).join('')}</tbody>
    </table>
    ` : ''}

    <!-- Case Summary -->
    ${secHead(nextSec(), 'Case Summary', 'sec-summary')}
    ${d.case_summary ? blockCard(`<div style="white-space:pre-wrap">${esc(d.case_summary)}</div>`) : '<p style="color:#999;font-size:13px">No case summary entered.</p>'}

    ${d.tactical_plan ? `
    <!-- Tactical Plan -->
    ${secHead(nextSec(), 'Tactical Plan', 'sec-tactical', true)}
    ${blockCard(`<div style="white-space:pre-wrap">${esc(d.tactical_plan)}</div>`)}
    ` : ''}

    ${d.pursuit_plan ? `
    <!-- Pursuit Plan -->
    ${secHead(nextSec(), 'Pursuit Plan / Runners', 'sec-pursuit')}
    ${blockCard(`<div style="white-space:pre-wrap">${esc(d.pursuit_plan)}</div>`)}
    ` : ''}

    ${d.medical_plan ? `
    <!-- Medical Plan -->
    ${secHead(nextSec(), 'Medical Plan / Officer Down', 'sec-medical')}
    ${blockCard(`<div style="white-space:pre-wrap">${esc(d.medical_plan)}</div>`, '#dc2626')}
    ` : ''}

    ${d.barricade_plan ? `
    <!-- Barricade Plan -->
    ${secHead(nextSec(), 'Barricade Plan', 'sec-barricade')}
    ${blockCard(`<div style="white-space:pre-wrap">${esc(d.barricade_plan)}</div>`)}
    ` : ''}

    ${d.contingency_plan ? `
    <!-- Contingency Plan -->
    ${secHead(nextSec(), 'Contingency Plan', 'sec-contingency')}
    ${blockCard(`<div style="white-space:pre-wrap">${esc(d.contingency_plan)}</div>`)}
    ` : ''}

    ${d.directions ? `
    <!-- Directions & Routes -->
    ${secHead(nextSec(), 'Directions & Routes', 'sec-directions', true)}
    <div class="route-pair">
      <div class="route-col">
        <div class="route-card">
          <h4>📍 Briefing → Operation Location</h4>
          <p style="font-size:12px"><strong>From:</strong> ${esc(d.briefing_location)}</p>
          <p style="font-size:12px"><strong>To:</strong> ${esc(d.location)}</p>
          ${routeInfo1 ? `<p style="font-size:12px;margin-top:4px">${routeInfo1.distance} · ${routeInfo1.duration}</p>` : ''}
          ${mapImage1 ? `<img src="${mapImage1}" style="width:100%;height:200px;object-fit:cover;border-radius:6px;margin:8px 0" />` : ''}
        </div>
      </div>
      <div class="route-col">
        <div class="route-card">
          <h4>🏥 Operation Location → Hospital</h4>
          <p style="font-size:12px"><strong>From:</strong> ${esc(d.location)}</p>
          <p style="font-size:12px"><strong>To:</strong> ${esc(d.hospital)}</p>
          ${routeInfo2 ? `<p style="font-size:12px;margin-top:4px">${routeInfo2.distance} · ${routeInfo2.duration}</p>` : ''}
          ${mapImage2 ? `<img src="${mapImage2}" style="width:100%;height:200px;object-fit:cover;border-radius:6px;margin:8px 0" />` : ''}
        </div>
      </div>
    </div>
    ${blockCard(`<div class="dir-list">${esc(d.directions)}</div>`)}
    ` : ''}

    ${d.location_photos?.length > 0 ? `
    <!-- Location Photos -->
    ${secHead(nextSec(), 'Location Photos', 'sec-photos', true)}
    <div class="photo-grid">
      ${d.location_photos.map(p => `<div><img src="${p.data}" /><div class="photo-cap">${esc(p.caption || '')}</div></div>`).join('')}
    </div>
    ` : ''}

    ${suspect ? `
    <!-- Suspect Report follows as attached pages -->
    ${secHead(nextSec(), 'Suspect Intelligence Report', 'sec-suspect', true)}
    <p style="font-size:14px;color:#666;text-align:center;margin:40px 0">The full Suspect Intelligence Report — including photographs, identifiers, vehicle information, registered firearms, and criminal history — is attached as the following pages of this document.</p>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>This document is the property of ${esc(agency)} and is intended for law enforcement use only.</p>
      <p style="margin-top:4px">Generated by ICAC P.U.L.S.E. — ${nowStr}</p>
    </div>

    </body></html>`;

    try {
      const result = await window.electronAPI.exportOpsPlanPdf({ html, caseNumber, caseId, appendSuspectPdf: true });
      if (result?.success) {
        showToast?.(`PDF exported: ${result.filePath}`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Failed to export PDF', 'error');
    }
  };

  /* ── Import from Settings templates ── */
  const importFromSettings = () => {
    try {
      const teamJson = localStorage.getItem('opsTemplate_entryTeam');
      if (teamJson) {
        const team = JSON.parse(teamJson);
        if (Array.isArray(team) && team.length > 0) setEntryTeam(team);
      }
      const hospAddr = localStorage.getItem('opsTemplate_hospitalAddr') || '';
      if (hospAddr) updateField('hospital', hospAddr);

      // Strip "Name — " prefix from briefing address if present (only use the street address for geocoding)
      let briefAddr = localStorage.getItem('opsTemplate_briefingAddr') || '';
      if (briefAddr.includes(' — ')) briefAddr = briefAddr.split(' — ').slice(1).join(' — ').trim();
      if (briefAddr.includes(' - ') && /^[A-Z]/.test(briefAddr)) {
        // Also handle "Name - Address" with regular dash
        const parts = briefAddr.split(' - ');
        if (parts.length >= 2 && /\d/.test(parts[1])) briefAddr = parts.slice(1).join(' - ').trim();
      }
      if (briefAddr) updateField('briefing_location', briefAddr);

      const comms = localStorage.getItem('opsTemplate_commsChannel') || '';
      if (comms) updateField('comms', comms);

      const notifications = localStorage.getItem('opsTemplate_notifications') || '';
      if (notifications) updateField('notifications', notifications);

      const tactical = localStorage.getItem('opsTemplate_tacticalPlan') || '';
      if (tactical) updateField('tactical_plan', tactical);

      const pursuit = localStorage.getItem('opsTemplate_pursuitPlan') || '';
      if (pursuit) updateField('pursuit_plan', pursuit);

      const medical = localStorage.getItem('opsTemplate_medicalPlan') || '';
      if (medical) updateField('medical_plan', medical);

      const barricade = localStorage.getItem('opsTemplate_barricadePlan') || '';
      if (barricade) updateField('barricade_plan', barricade);

      const contingency = localStorage.getItem('opsTemplate_contingencyPlan') || '';
      if (contingency) updateField('contingency_plan', contingency);

      scheduleAutoSave();
      showToast?.('Imported template data from Settings', 'success');
    } catch (err) {
      console.error('Failed to import from settings:', err);
      showToast?.('No template data found — configure in Settings first', 'error');
    }
  };

  /* ── Auto-populate from suspect tab ── */
  const autoPopulateSuspect = async () => {
    try {
      const suspect = await window.electronAPI.getSuspect(caseId);
      if (!suspect) {
        showToast?.('No suspect data found for this case', 'info');
        return;
      }
      const lines: string[] = [];
      if (suspect.first_name || suspect.last_name) lines.push(`Name: ${suspect.first_name || ''} ${suspect.last_name || ''}`.trim());
      if (suspect.dob) lines.push(`DOB: ${suspect.dob}`);
      if (suspect.address) lines.push(`Address: ${suspect.address}`);
      if (suspect.height || suspect.weight) lines.push(`Physical: ${[suspect.height, suspect.weight].filter(Boolean).join(', ')}`);
      if (suspect.hair_color || suspect.eye_color) lines.push(`Hair: ${suspect.hair_color || '—'}, Eyes: ${suspect.eye_color || '—'}`);
      const veh = [suspect.vehicle_color, suspect.vehicle_make, suspect.vehicle_model].filter(Boolean).join(' ');
      if (veh) lines.push(`Vehicle: ${veh}${suspect.license_plate ? ' / ' + suspect.license_plate : ''}`);
      if (suspect.phone) lines.push(`Phone: ${suspect.phone}`);
      if (suspect.has_weapons) lines.push('⚠ ARMED — Weapons on file');
      if (suspect.notes) lines.push(`Notes: ${suspect.notes}`);
      updateField('suspect_info', lines.join('\n'));
      showToast?.('Suspect info populated', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Failed to load suspect data', 'error');
    }
  };

  /* ── Manual save ── */
  const handleManualSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await savePlan();
    showToast?.('Operations plan saved', 'success');
  };

  /* ─────────────────────────── Render ─────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 bg-panel border border-accent-cyan/20 rounded-lg text-text-primary text-sm focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan/30 transition placeholder:text-text-muted/50";
  const textareaClass = `${inputClass} resize-none`;
  const labelClass = "text-xs text-text-muted uppercase tracking-wide block mb-1";
  const cardClass = "bg-panel/60 border border-accent-cyan/10 rounded-xl p-5 backdrop-blur-sm";
  const btnCyan = "px-4 py-2 bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 rounded-lg text-accent-cyan text-sm font-medium transition";
  const btnPink = "px-4 py-2 bg-accent-pink/20 hover:bg-accent-pink/30 border border-accent-pink/40 rounded-lg text-accent-pink text-sm font-medium transition";

  return (
    <div className="space-y-4 p-1 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-text-primary">Operations Plan</h2>
          {dirty && <span className="text-xs text-status-warning animate-pulse">● Unsaved</span>}
          {saving && <span className="text-xs text-accent-cyan animate-pulse">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleManualSave} className={btnCyan}>
            💾 Save
          </button>
          <button onClick={generateReport} className={btnCyan}>
            📄 Generate OPS Plan
          </button>
          <button onClick={importFromSettings} className="px-4 py-2 bg-accent-pink/10 hover:bg-accent-pink/20 border border-accent-pink/30 rounded-lg text-accent-pink text-sm font-medium transition">
            ⚙ Import from Settings
          </button>
          <button onClick={autoPopulateSuspect} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-sm font-medium transition">
            🔸 Auto-Populate Suspects
          </button>
          <button onClick={uploadSignedPdf} className={btnPink}>
            📎 Upload Signed Plan
          </button>
          {plan.plan_pdf_path && (
            <button onClick={viewSignedPdf} className="px-4 py-2 bg-status-success/20 hover:bg-status-success/30 border border-status-success/40 rounded-lg text-status-success text-sm font-medium transition">
              👁 View Signed PDF
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Date, Time, Report#, Case Agent */}
      <div className={cardClass}>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" value={plan.date} onChange={e => updateField('date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input type="time" value={plan.time} onChange={e => updateField('time', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Report #</label>
            <input type="text" value={plan.report_number} onChange={e => updateField('report_number', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Case Agent</label>
            <input type="text" value={plan.case_agent} onChange={e => updateField('case_agent', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Type of Operation */}
      <div className={cardClass}>
        <label className={labelClass}>Type of Operation</label>
        <div className="flex flex-wrap gap-4 mt-2">
          {OP_TYPES.map(type => (
            <label key={type} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={!!plan.operation_type[type]}
                onChange={() => toggleOpType(type)}
                className="w-4 h-4 accent-accent-cyan"
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Location + Hazards */}
      <div className={cardClass}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Location of Operation</label>
            <input type="text" value={plan.location} onChange={e => updateField('location', e.target.value)} className={inputClass} placeholder="Address of target location" />
          </div>
          <div>
            <label className={labelClass}>Briefing Location</label>
            <input type="text" value={plan.briefing_location} onChange={e => updateField('briefing_location', e.target.value)} className={inputClass} placeholder="Where team will brief" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Fortifications</label>
            <input type="text" value={plan.fortifications} onChange={e => updateField('fortifications', e.target.value)} className={inputClass} placeholder="Bars, gates, etc." />
          </div>
          <div>
            <label className={labelClass}>Cameras</label>
            <input type="text" value={plan.cameras} onChange={e => updateField('cameras', e.target.value)} className={inputClass} placeholder="Yes/No, locations" />
          </div>
          <div>
            <label className={labelClass}>Dogs</label>
            <input type="text" value={plan.dogs} onChange={e => updateField('dogs', e.target.value)} className={inputClass} placeholder="Yes/No, type" />
          </div>
          <div>
            <label className={labelClass}>Children Present</label>
            <input type="text" value={plan.children} onChange={e => updateField('children', e.target.value)} className={inputClass} placeholder="Yes/No, ages" />
          </div>
        </div>
      </div>

      {/* Comms, Hospital, Rally Point, Notifications */}
      <div className={cardClass}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Communications / Radio</label>
            <input type="text" value={plan.comms} onChange={e => updateField('comms', e.target.value)} className={inputClass} placeholder="Channel / frequency" />
          </div>
          <div>
            <label className={labelClass}>Hospital</label>
            <input type="text" value={plan.hospital} onChange={e => updateField('hospital', e.target.value)} className={inputClass} placeholder="Nearest hospital" />
          </div>
          <div>
            <label className={labelClass}>Rally Point</label>
            <input type="text" value={plan.rally_point} onChange={e => updateField('rally_point', e.target.value)} className={inputClass} placeholder="Designated rally point" />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Notifications (who to notify prior)</label>
          <textarea value={plan.notifications} onChange={e => updateField('notifications', e.target.value)} rows={2} className={textareaClass} placeholder="Watch Commander, Dispatch, etc." />
        </div>
      </div>

      {/* Suspect Info */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-2">
          <label className={labelClass}>Suspect Information</label>
          <button
            onClick={async () => {
              try {
                const s = await window.electronAPI.getSuspect(caseId);
                if (s) {
                  const info = [
                    `Name: ${s.first_name || ''} ${s.last_name || ''}`.trim(),
                    s.dob ? `DOB: ${s.dob}` : null,
                    s.address ? `Address: ${s.address}` : null,
                    s.phone ? `Phone: ${s.phone}` : null,
                    (s.vehicle_make || s.vehicle_model) ? `Vehicle: ${[s.vehicle_color, s.vehicle_make, s.vehicle_model].filter(Boolean).join(' ')}` : null,
                    s.license_plate ? `Plate: ${s.license_plate}` : null,
                    s.has_weapons ? '⚠ ARMED' : null,
                  ].filter(Boolean).join('\n');
                  updateField('suspect_info', info);
                  showToast?.('Suspect info populated', 'info');
                } else {
                  showToast?.('No suspect data found', 'info');
                }
              } catch { showToast?.('Failed to load suspect', 'error'); }
            }}
            className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition"
          >
            ↻ Refresh from Suspect Tab
          </button>
        </div>
        <textarea value={plan.suspect_info} onChange={e => updateField('suspect_info', e.target.value)} rows={6} className={`${textareaClass} font-mono`} placeholder="Click 'Refresh from Suspect Tab' to auto-populate..." />
      </div>

      {/* Other Residents */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-3">
          <label className={labelClass}>Other Residents at Location</label>
          <button onClick={addResident} className={btnCyan + ' !py-1 !px-3 !text-xs'}>+ Add Resident</button>
        </div>
        {residents.length === 0 ? (
          <p className="text-text-muted text-xs">No other residents added</p>
        ) : (
          <div className="space-y-3">
            {residents.map((r, i) => (
              <div key={i} className="bg-background/50 border border-accent-cyan/10 rounded-lg p-4 flex gap-4">
                {/* Photo */}
                <div className="flex flex-col items-center gap-2">
                  {r.photo ? (
                    <img src={r.photo} alt="Resident" className="w-20 h-20 rounded-lg object-cover border border-accent-cyan/30 cursor-pointer" onClick={() => window.open(r.photo!, '_blank')} />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-panel border border-accent-cyan/20 flex items-center justify-center text-text-muted text-2xl">👤</div>
                  )}
                  <button onClick={() => uploadResidentPhoto(i)} className="text-xs text-accent-cyan hover:underline">
                    {r.photo ? 'Change' : 'Upload'}
                  </button>
                </div>
                {/* Fields */}
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Name</label>
                      <input type="text" value={r.name} onChange={e => updateResident(i, 'name', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>DOB</label>
                      <input type="date" value={r.dob} onChange={e => updateResident(i, 'dob', e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                      <input type="checkbox" checked={r.hasFirearms} onChange={e => updateResident(i, 'hasFirearms', e.target.checked)} className="w-4 h-4 accent-accent-pink" />
                      Firearms
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                      <input type="checkbox" checked={r.hasCrimHistory} onChange={e => updateResident(i, 'hasCrimHistory', e.target.checked)} className="w-4 h-4 accent-accent-pink" />
                      Criminal History
                    </label>
                  </div>
                  {r.hasFirearms && (
                    <div>
                      <label className={labelClass}>Firearms Details</label>
                      <input type="text" value={r.firearms} onChange={e => updateResident(i, 'firearms', e.target.value)} className={inputClass} placeholder="List known firearms..." />
                    </div>
                  )}
                  {r.hasCrimHistory && (
                    <div>
                      <label className={labelClass}>Criminal History</label>
                      <input type="text" value={r.crimHistory} onChange={e => updateResident(i, 'crimHistory', e.target.value)} className={inputClass} placeholder="List relevant history..." />
                    </div>
                  )}
                </div>
                {/* Remove */}
                <button onClick={() => removeResident(i)} className="text-accent-pink/60 hover:text-accent-pink transition self-start" title="Remove">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Team */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-3">
          <label className={labelClass}>Entry Team / Assignments</label>
          <button onClick={addTeamMember} className={btnCyan + ' !py-1 !px-3 !text-xs'}>+ Add Row</button>
        </div>
        {entryTeam.length === 0 ? (
          <p className="text-text-muted text-xs">No team members added. Click "+ Add Row" to begin.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wide border-b border-accent-cyan/20">
                <th className="pb-2 pr-2">Name</th>
                <th className="pb-2 pr-2">Assignment</th>
                <th className="pb-2 pr-2">Vehicle</th>
                <th className="pb-2 pr-2">Call Sign</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entryTeam.map((m, i) => (
                <tr key={i} className="border-b border-accent-cyan/5">
                  <td className="py-2 pr-2"><input type="text" value={m.name} onChange={e => updateTeamMember(i, 'name', e.target.value)} className={inputClass + ' !py-1.5'} /></td>
                  <td className="py-2 pr-2"><input type="text" value={m.assignment} onChange={e => updateTeamMember(i, 'assignment', e.target.value)} className={inputClass + ' !py-1.5'} /></td>
                  <td className="py-2 pr-2"><input type="text" value={m.vehicle} onChange={e => updateTeamMember(i, 'vehicle', e.target.value)} className={inputClass + ' !py-1.5'} /></td>
                  <td className="py-2 pr-2"><input type="text" value={m.callSign} onChange={e => updateTeamMember(i, 'callSign', e.target.value)} className={inputClass + ' !py-1.5'} /></td>
                  <td className="py-2">
                    <button onClick={() => removeTeamMember(i)} className="text-accent-pink/60 hover:text-accent-pink transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Case Summary */}
      <div className={cardClass}>
        <label className={labelClass}>Case Summary</label>
        <textarea value={plan.case_summary} onChange={e => updateField('case_summary', e.target.value)} rows={4} className={textareaClass} placeholder="Brief summary of the case and reason for the operation..." />
      </div>

      {/* Plans (2-col) */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cardClass}>
          <label className={labelClass}>Tactical Plan</label>
          <textarea value={plan.tactical_plan} onChange={e => updateField('tactical_plan', e.target.value)} rows={5} className={textareaClass} placeholder="Tactical operations plan..." />
        </div>
        <div className={cardClass}>
          <label className={labelClass}>Pursuit Plan / Runners</label>
          <textarea value={plan.pursuit_plan} onChange={e => updateField('pursuit_plan', e.target.value)} rows={5} className={textareaClass} placeholder="Pursuit and runners plan..." />
        </div>
        <div className={cardClass}>
          <label className={labelClass}>Medical Plan / Officer Down</label>
          <textarea value={plan.medical_plan} onChange={e => updateField('medical_plan', e.target.value)} rows={5} className={textareaClass} placeholder="Medical plan and officer down procedure..." />
        </div>
        <div className={cardClass}>
          <label className={labelClass}>Barricade Plan</label>
          <textarea value={plan.barricade_plan} onChange={e => updateField('barricade_plan', e.target.value)} rows={5} className={textareaClass} placeholder="Barricade procedure..." />
        </div>
      </div>
      <div className={cardClass}>
        <label className={labelClass}>Contingency Plan</label>
        <textarea value={plan.contingency_plan} onChange={e => updateField('contingency_plan', e.target.value)} rows={3} className={textareaClass} placeholder="Contingency plan..." />
      </div>

      {/* Directions & Route Maps */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className={labelClass + ' !mb-0'}>Directions & Route Maps</label>
            <p className="text-text-muted/50 text-xs mt-1">Uses Briefing Location, Operation Location, and Hospital fields above. Click "Generate Routes" to map both routes.</p>
          </div>
          <button
            onClick={generateRoutes}
            disabled={generatingRoutes}
            className={btnCyan + (generatingRoutes ? ' opacity-50 cursor-wait' : '')}
          >
            {generatingRoutes ? '⏳ Generating...' : '🗺️ Generate Routes'}
          </button>
        </div>

        {/* Maps side by side */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <p className="text-xs font-semibold text-accent-pink mb-1">📍 Briefing → Operation Location</p>
            <div className="relative">
              <div
                ref={map1Ref}
                className="w-full h-64 rounded-lg border border-accent-cyan/20 bg-background overflow-hidden"
                style={{ minHeight: 256 }}
              />
              {!routeInfo1 && (
                <div className="absolute inset-0 flex items-center justify-center text-text-muted/40 text-sm pointer-events-none">
                  Click "Generate Routes" to display map
                </div>
              )}
            </div>
            {routeInfo1 && (
              <p className="text-xs mt-1.5">
                <span className="text-accent-pink font-semibold">{routeInfo1.distance}</span>
                <span className="text-text-muted"> · {routeInfo1.duration}</span>
              </p>
            )}
          </div>
          {/* Route 2: Operation → Hospital */}
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-1">🏥 Operation Location → Hospital</p>
            <div className="relative">
              <div
                ref={map2Ref}
                className="w-full h-64 rounded-lg border border-accent-cyan/20 bg-background overflow-hidden"
                style={{ minHeight: 256 }}
              />
              {!routeInfo2 && (
                <div className="absolute inset-0 flex items-center justify-center text-text-muted/40 text-sm pointer-events-none">
                  Click "Generate Routes" to display map
                </div>
              )}
            </div>
            {routeInfo2 && (
              <p className="text-xs mt-1.5">
                <span className="text-amber-400 font-semibold">{routeInfo2.distance}</span>
                <span className="text-text-muted"> · {routeInfo2.duration}</span>
              </p>
            )}
          </div>
        </div>

        {/* Directions textarea */}
        <div className="mt-4">
          <label className={labelClass}>Additional Directions / Notes</label>
          <textarea value={plan.directions} onChange={e => updateField('directions', e.target.value)} rows={4} className={textareaClass} placeholder="Turn-by-turn directions auto-fill here when routes are generated. Add extra notes, landmarks, rally points..." />
        </div>
      </div>

      {/* Location Photos */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-3">
          <label className={labelClass}>📷 Location Photos</label>
          <button onClick={addLocationPhoto} className={btnCyan + ' !py-1 !px-3 !text-xs'}>+ Add Photos</button>
        </div>
        {plan.location_photos.length === 0 ? (
          <p className="text-text-muted text-xs">No location photos added</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {plan.location_photos.map((photo, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden bg-background border border-accent-cyan/20 h-40">
                <img src={photo.data} alt={photo.caption || 'Location'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                  <button onClick={() => window.open(photo.data, '_blank')} className="px-3 py-1 bg-accent-cyan/30 rounded text-accent-cyan text-xs">View</button>
                  <button onClick={() => removeLocationPhoto(i)} className="px-3 py-1 bg-accent-pink/30 rounded text-accent-pink text-xs">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
