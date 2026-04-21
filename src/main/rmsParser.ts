/**
 * RMS Report Parser — ports 4 parser formats from VIPER's case-detail-with-analytics.html
 *
 * Formats:
 *   1. Prosecution Report   — Defendant Information + Case Filing Information
 *   2. Incident Summary     — Westminster PD / officer report summary style
 *   3. Field Incident Report — Virginia / NIBRS-style
 *   4. INFORM RMS           — original/default format
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RmsOffense {
  number: number;
  status: string;
  statute: string;
  description: string;
  severity: string;
}

export interface RmsPerson {
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

export interface RmsVehicle {
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

export interface RmsProperty {
  holdReason: string;
  articleType: string;
  make: string;
  description: string;
  quantity: string;
  value: string;
  recoveredValue: string;
}

export interface RmsNarrative {
  officer: string;
  badge: string;
  text: string;
}

export interface RmsDigital {
  officer: string;
  badge: string;
  description: string;
}

export interface RmsReport {
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
  confidentialPersons: RmsPerson[];
  rawText: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(): string {
  return 'rms_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function emptyReport(fileName: string): RmsReport {
  return {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: '',
    reportDate: '',
    reportType: '',
    supplementNo: '',
    agencyName: '',
    location: '',
    beat: '',
    fromDateTime: '',
    toDateTime: '',
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: ''
  };
}

// ---------------------------------------------------------------------------
// Format detection & dispatch
// ---------------------------------------------------------------------------

export function parseRmsReport(text: string, fileName: string): RmsReport {
  // 1. Prosecution Report format
  if (/Defendant Information/i.test(text) && /Case Filing Information/i.test(text)) {
    return parseProsecutionReport(text, fileName);
  }
  // 2. Incident Summary format (Westminster PD style)
  if (
    /Summary of\s*\n?\s*Officer Report Contents/i.test(text) ||
    /Suspect\(s\)\s*-\s*\d+\s*Involved/i.test(text) ||
    /Other Person\(s\)\s*-\s*\d+\s*Involved/i.test(text) ||
    /Victim\(s\)\s*-\s*\d+\s*Involved/i.test(text) ||
    /^\s*(Initial Incident Report|Supplemental Report)\s*$/m.test(text)
  ) {
    return parseIncidentSummary(text, fileName);
  }
  // 3. Field Incident Report (Virginia / NIBRS-style)
  if (/INCIDENT PAGE \d+/i.test(text) && /Incident No\.\s*\n/i.test(text)) {
    return parseFieldIncidentReport(text, fileName);
  }
  // 4. Suspect Intelligence Report (case management export)
  if (/SUSPECT INTELLIGENCE REPORT/i.test(text) || /Suspect Description[\s\S]{0,50}FIRST NAME/i.test(text)) {
    return parseSuspectIntelReport(text, fileName);
  }
  // 5. Original INFORM RMS (default)
  return parseInformRms(text, fileName);
}

// ===========================================================================
// Parser 1 — Prosecution Report
// ===========================================================================

function parseProsecutionReport(text: string, fileName: string): RmsReport {
  const rawLines = text.split('\n').map(l => l.trim());
  // Strip page headers: "Page N of N", "Westminster PD Prosecution Report - Continued",
  // "Defendant: Name  DOB: ...", "Filing Type: ...", "WPD Case Number: ..."
  const cleaned: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    if (/^Page \d+ of \d+$/.test(l)) continue;
    if (/Prosecution Report\s*-\s*Continued/i.test(l)) continue;
    if (/^Defendant:\s+.+\s+DOB:/i.test(l)) continue;
    if (/^Filing Type:\s+/i.test(l) && /^\w/.test(rawLines[i - 1] || '')) continue; // skip header-repeat filing type
    if (/^WPD Case Number:\s+/i.test(l)) continue;
    if (/^\w+ Police Department$/.test(l) && /^Prosecution Report$/i.test(rawLines[i + 1] || '')) { i++; continue; }
    if (/^Prosecution Report$/i.test(l)) continue;
    if (/^\w+ County Court$/i.test(l)) continue;
    cleaned.push(l);
  }
  const lines = cleaned;

  const report: RmsReport = {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: '',
    reportDate: '',
    reportType: 'Prosecution Report',
    supplementNo: '',
    agencyName: '',
    location: '',
    beat: '',
    fromDateTime: '',
    toDateTime: '',
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: text
  };

  // Find major section starts
  const defIdx = lines.indexOf('Defendant Information');
  const filingIdx = lines.findIndex(l => /Case Filing Information/.test(l));
  const incIdx = lines.indexOf('Incident Information');
  const chargesIdx = lines.findIndex(l => /^Charges\s*\(\d+\)/.test(l));
  const witnessIdx = lines.indexOf('Witnesses');
  const empWitIdx = lines.findIndex(l => /Employee Witnesses/.test(l));
  const evidIdx = lines.indexOf('Evidence');
  const vicLabelIdx = lines.indexOf('Victim Name');
  const synopsisIdx = lines.indexOf('Case Synopsis');

  // ---- Defendant ----
  if (defIdx >= 0) {
    const end = filingIdx > defIdx ? filingIdx : incIdx > defIdx ? incIdx : lines.length;
    const defLines = lines.slice(defIdx, end);
    const def: RmsPerson = {
      involvement: 'DEFENDANT', name: '', dob: '', age: '', race: '', sex: '',
      ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
      comments: '', guardian: '', detail: ''
    };
    for (let j = 0; j < defLines.length - 1; j++) {
      const dl = defLines[j];
      const nv = defLines[j + 1];
      if (dl === 'Defendant Name') { def.name = nv; j++; }
      else if (dl === 'Date Of Birth') { def.dob = nv; j++; }
      else if (dl === 'Age') { def.age = nv; j++; }
      else if (dl === 'Race') { def.race = nv; j++; }
      else if (dl === 'Sex') { def.sex = nv; j++; }
      else if (dl === 'Ethnicity') { def.ethnicity = nv; j++; }
      else if (dl === "Defendant's Address" || dl === 'Defendant Address') { def.address = nv; j++; }
      else if (/^Phone\s*\d?$/i.test(dl) && nv && /\(\d{3}\)|\d{3}-\d{3}/.test(nv)) { def.phone = def.phone ? def.phone + '; ' + nv : nv; j++; }
      else if (dl === 'Height') { def.height = nv; j++; }
      else if (dl === 'Weight') { def.weight = nv; j++; }
      else if (dl === 'Hair') { def.hair = nv; j++; }
      else if (dl === 'Eyes') { def.eyes = nv; j++; }
      else if (dl === "Driver's License #" || dl === 'Driver License #') { /* dl field — stored in detail */ def.detail = (def.detail ? def.detail + '; ' : '') + 'DL: ' + nv; j++; }
      else if (dl === 'License State') { def.detail = (def.detail ? def.detail + '; ' : '') + 'DL State: ' + nv; j++; }
      else if (dl === 'SID Number') { def.detail = (def.detail ? def.detail + '; ' : '') + 'SID: ' + nv; j++; }
      else if (dl === 'FBI Number') { def.detail = (def.detail ? def.detail + '; ' : '') + 'FBI: ' + nv; j++; }
    }
    report.personsInvolved.push(def);
  }

  // ---- Filing Type (between defendant and filing info) ----
  {
    const searchStart = defIdx >= 0 ? defIdx : 0;
    const searchEnd = filingIdx > searchStart ? filingIdx : incIdx > searchStart ? incIdx : lines.length;
    for (let j = searchStart; j < searchEnd - 1; j++) {
      if (lines[j] === 'Filing Type') {
        report.supplementNo = lines[j + 1]; // store filing type in supplementNo field
        break;
      }
    }
  }

  // ---- Filing Info ----
  if (filingIdx >= 0) {
    const end = incIdx > filingIdx ? incIdx : lines.length;
    const fLines = lines.slice(filingIdx, end);
    for (let j = 0; j < fLines.length - 1; j++) {
      if (fLines[j] === 'Date Of Filing') report.reportDate = fLines[j + 1];
      if (/Filing Officer/i.test(fLines[j])) {
        const narr: RmsNarrative = {
          officer: fLines[j + 1].replace(/\s+\d+$/, ''),
          badge: (fLines[j + 1].match(/(\d+)$/) || [])[1] || '',
          text: 'Filing Officer/Detective'
        };
        report.narratives.push(narr);
      }
    }
  }

  // ---- Incident Info ----
  if (incIdx >= 0) {
    const end = vicLabelIdx > incIdx ? vicLabelIdx : chargesIdx > incIdx ? chargesIdx : witnessIdx > incIdx ? witnessIdx : lines.length;
    const iLines = lines.slice(incIdx, end);
    for (let j = 0; j < iLines.length - 1; j++) {
      if (iLines[j] === 'Date Reported') report.reportDate = report.reportDate || iLines[j + 1];
      if (iLines[j] === 'Occurred From') report.fromDateTime = iLines[j + 1];
      if (iLines[j] === 'Occurred To') report.toDateTime = iLines[j + 1];
      if (iLines[j] === 'Incident Location') report.location = iLines[j + 1];
      if (iLines[j] === 'Case Number') report.reportNumber = iLines[j + 1];
    }
  }

  // ---- Victim ----
  if (vicLabelIdx >= 0) {
    const end = chargesIdx > vicLabelIdx ? chargesIdx : witnessIdx > vicLabelIdx ? witnessIdx : lines.length;
    const vLines = lines.slice(vicLabelIdx, end);
    const vic: RmsPerson = {
      involvement: 'VICTIM', name: '', dob: '', age: '', race: '', sex: '',
      ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
      comments: '', guardian: '', detail: ''
    };
    const knownVicLabels = /^(Date Of Birth|Age|Race|Sex|Phone|Ethnicity|Height|Weight|Hair|Eyes|Case Synopsis|Victim Name|Charges?|Witness)$/;
    let collectAddr = false;
    const addrParts: string[] = [];
    for (let j = 0; j < vLines.length; j++) {
      const vl = vLines[j];
      const nv = vLines[j + 1] || '';
      if (vl === 'Victim Name') { vic.name = nv; collectAddr = true; j++; }
      else if (collectAddr && !knownVicLabels.test(vl) && vl.length > 2) { addrParts.push(vl); }
      else if (vl === 'Date Of Birth' && !vic.dob) { collectAddr = false; vic.dob = nv; j++; }
      else if (vl === 'Age' && !vic.age) { collectAddr = false; vic.age = nv; j++; }
      else if (vl === 'Race' && !vic.race) { collectAddr = false; vic.race = nv; j++; }
      else if (vl === 'Sex' && !vic.sex) { collectAddr = false; vic.sex = nv; j++; }
      else if (vl === 'Ethnicity') { collectAddr = false; vic.ethnicity = nv; j++; }
      else if (vl === 'Phone' && nv && /\(\d{3}\)/.test(nv)) { collectAddr = false; vic.phone = nv; j++; }
      else if (vl === 'Height' && nv && /\d/.test(nv)) { collectAddr = false; vic.height = nv; j++; }
      else if (vl === 'Weight' && nv && /\d/.test(nv)) { collectAddr = false; vic.weight = nv; j++; }
      else if (vl === 'Hair' && nv) { collectAddr = false; vic.hair = nv; j++; }
      else if (vl === 'Eyes' && nv) { collectAddr = false; vic.eyes = nv; j++; }
      else { collectAddr = false; }
    }
    if (addrParts.length) vic.address = addrParts.join(', ');
    if (vic.name) report.personsInvolved.push(vic);
  }

  // ---- Charges ----
  if (chargesIdx >= 0) {
    // Capture Case Synopsis if it appears before charges
    if (synopsisIdx >= 0 && synopsisIdx < chargesIdx) {
      const synEnd = chargesIdx;
      const synLines: string[] = [];
      for (let j = synopsisIdx + 1; j < synEnd; j++) {
        if (lines[j]) synLines.push(lines[j]);
      }
      if (synLines.length) {
        report.narratives.push({ officer: '', badge: '', text: 'Case Synopsis: ' + synLines.join(' ') });
      }
    }
    const end = witnessIdx > chargesIdx ? witnessIdx : vicLabelIdx > chargesIdx ? vicLabelIdx : lines.length;
    const cLines = lines.slice(chargesIdx + 1, end);
    let currentCharge: RmsOffense | null = null;
    for (let j = 0; j < cLines.length; j++) {
      const cl = cLines[j];
      if (/^Charge\s+/.test(cl) || (cl === 'Charge' && cLines[j + 1])) {
        if (currentCharge) report.offenses.push(currentCharge);
        const statuteText = cl.replace(/^Charge\s*/, '') || cLines[j + 1] || '';
        currentCharge = { number: report.offenses.length + 1, status: '', statute: '', description: statuteText, severity: '' };
        if (cl === 'Charge') j++; // skip next line (already consumed)
      } else if (/^\d+$/.test(cl) && currentCharge) {
        currentCharge.number = parseInt(cl);
      } else if (/Attempted or Completed/i.test(cl) && currentCharge) {
        const m = cl.match(/Attempted or Completed\s+(Completed|Attempted)/i);
        if (m) currentCharge.status = m[1].toUpperCase();
      } else if (/Severity\/Class/i.test(cl) && currentCharge) {
        const m = cl.match(/Severity\/Class\s+(.*)/i);
        if (m) currentCharge.severity = m[1].trim();
      } else if (currentCharge && !currentCharge.description && cl.length > 10) {
        currentCharge.description += ' ' + cl;
      }
    }
    if (currentCharge) report.offenses.push(currentCharge);
  }

  // ---- Witnesses ----
  if (witnessIdx >= 0) {
    // Extend range past Employee Witnesses to capture all Witness #N blocks
    const end = evidIdx > witnessIdx ? evidIdx : lines.length;
    const wLines = lines.slice(witnessIdx + 1, end);
    let currentWit: RmsPerson | null = null;
    let collectAddr = false;
    let addrParts: string[] = [];
    let inEmployeeBlock = false;
    for (let j = 0; j < wLines.length; j++) {
      const wl = wLines[j];
      const nv = wLines[j + 1] || '';
      // Skip employee witness blocks embedded between civilian witnesses
      if (/Employee (Witnesses|Name)/i.test(wl)) { inEmployeeBlock = true; continue; }
      if (inEmployeeBlock) {
        if (/^Witness #\d+/.test(wl)) inEmployeeBlock = false;
        else continue;
      }
      if (/^Witness #\d+/.test(wl)) {
        if (currentWit) {
          if (addrParts.length) currentWit.address = addrParts.join(', ');
          report.personsInvolved.push(currentWit);
        }
        currentWit = {
          involvement: 'WITNESS', name: '', dob: '', age: '', race: '', sex: '',
          ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
          comments: '', guardian: '', detail: ''
        };
        addrParts = [];
        collectAddr = false;
        if (nv && !/^Date Of Birth|^Age|^Race|^Sex/.test(nv)) {
          currentWit.name = nv; collectAddr = true; j++;
        }
      } else if (currentWit) {
        if (collectAddr && !/^(Date Of Birth|Age|Race|Sex|Phone|Ethnicity|Height|Weight|Hair|Eyes|Witness Comments|Parent\/Guardian|Victims?)$/.test(wl)
          && !/^Witness #/.test(wl) && wl.length > 2 && !/^\(\d{3}\)/.test(wl) && !/^Employee/.test(wl)) {
          addrParts.push(wl);
        }
        else if (wl === 'Date Of Birth' && nv) { collectAddr = false; currentWit.dob = nv; j++; }
        else if (wl === 'Age' && nv) { collectAddr = false; currentWit.age = nv; j++; }
        else if (wl === 'Race' && nv) { collectAddr = false; currentWit.race = nv; j++; }
        else if (wl === 'Sex' && nv) { collectAddr = false; currentWit.sex = nv; j++; }
        else if (wl === 'Ethnicity' && nv) { collectAddr = false; currentWit.ethnicity = nv; j++; }
        else if (/^\(\d{3}\)\s*\d{3}-\d{4}/.test(wl)) {
          collectAddr = false;
          const phoneParts = wl.match(/^(\(\d{3}\)\s*\d{3}-\d{4})\s*(.*)/);
          currentWit.phone = phoneParts ? (phoneParts[2] ? phoneParts[1] + ' ' + phoneParts[2].trim() : phoneParts[1]) : wl;
        }
        else if (/^Witness Comments:/i.test(wl)) {
          collectAddr = false;
          currentWit.comments = wl.replace(/^Witness Comments:\s*/i, '');
        }
        else if (/^Parent\/Guardian/i.test(wl)) {
          collectAddr = false;
          const gm = wl.match(/Parent\/Guardian.*?:\s*(.*)/i);
          currentWit.guardian = gm ? gm[1].trim() : wl;
        }
        else { collectAddr = false; }
      }
    }
    if (currentWit) {
      if (addrParts.length) currentWit.address = addrParts.join(', ');
      report.personsInvolved.push(currentWit);
    }
  }

  // ---- Employee Witnesses ----
  if (empWitIdx >= 0) {
    const end = evidIdx > empWitIdx ? evidIdx : lines.length;
    const eLines = lines.slice(empWitIdx + 1, end);
    for (let j = 0; j < eLines.length; j++) {
      if (eLines[j] === 'Employee Name and Badge/ID Number' && eLines[j + 1]) {
        const m = eLines[j + 1].match(/^(.+?)\s+(\d{3,5})$/);
        if (m) {
          report.narratives.push({ officer: m[1].trim(), badge: m[2], text: 'Employee Witness' });
        }
        j++;
      }
    }
  }

  // ---- Evidence ----
  if (evidIdx >= 0) {
    const eLine = lines.slice(evidIdx + 1).find(l => l && l !== 'Evidence');
    if (eLine) report.digital.push({ officer: '', badge: '', description: eLine });
  }

  // Agency from filename or content
  report.agencyName = (text.match(/(\w+ Police Department)/)?.[1]) || '';
  if (!report.reportNumber) {
    const fnNum = fileName.match(/(\d{6,12})/);
    if (fnNum) report.reportNumber = fnNum[1];
  }

  // ---- Case Synopsis (if after charges/witnesses) ----
  if (synopsisIdx >= 0 && report.narratives.every(n => !n.text.startsWith('Case Synopsis'))) {
    const synEnd = Math.min(
      ...[chargesIdx, witnessIdx, empWitIdx, evidIdx, lines.length].filter(x => x > synopsisIdx)
    );
    const synLines: string[] = [];
    for (let j = synopsisIdx + 1; j < synEnd; j++) {
      if (lines[j]) synLines.push(lines[j]);
    }
    if (synLines.length) {
      report.narratives.unshift({ officer: '', badge: '', text: 'Case Synopsis: ' + synLines.join(' ') });
    }
  }

  return report;
}

// ===========================================================================
// Parser 2 — Incident Summary (Westminster PD / officer report summary format)
// ===========================================================================

function parseIncidentSummary(text: string, fileName: string): RmsReport {
  const rawLines = text.split('\n').map(l => l.trim());
  // Strip page headers
  const cleaned: string[] = [];
  let _rptType = '', _rptNum = '';
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    if (/^Page \d+ of \d+$/.test(l)) continue;
    if (/^Printed by\s+/i.test(l)) {
      // Next line may be standalone time (e.g. "7:40:32 AM")
      if (rawLines[i + 1] && /^\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$/i.test(rawLines[i + 1].trim())) i++;
      continue;
    }
    if (/^Case Number:\s*$/i.test(l)) { if (rawLines[i + 1] && /^\d/.test(rawLines[i + 1].trim())) i++; continue; }
    if (/^\d+ \w+ Street?$/i.test(l)) continue; // agency address
    if (/^\w+, [A-Z]{2} \d{5}$/.test(l)) continue; // city state zip
    if (/^\d{3}-\d{3}-\d{4}$/.test(l)) continue; // phone
    if (/Police Department$/i.test(l)) continue; // agency name
    if (/^(Initial Incident Report|Supplemental Report)$/i.test(l)) { if (!_rptType) _rptType = l; continue; }
    if (/^Report Number:\s*$/i.test(l)) {
      if (rawLines[i + 1] && /\d/.test(rawLines[i + 1].trim())) { _rptNum = rawLines[i + 1].trim(); i++; }
      continue;
    }
    if (/Summary of\s*$/i.test(l)) { if (/Officer Report/i.test(rawLines[i + 1] || '')) i++; continue; }
    if (/^Officer Report Contents$/i.test(l)) continue;
    cleaned.push(l);
  }
  const lines = cleaned;

  const report: RmsReport = {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: '',
    reportDate: '',
    reportType: 'Incident Summary',
    supplementNo: '',
    agencyName: '',
    location: '',
    beat: '',
    fromDateTime: '',
    toDateTime: '',
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: text
  };

  // Extract case number from raw text
  const caseMatch = text.match(/Case Number:\s*\n?\s*(\d[\d-]+)/i);
  if (caseMatch) report.reportNumber = caseMatch[1].trim();
  if (!report.reportNumber) {
    const fnNum = fileName.match(/(\d{6,12})/);
    if (fnNum) report.reportNumber = fnNum[1];
  }

  // Extract agency
  report.agencyName = (text.match(/(\w+ Police Department)/)?.[1]) || '';
  // Apply metadata extracted from page headers
  if (_rptType) report.reportType = _rptType;
  if (_rptNum && !report.reportNumber) report.reportNumber = _rptNum;

  // Find section boundaries
  const offenseSecIdx = lines.findIndex(l => /^Offense\(s\)$/i.test(l));
  const suspectSecIdx = lines.findIndex(l => /Suspect\(s\)\s*-\s*\d+\s*Involved/i.test(l));
  const victimSecIdx = lines.findIndex(l => /Victim\(s\)\s*-\s*\d+\s*Involved/i.test(l));
  const otherSecIdx = lines.findIndex(l => /Other Person\(s\)\s*-\s*\d+\s*Involved/i.test(l));
  const eventSecIdx = lines.findIndex(l => /^Event Information$/i.test(l));
  const narrSecIdx = lines.findIndex(l => /Report Narrative By/i.test(l));
  const empSecIdx = lines.findIndex(l => /^Reporting Employee\(?s?\)?$/i.test(l));

  // Generic person parser for this format
  function parsePersonBlock(startIdx: number, endIdx: number, defaultRole: string): RmsPerson[] {
    const persons: RmsPerson[] = [];
    let cur: RmsPerson | null = null;
    for (let j = startIdx; j < endIdx; j++) {
      const l = lines[j];
      // New person block: "Suspect\n1" or "Victim\n1" or "Person\n1"
      if (/^(Suspect|Victim|Person)$/i.test(l) && /^\d+$/.test(lines[j + 1] || '')) {
        if (cur) persons.push(cur);
        cur = {
          involvement: defaultRole, name: '', dob: '', age: '', race: '', sex: '',
          ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
          comments: '', guardian: '', detail: ''
        };
        j++; // skip number
        continue;
      }
      if (!cur) continue;
      const nv = lines[j + 1] || '';
      if (l === 'Name (Last, First, Middle, Suffix)') { cur.name = nv; j++; }
      else if (l === 'Involvement Type') { cur.involvement = nv.toUpperCase(); j++; }
      else if (l === 'Date Of Birth') { cur.dob = nv; j++; }
      else if (l === 'Age') { cur.age = nv; j++; }
      else if (l === 'Race') { cur.race = nv; j++; }
      else if (l === 'Ethnicity') { cur.ethnicity = nv; j++; }
      else if (l === 'Sex') { cur.sex = nv; j++; }
      else if (l === 'Height' && nv && /\d/.test(nv)) { cur.height = nv; j++; }
      else if (l === 'Weight' && nv && /\d/.test(nv)) { cur.weight = nv; j++; }
      else if (l === 'Hair Color' && nv && nv.length <= 10) { cur.hair = nv; j++; }
      else if (l === 'Eye Color' && nv && nv.length <= 10) { cur.eyes = nv; j++; }
      // Handle concatenated empty fields: "HeightWeightHair ColorEye Color" or partial combos
      else if (/^Height\s*Weight/i.test(l) || /HeightWeight/i.test(l)) { /* all empty — skip */ }
      else if (/^Parent \/ Guardian/i.test(l)) {
        if (nv && nv !== '-') cur.guardian = nv;
        j++;
      }
      else if (l === 'Home Address') { if (nv) cur.address = nv; j++; }
      else if (/^Phone\s*[12]$/i.test(l)) {
        const pv = nv.trim();
        if (pv && /[\d(]/.test(pv)) cur.phone = cur.phone ? cur.phone + '; ' + pv : pv;
        j++;
      }
      else if (l === 'Employer Name and Address') { j++; }
      else if (/^Job Title/i.test(l)) { /* skip */ }
      else if (/^(Suspect|Victim) Of:$/i.test(l)) {
        if (nv) cur.comments = (cur.comments ? cur.comments + '; ' : '') + l + ' ' + nv;
        j++;
      }
    }
    if (cur) persons.push(cur);
    return persons;
  }

  // Parse person sections
  const secBounds = [offenseSecIdx, suspectSecIdx, victimSecIdx, otherSecIdx, eventSecIdx, narrSecIdx, empSecIdx, lines.length]
    .filter(x => x >= 0).sort((a, b) => a - b);
  function nextBound(after: number): number { return secBounds.find(b => b > after) || lines.length; }

  // ---- Structured Offenses (individual officer reports) ----
  if (offenseSecIdx >= 0) {
    const end = nextBound(offenseSecIdx);
    let off: RmsOffense | null = null;
    for (let j = offenseSecIdx + 1; j < end; j++) {
      if (lines[j] === 'Offense' && /^\d+$/.test(lines[j + 1] || '')) {
        if (off) report.offenses.push(off);
        off = { number: parseInt(lines[j + 1]), status: '', statute: '', description: '', severity: '' };
        j++; continue;
      }
      if (!off) continue;
      const onv = lines[j + 1] || '';
      if (lines[j] === 'Statute/Ordinance Number and Description') { off.description = onv; j++; }
      else if (lines[j] === 'Attempted or Completed') { off.status = onv; j++; }
      else if (lines[j] === 'Felony/Misdemeanor') { off.severity = onv; j++; }
      else if (lines[j] === 'Degree') {
        if (onv && off.severity) off.severity += ' (' + onv + ')';
        j++;
      }
    }
    if (off) report.offenses.push(off);
  }

  if (suspectSecIdx >= 0) {
    report.personsInvolved.push(...parsePersonBlock(suspectSecIdx + 1, nextBound(suspectSecIdx), 'SUSPECT'));
  }
  if (victimSecIdx >= 0) {
    report.personsInvolved.push(...parsePersonBlock(victimSecIdx + 1, nextBound(victimSecIdx), 'VICTIM'));
  }
  if (otherSecIdx >= 0) {
    report.personsInvolved.push(...parsePersonBlock(otherSecIdx + 1, nextBound(otherSecIdx), 'WITNESS'));
  }

  // ---- Event Information ----
  if (eventSecIdx >= 0) {
    const end = nextBound(eventSecIdx);
    for (let j = eventSecIdx + 1; j < end - 1; j++) {
      if (lines[j] === 'Date Reported') { report.reportDate = lines[j + 1]; j++; }
      else if (lines[j] === 'Occurred From') { report.fromDateTime = lines[j + 1]; j++; }
      else if (lines[j] === 'Occurred To') { report.toDateTime = lines[j + 1]; j++; }
      else if (lines[j] === 'Incident Location') { report.location = lines[j + 1]; j++; }
      else if (lines[j] === 'Description of Incident') {
        const desc = lines[j + 1];
        // Only add as offense if no structured offenses were parsed
        if (desc && report.offenses.length === 0) { report.offenses.push({ number: 1, status: '', statute: '', description: desc, severity: '' }); j++; }
        else j++;
      }
    }
  }

  // ---- Narratives (full text for individual reports, metadata for summaries) ----
  if (narrSecIdx >= 0) {
    for (let j = narrSecIdx; j < lines.length; j++) {
      const m = lines[j].match(/(?:(?:Original|Supplemental)\s+)?Report Narrative By\s+(.+?)\s+(\d{3,5})/i);
      if (m) {
        const suppMatch = lines[j].match(/\(Supplement #(\d+)\)/);
        const meta: string[] = [];
        j++;
        // Capture Photos/BWC/Evidence metadata line
        if (j < lines.length && /Photos Taken:/i.test(lines[j])) { meta.push(lines[j].trim()); j++; }
        // Collect actual narrative text (individual reports have inline text)
        const narrLines: string[] = [];
        while (j < lines.length) {
          const nl = lines[j];
          // Stop at next narrative header
          if (/Report Narrative By/i.test(nl)) { j--; break; }
          // Skip Reporting Employee blocks embedded in narrative
          if (/^Reporting Employee\(?s?\)?$/i.test(nl)) {
            j++;
            while (j < lines.length && lines[j] && !/^\s*$/.test(lines[j])) j++;
            j++; continue;
          }
          narrLines.push(nl);
          j++;
        }
        // Trim empty lines
        while (narrLines.length && !narrLines[0]) narrLines.shift();
        while (narrLines.length && !narrLines[narrLines.length - 1]) narrLines.pop();
        const narrativeText = narrLines.join('\n').trim();
        const prefix = suppMatch ? 'Supplement #' + suppMatch[1] + '.' : 'Original Report.';
        report.narratives.push({
          officer: m[1].trim(), badge: m[2],
          text: narrativeText || (prefix + ' ' + (meta.join('; ') || 'See individual officer reports for full narrative.'))
        });
      }
    }
  }

  // ---- Reporting Employees (already captured via narrative section) ----
  if (empSecIdx >= 0) {
    for (let j = empSecIdx + 1; j < lines.length; j++) {
      const em = lines[j].match(/^(.+?)\s+(\d{3,5})$/);
      if (em && !/^(Reporting|Supplementing)$/i.test(lines[j - 1] || '')) {
        // Already captured in narratives usually, skip dupes
      }
    }
  }

  return report;
}

// ===========================================================================
// Parser 3 — Field Incident Report (Virginia / NIBRS-style)
// ===========================================================================

function parseFieldIncidentReport(text: string, fileName: string): RmsReport {
  const rawLines = text.split('\n').map(l => l.trim());

  // --- Extract metadata from first page header ---
  const agencyMatch = text.match(/DRAFT\s*\n\s*([^\n]+)/);
  const agencyName = agencyMatch ? agencyMatch[1].trim() : '';
  const incidentNo = (text.match(/Incident No\.\s*\n\s*([^\n]+)/) || [])[1] || '';
  // Dates: two-column extraction — labels then values
  let fromDate = '', toDate = '', reportedDate = '';
  const dateBlock = text.match(/Occurred From Date:\s*\n\s*Occurred To Date:\s*\n\s*(\d{2}-\d{2}-\d{4})\s*\n\s*(\d{2}-\d{2}-\d{4})/);
  if (dateBlock) { fromDate = dateBlock[1]; toDate = dateBlock[2]; }
  else {
    const f = text.match(/Occurred From Date:\s*\n\s*(\d{2}-\d{2}-\d{4})/);
    const t = text.match(/Occurred To Date:\s*\n\s*(\d{2}-\d{2}-\d{4})/);
    if (f) fromDate = f[1]; if (t) toDate = t[1];
  }
  const rptD = text.match(/Reported Date:\s*\n\s*(\d{2}-\d{2}-\d{4})/);
  if (rptD) reportedDate = rptD[1];

  // --- Strip page headers and footers ---
  const cleaned: string[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const l = rawLines[i];
    // Footer: "Printed on ..."  +  "Page X of Y"
    if (/^Printed on \d/i.test(l)) {
      i++;
      if (i < rawLines.length && /^Page \d+ of \d+$/i.test(rawLines[i])) i++;
      continue;
    }
    // Page header block starts with "DRAFT"
    if (l === 'DRAFT') {
      i++;
      // Skip agency name / address / phone lines
      while (i < rawLines.length) {
        const nl = rawLines[i];
        if (/SHERIFF|POLICE|DEPARTMENT|OFFICE/i.test(nl) && !/^OFFENSE$|^VICTIM$|^SUSPECT|^PERSON$|^VEHICLE$|^PROPERTY$|^NARRATIVE$|^ADMIN$|^DETAILS$|^SUMMARY$/.test(nl)) { i++; continue; }
        if (/^\d+\s+.+\b(ST|AVE|RD|LN|DR|BLVD|WAY)\b/i.test(nl)) { i++; continue; }
        if (/^[A-Z]+\s*,?\s*[A-Z]{2}\s+\d{5}/i.test(nl)) { i++; continue; }
        if (/^\d{7,}$/.test(nl)) { i++; continue; }
        break;
      }
      // Skip page-type line
      if (i < rawLines.length && /^(INCIDENT PAGE \d+|NARRATIVE #\d+|PROPERTIES|APPROVALS)$/i.test(rawLines[i])) i++;
      // Skip repeating incident header block ("Incident No." through "Time: HH:MM")
      if (i < rawLines.length && /^Incident No\.?$/i.test(rawLines[i])) {
        let skip = 0;
        while (i < rawLines.length && skip < 25) {
          const hl = rawLines[i]; i++; skip++;
          if (/^Time:\s*\d{1,2}:\d{2}$/.test(hl)) break;
        }
      }
      continue;
    }
    cleaned.push(l);
    i++;
  }
  const lines = cleaned;

  const report: RmsReport = {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: incidentNo.trim(),
    reportDate: reportedDate,
    reportType: 'Field Incident Report',
    supplementNo: '',
    agencyName,
    location: '',
    beat: '',
    fromDateTime: fromDate,
    toDateTime: toDate,
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: text
  };
  if (!report.reportNumber) {
    const fn = fileName.match(/(\d{4}[-]?\d{4,})/);
    if (fn) report.reportNumber = fn[1];
  }

  // --- Find section boundaries ---
  const sections: { name: string; startLine: number }[] = [];
  for (let j = 0; j < lines.length; j++) {
    const l = lines[j];
    if (l === 'DETAILS' || l === 'OFFENSE' || l === 'VICTIM' ||
      /^SUSPECT\s*[⁄\/]\s*OFFENDER$/i.test(l) || l === 'PERSON' ||
      l === 'VEHICLE' || l === 'PROPERTY' || l === 'NARRATIVE' ||
      l === 'ADMIN' || l === 'SUMMARY') {
      sections.push({ name: l.replace(/\s*[⁄\/]\s*OFFENDER/i, ''), startLine: j });
    }
  }
  // Get all ranges for a section name (can repeat across pages)
  function getRanges(name: string): string[][] {
    const out: string[][] = [];
    for (let s = 0; s < sections.length; s++) {
      if (sections[s].name === name) {
        const end = s + 1 < sections.length ? sections[s + 1].startLine : lines.length;
        out.push(lines.slice(sections[s].startLine + 1, end));
      }
    }
    return out;
  }

  // Helper: parse a label-value pair block — returns value for a given label
  // Many fields are just "Label\nValue" — if value is empty the next line is the next label
  function fieldVal(sl: string[], j: number): string { return j + 1 < sl.length ? sl[j + 1] : ''; }

  // --- Parse DETAILS ---
  for (const sl of getRanges('DETAILS')) {
    for (let j = 0; j < sl.length - 1; j++) {
      if (sl[j] === 'Location Address') { report.location = sl[j + 1]; j++; }
      else if (sl[j] === 'Beat' && !report.beat) { report.beat = sl[j + 1]; j++; }
    }
  }

  // --- Parse OFFENSE blocks ---
  for (const sl of getRanges('OFFENSE')) {
    let seq = '', desc = '', category = '', ac = '';
    for (let j = 0; j < sl.length; j++) {
      if (sl[j] === 'Seq') { seq = fieldVal(sl, j); j++; }
      else if (sl[j] === 'Category') { category = fieldVal(sl, j); j++; }
      else if (sl[j] === 'Description') {
        // Description may span multiple lines until a known label
        const descParts: string[] = [];
        j++;
        while (j < sl.length && !/^(A\/C|Location|Bias Motives|Usings|Domestic|Securities|# of Premises|Entry Method|Entry Locs|Exit Method|Exit Locs|Activities|Weapons|Seq|Category|VCC:)/.test(sl[j])) {
          if (sl[j]) descParts.push(sl[j]);
          j++;
        }
        desc = descParts.join(' ').trim();
        j--; // back up for for-loop increment
      }
      else if (sl[j] === 'A/C') { ac = fieldVal(sl, j); j++; }
    }
    if (seq && /^\d+$/.test(seq) && desc) {
      report.offenses.push({
        number: parseInt(seq),
        status: ac === 'C' ? 'COMPLETED' : ac === 'A' ? 'ATTEMPTED' : ac || '',
        statute: '',
        description: desc,
        severity: ''
      });
    }
  }

  // --- Generic person parser for VICTIM / SUSPECT / PERSON blocks ---
  const _personLabels = new Set(['Seq', 'Victim Type', 'Offender Type', 'Person Type',
    'Victim (Last, First Middle - Business)', 'Offender (Last, First Middle)',
    'Name (Last, First Middle - Business)', 'DOB', 'SSN', 'DL#/ID#', 'State',
    'Resident Status', 'Address', 'Telephone', 'Mobile', 'Work', 'Occupation',
    'Employer', 'Employment Address', 'Place of Birth', 'Offense Link',
    'Age', 'Unknown', 'Age Range', 'Sex', 'Race', 'Height', 'Weight', 'Hair', 'Eyes',
    'Ethnicity', 'Offender Link/Relationship', 'Injuries', 'Treated By',
    'Transported To', 'Discovered Crime', 'Can ID Suspect', 'Statement Taken',
    'Victim Crime Rights Served', 'Circumstances', 'Justified Homicide Circumstances',
    'LEOKA Assignment', 'LEOKA Circumstance', 'LEOKA Other ORI', 'LEOKA Status',
    'State Entry # - Date - By', 'State Cancellation # - Date - By',
    'NCIC Entry # - Date - By', 'NCIC Cancellation # - Date - By',
    'Scars/Marks/Tattoos/Other', 'Hair Style', 'Facial Hair', 'Complexion',
    'Build', 'Speech', 'Handed', 'Master Name #', 'Arrest', 'Victim Link',
    'Offender Link', 'Gang Affiliation', 'Aliases', 'Clothing Description',
    'Injury', 'Person Link', 'Loss Type', 'Stored At', 'Notes/Remarks',
    'Ownership Verified By', 'Owner (Last, First Middle - Business)',
    'Value Unknown', 'Evidence', 'Cargo']);
  function _isLabel(v: string): boolean { return _personLabels.has(v) || /^(State |NCIC |LEOKA )/.test(v); }
  function parsePerson(sl: string[], defaultRole: string): RmsPerson | null {
    let seq = '';
    const p: RmsPerson = {
      involvement: defaultRole, name: '', dob: '', sex: '', race: '',
      ethnicity: '', address: '', phone: '', height: '', weight: '',
      hair: '', eyes: '', age: '', comments: '', guardian: '', detail: ''
    };
    for (let j = 0; j < sl.length; j++) {
      const lab = sl[j], val = fieldVal(sl, j);
      const valIsLabel = _isLabel(val);
      if (lab === 'Seq') { if (!valIsLabel) { seq = val; j++; } }
      // Name fields (different labels per section)
      else if (/^(Victim|Offender|Name)\s*\(Last,?\s*First/i.test(lab)) { if (!valIsLabel) { p.name = val; j++; } }
      else if (lab === 'Offender Type' || lab === 'Victim Type' || lab === 'Person Type') { if (!valIsLabel) { p.detail = val; j++; } }
      else if (lab === 'DOB' && !valIsLabel && /\d/.test(val)) { p.dob = val; j++; }
      else if (lab === 'Age' && !valIsLabel && val) {
        if (/^\d+$/.test(val)) p.age = val;
        j++;
      }
      else if (lab === 'Age Range' && !valIsLabel && val && val !== '-') { if (!p.age) p.age = val; j++; }
      else if (lab === 'Sex' && !valIsLabel && val.length <= 2) { p.sex = val; j++; }
      else if (lab === 'Race' && !valIsLabel && val.length <= 3) { p.race = val; j++; }
      else if (lab === 'Ethnicity' && !valIsLabel && val.length <= 3) { p.ethnicity = val; j++; }
      else if (lab === 'Height' && !valIsLabel && /\d/.test(val)) { p.height = val; j++; }
      else if (lab === 'Weight' && !valIsLabel && /\d/.test(val)) { p.weight = val; j++; }
      else if (lab === 'Hair' && !valIsLabel && val) { p.hair = val; j++; }
      else if (lab === 'Eyes' && !valIsLabel && val) { p.eyes = val; j++; }
      else if (lab === 'Address' && !valIsLabel && val) { p.address = val; j++; }
      else if (lab === 'Telephone' && !valIsLabel && /[\d(]/.test(val)) { p.phone = val; j++; }
      else if (lab === 'Mobile' && !valIsLabel && /[\d(]/.test(val)) {
        p.phone = p.phone ? p.phone + '; ' + val : val; j++;
      }
      else if (lab === 'Occupation' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + 'Occupation: ' + val; j++; }
      else if (lab === 'Place of Birth' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + 'POB: ' + val; j++; }
      else if (lab === 'Resident Status' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + val; j++; }
      else if (lab === 'Scars/Marks/Tattoos/Other' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + 'SMT: ' + val; j++; }
      else if (lab === 'Aliases' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + 'Alias: ' + val; j++; }
      else if (lab === 'Clothing Description' && !valIsLabel && val) { p.comments = (p.comments ? p.comments + '; ' : '') + 'Clothing: ' + val; j++; }
      else if (lab === 'Injury' && !valIsLabel && val && val !== 'N') { p.comments = (p.comments ? p.comments + '; ' : '') + 'Injury: ' + val; j++; }
    }
    if (seq && /^\d+$/.test(seq) && (p.name || p.detail)) return p;
    return null;
  }

  // VICTIM sections
  for (const sl of getRanges('VICTIM')) {
    const p = parsePerson(sl, 'VICTIM');
    if (p) report.personsInvolved.push(p);
  }
  // SUSPECT sections (header normalized to just "SUSPECT" by section finder)
  for (const sl of getRanges('SUSPECT')) {
    const p = parsePerson(sl, 'SUSPECT');
    if (p) report.personsInvolved.push(p);
  }
  // PERSON sections (other involved persons — SUBJECT, WITNESS, etc.)
  for (const sl of getRanges('PERSON')) {
    const p = parsePerson(sl, 'PERSON INVOLVED');
    if (p) {
      // Refine role from Person Type field (SUBJECT, WITNESS, etc.)
      if (p.detail) {
        const dt = p.detail.toUpperCase();
        if (/WITNESS/i.test(dt)) p.involvement = 'WITNESS';
        else if (/SUSPECT/i.test(dt)) p.involvement = 'SUSPECT';
        else if (/VICTIM/i.test(dt)) p.involvement = 'VICTIM';
        else if (/REPORTING/i.test(dt)) p.involvement = 'REPORTING PARTY';
        else p.involvement = dt; // SUBJECT, etc. — routes to involvedPersons
      }
      report.personsInvolved.push(p);
    }
  }

  // --- Parse VEHICLE blocks ---
  const _vehLabels = new Set(['Seq', 'Vehicle Type', 'Color', 'Year', 'Make', 'Model',
    'Style', 'State', 'Registration', 'VIN', 'Value', 'Value Unknown', 'Classification',
    'Towed By', 'Tow Reason', 'Offense Link', 'Victim Link', 'Offender Link',
    'Person Link', 'Loss Type', 'Stored At', 'Ownership Verified By',
    'Owner (Last, First Middle - Business)', 'Owner Address', 'Owner Telephone',
    'Owner Mobile', 'Insurance Company', 'Insurance Address', 'Ins. Telephone',
    'Notes/Remarks', 'Reg. Current', 'Doors Locked', 'Key in Vehicle', 'Hold Vehicle',
    'Damage', 'Theft from Vehicle', 'Evidence', 'Vehicle is Cargo',
    'Recovered Date', 'Time', 'Recovered Location', 'Recovered By', 'Recovered Value',
    'Released Date', 'Released Location', 'Released By', 'Released Contents',
    'State Entry # - Date - By', 'State Cancellation # - Date - By',
    'NCIC Entry # - Date - By', 'NCIC Cancellation # - Date - By']);
  function _isVehLabel(v: string): boolean { return _vehLabels.has(v) || /^(State |NCIC )/.test(v); }
  for (const sl of getRanges('VEHICLE')) {
    let seq = '', vType = '', color = '', year = '', make = '', model = '',
      style = '', state = '', reg = '', vin = '', notes = '';
    for (let j = 0; j < sl.length; j++) {
      const lab = sl[j], val = fieldVal(sl, j);
      const vil = _isVehLabel(val);
      if (lab === 'Seq') { if (!vil) { seq = val; j++; } }
      else if (lab === 'Vehicle Type' && !vil && val) { vType = val; j++; }
      else if (lab === 'Color' && !vil && val) { color = val; j++; }
      else if (lab === 'Year' && !vil && /^\d{4}$/.test(val)) { year = val; j++; }
      else if (lab === 'Make' && !vil && val) { make = val; j++; }
      else if (lab === 'Model' && !vil && val) { model = val; j++; }
      else if (lab === 'Style' && !vil && val) { style = val; j++; }
      else if (lab === 'State' && !vil && val && val.length <= 3) { state = val; j++; }
      else if (lab === 'Registration' && !vil && val) { reg = val; j++; }
      else if (lab === 'VIN' && !vil && val) { vin = val; j++; }
      else if (lab === 'Notes/Remarks' && !vil && val) { notes = val; j++; }
      else if (lab === 'Loss Type' && !vil && val) { notes = (notes ? notes + '; ' : '') + 'Loss: ' + val; j++; }
    }
    if (seq && /^\d+$/.test(seq)) {
      report.vehicles.push({
        status: vType || '', colors: color, year, make,
        model: model || style || '', license: reg, state, vin, type: style || vType || ''
      });
    }
  }

  // --- Parse PROPERTY blocks ---
  const _propLabels = new Set(['Seq', 'Property Type', 'Accessories', 'Quantity',
    'Description', 'Make / Brand', 'Model', 'Color', 'Serial Number', 'Classification',
    'Drug Quantity', 'Drug Measurement', 'Drug Type Suspected', 'Value', 'Value Unknown',
    'Evidence', 'Cargo', 'Offense Link', 'Victim Link', 'Offender Link', 'Person Link',
    'Loss Type', 'Stored At', 'Ownership Verified By',
    'Owner (Last, First Middle - Business)', 'Owner Address', 'Owner Telephone',
    'Owner Mobile', 'Notes/Remarks', 'Recovered Date', 'Time', 'Recovered Location',
    'Recovered By', 'Recovered Value', 'Released Date', 'Released Location',
    'Released By', 'State Entry # - Date - By', 'State Cancellation # - Date - By',
    'NCIC Entry # - Date - By', 'NCIC Cancellation # - Date - By']);
  function _isPropLabel(v: string): boolean { return _propLabels.has(v) || /^(State |NCIC )/.test(v); }
  for (const sl of getRanges('PROPERTY')) {
    let seq = '', propType = '', qty = '', desc = '', makeBrand = '',
      model = '', color = '', serial = '', value = '', lossType = '';
    for (let j = 0; j < sl.length; j++) {
      const lab = sl[j], val = fieldVal(sl, j);
      const vil = _isPropLabel(val);
      if (lab === 'Seq') { if (!vil) { seq = val; j++; } }
      else if (lab === 'Property Type' && !vil && val) { propType = val; j++; }
      else if (lab === 'Quantity' && !vil && val) { qty = val; j++; }
      else if (lab === 'Description' && !vil && val) { desc = val; j++; }
      else if (lab === 'Make / Brand' && !vil && val) { makeBrand = val; j++; }
      else if (lab === 'Model' && !vil && val) { model = val; j++; }
      else if (lab === 'Color' && !vil && val) { color = val; j++; }
      else if (lab === 'Serial Number' && !vil && val) { serial = val; j++; }
      else if (lab === 'Value' && !vil && val && !/^Unknown$/i.test(val)) { value = val; j++; }
      else if (lab === 'Loss Type' && !vil && val) { lossType = val; j++; }
    }
    if (seq && /^\d+$/.test(seq) && (desc || propType)) {
      const makeModel = [makeBrand, model].filter(Boolean).join(' ');
      const fullDesc = [desc, color ? 'Color: ' + color : '', serial ? 'S/N: ' + serial : ''].filter(Boolean).join(' | ');
      report.property.push({
        holdReason: lossType || propType,
        articleType: propType,
        make: makeModel,
        description: fullDesc,
        quantity: qty,
        value: value,
        recoveredValue: ''
      });
    }
  }

  // --- Parse NARRATIVE blocks (may span multiple pages — combine by officer) ---
  const narrativeMap: Record<string, RmsNarrative> = {}; // key: officer-badge → { officer, badge, text }
  for (const sl of getRanges('NARRATIVE')) {
    let narDate = '', narBy = '';
    let textStart = -1;
    for (let j = 0; j < sl.length; j++) {
      const lab = sl[j], val = fieldVal(sl, j);
      if (lab === 'Seq') { j++; }
      else if (lab === 'Narrative Date') { narDate = val; j++; }
      else if (lab === 'Time' && /^\d{2}:\d{2}$/.test(val)) { j++; }
      else if (lab === 'Narrative By') { narBy = val; j++; }
      else if (/^(Investigative|Supplement|Supplemental|Arrest|Initial|General|Administrative)$/i.test(lab)) {
        textStart = j + 1;
        break;
      }
    }
    if (textStart < 0) continue;
    // Collect narrative text from textStart to end of section
    const narLines = sl.slice(textStart).filter(l => l !== '');
    const narText = narLines.join('\n').trim();
    if (!narText) continue;
    // Parse officer name and badge from "LASTNAME, FIRSTNAME - BADGE"
    const obMatch = narBy.match(/^(.+?)\s*-\s*(\d+)$/);
    const officer = obMatch ? obMatch[1].trim() : narBy;
    const badge = obMatch ? obMatch[2] : '';
    const key = officer + '-' + badge;
    if (narrativeMap[key]) {
      narrativeMap[key].text += '\n\n' + narText;
    } else {
      narrativeMap[key] = { officer, badge, text: narText };
    }
  }
  for (const nar of Object.values(narrativeMap)) {
    report.narratives.push(nar);
  }

  // --- Parse ADMIN / SUMMARY for reporting officer ---
  for (const sl of getRanges('ADMIN')) {
    for (let j = 0; j < sl.length - 1; j++) {
      if (sl[j] === 'Reported By' && sl[j + 1]) {
        report.reportType = 'Field Incident Report — Reported by ' + sl[j + 1];
        break;
      }
    }
  }
  for (const sl of getRanges('SUMMARY')) {
    for (let j = 0; j < sl.length - 1; j++) {
      if (sl[j] === 'Reporting Officer' && sl[j + 1]) {
        const ro = sl[j + 1].replace(/^\(\d+\)\s*/, '');
        if (!report.reportType.includes('Reported by')) {
          report.reportType = 'Field Incident Report — ' + ro;
        }
        break;
      }
    }
  }

  return report;
}

// ===========================================================================
// Parser 5 — Suspect Intelligence Report (case management export)
// ===========================================================================

function parseSuspectIntelReport(text: string, fileName: string): RmsReport {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const report: RmsReport = {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: '',
    reportDate: '',
    reportType: 'Suspect Intelligence Report',
    supplementNo: '',
    agencyName: '',
    location: '',
    beat: '',
    fromDateTime: '',
    toDateTime: '',
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: text
  };

  // Extract case number: "CASE 26-7235" or "CASE# 2024-12345"
  const caseMatch = text.match(/CASE\s*#?\s*([\d][\d-]+)/i);
  if (caseMatch) report.reportNumber = caseMatch[1].trim();

  // Extract prepared by / date
  const prepMatch = text.match(/Prepared by:\s*(.+?)(\w+ \d{1,2},\s*\d{4})/i);
  if (prepMatch) {
    report.reportDate = prepMatch[2].trim();
    report.agencyName = prepMatch[1].trim();
  }

  // Helper: find value after a label (label on one line, value on next)
  function getField(label: string): string {
    const idx = lines.findIndex(l => l.toUpperCase() === label.toUpperCase());
    if (idx >= 0 && idx + 1 < lines.length) {
      const val = lines[idx + 1];
      // Don't return next section header as a value
      if (!/^(FIRST NAME|LAST NAME|DATE OF BIRTH|PHONE|DRIVER|HEIGHT|WEIGHT|HAIR|EYE|SCARS|ADDRESS|PLACE|MAKE|MODEL|COLOR|LICENSE|REGISTERED|CRIMINAL|SUSPECT|VEHICLE|RESIDENCE|RESIDENTIAL|Prepared)/i.test(val)) {
        return val;
      }
    }
    return '';
  }

  // ---- Suspect Person ----
  const suspect: RmsPerson = {
    involvement: 'SUSPECT', name: '', dob: '', age: '', sex: '', race: '',
    ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
    comments: '', guardian: '', detail: ''
  };

  const firstName = getField('FIRST NAME');
  const lastName = getField('LAST NAME');
  suspect.name = [lastName, firstName].filter(Boolean).join(', ');
  suspect.dob = getField('DATE OF BIRTH');
  suspect.phone = getField('PHONE NUMBER');
  suspect.height = getField('HEIGHT');
  suspect.weight = getField('WEIGHT');
  suspect.hair = getField('HAIR COLOR');
  suspect.eyes = getField('EYE COLOR');

  const dl = getField("DRIVER'S LICENSE") || getField('DRIVER LICENSE') || getField("DRIVER'S LICENSE");
  if (dl) suspect.detail = 'DL: ' + dl;

  const smt = getField('SCARS / MARKS / TATTOOS');
  if (smt && smt.toLowerCase() !== 'none') suspect.comments = 'SMT: ' + smt;

  // Residential info
  suspect.address = getField('ADDRESS');
  const workplace = getField('PLACE OF WORK');
  if (workplace && workplace.toLowerCase() !== 'unknown') {
    suspect.comments = (suspect.comments ? suspect.comments + '; ' : '') + 'Employer: ' + workplace;
  }

  if (suspect.name) report.personsInvolved.push(suspect);

  // ---- Vehicle ----
  const vMake = getField('MAKE');
  const vModel = getField('MODEL');
  const vColor = getField('COLOR');
  const vPlate = getField('LICENSE PLATE');
  if (vMake || vModel) {
    report.vehicles.push({
      status: '', colors: vColor, year: '', make: vMake, model: vModel,
      license: vPlate && vPlate.toLowerCase() !== 'unknown' ? vPlate : '',
      state: '', vin: '', type: ''
    });
  }

  // ---- Registered Firearms ----
  const firearmsIdx = lines.findIndex(l => /^Registered Firearms$/i.test(l));
  if (firearmsIdx >= 0 && firearmsIdx + 1 < lines.length) {
    const firVal = lines[firearmsIdx + 1];
    if (firVal && !/^No registered/i.test(firVal) && !/^Criminal/i.test(firVal)) {
      report.property.push({
        holdReason: 'Registered Firearm', articleType: 'Firearm',
        make: '', description: firVal, quantity: '1', value: '', recoveredValue: ''
      });
    }
  }

  // ---- Criminal History ----
  const crimIdx = lines.findIndex(l => /^Criminal History$/i.test(l));
  if (crimIdx >= 0 && crimIdx + 1 < lines.length) {
    const crimVal = lines[crimIdx + 1];
    if (crimVal && !/^No criminal/i.test(crimVal) && !/^Suspect Photographs/i.test(crimVal)) {
      report.narratives.push({ officer: '', badge: '', text: 'Criminal History: ' + crimVal });
    }
  }

  // Extract report number from filename if not found
  if (!report.reportNumber) {
    const fnMatch = fileName.match(/(\d[\d-]+\d)/);
    if (fnMatch) report.reportNumber = fnMatch[1];
  }

  return report;
}

// ===========================================================================
// Parser 4 — Original INFORM RMS (default)
// ===========================================================================

function parseInformRms(text: string, fileName: string): RmsReport {
  const rawLines = text.split('\n').map(l => l.trim());
  const cleaned: string[] = [];
  let i = 0;
  let reportNumber = '', supplementNo = '', reportDate = '', agencyName = '', reportTitle = '';
  while (i < rawLines.length) {
    const l = rawLines[i];
    // Skip standalone DRAFT markers
    if (/^\*DRAFT COPY( ONLY)?\*$/.test(l)) { i++; continue; }
    if (/^Generated By:\s/i.test(l)) {
      // Skip the page-break header block (flexible order — up to 12 lines)
      i++;
      let headerLines = 0;
      while (i < rawLines.length && headerLines < 12) {
        const hl = rawLines[i];
        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(hl)) { i++; headerLines++; }
        else if (/^\d+\/\d+$/.test(hl)) { i++; headerLines++; }
        else if (/^\*DRAFT COPY/.test(hl)) { i++; headerLines++; }
        else if (/^Confidential Incident/i.test(hl)) {
          if (!reportTitle) reportTitle = hl;
          i++; headerLines++;
        }
        else if (/^Supplement\s*No:\s*/i.test(hl)) {
          const sm = hl.match(/Supplement\s*No:\s*(.*)/i);
          if (sm && !supplementNo) supplementNo = sm[1].trim();
          i++; headerLines++;
        }
        else if (/^\d{6,12}$/.test(hl) || /^\d{6,12}\s+Supplement/i.test(hl)) {
          const parts = hl.match(/^(\d+)\s+Supplement\s*No:\s*(.*)$/i);
          if (parts) {
            if (!reportNumber) { reportNumber = parts[1]; supplementNo = parts[2].trim(); }
          } else {
            const numOnly = hl.match(/^(\d{6,12})$/);
            if (numOnly && !reportNumber) reportNumber = numOnly[1];
          }
          i++; headerLines++;
        }
        else if (/^Reported Date/i.test(hl)) {
          const m = hl.match(/Reported Date(?:\/Time)?:\s*(.+)/i);
          if (m && !reportDate) reportDate = m[1].trim();
          i++; headerLines++;
        }
        else if (/Police Department|Sheriff|Agency/i.test(hl)) {
          if (!agencyName) agencyName = hl;
          i++; headerLines++;
        }
        else if (/^\d+\s+\w+\s+(Ave|St|Blvd|Dr|Rd|Ln|Way)\b/i.test(hl)
          || /^[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}/.test(hl)
          || /^\(\d{3}\)\s*\d{3}-\d{4}$/.test(hl)
          || /^Fax:\s*/i.test(hl)
          || /^Phone:\s*/i.test(hl)
          || hl === '') { i++; headerLines++; }
        else { break; }
      }
      continue;
    }
    cleaned.push(l);
    i++;
  }

  const lines = cleaned;
  const report: RmsReport = {
    id: makeId(),
    fileName,
    importedAt: new Date().toISOString(),
    reportNumber: reportNumber,
    reportDate: reportDate,
    reportType: reportTitle || '',
    supplementNo: supplementNo,
    agencyName: agencyName,
    location: '',
    beat: '',
    fromDateTime: '',
    toDateTime: '',
    pageCount: 0,
    offenses: [],
    personsInvolved: [],
    vehicles: [],
    property: [],
    narratives: [],
    digital: [],
    confidentialPersons: [],
    rawText: text
  };

  // Try to extract report type/number from filename if not found in footer
  if (!report.reportType) {
    const fnMatch = fileName.match(/(Initial Incident|Summary Incident|Supplement|Officer Incident)/i);
    if (fnMatch) report.reportType = fnMatch[1];
  }
  if (!report.reportNumber) {
    const fnNum = fileName.match(/(\d{9,12})/);
    if (fnNum) report.reportNumber = fnNum[1];
  }

  // Identify section boundaries in cleaned text
  const sectionNames = ['Event', 'Event Information', 'Offense(s)', 'Offenses',
    'Involved', 'Persons Involved', 'Vehicle(s)', 'Vehicles',
    'Property', 'Narrative(s)', 'Narratives', 'NARRATIVE',
    'Digital', 'Suspect(s) Extended', 'Suspects Extended'];
  const sections: { name: string; startLine: number }[] = [];
  for (let si = 0; si < lines.length; si++) {
    if (sectionNames.includes(lines[si])) {
      sections.push({ name: lines[si], startLine: si });
    }
  }

  function getSectionLines(names: string | string[]): string[] {
    if (typeof names === 'string') names = [names];
    const sec = sections.find(s => names.includes(s.name));
    if (!sec) return [];
    const nextSec = sections.find(s => s.startLine > sec.startLine);
    return lines.slice(sec.startLine + 1, nextSec ? nextSec.startLine : lines.length);
  }

  // ---- Event ----
  const eventLines = getSectionLines(['Event', 'Event Information']);
  for (let ei = 0; ei < eventLines.length; ei++) {
    const el = eventLines[ei];
    if (el === 'Location' && eventLines[ei + 1]) { report.location = eventLines[ei + 1]; ei++; }
    else if (el === 'Beat' && eventLines[ei + 1]) { report.beat = eventLines[ei + 1]; ei++; }
    else if (/^From Date/i.test(el)) {
      if (eventLines[ei + 1] && /^\d{2}\/\d{2}\/\d{4}/.test(eventLines[ei + 1])) { report.fromDateTime = eventLines[ei + 1]; ei++; }
    }
    else if (/^To Date/i.test(el)) {
      if (eventLines[ei + 1] && /^\d{2}\/\d{2}\/\d{4}/.test(eventLines[ei + 1])) { report.toDateTime = eventLines[ei + 1]; ei++; }
    }
  }

  // ---- Offenses ----
  // INFORM formats: offenses concatenated on one or two lines
  const offLines = getSectionLines(['Offense(s)', 'Offenses']);
  let offBuf = '';
  const offChunks: string[] = [];
  for (let oi = 0; oi < offLines.length; oi++) {
    const ol = offLines[oi];
    if (!ol) continue;
    if (/^\d/.test(ol) && offBuf) { offChunks.push(offBuf); offBuf = ''; }
    offBuf += (offBuf ? ' ' : '') + ol;
    if (/(?:FELONY|MISDEMEANOR|INFRACTION)$/i.test(ol)) { offChunks.push(offBuf); offBuf = ''; }
  }
  if (offBuf) offChunks.push(offBuf);

  const penalCodes = ['PC', 'HS', 'VC', 'BP', 'FC', 'WI', 'CC'];
  for (const chunk of offChunks) {
    const sevMatch = chunk.match(/(FELONY|MISDEMEANOR|INFRACTION)$/i);
    if (!sevMatch) continue;
    const severity = sevMatch[1].toUpperCase();
    let rest = chunk.slice(0, sevMatch.index).trimEnd();
    const numMatch = rest.match(/^(\d)/);
    if (!numMatch) continue;
    rest = rest.slice(1);
    let status = '';
    const stMatch = rest.match(/^(COMPLETED|ATTEMPTED|CONSPIRACY)\s*/i);
    if (stMatch) { status = stMatch[1].toUpperCase(); rest = rest.slice(stMatch[0].length); }
    let bestIdx = -1, bestCode = '';
    for (const code of penalCodes) {
      for (const pfx of [' ', ')']) {
        const idx = rest.indexOf(pfx + code);
        if (idx >= 0 && (idx + pfx.length) > bestIdx) { bestIdx = idx + pfx.length; bestCode = code; }
      }
    }
    if (bestIdx < 0) continue;
    const statute = rest.slice(0, bestIdx + bestCode.length).trim();
    const desc = rest.slice(bestIdx + bestCode.length).replace(/^[\s-]+/, '').trim();
    report.offenses.push({ number: parseInt(numMatch[1]), status, statute, description: desc, severity });
  }

  // ---- Involved ----
  const invLines = getSectionLines(['Involved', 'Persons Involved']);
  let currentPerson: RmsPerson | null = null;
  const roles = ['SUSPECT', 'VICTIM', 'PERSON', 'WITNESS', 'REPORTING', 'ARRESTED', 'MISSING', 'REPORTEE', 'ORG'];
  for (let j = 0; j < invLines.length; j++) {
    const il = invLines[j];
    if (/^Involvement/.test(il)) continue; // header row
    if (il === 'Invl No' || /^#?NameDOB/.test(il)) continue;
    const isRole = roles.some(r => il === r || il.startsWith(r + ' '));
    if (isRole) {
      if (currentPerson) report.personsInvolved.push(currentPerson);
      currentPerson = {
        involvement: il, name: '', dob: '', sex: '', race: '',
        ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
        age: '', comments: '', guardian: '', detail: ''
      };
    } else if (il === 'INVOLVED' && currentPerson && currentPerson.involvement === 'PERSON') {
      // "PERSON" + "INVOLVED" on separate lines → combine
      currentPerson.involvement = 'PERSON INVOLVED';
    } else if (currentPerson) {
      if (/^\d+$/.test(il)) continue; // invl number
      if (/SEE CONFIDENTIAL PAGE/i.test(il)) { currentPerson.name = '(Confidential)'; }
      else if (/^UNKNOWN,/.test(il)) { currentPerson.name = il; }
      else if (/^[A-Z][A-Z]+,\s+[A-Z]/.test(il) && !currentPerson.name) currentPerson.name = il;
      else if (il === 'Name' && invLines[j + 1]) { currentPerson.name = invLines[j + 1]; j++; }
      else if (il === 'DOB' && invLines[j + 1] && /\d/.test(invLines[j + 1])) { currentPerson.dob = invLines[j + 1]; j++; }
      else if (il === 'Sex' && invLines[j + 1]) { currentPerson.sex = invLines[j + 1]; j++; }
      else if (il === 'Race' && invLines[j + 1]) { currentPerson.race = invLines[j + 1]; j++; }
      else if (/^[MF]$/.test(il) && !currentPerson.sex) currentPerson.sex = il;
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(il) && !currentPerson.dob) currentPerson.dob = il;
    }
  }
  if (currentPerson) report.personsInvolved.push(currentPerson);

  // ---- Vehicles ----
  const vehLines = getSectionLines(['Vehicle(s)', 'Vehicles']);
  let currentVeh: RmsVehicle | null = null;
  for (let j = 0; j < vehLines.length; j++) {
    const vl = vehLines[j];
    if (/^(RECOVERED|STOLEN|IMPOUNDED|SUSPECT|VICTIM|TOWED)\s*$/i.test(vl)) {
      if (currentVeh) report.vehicles.push(currentVeh);
      currentVeh = { status: vl.trim(), colors: '', year: '', make: '', model: '', license: '', state: '', vin: '', type: '' };
    } else if (currentVeh) {
      if (vl === 'Color(s)') { /* next non-empty line is colors */ }
      else if (/^(WHITE|BLACK|BLUE|RED|GREEN|SILVER|GRAY|GREY|BROWN|TAN|MAROON|GOLD|YELLOW|ORANGE)/i.test(vl) && !currentVeh.colors) currentVeh.colors = vl;
      else if (vl === 'Year' || (/^\d{4}$/.test(vl) && parseInt(vl) > 1900 && parseInt(vl) < 2030)) currentVeh.year = /^\d{4}$/.test(vl) ? vl : '';
      else if (/^\d{4}$/.test(vl) && !currentVeh.year) currentVeh.year = vl;
      else if (vl === 'Make' && vehLines[j + 1]) { currentVeh.make = vehLines[j + 1]; j++; }
      else if (vl === 'ModelType / Style' && vehLines[j + 1]) { currentVeh.type = vehLines[j + 1]; j++; }
      else if (/^License No$/.test(vl) && vehLines[j + 1]) { currentVeh.license = vehLines[j + 1]; j++; }
      else if (vl === 'State' && vehLines[j + 1]) { currentVeh.state = vehLines[j + 1]; j++; }
      else if (vl === 'VIN' && vehLines[j + 1]) { currentVeh.vin = vehLines[j + 1]; j++; }
    }
  }
  if (currentVeh) report.vehicles.push(currentVeh);

  // ---- Property ----
  const propLines = getSectionLines(['Property']);
  let currentProp: RmsProperty | null = null;
  for (let j = 0; j < propLines.length; j++) {
    const pl = propLines[j];
    if (pl === 'Hold Reason' && propLines[j + 1]) {
      if (currentProp) report.property.push(currentProp);
      currentProp = { holdReason: propLines[j + 1], articleType: '', make: '', description: '', quantity: '', value: '', recoveredValue: '' };
      j++;
    } else if (currentProp) {
      if (pl === 'Article Type' && propLines[j + 1]) { currentProp.articleType = propLines[j + 1]; j++; }
      else if (pl === 'Description' && propLines[j + 1]) { currentProp.description = propLines[j + 1]; j++; }
      else if (pl === 'MakeModel' && propLines[j + 1]) { currentProp.make = propLines[j + 1]; j++; }
      else if (pl === 'Quantity' && propLines[j + 1]) { currentProp.quantity = propLines[j + 1]; j++; }
      else if (pl === 'Value' && propLines[j + 1]) { currentProp.value = propLines[j + 1]; j++; }
      else if (/^Recovered Value/.test(pl) && propLines[j + 1]) { currentProp.recoveredValue = propLines[j + 1]; j++; }
    }
  }
  if (currentProp) report.property.push(currentProp);

  // ---- Narratives (most important) ----
  const narLines = getSectionLines(['Narrative(s)', 'Narratives', 'NARRATIVE']);
  let currentNarrative: RmsNarrative | null = null;
  // Officer line: "LASTNAME, FIRSTNAME BADGE#" or "LASTNAME, FIRSTNAME BADGE# NARRATIVE"
  const officerPattern = /^([A-Z][A-Z]+,\s+[A-Z][A-Z]+(?:\s+[A-Z]\.?)?)\s+(\d{2,5})(?:\s+NARRATIVE)?$/;
  for (let j = 0; j < narLines.length; j++) {
    const nl = narLines[j];
    const om = nl.match(officerPattern);
    if (om) {
      if (currentNarrative && currentNarrative.text.trim()) report.narratives.push(currentNarrative);
      currentNarrative = { officer: om[1].trim(), badge: om[2], text: '' };
    } else if (currentNarrative) {
      // Stop at confidential section boundary
      if (nl === '*** Confidential Section ***' || nl === 'DO NOT DISTRIBUTE') break;
      // Skip standalone "OFFICER" sub-headers (appear between narratives)
      if (nl === 'OFFICER') continue;
      currentNarrative.text += (currentNarrative.text ? '\n' : '') + nl;
    }
  }
  if (currentNarrative && currentNarrative.text.trim()) report.narratives.push(currentNarrative);

  // ---- Digital ----
  const digLines = getSectionLines(['Digital']);
  for (let j = 0; j < digLines.length; j++) {
    const dl = digLines[j];
    // "OFFICER, NAME BADGE#DESCRIPTION" or "OFFICER, NAME BADGE#" then description on next line
    const digMatch = dl.match(/^([A-Z][A-Z]+,\s+[A-Z][A-Z]+(?:\s+[A-Z]\.?)?)\s+(\d{2,5})(.*)$/);
    if (digMatch) {
      report.digital.push({
        officer: digMatch[1].trim(),
        badge: digMatch[2],
        description: digMatch[3].trim() || (digLines[j + 1] || '')
      });
    }
  }

  // ---- Suspects Extended ----
  const suspExtLines = getSectionLines(['Suspect(s) Extended', 'Suspects Extended']);
  if (suspExtLines.length > 0) {
    let se: RmsPerson | null = null;
    for (let j = 0; j < suspExtLines.length; j++) {
      const sl = suspExtLines[j];
      if (sl === 'Involvement' && suspExtLines[j + 1]) {
        if (se) report.personsInvolved.push(se);
        se = {
          involvement: suspExtLines[j + 1], name: '', dob: '', age: '', sex: '', race: '',
          ethnicity: '', address: '', phone: '', height: '', weight: '', hair: '', eyes: '',
          comments: '', guardian: '', detail: 'Extended'
        };
        j++;
      } else if (se) {
        if (sl === 'Name' && suspExtLines[j + 1]) { se.name = suspExtLines[j + 1]; j++; }
        else if (sl === 'DOB' && suspExtLines[j + 1]) { se.dob = suspExtLines[j + 1]; j++; }
        else if (sl === 'Age' && suspExtLines[j + 1]) { se.age = suspExtLines[j + 1]; j++; }
        else if (sl === 'Sex' && suspExtLines[j + 1]) { se.sex = suspExtLines[j + 1]; j++; }
        else if (sl === 'Race' && suspExtLines[j + 1]) { se.race = suspExtLines[j + 1]; j++; }
      }
    }
    if (se) report.personsInvolved.push(se);
  }

  // ---- Orphan narrative text (continuation after page breaks) ----
  // INFORM RMS puts Digital + Suspects Extended on the same page as the NARRATIVE header,
  // then the bulk of the narrative continues on subsequent pages with no section header.
  // Collect all lines after the last known section that look like narrative text.
  if (sections.length > 0) {
    // Find where the last section's structured data ends
    // (approximate: skip known field labels for Suspects Extended)
    const orphanStart = sections[sections.length - 1].startLine + 1;
    // Skip past the last section's structured content by finding where free text begins
    const structuredLabels = /^(Involvement|Invl No|Name|DOB|Age|Sex|Race|Ethnicity|Height|Weight|ToJuvenile|Arrested|ToWeight|ToHair Color|Eye Color|Build|License & State|SBI\/CII|FBI Number|Misc|Home Address|P\.O\. Box|Cell Phone|Home Phone|Other Phone|Related Offense|Type|FELONY|MISDEMEANOR|Description|SUSPECT|VICTIM|WITNESS|REPORTING|APPROVING|Officer|OFFICER)$/;
    let foundFreeText = false;
    let freeTextStart = orphanStart;
    // Walk through lines after last section; once we see consecutive non-structured lines, that's orphan text
    let consecutiveFree = 0;
    for (let j = orphanStart; j < lines.length; j++) {
      const tl = lines[j];
      if (tl === '*** Confidential Section ***' || tl === 'DO NOT DISTRIBUTE') break;
      if (tl === '' || structuredLabels.test(tl) || /^[A-Z0-9]{1,3}$/.test(tl) || /^\d{1,3}$/.test(tl)
        || /^\(\d{3}\)\s*\d{3}/.test(tl) || /^\d{2}\/\d{2}\/\d{4}/.test(tl) || /^\d{3,}$/.test(tl)
        || /^NON-$/.test(tl) || /^HISPANIC$/.test(tl) || (/^[A-Z]+$/.test(tl) && tl.length < 12)) {
        consecutiveFree = 0;
        continue;
      }
      // Lines with mixed case or long text are likely narrative
      if (tl.length > 40 || /[a-z]/.test(tl)) {
        if (consecutiveFree === 0) freeTextStart = j;
        consecutiveFree++;
        if (consecutiveFree >= 3) { foundFreeText = true; break; }
      } else {
        consecutiveFree = 0;
      }
    }
    if (foundFreeText) {
      const confLine = lines.findIndex((l, idx) => idx >= freeTextStart && l === '*** Confidential Section ***');
      const orphanEnd = confLine >= 0 ? confLine : lines.length;
      // Re-use the officer pattern and narrative parsing on orphan lines
      let orphanNarrative = report.narratives.length > 0 ? report.narratives[report.narratives.length - 1] : null;
      const skipLabels = /^(OFFICER|Involvement|REPORTING|APPROVING|Officer)$/;
      for (let j = freeTextStart; j < orphanEnd; j++) {
        const ol = lines[j];
        if (ol === '*** Confidential Section ***' || ol === 'DO NOT DISTRIBUTE') break;
        if (skipLabels.test(ol) || ol === '') continue;
        const om = ol.match(officerPattern);
        if (om) {
          // Same officer → continue appending; different officer → new narrative
          if (orphanNarrative && orphanNarrative.officer === om[1].trim()) continue;
          if (orphanNarrative && orphanNarrative.text.trim() && !report.narratives.includes(orphanNarrative)) {
            report.narratives.push(orphanNarrative);
          }
          orphanNarrative = { officer: om[1].trim(), badge: om[2], text: '' };
        } else if (orphanNarrative) {
          orphanNarrative.text += (orphanNarrative.text ? '\n' : '') + ol;
        }
      }
      if (orphanNarrative && orphanNarrative.text.trim() && !report.narratives.includes(orphanNarrative)) {
        report.narratives.push(orphanNarrative);
      }
    }
  }

  // ---- Confidential persons (after "*** Confidential Section ***") ----
  const confIdx = lines.findIndex(l => l === '*** Confidential Section ***');
  if (confIdx >= 0) {
    let cp: RmsPerson | null = null;
    for (let j = confIdx + 1; j < lines.length; j++) {
      const cl = lines[j];
      if (cl === 'DO NOT DISTRIBUTE') continue;
      const isRole = roles.some(r => cl.startsWith(r));
      if (isRole) {
        if (cp) report.confidentialPersons.push(cp);
        cp = {
          involvement: cl, name: '', address: '', phone: '', dob: '', age: '', sex: '', race: '',
          ethnicity: '', height: '', weight: '', hair: '', eyes: '', comments: '', guardian: '', detail: ''
        };
      } else if (cp) {
        if (cl === 'Name' && lines[j + 1]) { cp.name = lines[j + 1]; j++; }
        else if (cl === 'Address' && lines[j + 1]) { cp.address = lines[j + 1]; j++; }
        else if (/^Home Address$/.test(cl) && lines[j + 1]) { cp.address = lines[j + 1]; j++; }
        else if (cl === 'DOB' && lines[j + 1]) { cp.dob = lines[j + 1]; j++; }
        else if (cl === 'Age' && lines[j + 1]) { cp.age = lines[j + 1]; j++; }
        else if (cl === 'Sex' && lines[j + 1]) { cp.sex = lines[j + 1]; j++; }
        else if (cl === 'Race' && lines[j + 1]) { cp.race = lines[j + 1]; j++; }
        else if (/^Cell Phone$/.test(cl) && lines[j + 1]) { cp.phone = lines[j + 1]; j++; }
      }
    }
    if (cp) report.confidentialPersons.push(cp);
  }

  return report;
}
