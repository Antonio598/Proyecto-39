-- Automation / posting rules
CREATE TABLE public.posting_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  posts_per_day     INT,
  posts_per_week    INT,
  allowed_days      INT[] DEFAULT '{1,2,3,4,5}',   -- 0=Sun ... 6=Sat
  time_slots        JSONB DEFAULT '[]',              -- [{hour: 9, minute: 0}, ...]
  formats           post_format[] DEFAULT '{}',
  publish_mode      TEXT DEFAULT 'approval',         -- 'auto' | 'approval'
  ai_prompt_id      UUID REFERENCES public.ai_prompts(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- AI prompts / templates
CREATE TABLE public.ai_prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES public.users(id),
  name          TEXT NOT NULL,
  prompt_text   TEXT NOT NULL,
  platform      social_platform,
  format        post_format,
  tone          TEXT,              -- professional, casual, funny, inspirational, etc.
  language      TEXT DEFAULT 'es',
  use_hashtags  BOOLEAN DEFAULT TRUE,
  use_emojis    BOOLEAN DEFAULT TRUE,
  is_template   BOOLEAN DEFAULT FALSE,
  usage_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.posting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posting_rules_workspace" ON public.posting_rules
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_prompts_workspace" ON public.ai_prompts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
