"use client";
export const dynamic = "force-dynamic";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Warehouse = {
  id: string;
  name: string;
};

export default function WarehousesPage() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!supabase) return setErr("Chýba Supabase konfigurácia.");
    setErr(null);

    const { data, error } = await supabase
      .from("warehouses")
      .select("id,name")
      .order("name");

    if (error) return setErr(error.message);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createWarehouse() {
    if (!supabase) return setErr("Chýba Supabase konfigurácia.");
    setErr(null);
    setMsg(null);

    const n = name.trim();
    if (!n) return setErr("Zadaj názov skladu.");

    const { error } = await supabase.from("warehouses").insert({ name: n });
    if (error) return setErr(error.message);

    setMsg("Sklad vytvorený.");
    setName("");
    await load();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Sklady</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 520 }}>
        <h3>Vytvoriť sklad</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Názov skladu"
            style={{ padding: 10, flex: 1 }}
          />
          <button onClick={createWarehouse} style={{ padding: "10px 12px" }}>
            Vytvoriť
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Zoznam skladov</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        {items.map((w) => (
          <div key={w.id} style={{ padding: 10, background: "#f3f4f6", borderRadius: 10 }}>
            <strong>{w.name}</strong>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{w.id}</div>
          </div>
        ))}
      </div>
    </main>
  );
}