"use client";
export const dynamic = "force-dynamic";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Warehouse = {
  id: string;
  name: string;
};

type LocationRow = {
  id: string;
  warehouse_id: string;
  code: string;
  label: string | null;
  x: number | null;
  y: number | null;
};

export default function LocationsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<LocationRow[]>([]);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadWarehouses() {
    if (!supabase) {
      setErr("Chýba Supabase konfigurácia.");
      return;
    }

    const { data, error } = await supabase
      .from("warehouses")
      .select("id,name")
      .order("name");

    if (error) {
      setErr(error.message);
      return;
    }

    const list = (data ?? []) as Warehouse[];
    setWarehouses(list);

    if (!warehouseId && list[0]) {
      setWarehouseId(list[0].id);
    }
  }

  async function loadLocations(whId: string) {
    if (!supabase) {
      setErr("Chýba Supabase konfigurácia.");
      return;
    }

    setErr(null);

    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("id,warehouse_id,code,label,x,y")
      .eq("warehouse_id", whId)
      .order("code");

    if (error) {
      setErr(error.message);
      return;
    }

    setItems((data ?? []) as LocationRow[]);
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (warehouseId) {
      loadLocations(warehouseId);
    }
  }, [warehouseId]);

  async function createLocation() {
    if (!supabase) {
      setErr("Chýba Supabase konfigurácia.");
      return;
    }

    setErr(null);
    setMsg(null);

    if (!warehouseId) {
      setErr("Vyber sklad.");
      return;
    }

    if (!code.trim()) {
      setErr("Zadaj kód lokácie.");
      return;
    }

    const xVal = x.trim() === "" ? null : Number(x);
    const yVal = y.trim() === "" ? null : Number(y);

    if (x.trim() !== "" && Number.isNaN(xVal)) {
      setErr("X musí byť číslo.");
      return;
    }

    if (y.trim() !== "" && Number.isNaN(yVal)) {
      setErr("Y musí byť číslo.");
      return;
    }

    const { error } = await supabase.from("warehouse_locations").insert({
      warehouse_id: warehouseId,
      code: code.trim(),
      label: label.trim() || null,
      x: xVal,
      y: yVal,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Lokácia vytvorená.");
    setCode("");
    setLabel("");
    setX("");
    setY("");

    await loadLocations(warehouseId);
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Lokácie skladu</h1>

      {err && (
        <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>
          {err}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>
          {msg}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "#f3f4f6",
          borderRadius: 12,
          maxWidth: 700,
        }}
      >
        <h3>Vytvoriť lokáciu</h3>

        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Sklad:
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={{ padding: 10, width: "100%", marginTop: 6 }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Kód lokácie, napr. A-01-01"
            style={{ padding: 10 }}
          />

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Popis, napr. Regál A / Polica 1"
            style={{ padding: 10 }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              value={x}
              onChange={(e) => setX(e.target.value)}
              placeholder="X pozícia (voliteľné)"
              style={{ padding: 10 }}
            />
            <input
              value={y}
              onChange={(e) => setY(e.target.value)}
              placeholder="Y pozícia (voliteľné)"
              style={{ padding: 10 }}
            />
          </div>

          <button
            onClick={createLocation}
            style={{ padding: "10px 12px", maxWidth: 220 }}
          >
            Vytvoriť lokáciu
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Zoznam lokácií</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
        {items.map((l) => (
          <div
            key={l.id}
            style={{ padding: 10, background: "#f3f4f6", borderRadius: 10 }}
          >
            <strong>{l.code}</strong>
            <div style={{ opacity: 0.8 }}>{l.label ?? "bez popisu"}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              x: {l.x ?? "—"} • y: {l.y ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}