CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('imovel', 'veiculo')),
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  location TEXT NOT NULL,
  specs TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  olx_url TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  source_photos_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'sold')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_listings_status_created ON listings(status, created_at);
CREATE TABLE login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);
CREATE INDEX idx_login_limits_expiry ON login_limits(resets_at);
CREATE TRIGGER protect_last_admin_update
BEFORE UPDATE OF role, active ON users
WHEN OLD.role = 'admin' AND OLD.active = 1
AND (NEW.role != 'admin' OR NEW.active = 0)
AND (SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1) <= 1
BEGIN SELECT RAISE(ABORT, 'last_admin'); END;
CREATE TRIGGER protect_last_admin_delete
BEFORE DELETE ON users
WHEN OLD.role = 'admin' AND OLD.active = 1
AND (SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1) <= 1
BEGIN SELECT RAISE(ABORT, 'last_admin'); END;
