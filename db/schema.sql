create table if not exists users (
  id text primary key,                 -- anonymous id created by the client
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id),
  topic_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'student')),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists notebook_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  claim text not null,
  source_message_id uuid references messages(id)
);

create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);

create table if not exists exam_answers (
  attempt_id uuid not null references exam_attempts(id) on delete cascade,
  question_id text not null,
  answer text not null,
  correct boolean not null,
  guessed boolean not null,
  reasoning text not null,
  notebook_refs uuid[] not null default '{}',
  primary key (attempt_id, question_id)
);

create table if not exists topic_progress (
  user_id text not null references users(id),
  topic_id text not null,
  status text not null check (status in ('not_started', 'failed', 'passed')),
  best_score int,
  last_session_at timestamptz,
  primary key (user_id, topic_id)
);
