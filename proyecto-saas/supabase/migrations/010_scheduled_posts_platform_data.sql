-- Add platform_data to scheduled_posts for storing per-post platform settings
-- e.g. { "facebook_page_id": "61575740184936", "facebook_page_name": "Baxico Supply" }
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS platform_data JSONB DEFAULT '{}';
