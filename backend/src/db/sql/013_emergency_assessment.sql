ALTER TABLE emergency_cases
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS external_referral JSONB;
