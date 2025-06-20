import { Request, Response } from 'express';
import { encryptionService } from '../utils/encryption';

export const submitForm = async (req: Request, res: Response) => {
  try {
    const formData = req.body;
    const files = req.files as Express.Multer.File[];
    const timestamp = new Date().toISOString();
    
    console.log('Form submission received at:', timestamp);
    
    // Encrypt form data in memory (for future database storage)
    encryptionService.encryptFormData(formData);
    console.log('Form data encrypted successfully');
    
    // Encrypt uploaded files
    const encryptedFiles: string[] = [];
    if (files && files.length > 0) {
      console.log(`Processing ${files.length} uploaded files...`);
      
      for (const file of files) {
        try {
          const encryptedFilePath = await encryptionService.encryptFile(file.path);
          encryptedFiles.push(encryptedFilePath);
          console.log(`File encrypted: ${file.originalname} -> ${encryptedFilePath}`);
        } catch (error) {
          console.error(`Failed to encrypt file ${file.originalname}:`, error);
          throw new Error(`File encryption failed for ${file.originalname}`);
        }
      }
    }
    
    // Generate secure application ID
    const applicationId = `CENTI-${Date.now()}-${encryptionService.generateSecureToken().substring(0, 8)}`;
    
    // TODO: Add database storage logic here with encrypted data
    // TODO: Add document generation logic here
    // TODO: Add email notification logic here
    
    console.log('Application processed successfully:', applicationId);
    
    res.status(200).json({
      success: true,
      message: 'Form submitted successfully',
      timestamp: timestamp,
      applicationId: applicationId,
      filesProcessed: encryptedFiles.length
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
