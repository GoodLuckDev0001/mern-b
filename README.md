# Centi Onboarding Backend

A secure Node.js/Express backend for the Centi onboarding platform, responsible for handling form submissions, file uploads, PDF generation, AES-256 encryption, and email notifications.

---

## Features
- REST API for onboarding data collection
- File upload and PDF generation
- AES-256 encryption of all sensitive files
- Secure key management
- Server-side timestamping
- Email notifications with attachments
- Ready for deployment behind TLS 1.3 reverse proxy

---

## Setup

### Prerequisites
- Node.js (v16+ recommended)
- npm

### 1. Install dependencies
```sh
npm install
```

### 2. Environment Variables
Create a `.env` file in the `backend` directory with your SMTP credentials:
```
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Centi Compliance <compliance@centi.ch>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### 3. Start the server
```sh
npm start
```

---

## API Endpoints
- `POST /api/submit` — Accepts onboarding form data and file uploads
- Other endpoints as defined in `src/routes/`

---

## File Handling & Encryption
- Uploaded documents and generated PDFs are zipped and then encrypted with AES-256.
- Only the `.encrypted` file is retained; the unencrypted zip is deleted for security.
- Encrypted files are stored in `src/templates/`.

### Decrypting Files
To decrypt an encrypted file:
```sh
npm run decrypt -- "src/templates/GeneratedForm_902.4e_2025-06-27T18-34-37-768Z.pdf.encrypted"
```
The decrypted file will appear in the same directory.

---

## Security
- **TLS 1.3:** Enforced at the infrastructure level (reverse proxy/load balancer). The backend is ready for secure deployment.
- **File Encryption:** All sensitive files are encrypted at rest using AES-256. Unencrypted files are deleted immediately after encryption.
- **Key Management:** Encryption keys are securely generated and stored in `src/config/encryption.key` with strict permissions. Key rotation is supported.
- **Validation:** All incoming data is validated for format and correctness.

---

## Scripts
- `npm start` — Start the backend server
- `npm run build` — Compile TypeScript
- `npm run decrypt -- <file>` — Decrypt an encrypted file

---

## Deployment Notes
- Deploy behind a reverse proxy (Nginx/Apache) configured for TLS 1.3.
- Ensure the `encryption.key` file is securely stored and backed up.
- Set environment variables for production (SMTP, database, etc.).
- Regularly rotate encryption keys if required by policy.

---

## License
Proprietary. All rights reserved. 