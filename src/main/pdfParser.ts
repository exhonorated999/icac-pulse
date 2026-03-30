import * as fs from 'fs';
import pdfParse from 'pdf-parse';

export interface NCMECParsedData {
  cybertipNumber?: string;
  priorityLevel?: string;
  dateReceivedUtc?: string;
  reportingCompany?: string;
  incidentType?: string;
  incidentTime?: string;
  identifiers: Array<{
    type: string;
    value: string;
  }>;
  files: Array<{
    filename: string;
    ipAddress?: string;
    datetime?: string;
  }>;
}

/**
 * Parse NCMEC CyberTip PDF and extract key information
 * @param pdfPath - Path to the NCMEC PDF file
 * @returns Parsed data structure
 */
export async function parseNCMECPDF(pdfPath: string): Promise<NCMECParsedData> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  
  const text = pdfData.text;
  const result: NCMECParsedData = {
    identifiers: [],
    files: []
  };
  
  // Extract CyberTipline Report Number
  // Pattern: "CyberTipline Report 136492947" or "CyberTipline Report #136492947"
  const reportNumMatch = text.match(/CyberTipline\s+Report\s+#?:?\s*(\d+)/i);
  if (reportNumMatch) {
    result.cybertipNumber = reportNumMatch[1];
  }
  
  // Extract Priority Level
  // Pattern: "Priority Level: E" or "Priority Level:E"
  const priorityMatch = text.match(/Priority\s+Level:\s*([A-Z])/i);
  if (priorityMatch) {
    const priorityCode = priorityMatch[1].toUpperCase();
    // Map single letter codes to full priority levels
    const priorityMap: { [key: string]: string } = {
      'I': 'Immediate',
      'E': 'Elevated',
      'R': 'Routine'
    };
    result.priorityLevel = priorityMap[priorityCode] || priorityCode;
  }
  
  // Extract Date Received (UTC)
  // Pattern: "Received by NCMEC on 10-13-2022 17:47:36 UTC"
  const dateReceivedMatch = text.match(/Received\s+by\s+NCMEC\s+on\s+([\d\-]+\s+[\d:]+\s+UTC)/i);
  if (dateReceivedMatch) {
    result.dateReceivedUtc = dateReceivedMatch[1].trim();
  }
  
  // Extract Submitter/Reporting Company
  // Pattern: "Submitter: MediaLab/Kik" or just "MediaLab/Kik" after Submitter:
  const submitterMatch = text.match(/Submitter:?\s*\n?\s*([^\n]+?)(?:\n|Business\s+Address)/i);
  if (submitterMatch) {
    result.reportingCompany = submitterMatch[1].trim();
  }
  
  // Extract Incident Type
  // Pattern: "Incident Type: Child Pornography (possession, manufacture, and distribution)"
  const incidentTypeMatch = text.match(/Incident\s+Type:\s*([^\n]+)/i);
  if (incidentTypeMatch) {
    result.incidentType = incidentTypeMatch[1].trim();
  }
  
  // Extract Incident Time
  // Pattern: "Incident Time: 10-10-2022 19:21:35 UTC"
  const incidentTimeMatch = text.match(/Incident\s+Time:\s*([\d\-]+\s+[\d:]+\s+UTC)/i);
  if (incidentTimeMatch) {
    result.incidentTime = incidentTimeMatch[1].trim();
  }
  
  // Extract Identifiers (emails, usernames, IPs, etc.)
  
  // Email addresses - look specifically in Suspect section
  const emailMatch = text.match(/Email\s+Address:\s*([^\n]+)/i);
  if (emailMatch) {
    const email = emailMatch[1].trim();
    if (email && email.includes('@')) {
      result.identifiers.push({ type: 'email', value: email });
    }
  }
  
  // Also find all emails in text as fallback
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  emails.forEach(email => {
    // Avoid duplicate from specific match above
    if (!result.identifiers.some(id => id.type === 'email' && id.value === email)) {
      result.identifiers.push({ type: 'email', value: email });
    }
  });
  
  // Screen/User Name
  const screenNameMatch = text.match(/Screen\/User\s+Name:\s*([^\n]+)/i);
  if (screenNameMatch) {
    const username = screenNameMatch[1].trim();
    if (username) {
      result.identifiers.push({ type: 'username', value: username });
    }
  }
  
  // ESP User ID
  const espUserIdMatch = text.match(/ESP\s+User\s+ID:\s*([^\n]+)/i);
  if (espUserIdMatch) {
    const userId = espUserIdMatch[1].trim();
    if (userId) {
      result.identifiers.push({ type: 'userid', value: userId });
    }
  }
  
  // IP Addresses - look for specific patterns in Suspect section
  const ipAddressMatch = text.match(/IP\s+Address:\s*([\d.]+)\s*\(([^)]+)\)\s*([\d\-]+\s+[\d:]+\s+UTC)/i);
  if (ipAddressMatch) {
    const ip = ipAddressMatch[1].trim();
    const eventType = ipAddressMatch[2].trim(); // e.g., "Login"
    const datetime = ipAddressMatch[3].trim();
    result.identifiers.push({ 
      type: 'ip', 
      value: `${ip} (${eventType}) - ${datetime}` 
    });
  }
  
  // Also find all IP addresses in text
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const ips = text.match(ipRegex) || [];
  ips.forEach(ip => {
    // Filter out invalid IPs and avoid duplicates
    const parts = ip.split('.');
    const isValid = parts.every(part => parseInt(part) <= 255);
    if (isValid && !result.identifiers.some(id => id.value.includes(ip))) {
      result.identifiers.push({ type: 'ip', value: ip });
    }
  });
  
  // Phone numbers (US format)
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const phones = text.match(phoneRegex) || [];
  phones.forEach(phone => {
    result.identifiers.push({ type: 'phone', value: phone });
  });
  
  // Extract uploaded files information
  // Pattern from PDF: Filename followed by MD5, then possibly IP and datetime
  const filenameRegex = /Filename:\s*([^\n]+)/gi;
  const filenameMatches = Array.from(text.matchAll(filenameRegex));
  
  filenameMatches.forEach(match => {
    const filename = match[1].trim();
    
    // Try to find associated IP and datetime in the following text
    const startPos = match.index || 0;
    const textAfter = text.substring(startPos, startPos + 500); // Look at next 500 chars
    
    // Look for IP Address with Event and Date/Time pattern
    const ipEventMatch = textAfter.match(/IP\s+Address\s+([\d.]+)\s+(\w+)\s+([\d\-]+\s+[\d:]+\s+UTC)/i);
    
    const fileInfo: { filename: string; ipAddress?: string; datetime?: string } = {
      filename: filename
    };
    
    if (ipEventMatch) {
      fileInfo.ipAddress = ipEventMatch[1];
      fileInfo.datetime = ipEventMatch[3];
    }
    
    result.files.push(fileInfo);
  });
  
  // Remove duplicate identifiers
  result.identifiers = removeDuplicateIdentifiers(result.identifiers);
  
  return result;
}

/**
 * Remove duplicate identifiers while preserving order
 */
function removeDuplicateIdentifiers(
  identifiers: Array<{ type: string; value: string }>
): Array<{ type: string; value: string }> {
  const seen = new Set<string>();
  return identifiers.filter(id => {
    const key = `${id.type}:${id.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Validate parsed data
 */
export function validateNCMECData(data: NCMECParsedData): boolean {
  // At minimum, we should have a cybertip number
  return !!data.cybertipNumber;
}
