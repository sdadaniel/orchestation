-- schema.sql — Orchestration SQLite schema
-- Replaces file-based state (.orchestration/tasks, notices, signals, output)

-- Tasks table (replaces .orchestration/tasks/*.md frontmatter)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  display_id TEXT UNIQUE,
  display_number INTEGER UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  phase TEXT,                   -- fine-grained state (e.g. working, reviewing)
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

-- Task steps (per-task workflow instances: work/review/qa/etc)
CREATE TABLE IF NOT EXISTS task_steps (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_key TEXT NOT NULL,       -- stable key inside a task (e.g. "work", "review")
  step_type TEXT NOT NULL,      -- semantic type (e.g. "task", "review", "check")
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, done, failed, skipped
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER,
  inputs TEXT DEFAULT '{}',     -- JSON object
  outputs TEXT DEFAULT '{}',    -- JSON object
  started_at TEXT,
  finished_at TEXT,
  created TEXT DEFAULT (datetime('now','localtime')),
  updated TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Task events (status changes, signals, dispatches)
CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  step_id TEXT,                 -- nullable (task-level event if null)
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
  step_id TEXT,                 -- nullable (task-level token usage if null)
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
  step_id TEXT,                 -- nullable (task-level conversation if null)
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

-- Docs (replaces docs/**/*.md file scanning)
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,            -- 파일 경로 (예: architecture/packaging-guide.md)
  title TEXT,
  content TEXT,                   -- 마크다운 본문
  category TEXT,                  -- architecture, prd, plan, roles, report, errors, todo 등
  updated TEXT DEFAULT (datetime('now','localtime'))
);

-- Run history (replaces output/run-history.json)
CREATE TABLE IF NOT EXISTS run_history (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL,            -- completed, failed
  exit_code INTEGER,
  task_results TEXT DEFAULT '[]',  -- JSON array of {taskId, status}
  total_cost_usd REAL DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_display_id ON tasks(display_id);
CREATE INDEX IF NOT EXISTS idx_tasks_display_number ON tasks(display_number);
CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_step_id ON task_events(step_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_step_id ON token_usage(step_id);
CREATE INDEX IF NOT EXISTS idx_conversations_task_id ON conversations(task_id);
CREATE INDEX IF NOT EXISTS idx_conversations_step_id ON conversations(step_id);
CREATE INDEX IF NOT EXISTS idx_notices_notice_id ON notices(notice_id);
CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
