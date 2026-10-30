-- ============================================================
-- BruClinic Migration 003: Operational Integrity & Data Safety
-- ============================================================
--   backup_runs  — auditable history of exports and restores
--   patient identity sync — keeps denormalised patient names/attributes
--                           consistent across every clinical table
--   patient identifier uniqueness — prevents duplicate patient cards
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
