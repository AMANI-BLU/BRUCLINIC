# BruClinic — Borana University Clinic Management System

> Enterprise-grade health information system for Borana University, Yabelo, Oromia, Ethiopia.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [First-Run Installation](#first-run-installation)
5. [Running in Development](#running-in-development)
6. [Running in Production](#running-in-production)
7. [Database Management](#database-management)
8. [Environment Variables](#environment-variables)
9. [Security Features](#security-features)
10. [Staff Roles](#staff-roles)
11. [Project Structure](#project-structure)
12. [Maintenance](#maintenance)

---

## System Overview

BruClinic is a multi-role clinical workflow management system handling:

| Module | Description |
|---|---|
| **Reception** | Patient registration, card issuance, OPD queue management |
| **OPD** | Doctor consultation, lab referrals, prescriptions |
| **Emergency** | Triage, acuity classification, bed management |
| **Pharmacy** | Prescription queue, medicine inventory, dispensing |
| **Laboratory** | Test orders, specimen tracking, result entry |
| **Admin** | Staff accounts, reports, audit logs, system configuration |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + TypeScript + Vite)           │
│  Port: 5173 (dev) / served by web server (prod) │
└──────────────────┬──────────────────────────────┘
                   │ HTTP REST API (JSON)
┌──────────────────▼──────────────────────────────┐
│  Backend (Node.js HTTP, no framework)           │
│  Port: 4000                                     │
│                                                 │
│  Middleware pipeline:                           │
│    Request ID → Security Headers → CORS →       │
│    Rate Limit → Body Parse → JWT Auth → Routes  │
└──────────────────┬──────────────────────────────┘
                   │ mysql2 connection pool
┌──────────────────▼──────────────────────────────┐
│  MySQL 8+ / MariaDB 10.5+                       │
│  Database: bruclinic                            │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 LTS | Download from nodejs.org |
| MySQL | ≥ 8.0 | Or MariaDB ≥ 10.5. XAMPP includes both. |
| npm | ≥ 10 | Bundled with Node.js |

---

## First-Run Installation

### Option A — Interactive Setup Wizard (Recommended)

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Create the MySQL database (in phpMyAdmin or MySQL shell)
#    CREATE DATABASE bruclinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. Run the interactive setup wizard
npm run setup
#    ↳ Collects DB credentials, generates JWT secret,
#      writes .env, runs migrations, creates admin account.

# 4. Install frontend dependencies
cd ../frontend
npm install
```

### Option B — Manual Setup

```bash
cd backend

# Copy and edit the environment file
cp .env.example .env
# Edit .env: set DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, SEED_ADMIN_*

# Generate a secure JWT secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Install dependencies
npm install

# Apply database schema
npm run db:migrate

# Create the admin account
npm run db:seed

# Install and start frontend
cd ../frontend
npm install
```

---

## Running in Development

Open two terminals:

```bash
# Terminal 1 — Backend (auto-restarts on file changes)
cd backend
npm run dev

# Terminal 2 — Frontend (Vite dev server with HMR)
cd frontend
npm run dev
```

Open **http://localhost:5173** and sign in with the admin credentials you set during setup.

---

## Running in Production

```bash
# Backend
cd backend
NODE_ENV=production npm start

# Frontend (build static files, then serve with nginx/caddy/etc.)
cd frontend
npm run build
# Serve the dist/ folder with your web server
```

> **Tip:** Use `pm2` to keep the backend running as a daemon:
> `pm2 start src/server.js --name bruclinic-api --interpreter node`

---

## Database Management

| Command | Description |
|---|---|
| `npm run db:migrate` | Apply all pending SQL migrations |
| `npm run db:seed` | Create/update the admin account from SEED_ADMIN_* env vars |
| `npm run db:check` | Show DB connectivity, migration status, and table row counts |
| `npm run setup` | Interactive first-run wizard (safe to re-run with `--force`) |
| `npm run setup:force` | Re-run setup, overwriting existing .env |

### Adding a new migration

1. Create `backend/src/db/sql/003_your_description.sql`
2. Write idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`)
3. Run `npm run db:migrate`

---

## Environment Variables

All variables are documented in [`backend/.env.example`](backend/.env.example).

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Random secret ≥ 32 chars for signing JWTs |
| `DB_HOST` | Yes | MySQL hostname |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | – | MySQL password |
| `DB_NAME` | Yes | Database name (`bruclinic`) |
| `PORT` | – | API port (default: 4000) |
| `CORS_ORIGIN` | Yes | Frontend URL (e.g. `http://localhost:5173`) |
| `NODE_ENV` | – | `development` or `production` |
| `LOG_LEVEL` | – | `debug` / `info` / `warn` / `error` |
| `SEED_ADMIN_USERNAME` | – | Used by `db:seed` to create initial admin |
| `SEED_ADMIN_PASSWORD` | – | Min 10 chars, uppercase + number |
| `SEED_ADMIN_EMAIL` | – | Admin email address |

---

## Security Features

### Authentication
- PBKDF2-SHA512 password hashing (120,000 iterations)
- Custom JWT with HMAC-SHA256, issuer/audience claim validation
- 8-hour token lifetime

### Rate Limiting (In-process, per IP)
| Tier | Limit | Window |
|---|---|---|
| Global | 300 requests | 1 minute |
| Login | 8 attempts | 15 minutes |
| Admin actions | 60 requests | 1 minute |

### HTTP Security Headers
- `Content-Security-Policy: default-src 'none'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security` (production only)
- `Cross-Origin-Resource-Policy: same-site`

### Audit & Compliance
- **Audit log** (`audit_logs` table): every CREATE/UPDATE/DELETE/LOGIN records actor, resource, IP, request ID, and a change diff
- **Security events** (`security_events` table): login failures, lockouts, access denials, config changes — with severity levels
- All logs include a `X-Request-ID` correlation header for end-to-end tracing
- Admin Security Center UI: searchable audit log, filterable security events, live system health, editable runtime config

### RBAC
Role-based access control is enforced at the route level. The permission matrix lives in [`backend/src/constants/roles.js`](backend/src/constants/roles.js).

---

## Staff Roles

| Role | Key | Default landing page |
|---|---|---|
| Administrator | `admin` | Admin Dashboard |
| Receptionist | `receptionist` | Reception Dashboard |
| OPD Physician | `opd` | OPD Dashboard |
| Emergency Specialist | `emergency` | Emergency Dashboard |
| Pharmacist | `pharmacy` | Pharmacy Board |
| Lab Technologist | `laboratory` | Laboratory Dashboard |

---

## Project Structure

```
BruClinic/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js              # Env parsing + startup validation
│   │   ├── constants/
│   │   │   ├── roles.js            # Role names, RBAC matrix, badge colors
│   │   │   └── events.js           # Security & audit event type enums
│   │   ├── db/
│   │   │   ├── pool.js             # MySQL connection pool + transaction helper
│   │   │   ├── migrate.js          # Migration runner
│   │   │   ├── seed.js             # Admin account seeder
│   │   │   ├── check.js            # DB status report
│   │   │   └── sql/
│   │   │       ├── 001_initial.sql # Core schema
│   │   │       └── 002_security_audit.sql  # Audit/security/config tables
│   │   ├── middleware/
│   │   │   ├── requestId.js        # X-Request-ID correlation
│   │   │   ├── rateLimiter.js      # Tiered in-process rate limiting
│   │   │   └── auditLogger.js      # Fire-and-forget audit/security writes
│   │   ├── routes/
│   │   │   ├── auth.js             # Login, user management (with security logging)
│   │   │   ├── resources.js        # Generic CRUD with RBAC + audit
│   │   │   ├── workflows.js        # Clinical workflow actions
│   │   │   ├── admin.js            # Audit logs, security events, config, stats
│   │   │   ├── dashboard.js        # Dashboard summary
│   │   │   └── health.js           # Enhanced health check
│   │   ├── services/
│   │   │   └── clinicWorkflows.js  # Business logic for clinical workflows
│   │   ├── utils/
│   │   │   ├── auth.js             # JWT generation/verification, password hash
│   │   │   ├── http.js             # sendJson, sendError, CORS, security headers
│   │   │   ├── logger.js           # Structured leveled logger
│   │   │   └── validation.js       # Input validation helpers
│   │   ├── data/
│   │   │   └── resourceRepository.js  # Generic CRUD repository
│   │   └── server.js               # Main server with middleware pipeline
│   ├── .env                        # Your configuration (git-ignored)
│   ├── .env.example                # Documented template
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/client.ts           # Typed fetch wrapper
    │   ├── components/Layout/      # Sidebar + header shell
    │   ├── context/                # Auth, Theme, Clinic contexts
    │   ├── pages/
    │   │   ├── SecurityCenter.tsx  # Admin security & config dashboard
    │   │   ├── StaffAccounts.tsx   # Staff management
    │   │   ├── dashboards/         # Role-specific landing pages
    │   │   └── ...                 # Other clinical pages
    │   ├── types/index.ts          # All TypeScript interfaces
    │   └── utils/validation.ts     # Client-side input validation
    └── package.json
```

---

## Maintenance

### Log rotation
The structured logger writes to stdout/stderr. In production, redirect these to a log aggregator or use `pm2 log rotation`.

### Clearing old audit records
Run periodically (e.g., via a cron job):
```sql
-- Respect the configured retention period
DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 365 DAY);
DELETE FROM security_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY);
```
Or adjust `audit_log_retention_days` / `security_event_retention_days` in **Admin → Security Center → System Config**.

### Rotating the JWT secret
1. Generate a new secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Update `JWT_SECRET` in `.env`
3. Restart the server — all existing sessions will be invalidated immediately (users will need to log in again)

### Adding a new staff role
1. Add the role string to `ROLES` in `backend/src/constants/roles.js`
2. Add it to `RESOURCE_ACCESS` in the same file
3. Add the frontend `ROLE_PRESETS` in `StaffAccounts.tsx` and `ROLE_SETTINGS` in `Settings.tsx`
4. Add a case to `getRoleLandingPage()` in `App.tsx`

---

*BruClinic v2.0 — Built for Borana University Health Services*
