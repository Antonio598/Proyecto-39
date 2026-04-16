-- Add ElevenLabs API key to brand_settings for voice generation
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS elevenlabs_key TEXT;
