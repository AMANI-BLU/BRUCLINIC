-- BruClinic Migration 015: Assign emergency notifications to an individual user
ALTER TABLE emergency_cases
  ADD COLUMN IF NOT EXISTS attending_doctor_id VARCHAR(64)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_cases_assignee
  ON emergency_cases (attending_doctor_id, created_at DESC);
