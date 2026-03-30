import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// List of known disposable email domains (curated list)
const DISPOSABLE_DOMAINS = [
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com',
  'throwaway.email', 'trashmail.com', 'yopmail.com', 'getnada.com',
  'maildrop.cc', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com',
  'grr.la', 'guerrillamail.net', 'spam4.me', 'tempinbox.com',
  'mailnesia.com', 'mintemail.com', 'mytemp.email', 'temp-mail.io',
  'discard.email', 'emailondeck.com', 'fakemailgenerator.com', 'getairmail.com'
];

// Common domain typos
const COMMON_TYPOS: { [key: string]: string } = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com'
};

export interface EmailVerificationResult {
  email: string;
  valid: boolean;
  classification: 'deliverable' | 'risky' | 'undeliverable';
  status: 'valid' | 'invalid' | 'disposable' | 'risky' | 'offline' | 'catch-all' | 'unknown';
  checks: {
    syntax: { valid: boolean; message: string };
    disposable: { isDisposable: boolean; message: string };
    typo: { hasTypo: boolean; suggestion?: string; message: string };
    dns: { valid: boolean; message: string; mxRecords?: string[] };
    smtp: { valid: boolean; message: string };
  };
  message: string;
  timestamp: string;
}

/**
 * Validate email syntax using RFC 5322 compliant regex
 */
function validateSyntax(email: string): { valid: boolean; message: string } {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!email || email.trim() === '') {
    return { valid: false, message: 'Email is empty' };
  }
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  
  // Additional checks
  if (email.length > 254) {
    return { valid: false, message: 'Email too long (max 254 characters)' };
  }
  
  const [local, domain] = email.split('@');
  
  if (local.length > 64) {
    return { valid: false, message: 'Local part too long (max 64 characters)' };
  }
  
  if (domain.includes('..')) {
    return { valid: false, message: 'Domain contains consecutive dots' };
  }
  
  return { valid: true, message: 'Syntax is valid' };
}

/**
 * Check if email is from a disposable email provider
 */
function checkDisposable(email: string): { isDisposable: boolean; message: string } {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    return { isDisposable: false, message: 'Unable to extract domain' };
  }
  
  const isDisposable = DISPOSABLE_DOMAINS.includes(domain);
  
  return {
    isDisposable,
    message: isDisposable 
      ? `Disposable email provider detected: ${domain}` 
      : 'Not a known disposable email provider'
  };
}

/**
 * Check for common typos in domain
 */
function checkTypos(email: string): { hasTypo: boolean; suggestion?: string; message: string } {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    return { hasTypo: false, message: 'Unable to extract domain' };
  }
  
  const suggestion = COMMON_TYPOS[domain];
  
  if (suggestion) {
    const correctedEmail = email.split('@')[0] + '@' + suggestion;
    return {
      hasTypo: true,
      suggestion: correctedEmail,
      message: `Possible typo detected. Did you mean: ${correctedEmail}?`
    };
  }
  
  return { hasTypo: false, message: 'No common typos detected' };
}

/**
 * Check DNS MX records for the domain
 */
async function checkDNS(email: string): Promise<{ valid: boolean; message: string; mxRecords?: string[] }> {
  const domain = email.split('@')[1];
  
  if (!domain) {
    return { valid: false, message: 'Unable to extract domain' };
  }
  
  try {
    const mxRecords = await resolveMx(domain);
    
    if (mxRecords && mxRecords.length > 0) {
      // Sort by priority (lower is better)
      mxRecords.sort((a, b) => a.priority - b.priority);
      
      const recordList = mxRecords.map(r => r.exchange);
      
      return {
        valid: true,
        message: `Found ${mxRecords.length} mail server(s)`,
        mxRecords: recordList
      };
    } else {
      return { valid: false, message: 'No mail servers found for domain' };
    }
  } catch (error: any) {
    if (error.code === 'ENOTFOUND') {
      return { valid: false, message: 'Domain does not exist' };
    } else if (error.code === 'ENODATA') {
      return { valid: false, message: 'Domain has no MX records' };
    } else {
      return { valid: false, message: `DNS lookup failed: ${error.message}` };
    }
  }
}

/**
 * Verify mailbox exists via SMTP handshake (without sending email)
 */
async function checkSMTP(email: string, mxHost?: string): Promise<{ valid: boolean; message: string }> {
  if (!mxHost) {
    return { valid: false, message: 'No mail server available' };
  }
  
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    let response = '';
    let step = 0;
    
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ valid: false, message: 'SMTP connection timeout' });
    }, 10000); // 10 second timeout
    
    socket.on('data', (data) => {
      response = data.toString();
      
      if (step === 0 && response.startsWith('220')) {
        // Server ready
        socket.write('HELO verify.local\r\n');
        step = 1;
      } else if (step === 1 && response.startsWith('250')) {
        // HELO accepted
        socket.write('MAIL FROM:<verify@verify.local>\r\n');
        step = 2;
      } else if (step === 2 && response.startsWith('250')) {
        // MAIL FROM accepted
        socket.write(`RCPT TO:<${email}>\r\n`);
        step = 3;
      } else if (step === 3) {
        clearTimeout(timeout);
        socket.write('QUIT\r\n');
        socket.end();
        
        if (response.startsWith('250')) {
          resolve({ valid: true, message: 'Mailbox exists and can receive email' });
        } else if (response.startsWith('550') || response.startsWith('551') || response.startsWith('553')) {
          resolve({ valid: false, message: 'Mailbox does not exist' });
        } else if (response.startsWith('450') || response.startsWith('451') || response.startsWith('452')) {
          resolve({ valid: false, message: 'Mailbox temporarily unavailable' });
        } else {
          resolve({ valid: false, message: 'Unable to verify mailbox' });
        }
      }
    });
    
    socket.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ valid: false, message: `SMTP error: ${error.message}` });
    });
    
    socket.on('timeout', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ valid: false, message: 'SMTP connection timeout' });
    });
  });
}

/**
 * Check if system is online
 */
async function isOnline(): Promise<boolean> {
  try {
    // Try to resolve a well-known DNS
    await resolveMx('gmail.com');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Comprehensive email verification
 */
export async function verifyEmail(email: string, skipOnlineChecks = false): Promise<EmailVerificationResult> {
  const timestamp = new Date().toISOString();
  
  // Trim and lowercase
  email = email.trim().toLowerCase();
  
  // Always run offline checks
  const syntaxCheck = validateSyntax(email);
  const disposableCheck = checkDisposable(email);
  const typoCheck = checkTypos(email);
  
  // Initialize result
  const result: EmailVerificationResult = {
    email,
    valid: syntaxCheck.valid,
    classification: 'undeliverable',
    status: 'invalid',
    checks: {
      syntax: syntaxCheck,
      disposable: disposableCheck,
      typo: typoCheck,
      dns: { valid: false, message: 'Not checked' },
      smtp: { valid: false, message: 'Not checked' }
    },
    message: '',
    timestamp
  };
  
  // If syntax is invalid, return early
  if (!syntaxCheck.valid) {
    result.message = syntaxCheck.message;
    result.status = 'invalid';
    result.classification = 'undeliverable';
    return result;
  }
  
  // If disposable, mark as such
  if (disposableCheck.isDisposable) {
    result.status = 'disposable';
    result.classification = 'risky';
    result.message = 'Disposable/temporary email service detected';
    result.valid = false;
  }
  
  // If typo detected, mark as risky
  if (typoCheck.hasTypo) {
    result.status = 'risky';
    result.classification = 'risky';
    result.message = typoCheck.message;
    result.valid = false;
  }
  
  // Skip online checks if requested or if already determined invalid
  if (skipOnlineChecks) {
    if (result.status === 'invalid') {
      result.message = syntaxCheck.message;
    }
    return result;
  }
  
  // Check if online
  const online = await isOnline();
  
  if (!online) {
    result.status = 'offline';
    result.classification = 'risky';
    result.message = 'Internet connection required for full verification';
    return result;
  }
  
  // Perform DNS check
  const dnsCheck = await checkDNS(email);
  result.checks.dns = dnsCheck;
  
  if (!dnsCheck.valid) {
    result.status = 'invalid';
    result.classification = 'undeliverable';
    result.message = dnsCheck.message;
    result.valid = false;
    return result;
  }
  
  // Perform SMTP check (use first MX record)
  const mxHost = dnsCheck.mxRecords?.[0];
  if (mxHost) {
    const smtpCheck = await checkSMTP(email, mxHost);
    result.checks.smtp = smtpCheck;
    
    if (smtpCheck.valid) {
      // SMTP confirmed mailbox exists
      result.status = 'valid';
      result.classification = 'deliverable';
      result.message = 'Email address verified and can receive mail';
      result.valid = true;
    } else {
      // SMTP failed, but DNS passed
      // This is common for servers that block verification (catch-all, greylisting, etc.)
      result.status = 'catch-all';
      result.classification = 'risky';
      result.message = 'Server accepts connections but blocks mailbox verification (common security practice)';
      result.valid = true; // Optimistically valid since DNS passed
    }
  } else {
    result.status = 'unknown';
    result.classification = 'risky';
    result.message = 'Unable to connect to mail server';
    result.valid = true; // Still consider risky, not invalid
  }
  
  return result;
}
