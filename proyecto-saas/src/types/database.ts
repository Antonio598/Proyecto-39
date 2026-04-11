export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "admin" | "editor" | "client" | "team_member";
export type SocialPlatform = "instagram" | "facebook" | "youtube" | "linkedin" | "tiktok";
export type AssetType =
  | "photo"
  | "video"
  | "audio"
  | "logo"
  | "template"
  | "brand_file"
  | "carousel_slide";
export type PostFormat =
  | "image"
  | "carousel"
  | "reel"
  | "story"
  | "short"
  | "long_video"
  | "text";
export type PostStatus =
  | "draft"
  | "generating"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  plan: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  user?: User;
}

export interface SocialAccount {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  platform_user_id: string;
  account_name: string;
  account_handle: string | null;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  is_active: boolean;
  auto_publish: boolean;
  last_synced_at: string | null;
  followers_count: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ContentAsset {
  id: string;
  workspace_id: string;
  uploaded_by: string | null;
  asset_type: AssetType;
  file_name: string;
  storage_path: string;
  public_url: string;
  file_size: number | null;
  mime_type: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  folder: string;
  metadata: Json;
  created_at: string;
}

export interface GeneratedPost {
  id: string;
  workspace_id: string;
  created_by: string | null;
  format: PostFormat;
  caption: string | null;
  hashtags: string[];
  media_urls: string[];
  asset_ids: string[];
  platform_data: Json;
  ai_prompt_id: string | null;
  ai_job_id: string | null;
  ai_provider: string | null;
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  workspace_id: string;
  generated_post_id: string | null;
  social_account_id: string;
  status: PostStatus;
  publish_mode: "auto" | "approval";
  scheduled_at: string;
  published_at: string | null;
  platform_post_id: string | null;
  platform_data: Json;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  error_message: string | null;
  retry_count: number;
  rule_id: string | null;
  created_at: string;
  updated_at: string;
  generated_post?: GeneratedPost;
  social_account?: SocialAccount;
}

export interface PostingRule {
  id: string;
  workspace_id: string;
  social_account_id: string;
  name: string;
  is_active: boolean;
  posts_per_day: number | null;
  posts_per_week: number | null;
  allowed_days: number[];
  time_slots: Json;
  formats: PostFormat[];
  publish_mode: "auto" | "approval";
  ai_prompt_id: string | null;
  created_at: string;
  updated_at: string;
  social_account?: SocialAccount;
}

export interface AiPrompt {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  prompt_text: string;
  platform: SocialPlatform | null;
  format: PostFormat | null;
  tone: string | null;
  language: string;
  use_hashtags: boolean;
  use_emojis: boolean;
  is_template: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandSettings {
  id: string;
  workspace_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  font_primary: string | null;
  font_secondary: string | null;
  logo_url: string | null;
  tone_of_voice: string | null;
  niche: string | null;
  guidelines: string | null;
  ai_context: string | null;
  hashtag_groups: Json;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
  user?: User;
}
