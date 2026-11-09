CREATE TABLE IF NOT EXISTS user_messages (
  id              VARCHAR(64) PRIMARY KEY,
  sender_id       VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  recipient_id    VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_messages_nonempty CHECK (length(btrim(body)) > 0),
  CONSTRAINT chk_user_messages_distinct_users CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_user_messages_inbox
  ON user_messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_sent
  ON user_messages (sender_id, created_at DESC);
