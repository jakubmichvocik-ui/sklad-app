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

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    await assertCallerIsAdmin(token);

    const { email, password, role_key } = (await req.json()) as {
      email: string;
      password: string;
      role_key: "admin" | "manager" | "clerk" | "viewer";
    };

    if (!email || !password || !role_key) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // createUser = server-side Admin API (needs service_role) :contentReference[oaicite:1]{index=1}
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Create user failed" }, { status: 400 });
    }

    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert({
      user_id: data.user.id,
      role_key,
    });

    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, user_id: data.user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}