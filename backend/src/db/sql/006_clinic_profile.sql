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
  working_hours   VARCHAR(200) NOT NULL DEFAULT 'Mon–Fri 08:00–17:00, Sat 08:00–13:00',
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

