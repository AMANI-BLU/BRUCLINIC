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