/**
 * Field Security Manager for PULSE
 * AES-256-GCM encryption with PBKDF2-SHA256 key derivation
 * Master key wrapped with both password and recovery key
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const MAGIC = Buffer.from('PLSENC'); // 6-byte magic header
const VERSION = 1;

// Ambiguous characters removed for recovery keys
const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface SecurityConfig {
  enabled: boolean;
  passwordSalt: string;
  passwordWrappedKey: string;
  passwordIV: string;
  passwordTag: string;
  recoverySalt: string;
  recoveryWrappedKey: string;
  recoveryIV: string;
  recoveryTag: string;
}

export class FieldSecurityManager {
  private configPath: string;
  private vaultPath: string;
  private vaultPlainPath: string;
  private config: SecurityConfig | null = null;
  private masterKey: Buffer | null = null;

  constructor(dataDir: string) {
    this.configPath = path.join(dataDir, 'field_security.json');
    this.vaultPath = path.join(dataDir, 'vault.enc');
    this.vaultPlainPath = path.join(dataDir, 'vault_plain.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch {
      this.config = null;
    }
  }

  private saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  private encryptAES(data: Buffer, key: Buffer): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv, tag, ciphertext: encrypted };
  }

  private decryptAES(ciphertext: Buffer, key: Buffer, iv: Buffer, tag: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private generateRecoveryKey(): string {
    const parts: string[] = [];
    for (let p = 0; p < 5; p++) {
      let segment = '';
      for (let i = 0; i < 4; i++) {
        segment += RECOVERY_CHARS[crypto.randomInt(RECOVERY_CHARS.length)];
      }
      parts.push(segment);
    }
    return 'PULSE-' + parts.join('-');
  }

  getState(): { enabled: boolean; locked: boolean } {
    return {
      enabled: this.config?.enabled ?? false,
      locked: this.masterKey === null
    };
  }

  setup(password: string): string {
    // Generate random master key
    const masterKey = crypto.randomBytes(KEY_LENGTH);

    // Wrap master key with password
    const pwSalt = crypto.randomBytes(16);
    const pwKey = this.deriveKey(password, pwSalt);
    const pwWrapped = this.encryptAES(masterKey, pwKey);

    // Wrap master key with recovery key
    const recoveryKey = this.generateRecoveryKey();
    const recSalt = crypto.randomBytes(16);
    const recKey = this.deriveKey(recoveryKey, recSalt);
    const recWrapped = this.encryptAES(masterKey, recKey);

    this.config = {
      enabled: true,
      passwordSalt: pwSalt.toString('hex'),
      passwordWrappedKey: pwWrapped.ciphertext.toString('hex'),
      passwordIV: pwWrapped.iv.toString('hex'),
      passwordTag: pwWrapped.tag.toString('hex'),
      recoverySalt: recSalt.toString('hex'),
      recoveryWrappedKey: recWrapped.ciphertext.toString('hex'),
      recoveryIV: recWrapped.iv.toString('hex'),
      recoveryTag: recWrapped.tag.toString('hex')
    };
    this.saveConfig();
    this.masterKey = masterKey;

    return recoveryKey;
  }

  unlock(password: string): boolean {
    if (!this.config) return false;
    try {
      const salt = Buffer.from(this.config.passwordSalt, 'hex');
      const key = this.deriveKey(password, salt);
      const iv = Buffer.from(this.config.passwordIV, 'hex');
      const tag = Buffer.from(this.config.passwordTag, 'hex');
      const ct = Buffer.from(this.config.passwordWrappedKey, 'hex');
      this.masterKey = this.decryptAES(ct, key, iv, tag);
      return true;
    } catch {
      this.masterKey = null;
      return false;
    }
  }

  recover(recoveryKey: string): boolean {
    if (!this.config) return false;
    try {
      const salt = Buffer.from(this.config.recoverySalt, 'hex');
      const key = this.deriveKey(recoveryKey.toUpperCase().trim(), salt);
      const iv = Buffer.from(this.config.recoveryIV, 'hex');
      const tag = Buffer.from(this.config.recoveryTag, 'hex');
      const ct = Buffer.from(this.config.recoveryWrappedKey, 'hex');
      this.masterKey = this.decryptAES(ct, key, iv, tag);
      return true;
    } catch {
      this.masterKey = null;
      return false;
    }
  }

  changePassword(newPassword: string): void {
    if (!this.masterKey || !this.config) throw new Error('Not unlocked');
    const pwSalt = crypto.randomBytes(16);
    const pwKey = this.deriveKey(newPassword, pwSalt);
    const pwWrapped = this.encryptAES(this.masterKey, pwKey);
    this.config.passwordSalt = pwSalt.toString('hex');
    this.config.passwordWrappedKey = pwWrapped.ciphertext.toString('hex');
    this.config.passwordIV = pwWrapped.iv.toString('hex');
    this.config.passwordTag = pwWrapped.tag.toString('hex');
    this.saveConfig();
  }

  generateNewRecoveryKey(): string {
    if (!this.masterKey || !this.config) throw new Error('Not unlocked');
    const recoveryKey = this.generateRecoveryKey();
    const recSalt = crypto.randomBytes(16);
    const recKey = this.deriveKey(recoveryKey, recSalt);
    const recWrapped = this.encryptAES(this.masterKey, recKey);
    this.config.recoverySalt = recSalt.toString('hex');
    this.config.recoveryWrappedKey = recWrapped.ciphertext.toString('hex');
    this.config.recoveryIV = recWrapped.iv.toString('hex');
    this.config.recoveryTag = recWrapped.tag.toString('hex');
    this.saveConfig();
    return recoveryKey;
  }

  disable(): void {
    // Decrypt vault to plain JSON before disabling
    if (fs.existsSync(this.vaultPath) && this.masterKey) {
      try {
        const plain = this.decryptVault();
        if (plain) {
          fs.writeFileSync(this.vaultPlainPath, plain, 'utf-8');
        }
      } catch { /* ignore */ }
      fs.unlinkSync(this.vaultPath);
    }
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
    this.config = null;
    this.masterKey = null;
  }

  lock(): void {
    this.masterKey = null;
  }

  encryptVault(jsonString: string): void {
    if (!this.masterKey) throw new Error('Not unlocked');
    const data = Buffer.from(jsonString, 'utf-8');
    const { iv, tag, ciphertext } = this.encryptAES(data, this.masterKey);

    // File format: PLSENC(6) + version(1) + reserved(1) + IV(16) + tag(16) + ciphertext
    const header = Buffer.alloc(8);
    MAGIC.copy(header, 0);
    header.writeUInt8(VERSION, 6);
    header.writeUInt8(0, 7);

    const output = Buffer.concat([header, iv, tag, ciphertext]);
    fs.writeFileSync(this.vaultPath, output);
  }

  decryptVault(): string | null {
    if (!this.masterKey) throw new Error('Not unlocked');
    if (!fs.existsSync(this.vaultPath)) return null;

    const data = fs.readFileSync(this.vaultPath);
    if (data.length < 40) return null;

    // Validate magic
    if (data.subarray(0, 6).toString() !== 'PLSENC') return null;

    const iv = data.subarray(8, 24);
    const tag = data.subarray(24, 40);
    const ciphertext = data.subarray(40);

    const plain = this.decryptAES(ciphertext, this.masterKey, iv, tag);
    return plain.toString('utf-8');
  }
}
