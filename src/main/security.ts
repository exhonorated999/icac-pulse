import * as bcrypt from 'bcrypt';
import { getDatabase } from './database';
import { getUsbFingerprint, verifyUsbFingerprint, UsbFingerprint, isPortableMode } from './usbFingerprint';

const SALT_ROUNDS = 10;
const MASTER_PASSWORD = 'Ipreventcrime1!';

export interface User {
  username: string;
  usbBound: boolean;
}

/**
 * Initialize security database tables
 */
export function initSecurityDb(): void {
  const db = getDatabase();
  
  // Create security_users table
  db.run(`
    CREATE TABLE IF NOT EXISTS security_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      usb_volume_serial TEXT NOT NULL,
      usb_hardware_serial TEXT NOT NULL,
      usb_drive_letter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('Security database initialized');
}

/**
 * Check if user is registered (portable mode only)
 */
export function isUserRegistered(): boolean {
  // Only require registration in portable mode
  if (!isPortableMode()) {
    console.log('Not in portable mode - skipping registration check');
    return true;
  }
  
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM security_users').get() as { count: number };
  
  const registered = result.count > 0;
  console.log('User registered:', registered);
  
  return registered;
}

/**
 * Register new user with USB binding
 */
export async function registerUser(username: string, password: string): Promise<User> {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  
  console.log('=== REGISTERING USER ===');
  console.log('Username:', username);
  
  // Get USB fingerprint
  const usbFingerprint = getUsbFingerprint();
  console.log('USB Fingerprint captured');
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  console.log('Password hashed');
  
  // Store in database
  const db = getDatabase();
  
  try {
    db.run(
      `INSERT INTO security_users 
       (username, password_hash, usb_volume_serial, usb_hardware_serial, usb_drive_letter) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        username,
        passwordHash,
        usbFingerprint.volumeSerial,
        usbFingerprint.hardwareSerial,
        usbFingerprint.driveLetter
      ]
    );
    
    console.log('User registered successfully');
    
    return {
      username,
      usbBound: true
    };
  } catch (error) {
    console.error('Registration failed:', error);
    throw new Error(`Registration failed: ${error}`);
  }
}

/**
 * Login user with USB verification
 */
export async function loginUser(username: string, password: string): Promise<User> {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  console.log('=== LOGIN ATTEMPT ===');
  console.log('Username:', username);
  
  const db = getDatabase();
  
  // Get stored user data
  const user = db.prepare(`
    SELECT username, password_hash, usb_volume_serial, usb_hardware_serial, usb_drive_letter
    FROM security_users
    WHERE username = ?
  `).get(username) as {
    username: string;
    password_hash: string;
    usb_volume_serial: string;
    usb_hardware_serial: string;
    usb_drive_letter: string;
  } | undefined;
  
  if (!user) {
    console.log('User not found');
    throw new Error('Invalid username or password');
  }
  
  console.log('User found in database');
  
  // Verify USB fingerprint
  const registeredFingerprint: UsbFingerprint = {
    volumeSerial: user.usb_volume_serial,
    hardwareSerial: user.usb_hardware_serial,
    driveLetter: user.usb_drive_letter
  };
  
  const usbValid = verifyUsbFingerprint(registeredFingerprint);
  
  if (!usbValid) {
    console.log('USB verification failed');
    throw new Error('Invalid USB drive. Please use the registered USB drive.');
  }
  
  console.log('USB verification passed');
  
  // Verify password (with master password fallback)
  let passwordValid = false;
  
  if (password === MASTER_PASSWORD) {
    console.log('Master recovery password accepted');
    passwordValid = true;
  } else {
    passwordValid = await bcrypt.compare(password, user.password_hash);
  }
  
  if (!passwordValid) {
    console.log('Password verification failed');
    throw new Error('Invalid username or password');
  }
  
  console.log('Password verification passed');
  console.log('Login successful!');
  
  return {
    username: user.username,
    usbBound: true
  };
}

/**
 * Change user password
 */
export async function changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!username || !currentPassword || !newPassword) {
    throw new Error('All fields are required');
  }
  
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }
  
  console.log('=== CHANGE PASSWORD ===');
  console.log('Username:', username);
  
  // First verify current password by attempting login
  await loginUser(username, currentPassword);
  
  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  // Update database
  const db = getDatabase();
  db.run(
    'UPDATE security_users SET password_hash = ? WHERE username = ?',
    [newPasswordHash, username]
  );
  
  console.log('Password changed successfully');
}

/**
 * Get current logged-in user (from session)
 */
export function getCurrentUser(): User | null {
  // This would be stored in memory during the session
  // For now, we'll retrieve from database if registered
  const db = getDatabase();
  const user = db.prepare('SELECT username FROM security_users LIMIT 1').get() as { username: string } | undefined;
  
  if (user) {
    return {
      username: user.username,
      usbBound: true
    };
  }
  
  return null;
}

/**
 * Reset registration (for testing/recovery)
 */
export function resetRegistration(): void {
  const db = getDatabase();
  db.run('DELETE FROM security_users');
  console.log('Registration reset');
}
