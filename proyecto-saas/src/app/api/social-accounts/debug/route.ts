import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.POSTPROXY_API_KEY;

    // 1. Fetch all profile groups
    const groupsRes = await fetch("https://api.postproxy.dev/api/profile_groups", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const groupsJson = await groupsRes.json();

    // 2. Fetch all profiles (no filter)
    const profilesRes = await fetch("https://api.postproxy.dev/api/profiles", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const profilesJson = await profilesRes.json();

    return NextResponse.json({
      hasKey: !!key,
      keyPrefix: key?.slice(0, 8),
      groups: { status: groupsRes.status, data: groupsJson },
      profiles: { status: profilesRes.status, data: profilesJson },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
