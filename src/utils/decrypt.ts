import { encryptionService } from './encryption';
import * as path from 'path';

const decryptFile = async () => {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: ts-node backend/src/utils/decrypt.ts <path_to_encrypted_file>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  console.log(`Attempting to decrypt file: ${filePath}`);

  try {
    const decryptedPath = await encryptionService.decryptFile(filePath);
    console.log(`✅ File decrypted successfully!`);
    console.log(`   Decrypted file available at: ${decryptedPath}`);
  } catch (error) {
    console.error('❌ Decryption failed:');
    console.error(error);
  }
};

decryptFile(); 