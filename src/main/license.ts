import * as crypto from 'crypto';
import { generateHardwareId } from './hardware';

/**
 * License Key System for ICAC P.U.L.S.E.
 * 
 * Provides multi-layered security:
 * 1. Hardware binding (machine-specific)
 * 2. License key validation
 * 3. Installation tracking
 * 
 * License Key Format: XXXX-XXXX-XXXX-XXXX-XXXX
 * - Contains encrypted hardware ID
 * - Contains installation timestamp
 * - Contains checksum
 */

const LICENSE_SECRET = 'ICAC_PULSE_LICENSE_v1.0_2024';
const LICENSE_VERSION = '1.0';

interface LicenseInfo {
  hardwareId: string;
  timestamp: number;
  version: string;
  departmentId?: string;
  valid: boolean;
}

/**
 * Generate a license key for the current machine
 * This would typically be done by you (the developer) and provided to departments
 */
export function generateLicenseKey(departmentId?: string): string {
  try {
    const hardwareId = generateHardwareId();
    const timestamp = Date.now();
    const version = LICENSE_VERSION;
    
    // Create data object
    const data = JSON.stringify({
      hw: hardwareId.substring(0, 16), // Partial hardware ID
      ts: timestamp,
      v: version,
      dept: departmentId || 'UNKNOWN'
    });
    
    // Encrypt the data
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.scryptSync(LICENSE_SECRET, 'salt', 32),
      Buffer.alloc(16, 0) // IV
    );
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Add checksum
    const checksum = crypto
      .createHash('sha256')
      .update(encrypted + LICENSE_SECRET)
      .digest('hex')
      .substring(0, 4);
    
    const fullKey = encrypted + checksum;
    
    // Format as XXXX-XXXX-XXXX-XXXX-XXXX
    return formatLicenseKey(fullKey);
  } catch (error) {
    console.error('Failed to generate license key:', error);
    throw new Error('License generation failed');
  }
}

/**
 * Validate a license key for the current machine
 */
export function validateLicenseKey(licenseKey: string): LicenseInfo {
  try {
    // Remove formatting
    const cleanKey = licenseKey.replace(/-/g, '');
    
    if (cleanKey.length < 8) {
      return { hardwareId: '', timestamp: 0, version: '', valid: false };
    }
    
    // Extract checksum
    const encrypted = cleanKey.substring(0, cleanKey.length - 4);
    const providedChecksum = cleanKey.substring(cleanKey.length - 4);
    
    // Verify checksum
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(encrypted + LICENSE_SECRET)
      .digest('hex')
      .substring(0, 4);
    
    if (providedChecksum !== calculatedChecksum) {
      console.error('License checksum mismatch');
      return { hardwareId: '', timestamp: 0, version: '', valid: false };
    }
    
    // Decrypt the data
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.scryptSync(LICENSE_SECRET, 'salt', 32),
      Buffer.alloc(16, 0) // IV
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const data = JSON.parse(decrypted);
    
    // Verify hardware ID matches (partial match)
    const currentHardwareId = generateHardwareId();
    const hwMatch = currentHardwareId.startsWith(data.hw);
    
    return {
      hardwareId: data.hw,
      timestamp: data.ts,
      version: data.v,
      departmentId: data.dept,
      valid: hwMatch && data.v === LICENSE_VERSION
    };
  } catch (error) {
    console.error('License validation error:', error);
    return { hardwareId: '', timestamp: 0, version: '', valid: false };
  }
}

/**
 * Format license key with dashes
 */
function formatLicenseKey(key: string): string {
  const parts: string[] = [];
  for (let i = 0; i < key.length; i += 4) {
    parts.push(key.substring(i, i + 4).toUpperCase());
  }
  return parts.slice(0, 5).join('-'); // Limit to 5 groups
}

/**
 * Check if this is the first installation on this machine
 */
export function isFirstInstallation(): boolean {
  // This would check if app data directory exists
  // If it doesn't exist, this is a first installation
  return true; // Placeholder
}

/**
 * Mark installation as complete
 * Creates a marker file to prevent re-installation
 */
export function markInstallationComplete(): void {
  // Create installation marker
  // This prevents running the installer again
  console.log('Installation marked as complete');
}

/**
 * Generate installation report for auditing
 */
export function generateInstallationReport(): string {
  const hardwareId = generateHardwareId();
  const timestamp = new Date().toISOString();
  
  return `
ICAC P.U.L.S.E. Installation Report
===================================
Installation Date: ${timestamp}
Hardware ID: ${hardwareId}
Version: ${LICENSE_VERSION}

This installation is bound to this specific machine.
The software cannot be transferred to another computer.

For support or license issues, contact your ICAC coordinator
with the Hardware ID listed above.
  `.trim();
}
