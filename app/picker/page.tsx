"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type OrderRow = { id: string; order_no: number; status: string; created_at: string };

export default function PickerList() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,order_no,status,created_at")
      .in("status", ["CONFIRMED", "PICKING", "PICKED"])
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Picker</h1>
      {loading ? <p>Načítavam…</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(r => (
            <a key={r.id} href={`/picker/${r.id}`} style={{ padding: 12, background: "#f3f4f6", borderRadius: 10, textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>#{r.order_no}</strong>
                <span style={{ opacity: 0.8 }}>{r.status}</span>
              </div>
              <div style={{ opacity: 0.7 }}>{new Date(r.created_at).toLocaleString()}</div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}