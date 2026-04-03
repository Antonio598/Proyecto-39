-- Brand settings per workspace
CREATE TABLE public.brand_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  font_primary    TEXT DEFAULT 'Inter',
  font_secondary  TEXT,
  logo_url        TEXT,
  tone_of_voice   TEXT,
  niche           TEXT,
  guidelines      TEXT,
  ai_context      TEXT,   -- Injected into every AI prompt for this workspace
  hashtag_groups  JSONB DEFAULT '[]',  -- [{name: "general", tags: ["#brand"]}]
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs
CREATE TABLE public.activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id),
  action        TEXT NOT NULL,        -- 'post.published', 'account.connected', etc.
  entity_type   TEXT,                 -- 'post', 'account', 'rule', etc.
  entity_id     UUID,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_settings_workspace" ON public.brand_settings
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "activity_logs_workspace" ON public.activity_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only system (service_role) can insert logs
CREATE POLICY "activity_logs_service_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (TRUE);

-- Indexes for performance
CREATE INDEX idx_scheduled_posts_workspace_status ON public.scheduled_posts(workspace_id, status);
CREATE INDEX idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX idx_scheduled_posts_account ON public.scheduled_posts(social_account_id);
CREATE INDEX idx_content_library_workspace ON public.content_library(workspace_id);
CREATE INDEX idx_activity_logs_workspace ON public.activity_logs(workspace_id, created_at DESC);
CREATE INDEX idx_social_accounts_workspace ON public.social_accounts(workspace_id);
CREATE INDEX idx_posting_rules_account ON public.posting_rules(social_account_id);
