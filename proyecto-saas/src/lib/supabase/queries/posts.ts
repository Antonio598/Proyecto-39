import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduledPost, PostStatus } from "@/types/database";

export async function getScheduledPosts(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: {
    status?: PostStatus | PostStatus[];
    from?: string;
    to?: string;
    accountId?: string;
    limit?: number;
  }
): Promise<ScheduledPost[]> {
  let query = supabase
    .from("scheduled_posts")
    .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: true });

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in("status", options.status);
    } else {
      query = query.eq("status", options.status);
    }
  }

  if (options?.from) {
    query = query.gte("scheduled_at", options.from);
  }

  if (options?.to) {
    query = query.lte("scheduled_at", options.to);
  }

  if (options?.accountId) {
    query = query.eq("social_account_id", options.accountId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getPost(
  supabase: SupabaseClient,
  postId: string
): Promise<ScheduledPost | null> {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
    .eq("id", postId)
    .single();

  return data;
}

export async function updatePostStatus(
  supabase: SupabaseClient,
  postId: string,
  status: PostStatus,
  extra?: Partial<ScheduledPost>
): Promise<void> {
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", postId);

  if (error) throw error;
}

export async function getPendingApprovals(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ScheduledPost[]> {
  return getScheduledPosts(supabase, workspaceId, {
    status: "pending_approval",
  });
}

export async function getUpcomingPosts(
  supabase: SupabaseClient,
  workspaceId: string,
  limit = 5
): Promise<ScheduledPost[]> {
  return getScheduledPosts(supabase, workspaceId, {
    status: ["scheduled", "approved"],
    from: new Date().toISOString(),
    limit,
  });
}
