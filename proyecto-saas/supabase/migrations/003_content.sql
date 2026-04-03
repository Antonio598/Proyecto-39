-- Asset types
CREATE TYPE asset_type AS ENUM (
  'photo', 'video', 'audio', 'logo', 'template', 'brand_file', 'carousel_slide'
);

-- Post formats
CREATE TYPE post_format AS ENUM (
  'image', 'carousel', 'reel', 'story', 'short', 'long_video', 'text'
);

-- Post status workflow
CREATE TYPE post_status AS ENUM (
  'draft',
  'generating',
  'pending_approval',
  'approved',
  'rejected',
  'scheduled',
  'publishing',
  'published',
  'failed'
);

-- Content library (media assets)
CREATE TABLE public.content_library (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES public.users(id),
  asset_type    asset_type NOT NULL,
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,    -- Supabase Storage path
  public_url    TEXT NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  duration_sec  NUMERIC,          -- For video/audio
  width         INT,
  height        INT,
  tags          TEXT[] DEFAULT '{}',
  folder        TEXT DEFAULT '/',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated post content
CREATE TABLE public.generated_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES public.users(id),
  format        post_format NOT NULL,
  caption       TEXT,
  hashtags      TEXT[] DEFAULT '{}',
  media_urls    TEXT[] DEFAULT '{}',
  asset_ids     UUID[] DEFAULT '{}',
  platform_data JSONB DEFAULT '{}',  -- Platform-specific payload
  ai_prompt_id  UUID,
  ai_job_id     TEXT,               -- External AI job reference
  ai_provider   TEXT,               -- 'nano_banana' | 'kling' | 'manual'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled / published posts
CREATE TABLE public.scheduled_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  generated_post_id   UUID REFERENCES public.generated_posts(id),
  social_account_id   UUID NOT NULL REFERENCES public.social_accounts(id),
  status              post_status NOT NULL DEFAULT 'draft',
  publish_mode        TEXT NOT NULL DEFAULT 'approval',  -- 'auto' | 'approval'
  scheduled_at        TIMESTAMPTZ NOT NULL,
  published_at        TIMESTAMPTZ,
  platform_post_id    TEXT,                -- ID returned by social API
  rejection_reason    TEXT,
  approved_by         UUID REFERENCES public.users(id),
  approved_at         TIMESTAMPTZ,
  error_message       TEXT,
  retry_count         INT DEFAULT 0,
  rule_id             UUID,               -- Which automation rule triggered this
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_library_workspace" ON public.content_library
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "generated_posts_workspace" ON public.generated_posts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_posts_workspace" ON public.scheduled_posts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Clients: read-only on scheduled_posts
CREATE POLICY "scheduled_posts_client_read" ON public.scheduled_posts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role = 'client'
    )
  );
