-- Social platform enum
CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'youtube');

-- Social accounts connected to workspaces
CREATE TABLE public.social_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform          social_platform NOT NULL,
  platform_user_id  TEXT NOT NULL,           -- Instagram user ID / Page ID / Channel ID
  account_name      TEXT NOT NULL,
  account_handle    TEXT,
  avatar_url        TEXT,
  access_token      TEXT NOT NULL,            -- Encrypted with pgcrypto
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[] DEFAULT '{}',
  is_active         BOOLEAN DEFAULT TRUE,
  auto_publish      BOOLEAN DEFAULT FALSE,    -- Automation on/off toggle
  last_synced_at    TIMESTAMPTZ,
  followers_count   BIGINT DEFAULT 0,
  metadata          JSONB DEFAULT '{}',       -- Extra: page_id, channel_data, etc.
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, platform, platform_user_id)
);

-- RLS
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_workspace" ON public.social_accounts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Clients can only read
CREATE POLICY "social_accounts_client_read" ON public.social_accounts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role = 'client'
    )
  );
