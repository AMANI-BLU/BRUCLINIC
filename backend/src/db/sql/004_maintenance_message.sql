-- ============================================================
-- BruClinic Migration 004: Maintenance Message
-- ============================================================
-- The maintenance screen shown to staff uses this administrator-editable
-- message. Kept separate from maintenance_mode so toggling maintenance
-- never overwrites the wording.

INSERT INTO system_config (key, value, description) VALUES
  (
    'maintenance_message',
    'The clinic system is being updated to serve you better. Clinical services will resume shortly.',
    'Message shown to staff while maintenance mode is enabled'
  )
ON CONFLICT (key) DO NOTHING;
