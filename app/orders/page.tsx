"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  order_no: number;
  status: string;
  created_at: string;
  shipped_at: string | null;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,order_no,status,created_at,shipped_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <h1>Objednávky</h1>
        <a href="/orders/new" style={{ padding: "10px 12px", background: "#e5e7eb", borderRadius: 10 }}>+ Nová objednávka</a>
      </div>

      {loading ? <p>Načítavam…</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(r => (
            <a key={r.id} href={`/picker/${r.id}`} style={{ padding: 12, background: "#f3f4f6", borderRadius: 10, textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>#{r.order_no}</strong>
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                status: <strong>{r.status}</strong>{r.shipped_at ? ` • shipped: ${new Date(r.shipped_at).toLocaleString()}` : ""}
              </div>
              <div style={{ marginTop: 6, opacity: 0.7 }}>Klik = otvorí vychystanie (picker)</div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}