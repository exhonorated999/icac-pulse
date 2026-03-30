import { execSync } from 'child_process';
import * as fs from 'fs';

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
 */
function getVolumeSerial(driveLetter: string): string {
  try {
    // Use PowerShell to get volume serial
    const command = `powershell -Command "Get-Volume -DriveLetter ${driveLetter.replace(':', '')} | Select-Object -ExpandProperty SerialNumber"`;
    const output = execSync(command, { encoding: 'utf-8' }).trim();
    
    if (output && output !== '') {
      return output;
    }
    
    // Fallback: use wmic
    const wmicCommand = `wmic volume where "DriveLetter='${driveLetter}'" get SerialNumber`;
    const wmicOutput = execSync(wmicCommand, { encoding: 'utf-8' });
    const lines = wmicOutput.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    if (lines.length > 1) {
      return lines[1]; // Second line after "SerialNumber" header
    }
    
    throw new Error('Could not retrieve volume serial');
  } catch (error) {
    console.error('Failed to get volume serial:', error);
    throw new Error(`Volume serial retrieval failed: ${error}`);
  }
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
    // Import required modules at top of function
    const path = require('path');
    const { getUserDataPath } = require('./database');
    
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
    
    // Check if drive is removable using Windows API
    const command = `powershell -Command "Get-Volume -DriveLetter ${driveLetter.replace(':', '')} | Select-Object -ExpandProperty DriveType"`;
    const output = execSync(command, { encoding: 'utf-8' }).trim();
    
    console.log('Drive type:', output);
    
    // DriveType: Removable = 2, Fixed = 3
    const isRemovable = output === 'Removable' || output === '2';
    console.log('RESULT: Portable mode =', isRemovable);
    
    return isRemovable;
  } catch (error) {
    console.error('Error in isPortableMode:', error);
    // If can't determine, check for .portable marker as fallback
    try {
      const path = require('path');
      const { getUserDataPath } = require('./database');
      const portableMarkerPath = path.join(getUserDataPath(), '.portable');
      return fs.existsSync(portableMarkerPath);
    } catch {
      return false;
    }
  }
}
