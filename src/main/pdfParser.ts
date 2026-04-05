import * as fs from 'fs';
import pdfParse from 'pdf-parse';

export interface NCMECParsedData {
  cybertipNumber?: string;
  priorityLevel?: string;
  dateReceivedUtc?: string;
  reportingCompany?: string;
  incidentType?: string;
  incidentTime?: string;
  suspectName?: string;
  suspectDOB?: string;
  identifiers: Array<{
    type: string;   // 'email' | 'username' | 'ip' | 'phone' | 'userid' | 'name' | 'url'
    value: string;
    context?: string; // e.g. "Login", "Upload", "Verified", timestamp
  }>;
  files: Array<{
    filename: string;
    ipAddress?: string;
    datetime?: string;
  }>;
  /** Prior CyberTip report numbers referenced */
  priorReports?: string[];
  /** Raw text for debugging (not stored) */
  rawTextPreview?: string;
}

/**
 * Parse NCMEC CyberTip PDF and extract key information.
 * Supports password-protected PDFs (standard for NCMEC reports).
 *
 * @param pdfPath  - Path to the NCMEC PDF file
 * @param password - Optional PDF password
 * @returns Parsed data structure
 */
export async function parseNCMECPDF(pdfPath: string, password?: string): Promise<NCMECParsedData> {
  const dataBuffer = fs.readFileSync(pdfPath);

  const options: any = {};
  if (password) {
    options.password = password;
  }

  let pdfData;
  try {
    pdfData = await pdfParse(dataBuffer, options);
  } catch (err: any) {
    const msg = err?.message || err?.toString() || '';
    // pdf.js throws "PasswordException" or similar for encrypted PDFs
    if (msg.includes('password') || msg.includes('Password') || msg.includes('encrypted')) {
      throw new Error('PasswordRequired: This PDF is password-protected');
    }
    throw err;
  }
  const text = pdfData.text;

  const result: NCMECParsedData = {
    identifiers: [],
    files: []
  };

  // Store first 500 chars for debug
  result.rawTextPreview = text.substring(0, 500);

  // ── CyberTipline Report Number ──────────────────────────────────
  // Pattern: "CyberTipline Report 138034350"
  const reportNumMatch = text.match(/CyberTipline\s+Report\s+#?:?\s*(\d+)/i);
  if (reportNumMatch) {
    result.cybertipNumber = reportNumMatch[1];
  }

  // ── Priority Level ──────────────────────────────────────────────
  // Pattern: "Priority Level: E"  (single letter: E=Elevated, I=Immediate, R=Routine)
  // Maps to short codes stored in DB: 1, 2, 3
  const priorityMatch = text.match(/Priority\s+Level:\s*([A-Z])/i);
  if (priorityMatch) {
    const code = priorityMatch[1].toUpperCase();
    const priorityMap: Record<string, string> = {
      'I': '1',   // Immediate → Level 1 (High)
      'E': '2',   // Elevated  → Level 2 (Medium)
      'R': '3'    // Routine   → Level 3 (Low)
    };
    result.priorityLevel = priorityMap[code] || code;
  }

  // ── Date Received (UTC) ─────────────────────────────────────────
  // Pattern: "Received by NCMEC on 11-01-2022 08:45:44 UTC"
  const dateReceivedMatch = text.match(/Received\s+by\s+NCMEC\s+on\s+([\d\-]+\s+[\d:]+\s+UTC)/i);
  if (dateReceivedMatch) {
    result.dateReceivedUtc = dateReceivedMatch[1].trim();
  }

  // ── Incident Type ───────────────────────────────────────────────
  // Pattern: "Incident Type:Child Pornography ..." or "Incident Type: Apparent Child Pornography"
  // The first match on page 1 (executive summary) may say "Apparent Child Pornography"
  // The Section A match says the full incident type
  const incidentTypeMatch = text.match(/Incident\s+Type:\s*([^\n]+)/i);
  if (incidentTypeMatch) {
    result.incidentType = incidentTypeMatch[1].trim();
  }

  // ── Incident Time ───────────────────────────────────────────────
  // Pattern: "Incident Time: 10-31-2022 08:18:21 UTC"
  const incidentTimeMatch = text.match(/Incident\s+Time:\s*([\d\-]+\s+[\d:]+\s+UTC)/i);
  if (incidentTimeMatch) {
    result.incidentTime = incidentTimeMatch[1].trim();
  }

  // ── Reporting Company / Submitter ───────────────────────────────
  // Real NCMEC format has two columns:
  //   "Submitter: Point of Contact for Law Enforcement:"
  //   "Google Email: USlawenforcement@google.com"
  // OR:
  //   "Submitter: Point of Contact for Law Enforcement:"
  //   "Facebook https://www.facebook.com/records"
  // The company name appears on the line AFTER "Submitter:"
  const submitterSection = text.match(/Submitter:\s*(?:Point\s+of\s+Contact[^\n]*)?\n\s*([^\n]+)/i);
  if (submitterSection) {
    let line = submitterSection[1].trim();
    // The line may be "Google Email: ..." or "Facebook https://..." or just "Google"
    // Extract just the company name (first word or first few words before URL/email)
    const companyMatch = line.match(/^([A-Za-z][A-Za-z0-9 /.\-&]*?)(?:\s+(?:Email|http|Phone|Business|Attn|Google\s+Reviewer))/i);
    if (companyMatch) {
      result.reportingCompany = companyMatch[1].trim();
    } else {
      // Just take the first word(s) as company name
      const firstWords = line.split(/\s+/).slice(0, 3).join(' ');
      result.reportingCompany = firstWords;
    }
  }

  // ── Suspect Section ─────────────────────────────────────────────
  // Extract the Suspect block (ends at "Recipient" or "Additional Information" or "Uploaded File")
  const suspectMatch = text.match(
    /\bSuspect\s*\n([\s\S]*?)(?=\n(?:Recipient|Additional\s+Information|Uploaded\s+File\s+Information|Section\s+B))/i
  );
  const suspectBlock = suspectMatch ? suspectMatch[1] : '';

  // Suspect Name
  const nameMatch = suspectBlock.match(/^Name:\s*(.+)/m);
  if (nameMatch) {
    result.suspectName = nameMatch[1].trim();
    result.identifiers.push({ type: 'name', value: nameMatch[1].trim(), context: 'Suspect' });
  }

  // Suspect DOB
  const dobMatch = suspectBlock.match(/Date\s+of\s+Birth:\s*([\d\-]+)/i);
  if (dobMatch) {
    result.suspectDOB = dobMatch[1].trim();
  }

  // ── Extract identifiers from Suspect block ──────────────────────
  extractIdentifiersFromBlock(suspectBlock, 'Suspect', result);

  // ── Recipient blocks ────────────────────────────────────────────
  // Some CyberTips (e.g. Facebook) have multiple Recipient sections
  const recipientRegex = /\bRecipient\s*\n([\s\S]*?)(?=\n(?:Recipient|Additional\s+Information|Uploaded\s+File\s+Information|Section\s+B))/gi;
  let recipientMatch2;
  while ((recipientMatch2 = recipientRegex.exec(text)) !== null) {
    const block = recipientMatch2[1];
    const rName = block.match(/^Name:\s*(.+)/m);
    if (rName) {
      result.identifiers.push({ type: 'name', value: rName[1].trim(), context: 'Recipient' });
    }
    extractIdentifiersFromBlock(block, 'Recipient', result);
  }

  // ── Prior CT Reports ────────────────────────────────────────────
  const priorMatch = text.match(/Prior\s+CT\s+Reports:\s*([^\n]+)/i);
  if (priorMatch) {
    result.priorReports = priorMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  // ── Uploaded Files ──────────────────────────────────────────────
  const filenameRegex = /Filename:\s*([^\n]+)/gi;
  const filenameMatches = Array.from(text.matchAll(filenameRegex));
  const seenFilenames = new Set<string>();

  filenameMatches.forEach(match => {
    const filename = match[1].trim();
    // Skip table-header style "Filename MD5" lines
    if (filename.toLowerCase() === 'md5' || filename.toLowerCase().startsWith('md5')) return;
    if (seenFilenames.has(filename)) return;
    seenFilenames.add(filename);

    const startPos = match.index || 0;
    const textAfter = text.substring(startPos, startPos + 600);

    const fileInfo: { filename: string; ipAddress?: string; datetime?: string } = { filename };

    // Look for associated IP and datetime
    const ipEventMatch = textAfter.match(/IP\s+Address:?\s+([\d.:a-fA-F]+)\s+\((\w+)\)\s*\n?\s*([\d\-]+\s+[\d:]+\s+UTC)/i);
    if (ipEventMatch) {
      fileInfo.ipAddress = ipEventMatch[1];
      fileInfo.datetime = ipEventMatch[3];
    }

    result.files.push(fileInfo);
  });

  // ── Deduplicate identifiers ─────────────────────────────────────
  result.identifiers = removeDuplicateIdentifiers(result.identifiers);

  return result;
}

/**
 * Extract emails, phones, IPs, usernames, user IDs, and profile URLs from a text block.
 */
function extractIdentifiersFromBlock(
  block: string,
  context: string,
  result: NCMECParsedData
): void {
  // Email Addresses
  // Pattern: "Email Address: VinceMac78@gmail.com (Verified)"
  const emailRegex = /Email\s+Address:\s*([^\s(]+)/gi;
  let m;
  while ((m = emailRegex.exec(block)) !== null) {
    result.identifiers.push({ type: 'email', value: m[1].trim(), context });
  }

  // Phone numbers
  // Pattern: "Mobile Phone: +19094147476 (Verified 03-19-2022 04:24:44 UTC)"
  const phoneRegex = /(?:Mobile\s+)?Phone:\s*(\+?[\d]+)/gi;
  while ((m = phoneRegex.exec(block)) !== null) {
    result.identifiers.push({ type: 'phone', value: m[1].trim(), context });
  }

  // Screen / User Name
  // Pattern: "Screen/User Name: lucio.luna.33449"
  const screenNameRegex = /Screen\/User\s+Name:\s*([^\n]+)/gi;
  while ((m = screenNameRegex.exec(block)) !== null) {
    result.identifiers.push({ type: 'username', value: m[1].trim(), context });
  }

  // ESP User ID
  // Pattern: "ESP User ID: 100057023791775"
  const espUserIdRegex = /ESP\s+User\s+ID:\s*([^\n]+)/gi;
  while ((m = espUserIdRegex.exec(block)) !== null) {
    result.identifiers.push({ type: 'userid', value: m[1].trim(), context });
  }

  // Profile URL
  // Pattern: "Profile URL: https://www.facebook.com/lucio.luna.33449"
  const profileUrlRegex = /Profile\s+URL:\s*(https?:\/\/[^\s\n]+)/gi;
  while ((m = profileUrlRegex.exec(block)) !== null) {
    result.identifiers.push({ type: 'url', value: m[1].trim(), context });
  }

  // IP Addresses with timestamps and event type
  // Pattern: "IP Address: 47.152.87.116 (Login)\n10-29-2022 23:43:28 UTC"
  // Also handles IPv6: "IP Address: 2600:1012:b112:ffa0:c16f:fe3f:847f:e0e9 (Login)"
  const ipRegex = /IP\s+Address:\s*([\d.:a-fA-F]+)\s+\((\w+)\)\s*\n?\s*([\d\-]+\s+[\d:]+\s+UTC)/gi;
  while ((m = ipRegex.exec(block)) !== null) {
    const ip = m[1].trim();
    const eventType = m[2].trim();   // Login, Upload, Other
    const timestamp = m[3].trim();
    result.identifiers.push({
      type: 'ip',
      value: ip,
      context: `${context} - ${eventType} ${timestamp}`
    });
  }
}

/**
 * Remove duplicate identifiers (same type+value), keeping first occurrence.
 */
function removeDuplicateIdentifiers(
  identifiers: Array<{ type: string; value: string; context?: string }>
): Array<{ type: string; value: string; context?: string }> {
  const seen = new Set<string>();
  return identifiers.filter(id => {
    const key = `${id.type}:${id.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Validate parsed data — at minimum should have a CyberTip number.
 */
export function validateNCMECData(data: NCMECParsedData): boolean {
  return !!data.cybertipNumber;
}
