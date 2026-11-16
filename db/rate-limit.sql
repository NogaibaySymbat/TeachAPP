-- Add the paid-request limiter to an existing TeachAPP database.
-- Matches db/schema.sql; safe to rerun. Preserves history, ai_usage and tts_usage.
BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id bigserial PRIMARY KEY,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_events_time_idx ON rate_limit_events(created_at);
CREATE INDEX IF NOT EXISTS rate_limit_events_key_idx ON rate_limit_events(key_hash, created_at);
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;

COMMIT;
