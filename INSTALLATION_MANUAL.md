# BruClinic — Installation & Operations Manual

**Borana University Clinic Management System (BruClinic v2.0)**  
*Location:* Yabelo, Oromia, Ethiopia  
*Document Version:* 2.0  
*Target Audience:* System Administrators, ICT Staff, DevOps Engineers, and Clinic Technicians  

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Hardware & Software Prerequisites](#2-hardware--software-prerequisites)
3. [Quick Start (One-Click Offline Mode)](#3-quick-start-one-click-offline-mode)
4. [Local / Offline Installation (Step-by-Step)](#4-local--offline-installation-step-by-step)
   - [4.1 PostgreSQL Database Setup](#41-postgresql-database-setup)
   - [4.2 Dependency Installation](#42-dependency-installation)
   - [4.3 Interactive Configuration Wizard](#43-interactive-configuration-wizard)
   - [4.4 Database Migrations & Administrator Setup](#44-database-migrations--administrator-setup)
   - [4.5 Launching Services](#45-launching-services)
5. [Docker Installation (Containerized)](#5-docker-installation-containerized)
6. [Cloud / Hosted Production Deployment](#6-cloud--hosted-production-deployment)
7. [Post-Installation Administration & Default Accounts](#7-post-installation-administration--default-accounts)
8. [Backup, Restore & Disaster Recovery](#8-backup-restore--disaster-recovery)
9. [Troubleshooting & Frequently Asked Questions](#9-troubleshooting--frequently-asked-questions)

---

## 1. System Overview & Architecture

BruClinic is designed as a modular, lightweight, and resilient clinical workflow management system. It functions seamlessly in both **air-gapped offline clinic workstations** and **hosted cloud deployments**.

```
┌────────────────────────────────────────────────────────┐
│  Client Tier: Web Browser (Chrome / Edge / Firefox)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Presentation Tier: React SPA (Vite + TypeScript)      │
│  Port: 5173 (Dev / Offline) or Vercel (Cloud CDN)      │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / Bearer JWT)
┌───────────────────────────▼────────────────────────────┐
│  Application Tier: Node.js Express 5 API Server        │
│  Port: 4000 (Local / Offline) or Render Web Service     │
│  Middleware: Rate Limiting, Audit Logging, IP Banning  │
└───────────────────────────┬────────────────────────────┘
                            │ pg Connection Pool (port 5432)
┌───────────────────────────▼────────────────────────────┐
│  Database Tier: PostgreSQL 14+                          │
│  Database Name: bruclinic                              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Hardware & Software Prerequisites

### Minimum Hardware Requirements
- **CPU:** Dual-core 2.0 GHz or higher (x64)
- **RAM:** 4 GB minimum (8 GB recommended)
- **Storage:** 5 GB free disk space (SSD recommended)
- **Network:** Local Area Network (LAN) for multi-workstation intranet or standalone offline

### Required Software
| Software | Required Version | Purpose | Download Link |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20 LTS` (e.g., 20.x or 22.x) | JavaScript Runtime | [nodejs.org](https://nodejs.org) |
| **npm** | `>= 10` | Package Manager | Included with Node.js |
| **PostgreSQL** | `>= 14` (PostgreSQL 16 or 18 recommended) | Relational Database | [postgresql.org](https://www.postgresql.org/download/) |
| **Git** *(Optional)* | `>= 2.30` | Version Control | [git-scm.com](https://git-scm.com) |
| **Docker** *(Optional)* | Desktop or Engine 24+ | Containerized DB | [docker.com](https://www.docker.com) |

---

## 3. Quick Start (One-Click Offline Mode)

If you are setting up on a workstation that already has Node.js and PostgreSQL installed:

1. **Start the local database:**
   - In an Administrator Command Prompt:
     ```cmd
     net start postgresql-x64-18
     ```
   - *Or if using Docker:* `docker compose up -d`
2. **Reset/Ensure Admin Login:**
   - Double-click **`reset-admin.bat`** (sets username: `admin`, password: `admin`).
3. **Launch BruClinic:**
   - Double-click **`start-offline.bat`**.
   - Your browser will automatically open **`http://localhost:5173`**.

---

## 4. Local / Offline Installation (Step-by-Step)

### 4.1 PostgreSQL Database Setup

#### Windows Native Installation:
1. Download and run the PostgreSQL installer (version 16 or 18).
2. During setup:
   - Accept the default port: `5432`.
   - Set a master password for user `postgres` (remember this password).
   - Keep the service name as default (e.g., `postgresql-x64-18`).
3. Verify the service is running:
   - Press `Win + R` → type `services.msc` → find **postgresql-x64-18** → ensure status is **Running**.

---

### 4.2 Dependency Installation

Open a terminal (PowerShell or Command Prompt) in the project directory:

```bash
# 1. Install root dependencies
npm install

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

---

### 4.3 Interactive Configuration Wizard

Run the interactive setup wizard in the backend folder:

```bash
cd backend
npm run setup
```

The wizard will interactively prompt:
- **Database host:** `localhost`
- **Database port:** `5432`
- **Database username:** `postgres`
- **Database password:** *(Enter the password chosen during PostgreSQL installation)*
- **Database name:** `bruclinic` *(The wizard will automatically create the database if it does not exist yet)*
- **Administrator Name:** `Clinic Administrator`
- **Administrator Username:** `admin`
- **Administrator Password:** *(Enter your desired password or use `admin`)*
- **Administrator Email:** `admin@bru.edu.et`

The wizard automatically writes `backend/.env`, generates a cryptographically secure 256-bit `JWT_SECRET`, runs all SQL migrations, and seeds the initial administrator account.

---

### 4.4 Database Migrations & Administrator Setup

If you prefer manual configuration instead of the setup wizard:

1. **Configure Environment:**
   Create `backend/.env` with the following template:
   ```ini
   NODE_ENV=development
   HOST=localhost
   PORT=4000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_NAME=bruclinic
   DATABASE_POOL_MAX=10
   JWT_SECRET=replace-with-a-random-32-character-secret-key-here
   CORS_ORIGIN=http://localhost:5173
   BODY_LIMIT_BYTES=1048576
   ```

2. **Execute Database Migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Reset/Verify Administrator Credentials:**
   Run the dedicated reset utility to ensure an unlocked administrator account:
   ```bash
   npm run admin:reset
   ```
   *Output:*
   ```text
   ✓ Administrator account updated successfully!
     Username : admin
     Password : admin
     Role     : admin
     Status   : Active (Unlocked)
   ```

---

### 4.5 Launching Services

From the project root directory:

```bash
# Start both backend and frontend concurrently
npm run dev
```

- **Frontend URL:** `http://localhost:5173`
- **Backend API URL:** `http://localhost:4000/api`
- **API Health Check:** `http://localhost:4000/api/health`

---

## 5. Docker Installation (Containerized)

For environments with Docker Desktop or Docker Engine installed, you can spin up the complete database with one command:

1. **Start PostgreSQL Container:**
   ```bash
   docker compose up -d
   ```
   This starts a PostgreSQL 16 container named `bruclinic-local-db` with persistent volume `bruclinic_pgdata` listening on port `5432`.

2. **Run Migrations & Seed:**
   ```bash
   npm run db:migrate
   npm run admin:reset
   ```

3. **Launch the System:**
   ```bash
   npm run dev
   ```

4. **Stop Database Container:**
   ```bash
   docker compose down
   ```
   *(Data is safely preserved in the `bruclinic_pgdata` docker volume).*

---

## 6. Cloud / Hosted Production Deployment

BruClinic is optimized for split production deployment:
- **Frontend:** Vercel (Global Edge CDN)
- **Backend API:** Render Web Service (Node.js)
- **Database:** Render PostgreSQL (or managed Supabase / Neon / AWS RDS)

### Step 1: Deploy Database (Render PostgreSQL)
1. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**.
2. Name: `bruclinic-db`. Database: `bruclinic`. User: `bruclinic_user`.
3. Choose the region closest to your clinic users.
4. Copy the **Internal Database URL** (for Render web service) and **External Database URL** (for remote admin).

### Step 2: Deploy Backend API (Render Web Service)
1. In Render Dashboard → **New +** → **Web Service**.
2. Connect your Git repository (`AMANI-BLU/BRUCLINIC`).
3. Set the following build and start configuration:
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm run db:migrate && npm start`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Paste Internal Database URL from Step 1)*
   - `JWT_SECRET`: *(Generate a 64-char random hex string)*
   - `CORS_ORIGIN`: `https://bruclinic.vercel.app` *(Your Vercel URL)*
5. Click **Deploy Web Service** and copy your backend URL (e.g. `https://bruclinic-api.onrender.com`).

### Step 3: Deploy Frontend (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com) → **Add New Project**.
2. Import repository `AMANI-BLU/BRUCLINIC`.
3. Configure settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add Environment Variable:
   - `VITE_API_URL`: `https://bruclinic-api.onrender.com/api`
5. Click **Deploy**.

---

## 7. Post-Installation Administration & Default Accounts

### Default Access Roles
Once the system is initialized, login at `/login`:

| Role | Username | Initial Password | Workstation Scope |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `admin` | Full system access, staff accounts, security, audit logs |
| **ICT Specialist** | *(created by admin)* | *(configurable)* | Security center, IP bans, system configuration, maintenance |
| **Receptionist** | *(created by admin)* | *(configurable)* | Patient registration, ID cards, OPD queue entry |
| **OPD Clinician** | *(created by admin)* | *(configurable)* | Medical consultations, prescriptions, lab test referrals |
| **Emergency Staff** | *(created by admin)* | *(configurable)* | Triage assessment, acuity color codes, ER bed/bay map |
| **Pharmacist** | *(created by admin)* | *(configurable)* | Medicine stock inventory, prescription dispensing |
| **Laboratory Tech** | *(created by admin)* | *(configurable)* | Investigation requests, specimen tracking, test results |

### Creating Additional Staff Accounts
1. Sign in as **`admin`**.
2. Navigate to **Staff Accounts** (`/staff-accounts`).
3. Click **Add Staff Account**.
4. Fill in full name, role, department, username, and initial password.
5. All staff accounts have default password enforcement and self-service password changes upon first login.

### Security Center Configuration
Navigate to **Security Center** (`/security`):
- **Banned IPs:** Block specific malicious IPs or temporary quarantine suspicious endpoints.
- **System Config:** Adjust session timeout (1–72 hours), maximum failed login attempts (3–20), and lockout duration (1–60 minutes).
- **Maintenance Mode:** Temporarily pause clinical staff during system maintenance while preserving administrator access.

---

## 8. Backup, Restore & Disaster Recovery

### Automated & Manual Backups
BruClinic includes a built-in JSON/SQL snapshot engine accessible from the Admin panel:
1. Navigate to **Backup & Recovery** (`/backup`).
2. Click **Generate Backup Now**.
3. Download the timestamped archive (e.g. `bruclinic-backup-2026-11-22.json`).

### Database Restoration
1. From `/backup`, click **Upload Backup Snapshot**.
2. Select the backup file.
3. Review the dry-run validation table (verifies row counts and foreign key integrity).
4. Click **Confirm & Restore Database**.

### Manual Command-Line Backup
```bash
# Dump PostgreSQL database to SQL file
pg_dump -U postgres -d bruclinic -F p -f bruclinic_backup.sql

# Restore PostgreSQL database from SQL file
psql -U postgres -d bruclinic -f bruclinic_backup.sql
```

---

## 9. Troubleshooting & Frequently Asked Questions

### Problem 1: "Cannot reach the database server (localhost:5432)" / Connection Refused
- **Cause:** The PostgreSQL service is stopped.
- **Solution:**
  - Start native Windows service: Open an Administrator terminal and run `net start postgresql-x64-18`.
  - Or if using Docker: Run `docker compose up -d`.

### Problem 2: "Database password authentication failed (28P01)"
- **Cause:** The password in `backend/.env` does not match the PostgreSQL superuser password.
- **Solution:**
  - Open `backend/.env` and update `DB_PASSWORD=your_password`.
  - Alternatively, re-run `cd backend && npm run setup` to test and re-save credentials.

### Problem 3: "Database 'bruclinic' does not exist (3D000)"
- **Cause:** PostgreSQL is running, but the database catalog was not created.
- **Solution:**
  - Run `npm run setup` in the `backend/` folder (it will auto-create the database).
  - Or manually in psql: `CREATE DATABASE bruclinic;`.
  - Then run: `npm run db:migrate`.

### Problem 4: "Clinic data could not be refreshed / Internal Server Error"
- **Cause:** The database schema is missing pending migration columns.
- **Solution:**
  - In project root or backend folder, run:
    ```bash
    npm run db:migrate
    ```
  - *(The offline launcher `start-offline.bat` now executes this check automatically).*

### Problem 5: "Too many sign-in attempts / Account locked"
- **Cause:** Failed login rate-limiter locked the account.
- **Solution:**
  - Run the reset utility in the project root:
    ```bash
    npm run admin:reset
    ```
  - This immediately resets the password to `admin` and clears all rate-limit locks.

### Problem 6: Port Conflict (Port 4000 or 5173 already in use)
- **Solution:**
  - Find process on port: `netstat -ano | findstr :4000`
  - Terminate lingering process: `taskkill /F /PID <PID>`
  - Or change `PORT=4001` in `backend/.env`.

---

*Manual maintained by Borana University ICT & Health Informatics Team.*
