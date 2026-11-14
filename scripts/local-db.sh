#!/bin/sh
set -eu

# Isolated development database; never touches DATABASE_URL or a cloud database.
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -d /opt/homebrew/opt/postgresql@16/bin ]; then
  PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
fi
if ! command -v pg_ctl >/dev/null 2>&1; then
  echo 'PostgreSQL is required. Install it, then run npm run db:local again.' >&2
  exit 1
fi
data_dir="$project_dir/.data/postgres"
mkdir -p "$project_dir/.data"
if [ ! -f "$data_dir/PG_VERSION" ]; then
  initdb -D "$data_dir" -U teachapp --auth=trust --encoding=UTF8 --no-locale >/dev/null
fi
if ! pg_ctl -D "$data_dir" status >/dev/null 2>&1; then
  pg_ctl -D "$data_dir" -l "$project_dir/.data/postgres.log" -o '-h 127.0.0.1 -p 55433 -k /tmp' start
fi
database_exists=$(psql -h 127.0.0.1 -p 55433 -U teachapp -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'teachapp'")
if [ "$database_exists" != '1' ]; then
  createdb -h 127.0.0.1 -p 55433 -U teachapp teachapp
fi
psql 'postgresql://teachapp@127.0.0.1:55433/teachapp' -v ON_ERROR_STOP=1 -f "$project_dir/db/schema.sql"
echo 'Local database is ready: postgresql://teachapp@127.0.0.1:55433/teachapp'
