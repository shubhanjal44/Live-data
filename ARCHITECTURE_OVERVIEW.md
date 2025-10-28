# Live-Data: System Architecture & Technical Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Web Browser    │  │   iOS App        │  │   Android App    │  │
│  │   (React.js)     │  │   (Swift/Kotlin) │  │   (Kotlin/Java)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │             │
│           └─────────────────────┼─────────────────────┘             │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │  Client-Side Encryption │                      │
│                    │  (AES-256-GCM)          │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   HTTPS/TLS Encryption     │
                    │   (Data in Transit)        │
                    └─────────────┬──────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                      API GATEWAY LAYER                               │
├─────────────────────────────────┼────────────────────────────────────┤
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │   API Gateway           │                      │
│                    │   (Rate Limiting)       │                      │
│                    │   (Request Validation)  │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                    BACKEND APPLICATION LAYER                         │
├─────────────────────────────────┼────────────────────────────────────┤
│                                 │                                    │
│  ┌──────────────────────────────▼──────────────────────────────┐   │
│  │              Express.js REST API Server                     │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐  │   │
│  │  │ Auth Controller │  │ File Controller │  │ Conversion │  │   │
│  │  │ - Register      │  │ - Upload        │  │ Controller │  │   │
│  │  │ - Login         │  │ - Download      │  │ - Convert  │  │   │
│  │  │ - MFA           │  │ - Delete        │  │ - Queue    │  │   │
│  │  │ - Password Reset│  │ - Share         │  │            │  │   │
│  │  └─────────────────┘  │ - Search        │  └────────────┘  │   │
│  │                       │ - Tag           │                  │   │
│  │                       └─────────────────┘                  │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │         Encryption & Security Services              │  │   │
│  │  │ - AES-256-GCM Encryption/Decryption                 │  │   │
│  │  │ - Key Management (AWS KMS Integration)              │  │   │
│  │  │ - Password Hashing (Bcrypt/Argon2)                  │  │   │
│  │  │ - JWT Token Generation & Validation                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐    ┌──────────▼──────────┐    ┌────────▼────────┐
│  DATABASE      │    │  CACHE LAYER       │    │  MESSAGE QUEUE  │
│  LAYER         │    │  (Redis)           │    │  (RabbitMQ)     │
├────────────────┤    ├────────────────────┤    ├─────────────────┤
│                │    │                    │    │                 │
│ PostgreSQL     │    │ - Session Cache    │    │ - File Conversion
│ - Users        │    │ - File Metadata    │    │ - Email Sending │
│ - Files        │    │ - Search Index     │    │ - Notifications │
│ - Keys         │    │ - Rate Limits      │    │                 │
│ - Audit Logs   │    │                    │    │                 │
│                │    │                    │    │                 │
└────────────────┘    └────────────────────┘    └─────────────────┘
        │
        │
┌───────▼────────────────────────────────────────────────────────┐
│              STORAGE & EXTERNAL SERVICES LAYER                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  AWS S3 / GCS    │  │  AWS KMS         │  │  CloudConvert│ │
│  │  (File Storage)  │  │  (Key Management)│  │  (Conversion)│ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Email Service   │  │  SMS Service     │  │  Monitoring  │ │
│  │  (SendGrid)      │  │  (Twilio)        │  │  (Datadog)   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: File Upload with Encryption

```
User Upload Flow:
┌─────────────┐
│ User Selects│
│    File    │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Client-Side          │
│ Encryption           │
│ (AES-256-GCM)        │
│ Generate IV & Key    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ HTTPS/TLS            │
│ Encrypted Upload     │
│ to Server            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Server Validation    │
│ - MIME Type Check    │
│ - File Size Check    │
│ - Malware Scan       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Server-Side          │
│ Encryption           │
│ (Additional Layer)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Store in S3/GCS      │
│ Encrypted File       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Store Metadata in    │
│ PostgreSQL           │
│ - File Name          │
│ - Size, Type         │
│ - Encryption IV      │
│ - Key ID             │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Store Encryption Key │
│ in AWS KMS           │
│ (Separate from Data) │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Log Audit Event      │
│ in Audit Table       │
└──────────────────────┘
```

---

## Data Flow: File Download with Decryption

```
User Download Flow:
┌─────────────┐
│ User Clicks │
│  Download   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Server Validates     │
│ User Permissions     │
│ & Access Rights      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Check if File Has    │
│ Password Protection  │
└──────┬───────────────┘
       │
       ├─── YES ──────┐
       │              │
       │         ┌────▼──────────────┐
       │         │ Prompt for        │
       │         │ File Password     │
       │         │ Validate Hash     │
       │         └────┬──────────────┘
       │              │
       └──────┬───────┘
              │
              ▼
┌──────────────────────┐
│ Retrieve Encryption  │
│ Key from AWS KMS     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Retrieve Encrypted   │
│ File from S3/GCS     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Server-Side          │
│ Decryption           │
│ (Remove Server Layer)│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Send via HTTPS/TLS   │
│ to Client            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Client-Side          │
│ Decryption           │
│ (AES-256-GCM)        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Display/Download     │
│ Decrypted File       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Log Audit Event      │
│ in Audit Table       │
└──────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Authentication & Authorization                    │
│  ├─ Email/Password Registration                             │
│  ├─ Multi-Factor Authentication (MFA)                       │
│  ├─ JWT Token-Based Sessions                                │
│  ├─ Role-Based Access Control (RBAC)                        │
│  └─ Device Management & Trusted Devices                     │
│                                                              │
│  Layer 2: Data in Transit                                   │
│  ├─ HTTPS/TLS 1.3 Encryption                                │
│  ├─ Certificate Pinning (Mobile Apps)                       │
│  ├─ Perfect Forward Secrecy (PFS)                           │
│  └─ HSTS Headers                                            │
│                                                              │
│  Layer 3: Client-Side Encryption                            │
│  ├─ AES-256-GCM Encryption                                  │
│  ├─ Random IV Generation                                    │
│  ├─ Client-Controlled Keys                                  │
│  └─ No Keys Sent to Server                                  │
│                                                              │
│  Layer 4: Server-Side Encryption                            │
│  ├─ Additional AES-256-GCM Layer                            │
│  ├─ Server-Managed Keys                                     │
│  ├─ Key Rotation Policies                                   │
│  └─ Separate Key Storage (AWS KMS)                          │
│                                                              │
│  Layer 5: File-Level Password Protection                    │
│  ├─ Individual File Passwords                               │
│  ├─ Bcrypt/Argon2 Password Hashing                          │
│  ├─ Brute-Force Protection                                  │
│  └─ Rate Limiting on Password Attempts                      │
│                                                              │
│  Layer 6: Access Control & Audit                            │
│  ├─ Granular File Permissions                               │
│  ├─ Comprehensive Audit Logging                             │
│  ├─ Activity Tracking                                       │
│  └─ Anomaly Detection                                       │
│                                                              │
│  Layer 7: Infrastructure Security                           │
│  ├─ Firewall & DDoS Protection                              │
│  ├─ Intrusion Detection Systems                             │
│  ├─ Regular Security Audits                                 │
│  ├─ Penetration Testing                                     │
│  └─ Vulnerability Scanning                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  storage_quota BIGINT DEFAULT 5368709120, -- 5GB
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);
```

### Files Table
```sql
CREATE TABLE files (
  file_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50),
  mime_type VARCHAR(100),
  s3_key VARCHAR(500) NOT NULL,
  encryption_iv VARCHAR(255) NOT NULL,
  encryption_key_id UUID NOT NULL,
  password_hash VARCHAR(255),
  is_password_protected BOOLEAN DEFAULT FALSE,
  folder_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
```

### Encryption Keys Table
```sql
CREATE TABLE encryption_keys (
  key_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  key_hash VARCHAR(255) NOT NULL,
  key_version INT DEFAULT 1,
  kms_key_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  log_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints (MVP)

### Authentication Endpoints
```
POST   /api/v1/auth/register          - User registration
POST   /api/v1/auth/login             - User login
POST   /api/v1/auth/refresh-token     - Refresh JWT token
POST   /api/v1/auth/logout            - User logout
POST   /api/v1/auth/mfa/setup         - Setup MFA
POST   /api/v1/auth/mfa/verify        - Verify MFA code
POST   /api/v1/auth/password-reset    - Request password reset
POST   /api/v1/auth/password-reset/confirm - Confirm password reset
```

### File Management Endpoints
```
POST   /api/v1/files/upload           - Upload file
GET    /api/v1/files                  - List user files
GET    /api/v1/files/:fileId          - Get file metadata
GET    /api/v1/files/:fileId/download - Download file
DELETE /api/v1/files/:fileId          - Delete file
PUT    /api/v1/files/:fileId          - Update file metadata
POST   /api/v1/files/:fileId/tag      - Add tag to file
GET    /api/v1/files/search           - Search files
```

### File Conversion Endpoints
```
POST   /api/v1/conversions            - Request file conversion
GET    /api/v1/conversions/:conversionId - Get conversion status
GET    /api/v1/conversions/formats    - Get supported formats
```

### File Sharing Endpoints
```
POST   /api/v1/shares                 - Create share link
GET    /api/v1/shares/:shareId        - Get share details
DELETE /api/v1/shares/:shareId        - Revoke share link
GET    /api/v1/shares/:shareId/download - Download shared file
```

### User Account Endpoints
```
GET    /api/v1/users/profile          - Get user profile
PUT    /api/v1/users/profile          - Update user profile
GET    /api/v1/users/storage          - Get storage info
POST   /api/v1/users/password-change  - Change password
GET    /api/v1/users/audit-logs       - Get audit logs
```

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend Framework | Node.js + Express.js | Fast, scalable, JavaScript ecosystem |
| Frontend Framework | React.js + TypeScript | Component-based, type-safe, large community |
| Database | PostgreSQL | ACID compliance, JSON support, reliability |
| Cache | Redis | Fast in-memory caching, session management |
| File Storage | AWS S3 / Google Cloud Storage | Scalable, reliable, cost-effective |
| Encryption | Node.js crypto + libsodium | Industry-standard, well-tested |
| Key Management | AWS KMS / Azure Key Vault | Secure key storage, compliance |
| Message Queue | RabbitMQ / Apache Kafka | Async processing, reliability |
| File Conversion | CloudConvert API | 1100+ format support, reliable |
| Authentication | JWT + OAuth 2.0 | Stateless, scalable, secure |
| Testing | Jest + React Testing Library | Comprehensive testing coverage |
| Deployment | Docker + Kubernetes | Containerization, orchestration |
| Monitoring | Datadog / ELK Stack | Performance monitoring, logging |
| CI/CD | GitHub Actions / GitLab CI | Automated testing and deployment |

---

## Compliance & Standards

- **GDPR**: Data privacy and user rights
- **HIPAA**: Healthcare data protection (if applicable)
- **SOC 2 Type II**: Security and availability controls
- **ISO 27001**: Information security management
- **OWASP Top 10**: Web application security
- **NIST Cybersecurity Framework**: Security best practices

---

## Estimated Development Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Setup & Infrastructure | 2 weeks | Project structure, databases, CI/CD |
| Phase 2: Authentication & Security | 3 weeks | User auth, encryption, key management |
| Phase 3: File Management | 3 weeks | Upload, download, storage, metadata |
| Phase 4: Conversion & Features | 2 weeks | File conversion, search, tagging |
| Phase 5: Frontend - Auth & Dashboard | 2 weeks | Registration, login, dashboard UI |
| Phase 6: Frontend - File Management | 2 weeks | Upload, list, download, preview |
| Phase 7: Frontend - Security | 1 week | Encryption UI, security settings |
| Phase 8: Frontend - Advanced Features | 1 week | Conversion, sharing, audit logs |
| Phase 9: Testing & QA | 3 weeks | Unit, integration, E2E tests |
| Phase 10: Deployment & Launch | 2 weeks | Production setup, monitoring, launch |
| **Total** | **~21 weeks** | **MVP Ready** |

