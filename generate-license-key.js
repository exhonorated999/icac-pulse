/**
 * License Key Generator Tool
 * 
 * Run this script to generate license keys for departments
 * 
 * Usage:
 *   node generate-license-key.js [department-id]
 * 
 * Example:
 *   node generate-license-key.js "LAPD-ICAC-2024"
 *   node generate-license-key.js "FBI-CAC-Seattle"
 */

const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');

const LICENSE_SECRET = 'ICAC_PULSE_LICENSE_v1.0_2024';
const LICENSE_VERSION = '1.0';

function generateHardwareId() {
  try {
    const machineId = machineIdSync(true);
    const hash = crypto.createHash('sha256');
    hash.update(machineId);
    hash.update('ICAC_CASE_MANAGER_SALT');
    return hash.digest('hex');
  } catch (error) {
    console.error('Failed to generate hardware ID:', error);
    throw error;
  }
}

function formatLicenseKey(key) {
  const parts = [];
  for (let i = 0; i < key.length; i += 4) {
    parts.push(key.substring(i, i + 4).toUpperCase());
  }
  return parts.slice(0, 5).join('-');
}

function generateLicenseKey(departmentId = 'UNKNOWN') {
  try {
    const hardwareId = generateHardwareId();
    const timestamp = Date.now();
    
    const data = JSON.stringify({
      hw: hardwareId.substring(0, 16),
      ts: timestamp,
      v: LICENSE_VERSION,
      dept: departmentId
    });
    
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.scryptSync(LICENSE_SECRET, 'salt', 32),
      Buffer.alloc(16, 0)
    );
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const checksum = crypto
      .createHash('sha256')
      .update(encrypted + LICENSE_SECRET)
      .digest('hex')
      .substring(0, 4);
    
    const fullKey = encrypted + checksum;
    return formatLicenseKey(fullKey);
  } catch (error) {
    console.error('Failed to generate license key:', error);
    throw error;
  }
}

function generateInstallationReport(departmentId, licenseKey) {
  const hardwareId = generateHardwareId();
  const timestamp = new Date().toISOString();
  
  return `
╔════════════════════════════════════════════════════════════╗
║        ICAC P.U.L.S.E. License Key Generation              ║
╚════════════════════════════════════════════════════════════╝

Generated: ${timestamp}

DEPARTMENT ID: ${departmentId}

LICENSE KEY: ${licenseKey}

HARDWARE ID: ${hardwareId.substring(0, 16)}...

INSTRUCTIONS FOR INSTALLATION:
1. Provide the installer .exe to the department
2. Provide the license key above (separately for security)
3. User must install as Administrator
4. User enters license key when prompted
5. Installer will self-destruct after installation

SECURITY NOTES:
- This license key is bound to the specific machine
- The software cannot be transferred to another computer
- Keep a record of this information for support purposes
- If hardware changes, a new license key must be generated

SUPPORT:
- If the user encounters "Hardware Mismatch" error,
  they will need a new license key for their new machine
- Contact you with their Hardware ID for verification

═══════════════════════════════════════════════════════════════
  `.trim();
}

// Main execution
const departmentId = process.argv[2] || prompt('Enter Department ID: ');

if (!departmentId || departmentId === 'undefined') {
  console.error('❌ Error: Department ID is required');
  console.log('\nUsage: node generate-license-key.js [department-id]');
  console.log('Example: node generate-license-key.js "LAPD-ICAC-2024"');
  process.exit(1);
}

try {
  console.log('\n🔐 Generating license key...\n');
  
  const licenseKey = generateLicenseKey(departmentId);
  const report = generateInstallationReport(departmentId, licenseKey);
  
  console.log(report);
  console.log('\n✅ License key generated successfully!');
  console.log('\n📋 Save this information securely for your records.');
  
} catch (error) {
  console.error('\n❌ Error generating license key:', error.message);
  process.exit(1);
}
