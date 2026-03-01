import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RoleKey = "admin" | "manager" | "clerk" | "viewer";
type Permissions = Partial<{
  can_view_stock: boolean;
  can_view_purchase_price: boolean;
  can_do_in: boolean;
  can_do_out: boolean;
  can_do_transfer: boolean;
  can_edit_products: boolean;
}>;

async function assertCallerIsAdmin(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) throw new Error("Unauthorized");

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role_key")
    .eq("user_id", userData.user.id)
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

    const body = (await req.json()) as {
      email: string;
      password: string;
      role_key: RoleKey;
      warehouse_ids?: string[];
      permissions?: Permissions;
    };

    const email = (body.email ?? "").trim();
    const password = (body.password ?? "").trim();
    const role_key = body.role_key;

    if (!email || !password || !role_key) {
      return NextResponse.json({ error: "Missing fields: email, password, role_key" }, { status: 400 });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !created.user) {
      return NextResponse.json({ error: createErr?.message ?? "Create user failed" }, { status: 400 });
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert({
      user_id: newUserId,
      role_key,
    });
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 400 });

    if (body.permissions && typeof body.permissions === "object") {
      const { error: permErr } = await supabaseAdmin
        .from("user_permissions")
        .upsert({ user_id: newUserId, ...body.permissions });
      if (permErr) return NextResponse.json({ error: permErr.message }, { status: 400 });
    }

    if (Array.isArray(body.warehouse_ids)) {
      const { error: delErr } = await supabaseAdmin
        .from("user_warehouse_access")
        .delete()
        .eq("user_id", newUserId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

      const ids = body.warehouse_ids.filter(Boolean);
      if (ids.length > 0) {
        const rows = ids.map((wid) => ({ user_id: newUserId, warehouse_id: wid }));
        const { error: insErr } = await supabaseAdmin.from("user_warehouse_access").insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

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

    return NextResponse.json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}