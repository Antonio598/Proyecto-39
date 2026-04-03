export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AiGenerationRequest {
  workspaceId: string;
  socialAccountId?: string;
  platform: string;
  format: string;
  promptText: string;
  tone?: string;
  language?: string;
  useHashtags?: boolean;
  useEmojis?: boolean;
  assetIds?: string[];
  brandContext?: string;
  customParams?: Record<string, unknown>;
}

export interface AiGenerationJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: {
    caption?: string;
    hashtags?: string[];
    mediaUrls?: string[];
    postId?: string;
  };
  error?: string;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface SocialPublishPayload {
  postId: string;
  socialAccountId: string;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
  format: string;
  platformData?: Record<string, unknown>;
}

export interface DashboardMetrics {
  totalPosts: number;
  publishedThisWeek: number;
  pendingApproval: number;
  connectedAccounts: number;
  totalFollowers: number;
  scheduledUpcoming: number;
}
