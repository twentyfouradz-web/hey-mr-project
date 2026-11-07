-- LEGACY MIGRATION: retained for migration-history compatibility only.
-- The current HEY MR website does not expose or use Chat Messenger endpoints/UI.
-- HEY MR additive production features. Safe to apply over existing 0001 schema.
CREATE TABLE IF NOT EXISTS ad_owners (
  ad_id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ad_owners_mobile ON ad_owners(mobile);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id TEXT NOT NULL,
  sender_mobile TEXT NOT NULL,
  receiver_mobile TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_ad_id ON chat_messages(ad_id,id);
CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(sender_mobile,receiver_mobile);
CREATE TABLE IF NOT EXISTS otp_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_audit_mobile ON otp_audit(mobile,created_at);
