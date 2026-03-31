-- schema.sql — Orchestration SQLite schema
-- Replaces file-based state (.orchestration/tasks, notices, signals, output)

-- Tasks table (replaces .orchestration/tasks/*.md frontmatter)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  branch TEXT,
  worktree TEXT,
  role TEXT DEFAULT 'general',
  reviewer_role TEXT,
  scope TEXT DEFAULT '[]',      -- JSON array
  context TEXT DEFAULT '[]',    -- JSON array
  depends_on TEXT DEFAULT '[]', -- JSON array
  complexity TEXT,
  sort_order INTEGER DEFAULT 0,
  content TEXT,                 -- markdown body below frontmatter
  created TEXT DEFAULT (datetime('now','localtime')),
  updated TEXT DEFAULT (datetime('now','localtime'))
);

-- Task events (status changes, signals, dispatches)
CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,     -- status_change, dispatch, review_start, review_result, merge, signal
  from_status TEXT,
  to_status TEXT,
  detail TEXT,
  timestamp TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Token usage (replaces token-usage.log)
CREATE TABLE IF NOT EXISTS token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  phase TEXT NOT NULL,           -- task, review, model_selection
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  cache_create INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  turns INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Conversations (replaces *-conversation.jsonl)
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  phase TEXT NOT NULL,           -- task, review
  line_number INTEGER,
  type TEXT,                     -- system, assistant, user, result
  subtype TEXT,                  -- init, tool_use, thinking, text
  tool_name TEXT,
  content TEXT,                  -- full JSON line
  timestamp TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Notices (replaces .orchestration/notices/*.md)
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id TEXT UNIQUE,
  title TEXT,
  content TEXT,
  type TEXT DEFAULT 'info',     -- info, warning, error
  created TEXT DEFAULT (datetime('now','localtime'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_conversations_task_id ON conversations(task_id);
CREATE INDEX IF NOT EXISTS idx_notices_notice_id ON notices(notice_id);
