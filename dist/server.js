"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const routes_1 = __importDefault(require("./routes"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const encryption_1 = require("./utils/encryption");
const selfsigned_1 = __importDefault(require("selfsigned"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' }
}));
app.use((0, compression_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'https://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'uploads')));
app.use('/api', routes_1.default);
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        encryption: 'AES-256-CBC enabled',
        tls: 'TLS 1.3 enforced'
    });
});
app.use((err, _req, res, _next) => {
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
app.use('*', (_req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const getSSLConfig = () => {
    const certPath = process.env.SSL_CERT_PATH || path_1.default.join(__dirname, '../ssl/cert.pem');
    const keyPath = process.env.SSL_KEY_PATH || path_1.default.join(__dirname, '../ssl/key.pem');
    try {
        if (fs_1.default.existsSync(certPath) && fs_1.default.existsSync(keyPath)) {
            return {
                cert: fs_1.default.readFileSync(certPath),
                key: fs_1.default.readFileSync(keyPath),
                minVersion: 'TLSv1.3',
                maxVersion: 'TLSv1.3',
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
    }
    catch (error) {
        console.warn('⚠️ SSL certificates not found, generating self-signed certificates for development...');
    }
    return generateSelfSignedCert();
};
const generateSelfSignedCert = () => {
    const sslDir = path_1.default.join(__dirname, '../ssl');
    if (!fs_1.default.existsSync(sslDir)) {
        fs_1.default.mkdirSync(sslDir, { recursive: true });
    }
    const certPath = path_1.default.join(sslDir, 'cert.pem');
    const keyPath = path_1.default.join(sslDir, 'key.pem');
    if (!fs_1.default.existsSync(certPath) || !fs_1.default.existsSync(keyPath)) {
        try {
            const attrs = [
                { name: 'commonName', value: 'localhost' },
                { name: 'countryName', value: 'CH' },
                { name: 'stateOrProvinceName', value: 'Zurich' },
                { name: 'localityName', value: 'Zurich' },
                { name: 'organizationName', value: 'Centi' },
                { name: 'organizationalUnitName', value: 'IT' }
            ];
            const pems = selfsigned_1.default.generate(attrs, {
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
                                type: 2,
                                value: 'localhost'
                            },
                            {
                                type: 7,
                                ip: '127.0.0.1'
                            }
                        ]
                    }
                ]
            });
            fs_1.default.writeFileSync(certPath, pems.cert);
            fs_1.default.writeFileSync(keyPath, pems.private);
            console.log('🔐 Generated self-signed SSL certificate for development');
        }
        catch (error) {
            console.error('❌ Failed to generate SSL certificate:', error);
            throw new Error('SSL certificate generation failed');
        }
    }
    return {
        cert: fs_1.default.readFileSync(certPath),
        key: fs_1.default.readFileSync(keyPath),
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256'
        ].join(':'),
        honorCipherOrder: true
    };
};
const startHTTPS = () => {
    try {
        const sslConfig = getSSLConfig();
        const httpsServer = https_1.default.createServer(sslConfig, app);
        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT} with TLS 1.3`);
            console.log(`📁 Upload directory: ${path_1.default.join(__dirname, 'uploads')}`);
            console.log(`🔐 Security: Helmet, CORS, Rate Limiting, TLS 1.3 enabled`);
            console.log(`🔐 Encryption: AES-256-CBC for temporary data`);
            console.log(`📊 Health check: https://localhost:${HTTPS_PORT}/health`);
            try {
                const uploadsDir = path_1.default.join(__dirname, 'uploads');
                if (!fs_1.default.existsSync(uploadsDir)) {
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                    console.log(`📁 Created uploads directory: ${uploadsDir}`);
                }
            }
            catch (error) {
                console.error('❌ Error creating uploads directory:', error);
            }
        });
        return httpsServer;
    }
    catch (error) {
        console.error('❌ Failed to start HTTPS server:', error);
        throw error;
    }
};
const startHTTP = () => {
    const httpApp = (0, express_1.default)();
    httpApp.use((req, res) => {
        const httpsUrl = `https://${req.headers.host?.replace(/:\d+/, `:${HTTPS_PORT}`)}${req.url}`;
        res.redirect(301, httpsUrl);
    });
    httpApp.listen(PORT, () => {
        console.log(`🔄 HTTP Server running on port ${PORT} (redirects to HTTPS)`);
    });
};
try {
    encryption_1.encryptionService.generateSecureToken();
    console.log('🔐 Encryption service initialized successfully');
}
catch (error) {
    console.error('❌ Failed to initialize encryption service:', error);
    process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
    startHTTPS();
}
else {
    startHTTP();
    startHTTPS();
}
exports.default = app;
//# sourceMappingURL=server.js.map