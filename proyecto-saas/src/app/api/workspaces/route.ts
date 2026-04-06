import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProfileGroup } from "@/lib/postproxy";


export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Ensure user row exists in public.users (trigger may not have run yet)
    await admin.from("users").upsert({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
    }, { onConflict: "id" });

    // Generate unique slug from name
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    // Create Postproxy profile group for this workspace
    let postproxyGroupId: string | null = null;
    try {
      const group = await createProfileGroup(name.trim());
      postproxyGroupId = group.id;
    } catch { /* non-fatal — workspace still created */ }

    // Create workspace (admin bypasses RLS)
    const { data: workspace, error: wsError } = await admin
      .from("workspaces")
      .insert({ name: name.trim(), slug, created_by: user.id, postproxy_group_id: postproxyGroupId })
      .select()
      .single();

    if (wsError) throw wsError;

    // Add user as admin member (upsert to avoid duplicate on retry)
    const { error: memberError } = await admin
      .from("workspace_members")
      .upsert({ workspace_id: workspace.id, user_id: user.id, role: "admin" }, { onConflict: "workspace_id,user_id" });

    if (memberError) throw memberError;

    return NextResponse.json({ data: workspace }, { status: 201 });
  } catch (error) {
    const e = error as { message?: string; code?: string; details?: string };
    return NextResponse.json(
      { error: e?.message ?? "unknown", code: e?.code, details: e?.details },
      { status: 500 }
    );
  }
}
