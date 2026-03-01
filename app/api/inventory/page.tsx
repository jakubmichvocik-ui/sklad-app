"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Warehouse = { id: string; name: string };
type Session = {
  id: string;
  warehouse_id: string;
  status: string;
  note: string | null;
  created_at: string;
  closed_at: string | null;
};

export default function InventoryHome() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [whId, setWhId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data: wh } = await supabase.from("warehouses").select("id,name").order("name");
    setWarehouses((wh as any) ?? []);
    if (wh && wh[0]) setWhId((wh[0] as any).id);

    const { data: s, error } = await supabase
      .from("inventory_sessions")
      .select("id,warehouse_id,status,note,created_at,closed_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) setErr(error.message);
    setSessions((s as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSession() {
    setErr(null);
    setMsg(null);
    if (!whId) return setErr("Vyber sklad.");

    const { data: auth } = await supabase.auth.getUser();
    const created_by = auth.user?.id ?? null;

    const { data, error } = await supabase
      .from("inventory_sessions")
      .insert({ warehouse_id: whId, note: note.trim() || null, created_by })
      .select("id")
      .single();

    if (error) return setErr(error.message);

    setMsg("Inventúra vytvorená.");
    setNote("");
    window.location.href = `/inventory/${(data as any).id}`;
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Inventúra</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 640 }}>
        <h3>Nová inventúra</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <select value={whId} onChange={(e) => setWhId(e.target.value)} style={{ padding: 10 }}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Poznámka (voliteľné)"
            style={{ padding: 10 }}
          />
          <button onClick={createSession} style={{ padding: "10px 12px", maxWidth: 240 }}>
            Vytvoriť inventúru
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Posledné inventúry</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {sessions.map((s) => (
          <a
            key={s.id}
            href={`/inventory/${s.id}`}
            style={{ padding: 12, background: "#f3f4f6", borderRadius: 12, textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{s.status}</strong>
              <span style={{ opacity: 0.7 }}>{new Date(s.created_at).toLocaleString()}</span>
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>warehouse_id: {s.warehouse_id}</div>
            {s.note && <div style={{ marginTop: 6 }}>{s.note}</div>}
          </a>
        ))}
      </div>
    </main>
  );
}