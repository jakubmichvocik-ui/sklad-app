import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function assertCallerIsAdmin(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role_key")
    .eq("user_id", data.user.id)
    .single();

  if (roleErr) throw new Error("Role check failed");
  if (roleRow?.role_key !== "admin") throw new Error("Forbidden");
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    await assertCallerIsAdmin(token);

    // list users (admin API)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200, page: 1 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // roles
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role_key");

    if (rolesErr) return NextResponse.json({ error: rolesErr.message }, { status: 400 });

    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role_key]));

    const users = (data.users ?? []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: roleMap.get(u.id) ?? "viewer",
    }));

    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}