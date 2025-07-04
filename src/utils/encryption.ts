import * as CryptoJS from 'crypto-js';
import * as fs from 'fs';
import * as path from 'path';

const KEY_SIZE = 32;
const IV_SIZE = 16;
const SALT_SIZE = 32;

class KeyManager {
  private static instance: KeyManager;
  private encryptionKey: string;
  private keyPath: string;

  private constructor() {
    this.keyPath = path.join(__dirname, '../config/encryption.key');
    this.encryptionKey = this.loadOrGenerateKey();
  }

  public static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  private loadOrGenerateKey(): string {
    try {
      const configDir = path.dirname(this.keyPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(this.keyPath)) {
        const keyData = fs.readFileSync(this.keyPath, 'utf8');
        return keyData.trim();
      }

      const newKey = CryptoJS.lib.WordArray.random(KEY_SIZE).toString();
      fs.writeFileSync(this.keyPath, newKey, { mode: 0o600 });
      console.log('🔐 Generated new encryption key');
      return newKey;
    } catch (error) {
      console.error('❌ Error in key management:', error);
      throw new Error('Failed to initialize encryption key');
    }
  }

  public getKey(): string {
    return this.encryptionKey;
  }

  public rotateKey(): void {
    const newKey = CryptoJS.lib.WordArray.random(KEY_SIZE).toString();
    fs.writeFileSync(this.keyPath, newKey, { mode: 0o600 });
    this.encryptionKey = newKey;
    console.log('🔄 Encryption key rotated successfully');
  }
}

export class EncryptionService {
  private keyManager: KeyManager;

  constructor() {
    this.keyManager = KeyManager.getInstance();
  }

  public encryptData(data: string): string {
    try {
      const key = this.keyManager.getKey();
      const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
      const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
      
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: KEY_SIZE / 4,
        iterations: 10000
      });

      const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const result = salt.toString() + iv.toString() + encrypted.toString();
      return result;
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  public decryptData(encryptedData: string): string {
    try {
      const key = this.keyManager.getKey();
      
      const salt = CryptoJS.enc.Hex.parse(encryptedData.substr(0, SALT_SIZE * 2));
      const iv = CryptoJS.enc.Hex.parse(encryptedData.substr(SALT_SIZE * 2, IV_SIZE * 2));
      const encrypted = encryptedData.substr((SALT_SIZE + IV_SIZE) * 2);

      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: KEY_SIZE / 4,
        iterations: 10000
      });

      const decrypted = CryptoJS.AES.decrypt(encrypted, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('❌ Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }
  public async encryptFile(filePath: string): Promise<string> {
    try {
      const fileData = fs.readFileSync(filePath);
      const encryptedData = this.encryptData(fileData.toString('base64'));
      const encryptedFilePath = filePath + '.encrypted';
      fs.writeFileSync(encryptedFilePath, encryptedData);
      
      fs.unlinkSync(filePath);
      
      return encryptedFilePath;
    } catch (error) {
      console.error('❌ File encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  public async decryptFile(encryptedFilePath: string): Promise<string> {
    try {
      const encryptedData = fs.readFileSync(encryptedFilePath, 'utf8');
      const decryptedData = this.decryptData(encryptedData);
      const decryptedFilePath = encryptedFilePath.replace('.encrypted', '');
      
      const buffer = Buffer.from(decryptedData, 'base64');
      fs.writeFileSync(decryptedFilePath, buffer);
      
      return decryptedFilePath;
    } catch (error) {
      console.error('❌ File decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  public encryptFormData(formData: any): string {
    const jsonData = JSON.stringify(formData);
    return this.encryptData(jsonData);
  }

  public decryptFormData(encryptedData: string): any {
    const jsonData = this.decryptData(encryptedData);
    return JSON.parse(jsonData);
  }

  public generateSecureToken(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  public hashData(data: string): string {
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.SHA256(data + salt).toString();
    return salt + ':' + hash;
  }

  public verifyHash(data: string, hashedData: string): boolean {
    const [salt, hash] = hashedData.split(':');
    const computedHash = CryptoJS.SHA256(data + salt).toString();
    return hash === computedHash;
  }
}

export const encryptionService = new EncryptionService(); 