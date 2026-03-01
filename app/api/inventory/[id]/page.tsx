"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import BarcodeScanner from "@/components/BarcodeScanner";

type Line = {
  product_id: string;
  expected_qty: number;
  counted_qty: number;
  name: string;
  ean: string | null;
};

export default function InventorySessionPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [status, setStatus] = useState<string>("OPEN");

  const [ean, setEan] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...lines].sort((a, b) => (b.counted_qty - b.expected_qty) - (a.counted_qty - a.expected_qty));
  }, [lines]);

  async function load() {
    setErr(null);
    setMsg(null);

    const { data: sess, error: sErr } = await supabase
      .from("inventory_sessions")
      .select("warehouse_id,status")
      .eq("id", sessionId)
      .single();

    if (sErr) return setErr(sErr.message);
    setWarehouseId((sess as any).warehouse_id);
    setStatus((sess as any).status);

    const { data, error } = await supabase
      .from("inventory_lines_view")
      .select("*")
      .eq("session_id", sessionId);

    // Ak nemáš view, použijeme join nižšie (viď poznámka)
    if (error) {
      // fallback join bez view:
      const { data: raw, error: e2 } = await supabase
        .from("inventory_lines")
        .select("product_id,expected_qty,counted_qty, products(name,ean)")
        .eq("session_id", sessionId);

      if (e2) return setErr(e2.message);

      const mapped = (raw as any[]).map((r) => ({
        product_id: r.product_id,
        expected_qty: Number(r.expected_qty ?? 0),
        counted_qty: Number(r.counted_qty ?? 0),
        name: r.products?.name ?? "(unknown)",
        ean: r.products?.ean ?? null,
      }));

      setLines(mapped);
      return;
    }

    setLines((data as any) ?? []);
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  function beepOk() {
    try {
      navigator.vibrate?.(60);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.12;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 90);
    } catch {}
  }

  async function ensureLineByEan(scannedEan: string) {
    setErr(null);
    setMsg(null);

    if (!warehouseId) return setErr("Neviem sklad (warehouse_id).");
    const eanClean = scannedEan.trim();
    if (!eanClean) return;

    // produkt podľa EAN
    const { data: prod, error: pErr } = await supabase
      .from("products")
      .select("id,name,ean")
      .eq("ean", eanClean)
      .single();

    if (pErr || !prod) return setErr("Produkt s týmto EAN neexistuje.");

    // expected_qty zo skladu (uprav podľa tvojej tabuľky - tu predpokladám 'stock' tabuľku)
    const { data: st, error: stErr } = await supabase
      .from("stock")
      .select("qty")
      .eq("warehouse_id", warehouseId)
      .eq("product_id", (prod as any).id)
      .single();

    const expected = stErr ? 0 : Number((st as any)?.qty ?? 0);

    // upsert line
    const { error: upErr } = await supabase
      .from("inventory_lines")
      .upsert({
        session_id: sessionId,
        product_id: (prod as any).id,
        expected_qty: expected,
        counted_qty: 1, // prvý scan dá 1
      }, { onConflict: "session_id,product_id" });

    if (upErr) return setErr(upErr.message);

    beepOk();
    setMsg(`${(prod as any).name} pridané do inventúry.`);
    setEan("");
    await load();
  }

  async function setCount(product_id: string, newCount: number) {
    setErr(null);
    const val = Math.max(0, Number.isFinite(newCount) ? newCount : 0);

    const { error } = await supabase
      .from("inventory_lines")
      .update({ counted_qty: val })
      .eq("session_id", sessionId)
      .eq("product_id", product_id);

    if (error) return setErr(error.message);
    await load();
  }

  async function closeSession() {
    setErr(null);
    setMsg(null);

    const { error } = await supabase
      .from("inventory_sessions")
      .update({ status: "CLOSED", closed_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) return setErr(error.message);
    setMsg("Inventúra uzavretá.");
    await load();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <h1>Inventúra</h1>
        <div style={{ padding: "6px 10px", background: "#f3f4f6", borderRadius: 10 }}>
          <strong>Status:</strong> {status}
        </div>
      </div>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12 }}>
        <h3>Sken / EAN</h3>
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="Zadaj EAN ručne" style={{ padding: 10 }} />
          <button onClick={() => ensureLineByEan(ean)} style={{ padding: "10px 12px", maxWidth: 220 }}>
            Pridať / aktualizovať
          </button>

          <details>
            <summary>Skenovať kamerou (mobil)</summary>
            <div style={{ marginTop: 10 }}>
              <BarcodeScanner onResult={(txt) => ensureLineByEan(txt)} />
            </div>
          </details>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Položky</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {sorted.map((l) => {
          const diff = l.counted_qty - l.expected_qty;
          return (
            <div key={l.product_id} style={{ padding: 12, background: "#f3f4f6", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{l.name}</strong>
                <span style={{ opacity: 0.75 }}>{l.ean ?? ""}</span>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span>očak.: <strong>{l.expected_qty}</strong></span>
                <span>napoč.: <strong>{l.counted_qty}</strong></span>
                <span>rozdiel: <strong>{diff > 0 ? `+${diff}` : diff}</strong></span>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setCount(l.product_id, l.counted_qty - 1)}>-</button>
                  <button onClick={() => setCount(l.product_id, l.counted_qty + 1)}>+</button>
                  <input
                    type="number"
                    value={l.counted_qty}
                    onChange={(e) => setCount(l.product_id, Number(e.target.value))}
                    style={{ padding: 8, width: 110 }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {status === "OPEN" && (
        <button onClick={closeSession} style={{ marginTop: 16, padding: "12px 14px", maxWidth: 260 }}>
          Uzavrieť inventúru
        </button>
      )}
    </main>
  );
}