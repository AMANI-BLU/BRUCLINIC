-- Link a completed Emergency case to its single medical record.
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS emergency_case_id VARCHAR(64)
    REFERENCES emergency_cases(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_emergency_case
  ON medical_records (emergency_case_id)
  WHERE emergency_case_id IS NOT NULL;
