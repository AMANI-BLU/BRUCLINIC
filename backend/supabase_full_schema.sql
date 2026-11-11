-- ================================================================
-- BruClinic Complete Schema + Migration Tracker
-- Paste this entire script into Supabase SQL Editor and run it.
-- ================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ================================================================
-- 001_initial.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 001: Core Clinic Schema (PostgreSQL)
-- ============================================================

-- Keep `updated_at` current on every UPDATE (replaces MySQL's
-- ON UPDATE CURRENT_TIMESTAMP behaviour).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(64) PRIMARY KEY,
  username        VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  role            VARCHAR(30) NOT NULL,
  role_title      VARCHAR(180) NOT NULL,
  department      VARCHAR(180) NOT NULL,
  email           VARCHAR(180) NOT NULL UNIQUE,
  avatar_initials VARCHAR(10) NOT NULL,
  badge_color     VARCHAR(20) NOT NULL DEFAULT '#2563eb',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id                      VARCHAR(64) PRIMARY KEY,
  student_id              VARCHAR(80),
  staff_id                VARCHAR(80),
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  gender                  VARCHAR(20) NOT NULL,
  date_of_birth           DATE NOT NULL,
  phone                   VARCHAR(40) NOT NULL,
  email                   VARCHAR(180) NOT NULL DEFAULT '',
  address                 TEXT NOT NULL DEFAULT '',
  patient_type            VARCHAR(30) NOT NULL,
  department              VARCHAR(180),
  blood_group             VARCHAR(5),
  allergies               JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  emergency_contact_name  VARCHAR(150) NOT NULL DEFAULT '',
  emergency_contact_phone VARCHAR(40) NOT NULL DEFAULT '',
  registered_at           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id             VARCHAR(64) PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  specialization VARCHAR(120) NOT NULL,
  email          VARCHAR(180) NOT NULL DEFAULT '',
  phone          VARCHAR(40) NOT NULL DEFAULT '',
  gender         VARCHAR(20) NOT NULL,
  available      BOOLEAN NOT NULL DEFAULT TRUE,
  schedule       JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar         VARCHAR(255),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id               VARCHAR(64) PRIMARY KEY,
  patient_id       VARCHAR(64) NOT NULL,
  patient_name     VARCHAR(180) NOT NULL,
  doctor_id        VARCHAR(64) NOT NULL,
  doctor_name      VARCHAR(180) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  type             VARCHAR(50) NOT NULL DEFAULT 'General',
  status           VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
  reason           TEXT NOT NULL,
  notes            TEXT,
  priority         VARCHAR(20) NOT NULL DEFAULT 'Medium',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medical_records (
  id             VARCHAR(64) PRIMARY KEY,
  patient_id     VARCHAR(64) NOT NULL,
  patient_name   VARCHAR(180) NOT NULL,
  doctor_id      VARCHAR(64),
  doctor_name    VARCHAR(180) NOT NULL,
  visit_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis      TEXT NOT NULL,
  symptoms       JSONB NOT NULL DEFAULT '[]'::jsonb,
  vitals         JSONB,
  prescription   JSONB NOT NULL DEFAULT '[]'::jsonb,
  lab_tests      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes          TEXT NOT NULL DEFAULT '',
  follow_up_date DATE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_records_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medicines (
  id             VARCHAR(64) PRIMARY KEY,
  name           VARCHAR(180) NOT NULL,
  category       VARCHAR(100) NOT NULL DEFAULT '',
  stock          INT NOT NULL DEFAULT 0,
  unit           VARCHAR(40) NOT NULL DEFAULT '',
  expiry_date    DATE NOT NULL,
  supplier       VARCHAR(180) NOT NULL DEFAULT '',
  min_stock      INT NOT NULL DEFAULT 0,
  cost_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_items (
  id                     VARCHAR(64) PRIMARY KEY,
  token_number           VARCHAR(30) NOT NULL,
  patient_id             VARCHAR(64) NOT NULL,
  patient_name           VARCHAR(180) NOT NULL,
  patient_type           VARCHAR(30) NOT NULL,
  department             VARCHAR(180),
  registered_time        VARCHAR(20) NOT NULL,
  stage                  VARCHAR(50) NOT NULL,
  priority               VARCHAR(20) NOT NULL DEFAULT 'Normal',
  assigned_doctor_id     VARCHAR(64),
  assigned_doctor_name   VARCHAR(180),
  assigned_opd_room      VARCHAR(120),
  vitals                 JSONB,
  chief_complaint        TEXT NOT NULL,
  card_status            VARCHAR(40),
  has_existing_card      BOOLEAN,
  request_source         VARCHAR(80),
  request_destination    VARCHAR(80),
  request_notes          TEXT,
  allergies              JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions     JSONB NOT NULL DEFAULT '[]'::jsonb,
  blood_group            VARCHAR(5),
  lab_order_id           VARCHAR(64),
  lab_test_name          VARCHAR(180),
  lab_category           VARCHAR(80),
  lab_status             VARCHAR(40),
  lab_result             TEXT,
  lab_unit               VARCHAR(40),
  lab_reference_range    VARCHAR(100),
  lab_is_abnormal        BOOLEAN,
  lab_completed_at       VARCHAR(30),
  lab_notes              TEXT,
  pharmacy_order_id      VARCHAR(64),
  prescribed_medicines   JSONB NOT NULL DEFAULT '[]'::jsonb,
  pharmacy_status        VARCHAR(30),
  doctor_diagnosis       TEXT,
  consultation_notes     TEXT,
  completed_at           VARCHAR(30),
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_queue_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_queue_doctor  FOREIGN KEY (assigned_doctor_id) REFERENCES doctors (id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS emergency_cases (
  id               VARCHAR(64) PRIMARY KEY,
  patient_id       VARCHAR(64) NOT NULL,
  patient_name     VARCHAR(180) NOT NULL,
  age              INT NOT NULL,
  gender           VARCHAR(20) NOT NULL,
  arrival_method   VARCHAR(40) NOT NULL,
  arrival_time     VARCHAR(30) NOT NULL,
  acuity           VARCHAR(20) NOT NULL,
  chief_complaint  TEXT NOT NULL,
  bed_number       VARCHAR(120) NOT NULL,
  vitals           JSONB NOT NULL DEFAULT '{}'::jsonb,
  attending_doctor VARCHAR(180) NOT NULL,
  status           VARCHAR(40) NOT NULL DEFAULT 'In Treatment',
  critical_notes   TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emergency_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id              VARCHAR(64) PRIMARY KEY,
  patient_id      VARCHAR(64) NOT NULL,
  patient_name    VARCHAR(180) NOT NULL,
  doctor_id       VARCHAR(64),
  doctor_name     VARCHAR(180) NOT NULL,
  ordered_at      VARCHAR(30) NOT NULL,
  priority        VARCHAR(20) NOT NULL DEFAULT 'Medium',
  test_name       VARCHAR(180) NOT NULL,
  category        VARCHAR(80) NOT NULL,
  specimen_type   VARCHAR(100) NOT NULL,
  status          VARCHAR(40) NOT NULL DEFAULT 'Requested',
  result          TEXT,
  unit            VARCHAR(40),
  reference_range VARCHAR(100),
  is_abnormal     BOOLEAN,
  notes           TEXT,
  completed_at    VARCHAR(30),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_lab_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id            VARCHAR(64) PRIMARY KEY,
  patient_id    VARCHAR(64) NOT NULL,
  patient_name  VARCHAR(180) NOT NULL,
  doctor_id     VARCHAR(64),
  doctor_name   VARCHAR(180) NOT NULL,
  prescribed_at VARCHAR(30) NOT NULL,
  medicines     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
  dispensed_at  VARCHAR(30),
  dispensed_by  VARCHAR(180),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacy_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records (patient_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_queue_stage ON queue_items (stage, priority);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_cases (status, acuity);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders (status, priority);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders (status);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_doctors_updated_at ON doctors;
CREATE TRIGGER trg_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_records_updated_at ON medical_records;
CREATE TRIGGER trg_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medicines_updated_at ON medicines;
CREATE TRIGGER trg_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_queue_updated_at ON queue_items;
CREATE TRIGGER trg_queue_updated_at BEFORE UPDATE ON queue_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_emergency_updated_at ON emergency_cases;
CREATE TRIGGER trg_emergency_updated_at BEFORE UPDATE ON emergency_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lab_orders_updated_at ON lab_orders;
CREATE TRIGGER trg_lab_orders_updated_at BEFORE UPDATE ON lab_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pharmacy_orders_updated_at ON pharmacy_orders;
CREATE TRIGGER trg_pharmacy_orders_updated_at BEFORE UPDATE ON pharmacy_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();


INSERT INTO schema_migrations (version) VALUES ('001_initial.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 002_security_audit.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 002: Security & Audit Infrastructure (PostgreSQL)
-- ============================================================
-- Adds three enterprise-grade tables:
--   audit_logs      â€” immutable record of every state-changing action
--   security_events â€” authentication and authorization incidents
--   system_config   â€” runtime-editable clinic configuration
-- ============================================================

-- -----------------------------------------------------------------
-- audit_logs: Immutable ledger of all mutating operations.
-- Rows are never updated or deleted (append-only by application design).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(64)  NOT NULL,
  request_id  VARCHAR(64),
  user_id     VARCHAR(64),
  username    VARCHAR(100),
  user_role   VARCHAR(30),
  action      VARCHAR(20)  NOT NULL,
  resource    VARCHAR(60)  NOT NULL,
  resource_id VARCHAR(64),
  summary     TEXT,
  changes     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs (request_id);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail: never UPDATE or DELETE rows from application code';
COMMENT ON COLUMN audit_logs.request_id IS 'Correlation ID from X-Request-ID';
COMMENT ON COLUMN audit_logs.action IS 'CREATE | UPDATE | DELETE | VIEW | LOGIN | LOGOUT | WORKFLOW | CONFIG';
COMMENT ON COLUMN audit_logs.changes IS 'Structured diff: {field: {from, to}}';

-- -----------------------------------------------------------------
-- security_events: Authentication, authorization, and rate-limit incidents.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_events (
  id          VARCHAR(64)  NOT NULL,
  event_type  VARCHAR(60)  NOT NULL,
  severity    VARCHAR(20)  NOT NULL DEFAULT 'info',
  user_id     VARCHAR(64),
  username    VARCHAR(100),
  ip_address  VARCHAR(45),
  request_id  VARCHAR(64),
  description TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_secev_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_secev_type ON security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_severity ON security_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_user ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_ip ON security_events (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_created ON security_events (created_at DESC);

COMMENT ON TABLE security_events IS 'Security incident log: auth failures, lockouts, access denials';
COMMENT ON COLUMN security_events.event_type IS 'See constants/events.js SECURITY_EVENT enum';
COMMENT ON COLUMN security_events.ip_address IS 'IPv4 or IPv6';

-- -----------------------------------------------------------------
-- system_config: Runtime-editable key-value clinic configuration.
-- All keys are lowercase_underscored strings.
-- Seed with safe defaults immediately below.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  key         VARCHAR(80)  NOT NULL,
  value       TEXT         NOT NULL,
  description VARCHAR(255),
  updated_by  VARCHAR(100),
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key)
);

COMMENT ON TABLE system_config IS 'Runtime-editable clinic configuration; changes take effect without server restart';
COMMENT ON COLUMN system_config.updated_by IS 'Username of last editor';

DROP TRIGGER IF EXISTS trg_system_config_updated_at ON system_config;
CREATE TRIGGER trg_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default config values (ON CONFLICT preserves custom values on re-migration)
INSERT INTO system_config (key, value, description) VALUES
  ('clinic_name',                    'Borana University Clinic',  'Official clinic name shown in reports and UI'),
  ('clinic_location',                'Yabelo, Oromia, Ethiopia',  'Physical address / campus location'),
  ('clinic_email',                   'clinic@boru.edu.et',        'Official contact email'),
  ('clinic_phone',                   '+251 46 441 0000',          'Official contact phone'),
  ('session_timeout_hours',          '8',                         'JWT token lifetime in hours (1-72)'),
  ('max_login_attempts',             '8',                         'Failed login attempts before lockout (3-20)'),
  ('login_lockout_minutes',          '15',                        'Lockout window in minutes (1-60)'),
  ('maintenance_mode',               'false',                     'Set to true to show a maintenance banner'),
  ('audit_log_retention_days',       '365',                       'Days to retain audit log rows (min 90)'),
  ('security_event_retention_days',  '180',                       'Days to retain security event rows (min 30)'),
  ('timezone',                       'Africa/Addis_Ababa',        'Clinic local timezone for reports'),
  ('academic_year',                  '',                            'Current academic year label (e.g. 2025/2026)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('002_security_audit.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 003_operational_integrity.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 003: Operational Integrity & Data Safety
-- ============================================================
--   backup_runs  â€” auditable history of exports and restores
--   patient identity sync â€” keeps denormalised patient names/attributes
--                           consistent across every clinical table
--   patient identifier uniqueness â€” prevents duplicate patient cards
--   backup configuration keys
-- ============================================================

-- -----------------------------------------------------------------
-- backup_runs: one row per export or import attempt.
-- Restores are written after the transaction commits (or validates).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_runs (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  kind       VARCHAR(20)  NOT NULL,
  mode       VARCHAR(20),
  status     VARCHAR(20)  NOT NULL DEFAULT 'completed',
  actor_id   VARCHAR(64),
  actor      VARCHAR(100),
  filename   VARCHAR(160),
  checksum   VARCHAR(100),
  dry_run    BOOLEAN      NOT NULL DEFAULT FALSE,
  counts     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  notes      TEXT,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_backup_kind   CHECK (kind IN ('export', 'import')),
  CONSTRAINT chk_backup_status CHECK (status IN ('completed', 'validated', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_created ON backup_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_kind ON backup_runs (kind, status);

COMMENT ON TABLE backup_runs IS 'History of data exports and restores; never edited by the application';

-- -----------------------------------------------------------------
-- Patient identity sync
--
-- Patient names and attributes are denormalised into appointments,
-- records, queue items, emergency cases, lab orders and pharmacy orders
-- for historical snapshots and fast lists. This trigger guarantees that
-- a correction to the patient master record is reflected everywhere,
-- regardless of which route (or restore) performed the update.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_patient_identity()
RETURNS TRIGGER AS $$
DECLARE
  full_name VARCHAR(180) := NEW.first_name || ' ' || NEW.last_name;
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.patient_type IS DISTINCT FROM OLD.patient_type
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.allergies IS DISTINCT FROM OLD.allergies
     OR NEW.chronic_conditions IS DISTINCT FROM OLD.chronic_conditions
     OR NEW.blood_group IS DISTINCT FROM OLD.blood_group
  THEN
    UPDATE appointments SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE medical_records SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE emergency_cases SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE lab_orders SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE pharmacy_orders SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE queue_items
       SET patient_name = full_name,
           patient_type = NEW.patient_type,
           department = COALESCE(NEW.department, department),
           allergies = NEW.allergies,
           chronic_conditions = NEW.chronic_conditions,
           blood_group = NEW.blood_group
     WHERE patient_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_identity_sync ON patients;
CREATE TRIGGER trg_patients_identity_sync
AFTER UPDATE OF first_name, last_name, patient_type, department, allergies, chronic_conditions, blood_group
ON patients
FOR EACH ROW
EXECUTE FUNCTION sync_patient_identity();

-- -----------------------------------------------------------------
-- Patient identifier uniqueness
-- A student or staff member must have exactly one patient card.
-- Blank identifiers are allowed on external/other patient types.
-- -----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_student_id
  ON patients (UPPER(BTRIM(student_id)))
  WHERE student_id IS NOT NULL AND BTRIM(student_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_staff_id
  ON patients (UPPER(BTRIM(staff_id)))
  WHERE staff_id IS NOT NULL AND BTRIM(staff_id) <> '';

-- -----------------------------------------------------------------
-- Backup configuration keys
-- -----------------------------------------------------------------
INSERT INTO system_config (key, value, description) VALUES
  ('backup_retention_days', '90',  'Recommended number of days to keep exported backup files'),
  ('backup_max_rows',       '250000', 'Maximum rows per table included in one backup')
ON CONFLICT (key) DO NOTHING;

-- Maintenance mode was a display-only flag before this version. Reset the
-- flag so enabling enforcement does not unexpectedly lock out clinic staff.
UPDATE system_config SET value = 'false' WHERE key = 'maintenance_mode' AND value = 'true';


INSERT INTO schema_migrations (version) VALUES ('003_operational_integrity.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 004_maintenance_message.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 004: Maintenance Message
-- ============================================================
-- The maintenance screen shown to staff uses this administrator-editable
-- message. Kept separate from maintenance_mode so toggling maintenance
-- never overwrites the wording.

INSERT INTO system_config (key, value, description) VALUES
  (
    'maintenance_message',
    'The clinic system is being updated to serve you better. Clinical services will resume shortly.',
    'Message shown to staff while maintenance mode is enabled'
  )
ON CONFLICT (key) DO NOTHING;


INSERT INTO schema_migrations (version) VALUES ('004_maintenance_message.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 005_medicine_images.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 005: Medicine images & pharmacist attribution
-- ============================================================

-- Photograph of the medicine box/bottle uploaded by the pharmacist.
-- Stored as an inline (base64) data URL so the JSON API stays dependency-free.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Which staff member added this medicine to the catalogue.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS added_by VARCHAR(180) NOT NULL DEFAULT '';


INSERT INTO schema_migrations (version) VALUES ('005_medicine_images.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 006_clinic_profile.sql
-- ================================================================
-- ============================================================
-- BruClinic Migration 006: Clinic Profile Table
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_profile (
  id              VARCHAR(10)  PRIMARY KEY DEFAULT 'main',
  name            VARCHAR(200) NOT NULL DEFAULT 'Borana University Clinic',
  tagline         VARCHAR(300) NOT NULL DEFAULT 'Caring for the Borana University Community',
  address         TEXT         NOT NULL DEFAULT 'Yabelo, Oromia, Ethiopia',
  phone           VARCHAR(80)  NOT NULL DEFAULT '+251 46 441 0000',
  email           VARCHAR(180) NOT NULL DEFAULT 'clinic@boru.edu.et',
  website         VARCHAR(255) NOT NULL DEFAULT '',
  logo_url        VARCHAR(500) NOT NULL DEFAULT '',
  working_hours   VARCHAR(200) NOT NULL DEFAULT 'Monâ€“Fri 08:00â€“17:00, Sat 08:00â€“13:00',
  emergency_line  VARCHAR(80)  NOT NULL DEFAULT '',
  accreditation   VARCHAR(255) NOT NULL DEFAULT '',
  bed_capacity    INT          NOT NULL DEFAULT 0,
  founded_year    INT,
  updated_by      VARCHAR(100),
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_clinic_profile_updated_at ON clinic_profile;
CREATE TRIGGER trg_clinic_profile_updated_at
  BEFORE UPDATE ON clinic_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ensure singleton row exists
INSERT INTO clinic_profile (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;



INSERT INTO schema_migrations (version) VALUES ('006_clinic_profile.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 007_emergency_bays.sql
-- ================================================================
CREATE TABLE IF NOT EXISTS emergency_bays (
  id           VARCHAR(64) PRIMARY KEY,
  name         VARCHAR(120) NOT NULL UNIQUE,
  type         VARCHAR(80) NOT NULL DEFAULT 'Observation',
  oxygen_port  BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO emergency_bays (id, name, type, oxygen_port) VALUES
  ('BAY-01', 'Bay 01 (Resus/Trauma 1)', 'Critical', TRUE),
  ('BAY-02', 'Bay 02 (Resus/Trauma 2)', 'Critical', TRUE),
  ('BAY-03', 'Bay 03 (Acute Surgery)', 'Acute', TRUE),
  ('BAY-04', 'Bay 04 (Acute Medical)', 'Acute', TRUE),
  ('BAY-05', 'Bay 05 (Observation)', 'Observation', FALSE),
  ('BAY-06', 'Bay 06 (Observation)', 'Observation', FALSE),
  ('BAY-07', 'Bay 07 (Isolation / Fever)', 'Isolation', TRUE),
  ('BAY-08', 'Bay 08 (Step-down)', 'Step-down', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_emergency_bays_updated_at ON emergency_bays;
CREATE TRIGGER trg_emergency_bays_updated_at
  BEFORE UPDATE ON emergency_bays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_migrations (version) VALUES ('007_emergency_bays.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 007_password_lifecycle.sql
-- ================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO system_config (key, value, description) VALUES
  ('default_user_password_hash', '', 'Hashed temporary password assigned to newly created staff accounts')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('007_password_lifecycle.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 008_multi_test_requests.sql
-- ================================================================
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS request_group_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS queue_item_id VARCHAR(64)
    REFERENCES queue_items(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_request_group ON lab_orders (request_group_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_queue_item ON lab_orders (queue_item_id);

INSERT INTO schema_migrations (version) VALUES ('008_multi_test_requests.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 009_record_encounter_link.sql
-- ================================================================
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS queue_item_id VARCHAR(64)
    REFERENCES queue_items(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE queue_items
  ADD COLUMN IF NOT EXISTS external_referral JSONB;

ALTER TABLE pharmacy_orders
  ADD COLUMN IF NOT EXISTS queue_item_id VARCHAR(64)
    REFERENCES queue_items(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_queue_item
  ON medical_records (queue_item_id)
  WHERE queue_item_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('009_record_encounter_link.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 010_user_messages.sql
-- ================================================================
CREATE TABLE IF NOT EXISTS user_messages (
  id              VARCHAR(64) PRIMARY KEY,
  sender_id       VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  recipient_id    VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_messages_nonempty CHECK (length(btrim(body)) > 0),
  CONSTRAINT chk_user_messages_distinct_users CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_user_messages_inbox
  ON user_messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_sent
  ON user_messages (sender_id, created_at DESC);


INSERT INTO schema_migrations (version) VALUES ('010_user_messages.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 012_emergency_record_link.sql
-- ================================================================
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS emergency_case_id VARCHAR(64)
    REFERENCES emergency_cases(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_emergency_case
  ON medical_records (emergency_case_id)
  WHERE emergency_case_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('012_emergency_record_link.sql') ON CONFLICT DO NOTHING;


-- ================================================================
-- 013_emergency_assessment.sql
-- ================================================================
ALTER TABLE emergency_cases
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS external_referral JSONB;

INSERT INTO schema_migrations (version) VALUES ('013_emergency_assessment.sql') ON CONFLICT DO NOTHING;



-- ================================================================
-- SEED: Create the initial admin account
-- Change username/email/password before running!
-- Password below is bcrypt hash of: Admin@BruClinic2024
-- Generate a new one at: https://bcrypt-generator.com (cost 10)
-- ================================================================

INSERT INTO users (
  id, username, password_hash, name, role, role_title,
  department, email, avatar_initials, badge_color, is_active
) VALUES (
  'USR-ADMIN',
  'admin',
  '\\\.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Clinic Administrator',
  'admin',
  'System Administrator',
  'Clinic Administration',
  'admin@bruclinic.com',
  'CA',
  '#2563eb',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- After running this, sign in with:
--   Username: admin
--   Password: password   (the hash above is bcrypt of "password")
-- CHANGE IT IMMEDIATELY after first login via Settings → Change Password
