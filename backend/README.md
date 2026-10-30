# BruClinic Backend

PostgreSQL-backed REST API for the BruClinic clinic management system. It uses Node.js HTTP primitives (no web framework), a repository layer, and transaction-based clinical workflows.

## Quick start

1. Start PostgreSQL and create the database:

   ```sql
   CREATE DATABASE bruclinic;
   ```

2. Confirm the `DB_*` values in `.env` (or run `npm run setup` for the interactive wizard).
3. From `backend/` run:

   ```bash
   npm install
   npm run db:check
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

The API listens on `http://localhost:4000`. The seed script adds clinic doctors. It creates an administrator only when `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_EMAIL` are explicitly configured; no default credentials are created.

## Configuration

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=bruclinic
DATABASE_POOL_MAX=10
JWT_SECRET=replace-with-a-long-random-secret
BODY_LIMIT_BYTES=1048576
BACKUP_MAX_BYTES=52428800
SESSION_TIMEOUT_HOURS=8
```

Administrators can change operational settings at runtime in **Security Center → System Config** (stored in `system_config`, no restart needed):

- `session_timeout_hours` — JWT lifetime, applied to newly issued tokens
- `max_login_attempts` / `login_lockout_minutes` — per-IP + per-username lockout
- `maintenance_mode` — when on, staff are shown a full-page maintenance screen and every non-admin API action returns `503`; administrators keep access so they can switch it off
- `maintenance_message` — the wording shown on that maintenance screen
- `backup_retention_days` / `backup_max_rows` — backup operating policy

## API

Resources: `patients`, `doctors`, `appointments`, `records`, `medicines`, `queue`, `emergency`, `lab-orders`, and `pharmacy-orders`.

Authentication is database-backed:

```text
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/users
POST   /api/auth/create-user
PATCH  /api/auth/users/{id}/status
POST   /api/auth/users/{id}/reset-password
PATCH  /api/auth/users/{id}
DELETE /api/auth/users/{id}
```

Clinical workflows are atomic transactions:

```text
POST /api/workflows/card-to-opd
POST /api/workflows/opd-to-lab
POST /api/workflows/opd-to-pharmacy
POST /api/workflows/complete-consultation
POST /api/workflows/dispense-pharmacy
```

## Data backup and restore

Administrators can export and restore the whole database from **Backup & Restore** in the sidebar, or directly through the API:

```text
GET  /api/admin/backup?includeUsers=true&includeAudit=false
GET  /api/admin/backup/tables
GET  /api/admin/backup/history
POST /api/admin/backup/restore
```

An export is a single JSON file (`format: "bruclinic-backup"`) containing every core table plus a SHA-256 checksum. Staff accounts are included by default because a disaster-recovery file is incomplete without them; audit and security logs are opt-in.

Restores are validated first and always transactional:

```bash
# Validate only — writes nothing
curl -X POST http://localhost:4000/api/admin/backup/restore \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"backup": {...}, "mode": "merge", "dryRun": true}'
```

- `merge` keeps current data and inserts or updates matching rows.
- `replace` deletes the tables in the file first and requires `"confirm": "REPLACE"`.
- Edited or corrupted files are rejected by the checksum.
- A restore is refused if it would leave the clinic without an active administrator or remove the administrator performing it.
- Uploads are limited by `BACKUP_MAX_BYTES` (50 MB by default).

Every export, validation and restore is recorded in `backup_runs`, `audit_logs` and `security_events`.

## Patient consistency

`patients` is the single master record. Student/staff identifiers are unique, and a database trigger propagates a patient's corrected name, type, department, allergies, chronic conditions and blood group to appointments, medical records, queue items, emergency cases, lab orders and pharmacy orders. The frontend renders names and card numbers through one shared helper, so every department sees the same patient identity.
