-- Add API key columns directly to brand_settings (stored server-side only, never returned to frontend)
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS openai_key      TEXT,
  ADD COLUMN IF NOT EXISTS nano_banana_key TEXT,
  ADD COLUMN IF NOT EXISTS kling_key       TEXT;

-- Add ai_settings to posting_rules so each rule can specify tone, language, etc.
ALTER TABLE public.posting_rules
  ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}';

-- Add metadata to workspaces (needed for postproxy_group_id and other misc data)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
