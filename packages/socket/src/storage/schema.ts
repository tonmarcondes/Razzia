export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  password_hash TEXT,
  must_reset INTEGER NOT NULL DEFAULT 1 CHECK (must_reset IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (active = 0 OR password_hash IS NOT NULL)
) STRICT;
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (expires_at > issued_at)
) STRICT;
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'selected', 'library')),
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (id, current_revision) REFERENCES quiz_revisions(quiz_id, revision) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE TABLE quiz_revisions (
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) DEFERRABLE INITIALLY DEFERRED,
  revision INTEGER NOT NULL CHECK (revision > 0),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  sha256 TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (quiz_id, revision)
) STRICT;
CREATE TRIGGER immutable_quiz_revision_update BEFORE UPDATE ON quiz_revisions BEGIN
  SELECT RAISE(ABORT, 'Quiz revisions are immutable');
END;
CREATE TRIGGER immutable_quiz_revision_delete BEFORE DELETE ON quiz_revisions BEGIN
  SELECT RAISE(ABORT, 'Quiz revisions are retained');
END;
CREATE TABLE quiz_grants (
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  can_use INTEGER NOT NULL CHECK (can_use IN (0, 1)),
  can_copy INTEGER NOT NULL CHECK (can_copy IN (0, 1)),
  PRIMARY KEY (quiz_id, user_id),
  CHECK (can_use = 1 OR can_copy = 1)
) STRICT;
CREATE TABLE game_runs (
  id TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL REFERENCES users(id),
  host_session_id TEXT REFERENCES sessions(id),
  source_quiz_id TEXT,
  source_revision INTEGER,
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY (source_quiz_id, source_revision) REFERENCES quiz_revisions(quiz_id, revision),
  CHECK ((source_quiz_id IS NULL) = (source_revision IS NULL))
) STRICT;
CREATE TABLE results (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  game_run_id TEXT REFERENCES game_runs(id),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at TEXT NOT NULL,
  deleted_at TEXT
) STRICT;
CREATE TRIGGER immutable_result BEFORE UPDATE OF payload, owner_id, game_run_id ON results BEGIN
  SELECT RAISE(ABORT, 'Result snapshots are immutable');
END;
CREATE TABLE media (
  name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  sha256 TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size >= 0),
  classification TEXT NOT NULL DEFAULT 'holding' CHECK (classification IN ('holding', 'private')),
  created_at TEXT NOT NULL
) STRICT;
CREATE TABLE media_references (
  media_name TEXT NOT NULL REFERENCES media(name),
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('quiz_revision', 'result', 'game_run')),
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (media_name, resource_kind, resource_id, revision)
) STRICT;
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE TABLE migration_files (
  path TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('quiz', 'result', 'media')),
  resource_id TEXT NOT NULL
) STRICT;
`
