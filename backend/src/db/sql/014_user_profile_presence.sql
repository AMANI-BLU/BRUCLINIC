-- BruClinic Migration 014: Staff profile details and presence
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'Male',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at DESC);
