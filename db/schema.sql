BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive migration: existing anonymous users and their sessions remain intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_subject uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ai_reply_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_subject_idx ON users(auth_subject);
CREATE UNIQUE INDEX IF NOT EXISTS users_demo_username_idx ON users(demo_username);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_topic_idx ON sessions(user_id, topic_id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notebook_revision text;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'student')),
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, session_id)
);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS messages_reply_to_idx ON messages(reply_to_message_id);
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_reply_source_fk
    FOREIGN KEY (reply_to_message_id, session_id) REFERENCES messages(id, session_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_reply_role_check
    CHECK (reply_to_message_id IS NULL OR role = 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Claims are committed before contacting OpenAI. The token fences late workers.
CREATE TABLE IF NOT EXISTS student_reply_jobs (
  message_id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  attempt_token uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  FOREIGN KEY (message_id, session_id) REFERENCES messages(id, session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS student_reply_jobs_session_idx ON student_reply_jobs(session_id);

-- Budget reservations deliberately survive deleted users and sessions.
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_key text NOT NULL DEFAULT 'openai',
  model text NOT NULL,
  reserved_nanodollars bigint NOT NULL CHECK (reserved_nanodollars > 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  budget_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_budget_idx ON ai_usage(budget_key);

CREATE TABLE IF NOT EXISTS notebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  claim text NOT NULL,
  source_message_id uuid NOT NULL,
  FOREIGN KEY (source_message_id, session_id) REFERENCES messages(id, session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0),
  total integer NOT NULL CHECK (total > 0 AND score <= total),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_attempts_session_idx ON exam_attempts(session_id, created_at);
-- Immutable snapshots keep past evidence and answer keys intact after teaching more.
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS learning_revision text;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS notebook_snapshot jsonb NOT NULL DEFAULT '[]';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS questions_snapshot jsonb NOT NULL DEFAULT '[]';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS key_ideas_snapshot jsonb NOT NULL DEFAULT '[]';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS gaps jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_revision_idx ON exam_attempts(session_id, learning_revision);

-- Short durable claims: no database connection is held while a model responds.
CREATE TABLE IF NOT EXISTS learning_jobs (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('notebook', 'exam')),
  revision text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  attempt_token uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (session_id, operation, revision)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer text,
  correct boolean NOT NULL,
  guessed boolean NOT NULL,
  reasoning text NOT NULL,
  notebook_refs uuid[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (attempt_id, question_id),
  CHECK (NOT correct OR (NOT guessed AND cardinality(notebook_refs) > 0))
);

CREATE TABLE IF NOT EXISTS topic_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'failed', 'passed')),
  best_score integer CHECK (best_score >= 0),
  last_session_at timestamptz,
  PRIMARY KEY (user_id, topic_id)
);

-- Browser Supabase keys are for Auth only. All application data goes through
-- the server's owner-role connection and its explicit ownership checks.
-- With no client policies, public API roles cannot read or write these tables.
-- Text-to-speech character reservations, separate from the OpenAI dollar ledger.
-- Rows have no foreign keys and survive deleted sessions, so the monthly cap
-- cannot be reset by deleting data. Never truncate this table.
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

-- Paid-request rate limit events. Holds only a keyed hash of the network
-- address, no user link; rows older than a day are pruned by the app.
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id bigserial PRIMARY KEY,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_events_time_idx ON rate_limit_events(created_at);
CREATE INDEX IF NOT EXISTS rate_limit_events_key_idx ON rate_limit_events(key_hash, created_at);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_reply_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_progress ENABLE ROW LEVEL SECURITY;

COMMIT;
