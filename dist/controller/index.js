"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitForm = void 0;
const encryption_1 = require("../utils/encryption");
const submitForm = async (req, res) => {
    try {
        const formData = req.body;
        const files = req.files;
        const timestamp = new Date().toISOString();
        console.log('Form submission received at:', timestamp);
        encryption_1.encryptionService.encryptFormData(formData);
        console.log('Form data encrypted successfully');
        const encryptedFiles = [];
        if (files && files.length > 0) {
            console.log(`Processing ${files.length} uploaded files...`);
            for (const file of files) {
                try {
                    const encryptedFilePath = await encryption_1.encryptionService.encryptFile(file.path);
                    encryptedFiles.push(encryptedFilePath);
                    console.log(`File encrypted: ${file.originalname} -> ${encryptedFilePath}`);
                }
                catch (error) {
                    console.error(`Failed to encrypt file ${file.originalname}:`, error);
                    throw new Error(`File encryption failed for ${file.originalname}`);
                }
            }
        }
        const applicationId = `CENTI-${Date.now()}-${encryption_1.encryptionService.generateSecureToken().substring(0, 8)}`;
        console.log('Application processed successfully:', applicationId);
        res.status(200).json({
            success: true,
            message: 'Form submitted successfully',
            timestamp: timestamp,
            applicationId: applicationId,
            filesProcessed: encryptedFiles.length
        });
    }
    catch (error) {
        console.error('Error submitting form:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.submitForm = submitForm;
//# sourceMappingURL=index.js.map