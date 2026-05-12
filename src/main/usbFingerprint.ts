import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getUserDataPath } from './database';

export interface UsbFingerprint {
  volumeSerial: string;
  hardwareSerial: string;
  driveLetter: string;
}

/**
 * Get USB drive fingerprint for the portable installation
 * Returns volume serial + hardware serial for USB binding
 */
export function getUsbFingerprint(): UsbFingerprint {
  try {
    const exePath = process.execPath;
    const driveLetter = exePath.substring(0, 2); // e.g., "H:"
    
    console.log('=== USB FINGERPRINT ===');
    console.log('Executable path:', exePath);
    console.log('Drive letter:', driveLetter);
    
    // Get volume serial number using Windows API
    const volumeSerial = getVolumeSerial(driveLetter);
    console.log('Volume serial:', volumeSerial);
    
    // Get hardware serial number from WMI
    const hardwareSerial = getHardwareSerial(driveLetter);
    console.log('Hardware serial:', hardwareSerial);
    
    return {
      volumeSerial,
      hardwareSerial,
      driveLetter
    };
  } catch (error) {
    console.error('Failed to get USB fingerprint:', error);
    throw new Error(`USB fingerprint failed: ${error}`);
  }
}

/**
 * Get volume serial number from Windows
 *
 * Tries multiple methods because:
 *   - `Get-Volume -DriveLetter X | Select SerialNumber` returns NOTHING on
 *     many Windows builds (MSFT_Volume's SerialNumber property is empty for
 *     some USB drives) and throws "Property 'SerialNumber' cannot be found"
 *     on older PowerShell.
 *   - `wmic` is deprecated/removed on Windows 11 24H2+.
 *   - `cmd /c vol X:` is the most universally reliable fallback.
 */
function getVolumeSerial(driveLetter: string): string {
  const letterNoColon = driveLetter.replace(':', '');
  const letterWithColon = letterNoColon + ':';
  const attempts: Array<{ name: string; run: () => string }> = [
    {
      name: 'Win32_LogicalDisk.VolumeSerialNumber (WMI)',
      run: () => {
        const cmd = `powershell -NoProfile -Command "(Get-WmiObject Win32_LogicalDisk -Filter \\"DeviceID='${letterWithColon}'\\").VolumeSerialNumber"`;
        return execSync(cmd, { encoding: 'utf-8', timeout: 8000 }).trim();
      },
    },
    {
      name: 'Win32_LogicalDisk via CIM',
      run: () => {
        const cmd = `powershell -NoProfile -Command "(Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='${letterWithColon}'\\").VolumeSerialNumber"`;
        return execSync(cmd, { encoding: 'utf-8', timeout: 8000 }).trim();
      },
    },
    {
      name: 'cmd vol',
      run: () => {
        // `vol D:` returns: "Volume in drive D is XYZ\r\n Volume Serial Number is XXXX-XXXX"
        const out = execSync(`cmd /c vol ${letterWithColon}`, { encoding: 'utf-8', timeout: 5000 });
        const m = out.match(/Serial Number is\s+([A-F0-9-]+)/i);
        if (m) return m[1].replace(/-/g, '');
        return '';
      },
    },
    {
      name: 'wmic logicaldisk (legacy)',
      run: () => {
        const out = execSync(
          `wmic logicaldisk where "DeviceID='${letterWithColon}'" get VolumeSerialNumber`,
          { encoding: 'utf-8', timeout: 5000 }
        );
        const lines = out.split('\n').map(l => l.trim()).filter(l => l !== '' && !/^VolumeSerialNumber$/i.test(l));
        return lines[0] || '';
      },
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const value = attempt.run();
      if (value && value !== '') {
        console.log(`Volume serial via ${attempt.name}: ${value}`);
        return value;
      }
      errors.push(`${attempt.name}: empty`);
    } catch (err: any) {
      errors.push(`${attempt.name}: ${err?.message || err}`);
    }
  }

  console.error('All volume serial methods failed:', errors);
  throw new Error(`Volume serial retrieval failed (tried ${attempts.length} methods): ${errors.join(' | ')}`);
}

/**
 * Get hardware serial number from USB device
 */
function getHardwareSerial(driveLetter: string): string {
  try {
    // Get USB device ID using PowerShell and WMI
    const command = `powershell -Command "$drive = Get-WmiObject Win32_LogicalDisk | Where-Object {$_.DeviceID -eq '${driveLetter}'}; if ($drive) { $partition = Get-WmiObject Win32_DiskPartition | Where-Object {$_.DeviceID -eq $drive.DeviceID.Replace('\\\\\\\\', '\\\\\\\\\\\\\\\\')}; if ($partition) { $disk = Get-WmiObject Win32_DiskDrive | Where-Object {$_.Index -eq $partition.DiskIndex}; if ($disk) { Write-Output $disk.PNPDeviceID } } }"`;
    
    const output = execSync(command, { encoding: 'utf-8', timeout: 5000 }).trim();
    
    if (output && output !== '') {
      return output;
    }
    
    // Fallback: use volume serial as basis
    const volumeSerial = getVolumeSerial(driveLetter);
    return `VOL_${volumeSerial}`;
    
  } catch (error) {
    console.warn('Failed to get hardware serial, using volume-based fallback:', error);
    // Fallback to volume serial
    try {
      const volumeSerial = getVolumeSerial(driveLetter);
      return `VOL_${volumeSerial}`;
    } catch (e) {
      throw new Error(`Hardware serial retrieval failed: ${error}`);
    }
  }
}

/**
 * Verify USB fingerprint matches registered fingerprint
 */
export function verifyUsbFingerprint(registered: UsbFingerprint): boolean {
  try {
    const current = getUsbFingerprint();
    
    console.log('=== USB VERIFICATION ===');
    console.log('Registered:', JSON.stringify(registered));
    console.log('Current:', JSON.stringify(current));
    
    const volumeMatch = current.volumeSerial === registered.volumeSerial;
    const hardwareMatch = current.hardwareSerial === registered.hardwareSerial;
    
    console.log('Volume match:', volumeMatch);
    console.log('Hardware match:', hardwareMatch);
    console.log('Result:', volumeMatch && hardwareMatch ? 'VERIFIED' : 'FAILED');
    
    return volumeMatch && hardwareMatch;
  } catch (error) {
    console.error('USB verification error:', error);
    return false;
  }
}

/**
 * Check if running in portable mode (on removable drive)
 */
export function isPortableMode(): boolean {
  try {
    // Method 1: Check for .portable marker file in AppData
    const portableMarkerPath = path.join(getUserDataPath(), '.portable');
    const hasPortableMarker = fs.existsSync(portableMarkerPath);
    
    console.log('=== PORTABLE MODE CHECK ===');
    console.log('Portable marker path:', portableMarkerPath);
    console.log('Portable marker exists:', hasPortableMarker);
    
    // If marker exists, we're in portable mode
    if (hasPortableMarker) {
      console.log('RESULT: Portable mode (marker file found)');
      return true;
    }
    
    // Method 2: Check if running from removable drive
    const exePath = process.execPath;
    const driveLetter = exePath.substring(0, 2);
    
    console.log('Executable path:', exePath);
    console.log('Drive letter:', driveLetter);
    
    // Check if drive is removable using WMI (Win32_LogicalDisk.DriveType: 2 = removable)
    const command = `powershell -NoProfile -Command "(Get-WmiObject Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}'\\").DriveType"`;
    const output = execSync(command, { encoding: 'utf-8', timeout: 8000 }).trim();
    
    console.log('Drive type:', output);
    
    // DriveType: Removable = 2, Fixed = 3
    const isRemovable = output === '2' || output === 'Removable';
    console.log('RESULT: Portable mode =', isRemovable);
    
    return isRemovable;
  } catch (error) {
    console.error('Error in isPortableMode:', error);
    // If can't determine, check for .portable marker as fallback
    try {
      const portableMarkerPath = path.join(getUserDataPath(), '.portable');
      return fs.existsSync(portableMarkerPath);
    } catch {
      return false;
    }
  }
}
