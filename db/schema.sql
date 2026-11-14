BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive migration: existing anonymous users and their sessions remain intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_subject uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_username text;
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

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'student')),
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, session_id)
);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at);

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
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_progress ENABLE ROW LEVEL SECURITY;

COMMIT;
