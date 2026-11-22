# BruClinic — Installation & Operations Manual

**Borana University Clinic Management System (BruClinic v2.0)**  
*Location:* Yabelo, Oromia, Ethiopia  
*Document Version:* 2.1  
*Target Audience:* System Administrators, ICT Staff, DevOps Engineers, and Clinic Technicians  

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Hardware & Software Prerequisites](#2-hardware--software-prerequisites)
3. [Localhost Installation (Windows Offline Workstation)](#3-localhost-installation-windows-offline-workstation)
   - [3.1 Quick Start (One-Click Offline Mode)](#31-quick-start-one-click-offline-mode)
   - [3.2 Step-by-Step Windows Installation](#32-step-by-step-windows-installation)
   - [3.3 Windows Database & Password Reset](#33-windows-database--password-reset)
4. [Local Server Installation (Ubuntu / Linux University Intranet)](#4-local-server-installation-ubuntu--linux-university-intranet)
   - [4.1 Architecture & Best Practices](#41-architecture--best-practices)
   - [4.2 Method A: Docker Compose + Nginx (Recommended)](#42-method-a-docker-compose--nginx-recommended)
   - [4.3 Method B: Native Ubuntu (NVM + PM2 + PostgreSQL + Nginx)](#43-method-b-native-ubuntu-nvm--pm2--postgresql--nginx)
   - [4.4 Effortless Server Updates (App & Runtime Versions)](#44-effortless-server-updates-app--runtime-versions)
   - [4.5 Automated Daily Server Backups](#45-automated-daily-server-backups)
5. [Cloud / Hosted Production Deployment (Vercel + Render)](#5-cloud--hosted-production-deployment-vercel--render)
6. [Post-Installation Administration & Default Accounts](#6-post-installation-administration--default-accounts)
7. [Backup, Restore & Disaster Recovery](#7-backup-restore--disaster-recovery)
8. [Troubleshooting & Frequently Asked Questions](#8-troubleshooting--frequently-asked-questions)

---

## 1. System Overview & Architecture

BruClinic is designed as a modular, lightweight, and resilient clinical workflow management system. It functions seamlessly in three operational environments:
1. **Localhost / Offline Workstation:** Single doctor or clinic laptop/desktop running Windows/macOS.
2. **Local Server (University Intranet):** Centralized on-premise Ubuntu server in the university data center serving dozens of concurrent clinic workstations over LAN/Wi-Fi with zero internet dependency.
3. **Cloud Production:** Hybrid cloud deployment on Vercel Edge CDN + Render Node.js + Managed PostgreSQL.

```
┌─────────────────────────────────────────────────────────────────┐
│     Client Workstations: Doctors, Nurses, Lab, Reception        │
│          Web Browsers (Chrome / Edge / Firefox / Safari)        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / Port 80 (or 443 HTTPS)
┌────────────────────────────────▼────────────────────────────────┐
│      Presentation Tier: Nginx Reverse Proxy + React SPA         │
│          Serves compiled Vite/React bundle + Gzip Cache         │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Internal Proxy (/api/*)
┌────────────────────────────────▼────────────────────────────────┐
│      Application Tier: Node.js Express 5 API Server (Port 4000) │
│       Rate Limiting, Audit Logging, Real IP Recording, JWT      │
└────────────────────────────────┬────────────────────────────────┘
                                 │ PostgreSQL Pool (Port 5432)
┌────────────────────────────────▼────────────────────────────────┐
│      Database Tier: PostgreSQL 14+ (DB: bruclinic)              │
│       10 Clinical Resources, Automated Migrations & Triggers    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware & Software Prerequisites

### Minimum Hardware Requirements
| Deployment Type | CPU | RAM | Disk Space | Network |
| :--- | :--- | :--- | :--- | :--- |
| **Localhost Workstation** | Dual-core 2.0 GHz | 4 GB | 5 GB SSD | Standalone / Offline |
| **Local University Server** | Quad-core 2.5 GHz+ | 8 GB – 16 GB | 40 GB+ SSD | Gigabit Local Area Network (Static IP) |
| **Cloud Hosting** | 1–2 Shared vCPUs | 1 GB – 2 GB | Managed Cloud DB | Public Internet |

### Required Software Packages
| Software | Required Version | Role | Supported Environments |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20 LTS` (v22 recommended) | JavaScript Runtime | Windows, macOS, Ubuntu |
| **npm** | `>= 10` | Dependency Manager | Bundled with Node.js |
| **PostgreSQL** | `>= 14` (v16 recommended) | Relational Database | Native Service or Docker |
| **Docker & Compose** | Engine 24+, Compose v2 | Container Orchestration | Ubuntu Server, Windows |
| **Nginx** | `>= 1.18` | Reverse Proxy & SSL | Ubuntu Server |

---

## 3. Localhost Installation (Windows Offline Workstation)

Use this section to install and run BruClinic on an individual clinic desktop or laptop running Windows.

### 3.1 Quick Start (One-Click Offline Mode)
If Node.js and PostgreSQL are already installed:
1. **Start the local PostgreSQL database:**
   ```cmd
   net start postgresql-x64-18
   ```
   *(Or if using Docker: `docker compose up -d`)*
2. **Reset/Verify Admin Login:**
   - Double-click **`reset-admin.bat`** (resets username: `admin`, password: `admin`, unlocks account).
3. **Launch BruClinic:**
   - Double-click **`start-offline.bat`**.
   - The launcher checks database health, auto-runs schema migrations, starts backend (:4000) and frontend (:5173), and automatically opens `http://localhost:5173` in your browser.

---

### 3.2 Step-by-Step Windows Installation

#### Step 1: Install PostgreSQL
1. Download PostgreSQL 16 or 18 from [postgresql.org](https://www.postgresql.org/download/windows/).
2. During installation:
   - Accept the default port: `5432`.
   - Set a master password for user `postgres` (e.g. `admin` or your preferred password).
   - Verify the service is running in `services.msc` (**postgresql-x64-18** status = Running).

#### Step 2: Install Node.js
Download and install **Node.js 22 LTS** (x64) from [nodejs.org](https://nodejs.org). Ensure the *"Add to PATH"* option is checked.

#### Step 3: Install Project Dependencies
Open PowerShell or Command Prompt in the project folder:
```powershell
# Install root, backend, and frontend packages
npm install
cd backend; npm install; cd ..
cd frontend; npm install; cd ..
```

#### Step 4: Interactive Setup Wizard
Run the automated configuration wizard:
```powershell
cd backend
npm run setup
```
The wizard will:
- Test the connection to PostgreSQL.
- Automatically create the `bruclinic` database if it doesn't exist.
- Run all SQL database migrations.
- Create or update the initial administrator account.
- Generate a secure `JWT_SECRET` in `backend/.env`.

---

### 3.3 Windows Database & Password Reset
If you ever forget the administrator credentials or get locked out due to failed attempts:
```powershell
# Default reset (admin / admin)
npm run admin:reset

# Or reset with custom credentials
node backend/scripts/reset-admin.js <username> <new_password>
```

To start the system manually anytime:
```powershell
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`

---

## 4. Local Server Installation (Ubuntu / Linux University Intranet)

Use this section to deploy BruClinic on a centralized Ubuntu server (e.g. Ubuntu 22.04 or 24.04 LTS) for Borana University. Any clinic computer connected to the university LAN or campus Wi-Fi will access the system through the server's local IP address.

### 4.1 Architecture & Best Practices
- **Single-Origin Nginx:** Nginx listens on port 80/443, serves the compiled frontend assets directly, and reverse-proxies `/api/` requests to the Node.js backend. This **completely eliminates CORS issues** and ensures real client IPs are logged.
- **Easy Upgrades:** Decouple runtime versions (Node.js and PostgreSQL) from the host operating system so updating BruClinic or Node never breaks other university services.

---

### 4.2 Method A: Docker Compose + Nginx (Recommended)

> [!TIP]
> **Why Docker is the Best Approach for Universities:**
> - Node.js 22 and PostgreSQL 16 are encapsulated inside isolated containers.
> - Upgrading the system or Node version is a **1-command task** (`./scripts/update.sh`).
> - No package conflicts with Ubuntu's host OS.

#### Step 1: Install Docker Engine on Ubuntu Server
```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install curl, git, and firewall
sudo apt install -y curl git ufw

# 3. Install official Docker Engine and Docker Compose plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 4. Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker

# 5. Verify Docker Compose
docker compose version
```

#### Step 2: Clone the Repository
```bash
cd /opt
sudo git clone https://github.com/AMANI-BLU/BRUCLINIC.git bruclinic
sudo chown -R $USER:$USER /opt/bruclinic
cd /opt/bruclinic
```

#### Step 3: Configure Production Environment Variables
Create the production environment file:
```bash
cat << 'EOF' > .env
# Database Settings
DB_NAME=bruclinic
DB_USER=postgres
DB_PASSWORD=ChangeThisToAStrongClinicPassword2026!

# JWT Secret (Min 48 characters)
JWT_SECRET=b65f7c3e8a1d4920e54b67fa923c8e1045db37912a67e41c8f03d528b1e4a69c

# Allowed Origins (Nginx reverse proxy serves frontend and backend on the same port 80)
CORS_ORIGIN=*
LOG_LEVEL=info
EOF
```

#### Step 4: Launch the Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
*What happens automatically:*
1. PostgreSQL container starts with persistent data stored in Docker volume `pgdata`.
2. Backend container waits for database health check, automatically applies all pending SQL schema migrations, and binds to port 4000.
3. Frontend builds the production bundle and mounts it inside Nginx on port 80.

#### Step 5: Configure the Ubuntu Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### Step 6: Access BruClinic across the University Intranet
Find your server's local network IP:
```bash
ip addr show | grep "inet "
# Example: 192.168.1.150
```
Open **`http://192.168.1.150`** (or your local intranet domain `http://clinic.bborana.edu.et`) from any computer on the campus network.

---

### 4.3 Method B: Native Ubuntu (NVM + PM2 + PostgreSQL + Nginx)

If university IT policy prohibits Docker, follow this production setup using **NVM** to manage Node.js versions safely without touching Ubuntu's system packages.

#### Step 1: Install NVM & Node.js 22 LTS
```bash
# 1. Install Node Version Manager (NVM)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# 2. Install Node.js 22 LTS
nvm install 22
nvm use 22
nvm alias default 22

# 3. Install PM2 process manager
npm install -g pm2
```

#### Step 2: Install and Configure PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create clinic user and database
sudo -u postgres psql -c "CREATE USER bruclinic_user WITH PASSWORD 'YourSecurePassword2026!';"
sudo -u postgres psql -c "CREATE DATABASE bruclinic OWNER bruclinic_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bruclinic TO bruclinic_user;"
```

#### Step 3: Configure and Start the Backend API
```bash
cd /opt/bruclinic/backend
npm ci --omit=dev

# Create backend .env
cat << 'EOF' > .env
PORT=4000
HOST=127.0.0.1
DATABASE_URL=postgres://bruclinic_user:YourSecurePassword2026!@127.0.0.1:5432/bruclinic
JWT_SECRET=b65f7c3e8a1d4920e54b67fa923c8e1045db37912a67e41c8f03d528b1e4a69c
CORS_ORIGIN=*
NODE_ENV=production
EOF

# Run database migrations and seed default administrator
npm run db:migrate
npm run db:seed

# Start backend via PM2 in cluster mode (auto-restarts on reboot or crash)
pm2 start src/server.js --name bruclinic-api -i max
pm2 startup
pm2 save
```

#### Step 4: Build Frontend & Configure Nginx Reverse Proxy
```bash
# 1. Build frontend with relative API path
cd /opt/bruclinic/frontend
npm ci
VITE_API_URL=/api npm run build

# 2. Install Nginx
sudo apt install -y nginx

# 3. Create Nginx site configuration
sudo tee /etc/nginx/sites-available/bruclinic > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 60M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        root /opt/bruclinic/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 4. Enable configuration and reload Nginx
sudo ln -s /etc/nginx/sites-available/bruclinic /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

### 4.4 Effortless Server Updates (App & Runtime Versions)

#### 1. Updating the Application Code & Schema (1 Command)
Whenever an update is released on GitHub, run the automated update script on the Ubuntu server:
```bash
cd /opt/bruclinic
chmod +x scripts/update.sh
./scripts/update.sh
```
**What `scripts/update.sh` executes automatically:**
1. **Safety Backup:** Automatically dumps the PostgreSQL database into `/opt/bruclinic/backups/bruclinic_backup_preupdate_<timestamp>.sql`.
2. **Git Pull:** Pulls latest code cleanly from `master`.
3. **Rebuilds & Restarts:** Rebuilds updated containers (or reloads PM2 and Nginx in native mode).
4. **Auto-Migration:** Applies any new SQL migrations.
5. **Health Verification:** Probes `http://localhost/api/health` to confirm HTTP 200 OK.

#### 2. Updating Runtime Versions (Node.js & PostgreSQL)
- **Under Docker (Method A):**
  - To upgrade Node.js: Change `node:22-alpine` in `backend/Dockerfile` and `frontend/Dockerfile` to `node:24-alpine`.
  - To upgrade PostgreSQL: Change `postgres:16-alpine` in `docker-compose.prod.yml` to `postgres:18-alpine`.
  - Run: `docker compose -f docker-compose.prod.yml up -d --build`.
- **Under Native NVM (Method B):**
  - To upgrade Node.js:
    ```bash
    nvm install 24
    nvm use 24
    nvm alias default 24
    pm2 restart bruclinic-api
    ```

---

### 4.5 Automated Daily Server Backups
Configure an automated daily database backup every night at 2:00 AM:
```bash
crontab -e
```
Add the following line:
```cron
0 2 * * * docker exec bruclinic-db pg_dump -U postgres bruclinic | gzip > /opt/bruclinic/backups/bruclinic_$(date +\%Y\%m\%d).sql.gz
```
*(Or for native PostgreSQL: `0 2 * * * pg_dump -U postgres -d bruclinic | gzip > /opt/bruclinic/backups/bruclinic_$(date +\%Y\%m\%d).sql.gz`)*

---

## 5. Cloud / Hosted Production Deployment (Vercel + Render)

For internet-accessible deployments:
- **Frontend:** Vercel (Edge CDN)
- **Backend API:** Render Web Service (Node.js)
- **Database:** Render PostgreSQL (or Supabase / Neon / AWS RDS)

### Step 1: Deploy Database (Render PostgreSQL)
1. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**.
2. Name: `bruclinic-db`. Database: `bruclinic`. User: `bruclinic_user`.
3. Copy the **Internal Database URL** (for backend web service).

### Step 2: Deploy Backend API (Render Web Service)
1. In Render Dashboard → **New +** → **Web Service** → Connect your repository.
2. Configuration:
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm run db:migrate && npm start`
3. Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Internal Database URL from Step 1)*
   - `JWT_SECRET`: *(64-char random hex string)*
   - `CORS_ORIGIN`: `https://bruclinic.vercel.app`
4. Copy your backend URL (e.g. `https://bruclinic-api.onrender.com`).

### Step 3: Deploy Frontend (Vercel)
1. In [Vercel Dashboard](https://vercel.com) → **Add New Project** → Import repository.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment Variable:
   - `VITE_API_URL`: `https://bruclinic-api.onrender.com/api`
4. Click **Deploy**.

---

## 6. Post-Installation Administration & Default Accounts

### Default Access Roles
Sign in at `/login` with the initial credentials:

| Role | Default Username | Default Password | Scope of Work |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `admin` | Complete system configuration, staff management, audit logs, IP bans |
| **ICT Specialist** | *(created by admin)* | *(configurable)* | Security center, IP bans, system settings, maintenance mode |
| **Receptionist** | *(created by admin)* | *(configurable)* | Patient registration, ID cards, OPD triage queue |
| **OPD Clinician** | *(created by admin)* | *(configurable)* | Medical consultations, prescriptions, lab investigation orders |
| **Emergency Staff** | *(created by admin)* | *(configurable)* | Triage assessment, acuity color codes, ER bed tracking |
| **Pharmacist** | *(created by admin)* | *(configurable)* | Drug inventory, dispensing prescriptions |
| **Laboratory Tech** | *(created by admin)* | *(configurable)* | Specimen logging, test execution, laboratory results |

### Creating Additional Staff Accounts
1. Sign in as **`admin`**.
2. Navigate to **Staff Accounts** (`/staff-accounts`).
3. Click **Add Staff Account** → select role, department, username, and initial password.

### Security Center Configuration
Navigate to **Security Center** (`/security`):
- **IP Ban & Quarantine:** Instantly block malicious or infected host devices on the university network.
- **System Config:** Tune session timeouts (1–72 hours), maximum failed attempts (3–20), and lockout duration.
- **Maintenance Mode:** Temporarily pause clinical staff workflows during database updates while preserving administrative access.

---

## 7. Backup, Restore & Disaster Recovery

### Built-in Web UI Backups
1. Navigate to **Backup & Recovery** (`/backup`).
2. Click **Generate Backup Now** to download a complete JSON snapshot archive.
3. To restore: Click **Upload Backup Snapshot**, review the dry-run validation table, and click **Confirm & Restore Database**.

### Manual Command-Line Backups
```bash
# Dump database to SQL file
pg_dump -U postgres -d bruclinic -F p -f bruclinic_manual_backup.sql

# Restore database from SQL file
psql -U postgres -d bruclinic -f bruclinic_manual_backup.sql
```

---

## 8. Troubleshooting & Frequently Asked Questions

### Problem 1: "Cannot reach the database server (localhost:5432)" / Connection Refused
- **Windows Solution:** Open Administrator Command Prompt and run `net start postgresql-x64-18`.
- **Ubuntu Docker Solution:** Run `docker compose -f docker-compose.prod.yml up -d db`.
- **Ubuntu Native Solution:** Run `sudo systemctl restart postgresql`.

### Problem 2: "Clinic data could not be refreshed / Internal Server Error"
- **Cause:** Pending database schema migrations were not executed.
- **Solution:** Run `npm run db:migrate` in the project root or backend folder.

### Problem 3: "Too many sign-in attempts / Account locked"
- **Cause:** Rate-limiting tripped after failed attempts.
- **Solution:** Run `npm run admin:reset` to immediately reset the administrator password to `admin` and clear all rate-limit locks.

### Problem 4: Port Collision (Port 4000, 5173, or 80 already in use)
- **Windows:** Check port with `netstat -ano | findstr :4000` and terminate with `taskkill /F /PID <PID>`.
- **Ubuntu:** Check port with `sudo lsof -i :80` or `sudo netstat -tulpn | grep 80`.

---

*Document maintained by Borana University ICT & Health Informatics Department.*
