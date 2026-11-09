ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO system_config (key, value, description) VALUES
  ('default_user_password_hash', '', 'Hashed temporary password assigned to newly created staff accounts')
ON CONFLICT (key) DO NOTHING;