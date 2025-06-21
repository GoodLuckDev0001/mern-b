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
const encryption_1 = require("./encryption");
const path = __importStar(require("path"));
const decryptFile = async () => {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Usage: ts-node backend/src/utils/decrypt.ts <path_to_encrypted_file>');
        process.exit(1);
    }
    const filePath = path.resolve(args[0]);
    console.log(`Attempting to decrypt file: ${filePath}`);
    try {
        const decryptedPath = await encryption_1.encryptionService.decryptFile(filePath);
        console.log(`✅ File decrypted successfully!`);
        console.log(`   Decrypted file available at: ${decryptedPath}`);
    }
    catch (error) {
        console.error('❌ Decryption failed:');
        console.error(error);
    }
};
decryptFile();
//# sourceMappingURL=decrypt.js.map