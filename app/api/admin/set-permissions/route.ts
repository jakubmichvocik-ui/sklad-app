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

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role_key")
    .eq("user_id", data.user.id)
    .single();

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
      user_id: string;
      perms: {
        can_admin?: boolean;
        can_products?: boolean;
        can_warehouses?: boolean;
        can_stock?: boolean;
        can_move?: boolean;
        can_orders?: boolean;
        can_picker?: boolean;
        can_inventory?: boolean;
      };
    };

    if (!body?.user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    const row = {
      user_id: body.user_id,
      can_admin: !!body.perms?.can_admin,
      can_products: !!body.perms?.can_products,
      can_warehouses: !!body.perms?.can_warehouses,
      can_stock: !!body.perms?.can_stock,
      can_move: !!body.perms?.can_move,
      can_orders: !!body.perms?.can_orders,
      can_picker: !!body.perms?.can_picker,
      can_inventory: !!body.perms?.can_inventory,
    };

    const { error } = await supabaseAdmin.from("user_permissions").upsert(row, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}