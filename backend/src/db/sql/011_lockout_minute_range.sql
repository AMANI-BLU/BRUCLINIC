UPDATE system_config
SET description = 'Lockout window in minutes (1-60)'
WHERE key = 'login_lockout_minutes';
