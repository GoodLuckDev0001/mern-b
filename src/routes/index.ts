import express from 'express';
import multer from 'multer';
import path from 'path';
import { submitForm } from '../controller';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: (error: any, acceptFile: boolean) => void) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20
  }
});

router.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Centi Onboarding Backend'
  });
});

router.post('/submit', upload.any(), submitForm);

export default router;
