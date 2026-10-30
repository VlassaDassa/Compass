-- Actual runtime schema. Applied idempotently by server.mjs at startup.
CREATE TABLE IF NOT EXISTS compass_workspace_state (
  workspace_id text PRIMARY KEY,
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE compass_workspace_state ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS compass_ai_settings (
  workspace_id text PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL DEFAULT '',
  base_url text NOT NULL DEFAULT '',
  api_key_cipher text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Login accounts are separate from the editable workspace and its demo users.
CREATE TABLE IF NOT EXISTS compass_auth_users (
  id text PRIMARY KEY,
  login text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','user')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS compass_auth_users_login_lower ON compass_auth_users (lower(login));
CREATE TABLE IF NOT EXISTS compass_auth_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES compass_auth_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compass_auth_sessions_user_idx ON compass_auth_sessions(user_id);
