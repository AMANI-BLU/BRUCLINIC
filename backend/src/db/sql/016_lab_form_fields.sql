-- BruClinic Migration 016: Borana laboratory form operational fields
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS logged_in_at VARCHAR(30),
  ADD COLUMN IF NOT EXISTS logged_out_at VARCHAR(30),
  ADD COLUMN IF NOT EXISTS star BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS technician_initials VARCHAR(40),
  ADD COLUMN IF NOT EXISTS technician_comment TEXT,
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(180),
  ADD COLUMN IF NOT EXISTS approved_at VARCHAR(30);
