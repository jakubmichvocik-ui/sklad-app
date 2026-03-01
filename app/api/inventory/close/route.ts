import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function assertCallerCanCloseInventory(
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

  // jednoduché pravidlo: admin alebo manager
  if (!roleRow || !["admin", "manager"].includes(roleRow.role_key)) throw new Error("Forbidden");
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    await assertCallerCanCloseInventory(supabaseAdmin, token);

    const { session_id } = (await req.json()) as { session_id: string };
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    // load session
    const { data: sess, error: sErr } = await supabaseAdmin
      .from("inventory_sessions")
      .select("id, warehouse_id, status")
      .eq("id", session_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if ((sess as any).status !== "OPEN") {
      return NextResponse.json({ error: "Session is not OPEN." }, { status: 400 });
    }

    const warehouse_id = (sess as any).warehouse_id as string;

    // load lines
    const { data: lines, error: lErr } = await supabaseAdmin
      .from("inventory_lines")
      .select("product_id, expected_qty, counted_qty")
      .eq("session_id", session_id);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });

    const safeLines = (lines ?? []) as any[];

    // 1) audit log (optional)
    if (safeLines.length > 0) {
      const adjRows = safeLines.map((l) => ({
        session_id,
        warehouse_id,
        product_id: l.product_id,
        expected_qty: Number(l.expected_qty ?? 0),
        counted_qty: Number(l.counted_qty ?? 0),
        diff_qty: Number(l.counted_qty ?? 0) - Number(l.expected_qty ?? 0),
      }));

      // audit je voliteľný: ak tabuľka neexistuje alebo insert zlyhá, ignorujeme
      const { error: adjErr } = await supabaseAdmin.from("inventory_adjustments").insert(adjRows);
      // ignore adjErr
      void adjErr;
    }

    // 2) dorovnanie skladu: stock.qty = counted_qty
    const stockUpserts = safeLines.map((l) => ({
      warehouse_id,
      product_id: l.product_id,
      qty: Number(l.counted_qty ?? 0),
    }));

    if (stockUpserts.length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from("stock")
        .upsert(stockUpserts, { onConflict: "warehouse_id,product_id" });

      if (upErr) {
        return NextResponse.json(
          {
            error:
              "Stock update failed. Skontroluj, či existuje tabuľka stock(warehouse_id, product_id, qty) a unique constraint.",
            details: upErr.message,
          },
          { status: 400 }
        );
      }
    }

    // 3) close session
    const { error: cErr } = await supabaseAdmin
      .from("inventory_sessions")
      .update({ status: "CLOSED", closed_at: new Date().toISOString() })
      .eq("id", session_id);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, closed: true, lines: stockUpserts.length });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}