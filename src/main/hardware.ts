import { machineIdSync } from 'node-machine-id';
import * as crypto from 'crypto';

/**
 * Generate a unique hardware ID for this machine
 * Uses machine-id library which generates a consistent ID based on:
 * - Windows: MachineGuid from registry
 * - Result is hashed for additional security
 */
export function generateHardwareId(): string {
  try {
    const machineId = machineIdSync(true); // true = original machine id
    
    // Hash the machine ID for additional security
    const hash = crypto.createHash('sha256');
    hash.update(machineId);
    hash.update('ICAC_CASE_MANAGER_SALT'); // Application-specific salt
    
    return hash.digest('hex');
  } catch (error) {
    console.error('Failed to generate hardware ID:', error);
    throw new Error('Unable to generate hardware identifier');
  }
}

/**
 * Verify if the provided hardware ID matches the current machine
 */
export function verifyHardwareId(storedId: string): boolean {
  try {
    const currentId = generateHardwareId();
    return currentId === storedId;
  } catch (error) {
    console.error('Failed to verify hardware ID:', error);
    return false;
  }
}

/**
 * Generate encryption key from hardware ID
 * Used to encrypt the SQLite database
 */
export function generateEncryptionKey(hardwareId: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(hardwareId);
  hash.update('DATABASE_ENCRYPTION_KEY');
  return hash.digest('hex');
}
