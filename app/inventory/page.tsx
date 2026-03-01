"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Session = {
  id: string;
  warehouse_id: string;
  status: string;
  note: string | null;
  created_at: string;
  closed_at: string | null;
};

export default function InventoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("inventory_sessions")
      .select("id,warehouse_id,status,note,created_at,closed_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return setErr(error.message);
    setSessions((data as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Inventúra</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}

      <a
        href="/inventory/new"
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "10px 14px",
          background: "#111827",
          color: "white",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        + Nová inventúra
      </a>

      <h2 style={{ marginTop: 18 }}>Posledné inventúry</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {sessions.map((s) => (
          <a
            key={s.id}
            href={`/inventory/${s.id}`}
            style={{
              padding: 12,
              background: "#f3f4f6",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{s.status}</strong>
              <span style={{ opacity: 0.75 }}>{new Date(s.created_at).toLocaleString()}</span>
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>warehouse_id: {s.warehouse_id}</div>
            {s.note && <div style={{ marginTop: 6 }}>{s.note}</div>}
          </a>
        ))}
      </div>
    </main>
  );
}