import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function assertAuth(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const _userId = await assertAuth(supabaseAdmin, token);

    const { order_id } = await req.json();
    if (!order_id) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

    // load order + items
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id,status,warehouse_id")
      .eq("id", order_id)
      .single();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });

    if (order.status !== "PICKED") {
      return NextResponse.json({ error: "Order must be PICKED to ship." }, { status: 400 });
    }

    const { data: items, error: iErr } = await supabaseAdmin
      .from("order_items")
      .select("product_id,qty_ordered,qty_picked")
      .eq("order_id", order_id);
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });

    // OPTIONAL: tu neskôr spravíme reálne odpočítanie zo stock + zapis do moves
    // MVP: len označíme SHIPPED
    // (Keď mi pošleš názov tabuľky pohybov / stock schému, doplním to presne.)
    const { error: sErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "SHIPPED", shipped_at: new Date().toISOString() })
      .eq("id", order_id);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, shipped: true, items_count: items?.length ?? 0 });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}