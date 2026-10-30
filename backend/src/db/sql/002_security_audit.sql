-- ============================================================
-- BruClinic Migration 002: Security & Audit Infrastructure (PostgreSQL)
-- ============================================================
-- Adds three enterprise-grade tables:
--   audit_logs      — immutable record of every state-changing action
--   security_events — authentication and authorization incidents
--   system_config   — runtime-editable clinic configuration
-- ============================================================

-- -----------------------------------------------------------------
-- audit_logs: Immutable ledger of all mutating operations.
-- Rows are never updated or deleted (append-only by application design).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(64)  NOT NULL,
  request_id  VARCHAR(64),
  user_id     VARCHAR(64),
  username    VARCHAR(100),
  user_role   VARCHAR(30),
  action      VARCHAR(20)  NOT NULL,
  resource    VARCHAR(60)  NOT NULL,
  resource_id VARCHAR(64),
  summary     TEXT,
  changes     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs (request_id);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail: never UPDATE or DELETE rows from application code';
COMMENT ON COLUMN audit_logs.request_id IS 'Correlation ID from X-Request-ID';
COMMENT ON COLUMN audit_logs.action IS 'CREATE | UPDATE | DELETE | VIEW | LOGIN | LOGOUT | WORKFLOW | CONFIG';
COMMENT ON COLUMN audit_logs.changes IS 'Structured diff: {field: {from, to}}';

-- -----------------------------------------------------------------
-- security_events: Authentication, authorization, and rate-limit incidents.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_events (
  id          VARCHAR(64)  NOT NULL,
  event_type  VARCHAR(60)  NOT NULL,
  severity    VARCHAR(20)  NOT NULL DEFAULT 'info',
  user_id     VARCHAR(64),
  username    VARCHAR(100),
  ip_address  VARCHAR(45),
  request_id  VARCHAR(64),
  description TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_secev_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_secev_type ON security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_severity ON security_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_user ON security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_ip ON security_events (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secev_created ON security_events (created_at DESC);

COMMENT ON TABLE security_events IS 'Security incident log: auth failures, lockouts, access denials';
COMMENT ON COLUMN security_events.event_type IS 'See constants/events.js SECURITY_EVENT enum';
COMMENT ON COLUMN security_events.ip_address IS 'IPv4 or IPv6';

-- -----------------------------------------------------------------
-- system_config: Runtime-editable key-value clinic configuration.
-- All keys are lowercase_underscored strings.
-- Seed with safe defaults immediately below.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  key         VARCHAR(80)  NOT NULL,
  value       TEXT         NOT NULL,
  description VARCHAR(255),
  updated_by  VARCHAR(100),
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key)
);

COMMENT ON TABLE system_config IS 'Runtime-editable clinic configuration; changes take effect without server restart';
COMMENT ON COLUMN system_config.updated_by IS 'Username of last editor';

DROP TRIGGER IF EXISTS trg_system_config_updated_at ON system_config;
CREATE TRIGGER trg_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default config values (ON CONFLICT preserves custom values on re-migration)
INSERT INTO system_config (key, value, description) VALUES
  ('clinic_name',                    'Borana University Clinic',  'Official clinic name shown in reports and UI'),
  ('clinic_location',                'Yabelo, Oromia, Ethiopia',  'Physical address / campus location'),
  ('clinic_email',                   'clinic@boru.edu.et',        'Official contact email'),
  ('clinic_phone',                   '+251 46 441 0000',          'Official contact phone'),
  ('session_timeout_hours',          '8',                         'JWT token lifetime in hours (1-72)'),
  ('max_login_attempts',             '8',                         'Failed login attempts before lockout (3-20)'),
  ('login_lockout_minutes',          '15',                        'Lockout window in minutes (5-60)'),
  ('maintenance_mode',               'false',                     'Set to true to show a maintenance banner'),
  ('audit_log_retention_days',       '365',                       'Days to retain audit log rows (min 90)'),
  ('security_event_retention_days',  '180',                       'Days to retain security event rows (min 30)'),
  ('timezone',                       'Africa/Addis_Ababa',        'Clinic local timezone for reports'),
  ('academic_year',                  '',                          'Current academic year label (e.g. 2025/2026)')
ON CONFLICT (key) DO NOTHING;
