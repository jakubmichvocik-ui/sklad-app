"use client";

import TopBar from "@/components/TopBar";
import BarcodeScanner from "@/components/BarcodeScanner";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  product_id: string;
  name: string | null;
  ean: string | null;
  qty_ordered: number;
  qty_picked: number;
};

export default function PickerOrderPage({ params }: any) {
  const orderId = params.id as string;

  const [orderNo, setOrderNo] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("-");
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const pickedAll = useMemo(() => items.length > 0 && items.every(i => i.qty_picked >= i.qty_ordered), [items]);

  async function load() {
    setErr(null); setMsg(null);
    const { data: o, error: oErr } = await supabase.from("orders").select("order_no,status").eq("id", orderId).single();
    if (oErr) return setErr(oErr.message);
    setOrderNo((o as any).order_no);
    setStatus((o as any).status);

    const { data: it, error: iErr } = await supabase
      .from("order_items")
      .select("id,product_id,name,ean,qty_ordered,qty_picked")
      .eq("order_id", orderId)
      .order("name");
    if (iErr) return setErr(iErr.message);
    setItems((it as any) ?? []);
  }

  useEffect(() => { load(); }, []);

  function vibroOk() {
    try { navigator.vibrate?.(60); } catch {}
  }
  function beepOk() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 90);
    } catch {}
  }

  async function incItem(itemId: string, delta: number) {
    setErr(null); setMsg(null);
    const it = items.find(x => x.id === itemId);
    if (!it) return;

    const next = Math.max(0, (it.qty_picked ?? 0) + delta);
    const { error } = await supabase.from("order_items").update({ qty_picked: next }).eq("id", itemId);
    if (error) return setErr(error.message);

    // status order -> PICKING
    if (status === "CONFIRMED") {
      await supabase.from("orders").update({ status: "PICKING" }).eq("id", orderId);
      setStatus("PICKING");
    }

    await load();
  }

  async function onScan(code: string) {
    setErr(null); setMsg(null);

    const found = items.find(i => (i.ean ?? "").trim() === code.trim());
    if (!found) {
      setErr(`EAN ${code} nenájdený v objednávke.`);
      return;
    }

    await incItem(found.id, 1);
    vibroOk();
    beepOk();
    setMsg(`OK: ${found.name ?? ""} +1`);
  }

  async function markPicked() {
    setErr(null); setMsg(null);
    if (!pickedAll) return setErr("Nie sú vychystané všetky položky.");
    const { error } = await supabase.from("orders").update({ status: "PICKED" }).eq("id", orderId);
    if (error) return setErr(error.message);
    setStatus("PICKED");
    setMsg("Objednávka je PICKED.");
  }

  // Expedícia: zavoláme server endpoint, ktorý spraví OUT pohyb + status SHIPPED
  async function shipNow() {
    setErr(null); setMsg(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setErr("Nie si prihlásený.");

    const res = await fetch("/api/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: orderId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json?.error ?? "Ship failed");
    setMsg("Objednávka expedovaná (SHIPPED).");
    await load();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Picker #{orderNo ?? "…"}</h1>
      <div style={{ opacity: 0.8 }}>Status: <strong>{status}</strong></div>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <div style={{ marginTop: 12 }}>
        <BarcodeScanner onResult={onScan} />
      </div>

      <h3 style={{ marginTop: 16 }}>Položky</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map(i => (
          <div key={i.id} style={{ padding: 12, background: "#f3f4f6", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{i.name ?? "produkt"}</strong>
              <span style={{ opacity: 0.8 }}>{i.qty_picked}/{i.qty_ordered}</span>
            </div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>{i.ean ?? ""}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => incItem(i.id, -1)} style={{ padding: "10px 12px" }}>−</button>
              <button onClick={() => incItem(i.id, +1)} style={{ padding: "10px 12px" }}>+1</button>
              <button onClick={() => incItem(i.id, i.qty_ordered - i.qty_picked)} style={{ padding: "10px 12px" }}>
                Dopln na {i.qty_ordered}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button disabled={!pickedAll} onClick={markPicked} style={{ padding: "12px 14px" }}>
          Označiť ako PICKED
        </button>

        <button disabled={status !== "PICKED"} onClick={shipNow} style={{ padding: "12px 14px" }}>
          Expedovať (SHIPPED + OUT)
        </button>

        <a href={`/print/order/${orderId}`} style={{ padding: "12px 14px", background: "#e5e7eb", borderRadius: 10 }}>
          Tlač dodací list
        </a>
      </div>
    </main>
  );
}