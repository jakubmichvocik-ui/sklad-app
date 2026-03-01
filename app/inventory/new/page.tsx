"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Warehouse = { id: string; name: string };

export default function NewInventoryPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("warehouses").select("id,name").order("name");
      if (!error) {
        setWarehouses((data as any) ?? []);
        if (data && (data as any[])[0]) setWarehouseId((data as any[])[0].id);
      }
    })();
  }, []);

  async function create() {
    setErr(null);
    if (!warehouseId) return setErr("Vyber sklad.");

    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("inventory_sessions")
      .insert({
        warehouse_id: warehouseId,
        note: note.trim() || null,
        created_by: auth.user?.id ?? null,
        status: "OPEN",
      })
      .select("id")
      .single();

    setBusy(false);

    if (error) return setErr(error.message);

    window.location.href = `/inventory/${(data as any).id}`;
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Nová inventúra</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}

      <div style={{ display: "grid", gap: 10, maxWidth: 520, marginTop: 12 }}>
        <label>
          Sklad:
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Poznámka (voliteľné):
          <input value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: 10, width: "100%" }} />
        </label>

        <button disabled={busy} onClick={create} style={{ padding: "12px 14px", maxWidth: 260 }}>
          {busy ? "Vytváram…" : "Vytvoriť inventúru"}
        </button>
      </div>
    </main>
  );
}