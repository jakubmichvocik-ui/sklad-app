"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Warehouse = { id: string; name: string };
type Location = {
  id: string;
  warehouse_id: string;
  code: string;
  label: string | null;
  x: number | null;
  y: number | null;
};
type ProductAtLoc = {
  id: string;
  products: { id: string; name: string; ean: string | null } | null;
};

export default function WarehouseMapPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [locs, setLocs] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(null);
  const [items, setItems] = useState<ProductAtLoc[]>([]);

  const [err, setErr] = useState<string | null>(null);

  // rozmery mapy (môžeš neskôr meniť podľa skladu)
  const GRID_W = 10; // stĺpce
  const GRID_H = 8;  // riadky

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("warehouses").select("id,name").order("name");
      const list = (data as any[]) ?? [];
      setWarehouses(list);
      if (list[0]) setWarehouseId(list[0].id);
    })();
  }, []);

  async function loadLocations(whId: string) {
    setErr(null);
    setSelectedLoc(null);
    setItems([]);

    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("id,warehouse_id,code,label,x,y")
      .eq("warehouse_id", whId);

    if (error) return setErr(error.message);
    setLocs((data as any) ?? []);
  }

  useEffect(() => {
    if (warehouseId) loadLocations(warehouseId);
  }, [warehouseId]);

  const locByXY = useMemo(() => {
    const map = new Map<string, Location>();
    for (const l of locs) {
      if (l.x == null || l.y == null) continue;
      map.set(`${l.x},${l.y}`, l);
    }
    return map;
  }, [locs]);

  async function openLocation(loc: Location) {
    setSelectedLoc(loc);
    setErr(null);

    const { data, error } = await supabase
      .from("product_locations")
      .select("id, products(id,name,ean)")
      .eq("warehouse_id", warehouseId)
      .eq("location_id", loc.id)
      .order("created_at", { ascending: false });

    if (error) return setErr(error.message);
    setItems((data as any) ?? []);
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Mapa skladu</h1>

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

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Klikni na bunku. Bunky bez lokácie sú prázdne (najprv si lokácie nadefinujeme).
        </div>
      </div>

      {/* GRID */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_W}, 1fr)`,
          gap: 8,
          maxWidth: 900,
        }}
      >
        {Array.from({ length: GRID_W * GRID_H }).map((_, idx) => {
          const x = idx % GRID_W;
          const y = Math.floor(idx / GRID_W);
          const loc = locByXY.get(`${x},${y}`);
          const active = selectedLoc?.id === loc?.id;

          return (
            <button
              key={`${x}-${y}`}
              onClick={() => (loc ? openLocation(loc) : undefined)}
              style={{
                aspectRatio: "1/1",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: loc ? (active ? "#111827" : "#f3f4f6") : "#fff",
                color: loc ? (active ? "white" : "black") : "#9ca3af",
                cursor: loc ? "pointer" : "default",
                padding: 8,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
              title={loc ? loc.code : `(${x},${y}) bez lokácie`}
            >
              <div style={{ fontWeight: 800, fontSize: 12 }}>{loc ? loc.code : "—"}</div>
              <div style={{ opacity: 0.75, fontSize: 11 }}>{loc?.label ?? ""}</div>
              <div style={{ opacity: 0.5, fontSize: 11 }}>
                {x},{y}
              </div>
            </button>
          );
        })}
      </div>

      {/* RIGHT PANEL */}
      {selectedLoc && (
        <div style={{ marginTop: 16, padding: 12, background: "#f3f4f6", borderRadius: 14, maxWidth: 900 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Lokácia: {selectedLoc.code}</h2>
            <span style={{ opacity: 0.7 }}>{selectedLoc.label ?? ""}</span>
          </div>

          <h3 style={{ marginTop: 12 }}>Produkty na lokácii</h3>
          {items.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Zatiaľ nič.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {items.map((r) => (
                <div key={r.id} style={{ padding: 10, background: "white", borderRadius: 12 }}>
                  <strong>{r.products?.name ?? "(unknown)"}</strong>
                  <div style={{ opacity: 0.7 }}>{r.products?.ean ?? ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}