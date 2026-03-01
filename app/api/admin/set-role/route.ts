import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function assertCallerIsAdmin(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  accessToken: string
) {
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
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    await assertCallerIsAdmin(supabaseAdmin, token);

    const { user_id, role_key } = (await req.json()) as {
      user_id: string;
      role_key: "admin" | "manager" | "clerk" | "viewer";
    };

    if (!user_id || !role_key) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { error: upErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id, role_key });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}