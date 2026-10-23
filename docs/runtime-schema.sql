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
