import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";
import { YouTubePublisher } from "@/lib/social/youtube/upload";
import { publishPost, type PostproxyPlatform } from "@/lib/postproxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const { postId } = await params;

    // Use admin client for publishing (needs full access to related tables)
    const supabase = createAdminClient();
    const userSupabase = await createClient();

    // Fetch the post with its related data
    const { data: post, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    }

    const account = post.social_account;
    if (!account) {
      return NextResponse.json({ error: "Cuenta de red social no encontrada" }, { status: 400 });
    }

    // Check that the post is in a publishable state
    const PUBLISHABLE = ["approved", "scheduled", "pending_approval", "failed"];
    if (!PUBLISHABLE.includes(post.status)) {
      return NextResponse.json(
        { error: `No se puede publicar un post con estado "${post.status}"` },
        { status: 400 }
      );
    }

    const now = new Date();
    const content = post.generated_post; // may be null

    // Mark as publishing
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing", updated_at: now.toISOString() })
      .eq("id", postId);

    try {
      let platformPostId: string | null = null;

      // Build caption — avoid sending empty string "" to platform APIs
      const rawCaption = [
        content?.caption ?? "",
        content?.hashtags?.join(" ") ?? "",
      ].filter(Boolean).join("\n\n");
      const caption = rawCaption.trim() || undefined;

      const mediaUrl = content?.media_urls?.[0] ?? null;

      const isPostproxyPlatform = ["facebook", "instagram", "linkedin", "tiktok"].includes(account.platform);

      if (isPostproxyPlatform) {
        const profileId = account.metadata?.postproxy_profile_id;
        if (!profileId) {
          throw new Error(`La cuenta de ${account.platform} no está correctamente vinculada con PostProxy.`);
        }
        if (!mediaUrl && account.platform === "instagram") {
          throw new Error("Instagram requiere media (imagen o video) para publicar");
        }
        if (!mediaUrl && !caption && account.platform === "facebook") {
          throw new Error("Facebook requiere media o caption para publicar");
        }

        const isVid = mediaUrl ? /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl) : false;

        const r = await publishPost({
          body: caption ?? "",
          profiles: [profileId],
          imageUrls: mediaUrl && !isVid ? (content?.media_urls?.length ? content.media_urls : [mediaUrl]) : undefined,
          videoUrl: mediaUrl && isVid ? mediaUrl : undefined,
        });
        
        platformPostId = r?.id ?? r?.post_id ?? r?.data?.id ?? `postproxy-${Date.now()}`;
      } else if (account.platform === "youtube") {
        if (!mediaUrl) {
          throw new Error("YouTube requiere un video para publicar");
        }
        const yt = new YouTubePublisher(account.access_token);
        const r = await yt.uploadVideoByUrl(mediaUrl, {
          title: content?.caption?.split("\n")[0]?.slice(0, 100) ?? "Video",
          description: caption ?? "",
          tags: content?.hashtags?.map((h: string) => h.replace("#", "")) ?? [],
          privacyStatus: "public",
        });
        platformPostId = r.id;
      } else {
        throw new Error(`Plataforma "${account.platform}" no soportada`);
      }

      // Mark as published
      await supabase
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: now.toISOString(),
          platform_post_id: platformPostId,
          updated_at: now.toISOString(),
        })
        .eq("id", postId);

      // Log activity
      await userSupabase.from("activity_logs").insert({
        workspace_id: workspaceId,
        user_id: session.user.id,
        action: "post.published",
        entity_type: "post",
        entity_id: postId,
        metadata: { platform: account.platform, platformPostId, manual: true },
      });

      return NextResponse.json({ success: true, platformPostId });
    } catch (publishError) {
      const errorMsg = publishError instanceof Error ? publishError.message : "Error desconocido";

      // Revert to approved so it can be retried
      await supabase
        .from("scheduled_posts")
        .update({
          status: "failed",
          error_message: errorMsg,
          retry_count: (post.retry_count ?? 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq("id", postId);

      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
