"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const CryptoJS = __importStar(require("crypto-js"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const KEY_SIZE = 32;
const IV_SIZE = 16;
const SALT_SIZE = 32;
class KeyManager {
    constructor() {
        this.keyPath = path.join(__dirname, '../config/encryption.key');
        this.encryptionKey = this.loadOrGenerateKey();
    }
    static getInstance() {
        if (!KeyManager.instance) {
            KeyManager.instance = new KeyManager();
        }
        return KeyManager.instance;
    }
    loadOrGenerateKey() {
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
        }
        catch (error) {
            console.error('❌ Error in key management:', error);
            throw new Error('Failed to initialize encryption key');
        }
    }
    getKey() {
        return this.encryptionKey;
    }
    rotateKey() {
        const newKey = CryptoJS.lib.WordArray.random(KEY_SIZE).toString();
        fs.writeFileSync(this.keyPath, newKey, { mode: 0o600 });
        this.encryptionKey = newKey;
        console.log('🔄 Encryption key rotated successfully');
    }
}
class EncryptionService {
    constructor() {
        this.keyManager = KeyManager.getInstance();
    }
    encryptData(data) {
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
        }
        catch (error) {
            console.error('❌ Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    decryptData(encryptedData) {
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
        }
        catch (error) {
            console.error('❌ Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }
    async encryptFile(filePath) {
        try {
            const fileData = fs.readFileSync(filePath);
            const encryptedData = this.encryptData(fileData.toString('base64'));
            const encryptedFilePath = filePath + '.encrypted';
            fs.writeFileSync(encryptedFilePath, encryptedData);
            fs.unlinkSync(filePath);
            return encryptedFilePath;
        }
        catch (error) {
            console.error('❌ File encryption error:', error);
            throw new Error('Failed to encrypt file');
        }
    }
    async decryptFile(encryptedFilePath) {
        try {
            const encryptedData = fs.readFileSync(encryptedFilePath, 'utf8');
            const decryptedData = this.decryptData(encryptedData);
            const decryptedFilePath = encryptedFilePath.replace('.encrypted', '');
            const buffer = Buffer.from(decryptedData, 'base64');
            fs.writeFileSync(decryptedFilePath, buffer);
            return decryptedFilePath;
        }
        catch (error) {
            console.error('❌ File decryption error:', error);
            throw new Error('Failed to decrypt file');
        }
    }
    encryptFormData(formData) {
        const jsonData = JSON.stringify(formData);
        return this.encryptData(jsonData);
    }
    decryptFormData(encryptedData) {
        const jsonData = this.decryptData(encryptedData);
        return JSON.parse(jsonData);
    }
    generateSecureToken() {
        return CryptoJS.lib.WordArray.random(32).toString();
    }
    hashData(data) {
        const salt = CryptoJS.lib.WordArray.random(16).toString();
        const hash = CryptoJS.SHA256(data + salt).toString();
        return salt + ':' + hash;
    }
    verifyHash(data, hashedData) {
        const [salt, hash] = hashedData.split(':');
        const computedHash = CryptoJS.SHA256(data + salt).toString();
        return hash === computedHash;
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
//# sourceMappingURL=encryption.js.map