import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import https from 'https';
import fs from 'fs';
import router from './routes';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { encryptionService } from './utils/encryption';
import selfsigned from 'selfsigned';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

dotenv.config();

const app = express();

// Security middleware with enhanced TLS configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration with secure defaults
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with encryption
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Load the OpenAPI YAML file
const swaggerDocument = YAML.load(path.join(__dirname, './openapi.yaml'));

// API routes
app.use('/api', router);

// Serve Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    encryption: 'AES-256-CBC enabled',
    tls: 'TLS 1.3 enforced'
  });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size of 10MB'
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ 
      error: 'Too many files',
      message: 'Maximum 20 files allowed per request'
    });
  }
  
  return res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// SSL/TLS Configuration for TLS 1.3
const getSSLConfig = () => {
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/cert.pem');
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/key.pem');
  
  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        minVersion: 'TLSv1.3' as any,
        maxVersion: 'TLSv1.3' as any,
        ciphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256'
        ].join(':'),
        honorCipherOrder: true,
        requestCert: false,
        rejectUnauthorized: false
      };
    }
  } catch (error) {
    console.warn('⚠️ SSL certificates not found, generating self-signed certificates for development...');
  }
  
  // Generate self-signed certificate for development
  return generateSelfSignedCert();
};

const generateSelfSignedCert = () => {
  const sslDir = path.join(__dirname, '../ssl');
  
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }
  
  const certPath = path.join(sslDir, 'cert.pem');
  const keyPath = path.join(sslDir, 'key.pem');
  
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    try {
      // Generate self-signed certificate using the selfsigned library
      const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'CH' },
        { name: 'stateOrProvinceName', value: 'Zurich' },
        { name: 'localityName', value: 'Zurich' },
        { name: 'organizationName', value: 'Centi' },
        { name: 'organizationalUnitName', value: 'IT' }
      ];
      
      const pems = selfsigned.generate(attrs, {
        algorithm: 'sha256',
        days: 365,
        keySize: 4096,
        extensions: [
          {
            name: 'basicConstraints',
            cA: true
          },
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
          },
          {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 2, // DNS
                value: 'localhost'
              },
              {
                type: 7, // IP
                ip: '127.0.0.1'
              }
            ]
          }
        ]
      });
      
      // Write certificate and key to files
      fs.writeFileSync(certPath, pems.cert);
      fs.writeFileSync(keyPath, pems.private);
      
      console.log('🔐 Generated self-signed SSL certificate for development');
    } catch (error) {
      console.error('❌ Failed to generate SSL certificate:', error);
      throw new Error('SSL certificate generation failed');
    }
  }
  
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    minVersion: 'TLSv1.3' as any,
    maxVersion: 'TLSv1.3' as any,
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ].join(':'),
    honorCipherOrder: true
  };
};

// Start HTTPS server with TLS 1.3
const startHTTPS = () => {
  try {
    const sslConfig = getSSLConfig();
    const httpsServer = https.createServer(sslConfig, app);
    
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT} with TLS 1.3`);
      console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
      console.log(`🔐 Security: Helmet, CORS, Rate Limiting, TLS 1.3 enabled`);
      console.log(`🔐 Encryption: AES-256-CBC for temporary data`);
      console.log(`📊 Health check: https://localhost:${HTTPS_PORT}/health`);
      
      // Create uploads directory if it doesn't exist
      try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          console.log(`📁 Created uploads directory: ${uploadsDir}`);
        }
      } catch (error) {
        console.error('❌ Error creating uploads directory:', error);
      }
    });
    
    return httpsServer;
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error);
    throw error;
  }
};

// Start HTTP server for development (redirects to HTTPS)
const startHTTP = () => {
  const httpApp = express();
  
  // Redirect all HTTP traffic to HTTPS
  httpApp.use((req, res) => {
    const httpsUrl = `https://${req.headers.host?.replace(/:\d+/, `:${HTTPS_PORT}`)}${req.url}`;
    res.redirect(301, httpsUrl);
  });
  
  httpApp.listen(PORT, () => {
    console.log(`🔄 HTTP Server running on port ${PORT} (redirects to HTTPS)`);
  });
};

// Initialize encryption service
try {
  encryptionService.generateSecureToken(); // Test encryption service
  console.log('🔐 Encryption service initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize encryption service:', error);
  process.exit(1);
}

// Start servers
if (process.env.NODE_ENV === 'production') {
  // Production: HTTPS only
  startHTTPS();
} else {
  // Development: Both HTTP (redirect) and HTTPS
  startHTTP();
  startHTTPS();
}

export default app;