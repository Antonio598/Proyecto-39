-- Add linkedin and tiktok to the social_platform enum
-- These platforms were missing from the original enum, causing silent upsert failures during sync

ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'tiktok';
