export declare class EncryptionService {
    private keyManager;
    constructor();
    encryptData(data: string): string;
    decryptData(encryptedData: string): string;
    encryptFile(filePath: string): Promise<string>;
    decryptFile(encryptedFilePath: string): Promise<string>;
    encryptFormData(formData: any): string;
    decryptFormData(encryptedData: string): any;
    generateSecureToken(): string;
    hashData(data: string): string;
    verifyHash(data: string, hashedData: string): boolean;
}
export declare const encryptionService: EncryptionService;
