-- Run in the Supabase SQL Editor to enable the student voice usage ledger.
-- Matches db/schema.sql. Safe to rerun; preserves existing reservations.
-- Does not change ai_usage or the OpenAI budget.
BEGIN;

CREATE TABLE IF NOT EXISTS tts_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  usage_month text NOT NULL CHECK (usage_month ~ '^[0-9]{4}-[0-9]{2}$'),
  message_id uuid NOT NULL,
  characters integer NOT NULL CHECK (characters > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tts_usage_month_idx ON tts_usage(provider, usage_month);
CREATE INDEX IF NOT EXISTS tts_usage_message_idx ON tts_usage(message_id);

ALTER TABLE tts_usage ENABLE ROW LEVEL SECURITY;

COMMIT;

