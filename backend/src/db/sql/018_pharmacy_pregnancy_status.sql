ALTER TABLE pharmacy_orders
  ADD COLUMN IF NOT EXISTS pregnancy_status VARCHAR(30);