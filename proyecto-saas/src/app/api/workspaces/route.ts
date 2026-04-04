import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/utils/errors";

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

    // Ensure user row exists in public.users (trigger may not have run yet)
    await supabase.from("users").upsert({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
    }, { onConflict: "id" });

    // Generate unique slug from name
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    // Create workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), slug, created_by: user.id })
      .select()
      .single();

    if (wsError) throw wsError;

    // Add user as admin member
    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: workspace.id, user_id: user.id, role: "admin" });

    if (memberError) throw memberError;

    return NextResponse.json({ data: workspace }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[POST /api/workspaces]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
