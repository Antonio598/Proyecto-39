import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialAccount, SocialPlatform } from "@/types/database";

export async function listSocialAccounts(
  supabase: SupabaseClient,
  workspaceId: string,
  platform?: SocialPlatform
): Promise<SocialAccount[]> {
  let query = supabase
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getSocialAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<SocialAccount | null> {
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  return data;
}

export async function upsertSocialAccount(
  supabase: SupabaseClient,
  account: Omit<SocialAccount, "id" | "created_at" | "updated_at">
): Promise<SocialAccount> {
  const { data, error } = await supabase
    .from("social_accounts")
    .upsert(account, {
      onConflict: "workspace_id,platform,platform_user_id",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleAccountActive(
  supabase: SupabaseClient,
  accountId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("social_accounts")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", accountId);

  if (error) throw error;
}
