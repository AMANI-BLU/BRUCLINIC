-- ============================================================
-- BruClinic Migration 019: Banned IP Management
-- ============================================================
CREATE TABLE IF NOT EXISTS banned_ips (
  ip_address  VARCHAR(45) PRIMARY KEY,
  reason      TEXT NOT NULL DEFAULT 'Banned by administrator',
  banned_by   VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banned_ips_expires ON banned_ips (expires_at);
