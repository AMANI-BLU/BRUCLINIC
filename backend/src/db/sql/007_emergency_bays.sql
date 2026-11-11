-- ============================================================
-- BruClinic Migration 007: Emergency bay configuration
-- ============================================================

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
