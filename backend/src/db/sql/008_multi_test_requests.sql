ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS request_group_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS queue_item_id VARCHAR(64)
    REFERENCES queue_items(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_request_group ON lab_orders (request_group_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_queue_item ON lab_orders (queue_item_id);