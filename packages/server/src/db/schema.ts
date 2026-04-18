import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

    CREATE TABLE IF NOT EXISTS organization_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_type TEXT NOT NULL CHECK (template_type IN ('node', 'node+java', 'node+python')),
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'stopped')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'product')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
      preview_port INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS project_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      repo_url TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, repo_url)
    );

    CREATE TABLE IF NOT EXISTS user_claude_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'discussing' CHECK (status IN ('discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draft_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(draft_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS draft_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES draft_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT,
      message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'code', 'document_card', 'ai_command', 'system')),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES draft_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'agree' CHECK (type IN ('agree', 'disagree', 'suggest')),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_drafts_project_id ON drafts(project_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_draft_members_draft_id ON draft_members(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_members_user_id ON draft_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_messages_draft_id ON draft_messages(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_messages_parent_id ON draft_messages(parent_id);
    CREATE INDEX IF NOT EXISTS idx_message_confirmations_message_id ON message_confirmations(message_id);
  `);
}