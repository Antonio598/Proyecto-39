-- Add Postproxy profile group ID to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS postproxy_group_id TEXT;
