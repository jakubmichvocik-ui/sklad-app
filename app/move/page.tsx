"use client";

import BarcodeScanner from "@/components/BarcodeScanner";
import { supabase } from "@/lib/supabaseClient";
import { Location, Product, Warehouse } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type MoveType = "IN" | "OUT" | "TRANSFER";

export default function MovePage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [type, setType] = useState<MoveType>("IN");
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState<string>("");

  const [fromLoc, setFromLoc] = useState<string>("");
  const [toLoc, setToLoc] = useState<string>("");

  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState(""); // len IN

  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter((p) => (p.name + " " + p.sku + " " + (p.barcode ?? "")).toLowerCase().includes(q))
      .slice(0, 50);
  }, [products, query]);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setError("Nie si prihlásený. Choď na /login.");
        return;
      }

      const w = await supabase.from("warehouses").select("*").order("name");
      const l = await supabase.from("locations").select("*").order("code");
      const p = await supabase.from("products").select("*").order("name");

      if (w.error) return setError(w.error.message);
      if (l.error) return setError(l.error.message);
      if (p.error) return setError(p.error.message);

      setWarehouses((w.data as any) ?? []);
      setLocations((l.data as any) ?? []);
      setProducts((p.data as any) ?? []);

      // Default: pri IN nastav cieľ na Sklad / S-01 (ak existuje)
      const sklad = (w.data as any[])?.find((x) => x.name === "Sklad");
      const s01 = (l.data as any[])?.find((x) => x.code === "S-01" && x.warehouse_id === sklad?.id);
      if (s01) setToLoc(s01.id);
    })();
  }, []);

  useEffect(() => {
    setOk(null);
    setError(null);

    if (type === "IN") {
      setFromLoc("");
    } else if (type === "OUT") {
      setToLoc("");
      setUnitPrice("");
    } else {
      setUnitPrice("");
    }
  }, [type]);

  function onScanned(code: string) {
    setOk(null);
    setError(null);

    const clean = code.trim();
    setQuery(clean);

    // Najprv skús nájsť presnú zhodu EAN
    const found = products.find((p) => (p.barcode ?? "").trim() === clean);

    if (found) {
      setProductId(found.id);
      setOk(`Našiel som produkt: ${found.name}`);
      return;
    }

    // Ak nenájde, ponúkne len filtrovanie (user si vyberie)
    setError(`Nenašiel som produkt s EAN: ${clean}. Skontroluj, či má produkt vyplnené barcode (EAN).`);
  }

  async function submit() {
    setError(null);
    setOk(null);

    const pid = productId;
    if (!pid) return setError("Vyber produkt.");
    const q = Number(qty);
    if (!q || q <= 0) return setError("Množstvo musí byť > 0.");

    if (type === "IN" && !toLoc) return setError("Vyber cieľovú lokáciu.");
    if (type === "OUT" && !fromLoc) return setError("Vyber zdrojovú lokáciu.");
    if (type === "TRANSFER" && (!fromLoc || !toLoc)) return setError("Vyber zdroj aj cieľ.");
    if (type === "TRANSFER" && fromLoc === toLoc) return setError("Zdroj a cieľ nemôžu byť rovnaké.");

    const price = unitPrice.trim() === "" ? null : Number(unitPrice);
    if (type === "IN" && (price === null || Number.isNaN(price))) return setError("Pri príjme zadaj nákupnú cenu.");

    const whId =
      type === "IN"
        ? locById.get(toLoc)?.warehouse_id
        : type === "OUT"
        ? locById.get(fromLoc)?.warehouse_id
        : locById.get(toLoc)?.warehouse_id;

    // 1) create movement
    const mv = await supabase
      .from("movements")
      .insert({ type, warehouse_id: whId ?? null, note: null })
      .select("id")
      .single();

    if (mv.error) return setError(mv.error.message);
    const movementId = (mv.data as any).id as string;

    // 2) movement item
    const item = await supabase.from("movement_items").insert({
      movement_id: movementId,
      product_id: pid,
      from_location_id: fromLoc || null,
      to_location_id: toLoc || null,
      quantity: q,
      unit_price: price,
    });

    if (item.error) return setError(item.error.message);

    // 3) apply stock update (RPC)
    const rpc = await supabase.rpc("apply_movement", {
      p_type: type,
      p_product_id: pid,
      p_from_location: fromLoc || null,
      p_to_location: toLoc || null,
      p_qty: q,
      p_unit_price: price,
    });

    if (rpc.error) return setError(rpc.error.message);

    setOk("Uložené.");
    setQty("1");
    setUnitPrice("");
  }

  return (
    <main>
      <h1>Pohyb</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/products">Produkty</a>
        <a href="/login">Login</a>
        <a href="/">Domov</a>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {error && <div style={{ padding: 10, background: "#fee2e2" }}>{error}</div>}
      {ok && <div style={{ padding: 10, background: "#dcfce7" }}>{ok}</div>}

      <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
        <label>
          Typ pohybu
          <select value={type} onChange={(e) => setType(e.target.value as MoveType)} style={{ width: "100%", padding: 10 }}>
            <option value="IN">Príjem</option>
            <option value="OUT">Výdaj</option>
            <option value="TRANSFER">Presun</option>
          </select>
        </label>

        <h2 style={{ marginTop: 8 }}>Skenovanie (mobil)</h2>
        <BarcodeScanner onResult={onScanned} />

        <label>
          Produkt (hľadaj podľa názvu/SKU/EAN)
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="napr. magnet / SV-001 / 858..."
            style={{ width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Výber produktu
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ width: "100%", padding: 10 }}>
            <option value="">— vyber —</option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (SKU: {p.sku}){p.barcode ? ` • EAN: ${p.barcode}` : ""}
              </option>
            ))}
          </select>
        </label>

        {type !== "IN" && (
          <label>
            Z lokácie
            <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} style={{ width: "100%", padding: 10 }}>
              <option value="">— vyber —</option>
              {locations.map((l) => {
                const wh = warehouses.find((w) => w.id === l.warehouse_id)?.name ?? "";
                return (
                  <option key={l.id} value={l.id}>
                    {wh} / {l.code} {l.name ? `(${l.name})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {type !== "OUT" && (
          <label>
            Do lokácie
            <select value={toLoc} onChange={(e) => setToLoc(e.target.value)} style={{ width: "100%", padding: 10 }}>
              <option value="">— vyber —</option>
              {locations.map((l) => {
                const wh = warehouses.find((w) => w.id === l.warehouse_id)?.name ?? "";
                return (
                  <option key={l.id} value={l.id}>
                    {wh} / {l.code} {l.name ? `(${l.name})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <label>
          Množstvo (ks)
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setQty(String(Math.max(1, Number(qty || "1") - 1)))}
              style={{ padding: "10px 12px", minWidth: 44 }}
            >
              −
            </button>

            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              style={{ width: 140, padding: 10 }}
            />

            <button
              type="button"
              onClick={() => setQty(String(Number(qty || "0") + 1))}
              style={{ padding: "10px 12px", minWidth: 44 }}
            >
              +
            </button>

            <button type="button" onClick={() => setQty("1")} style={{ padding: "10px 12px" }}>
              1
            </button>
            <button type="button" onClick={() => setQty("5")} style={{ padding: "10px 12px" }}>
              5
            </button>
            <button type="button" onClick={() => setQty("10")} style={{ padding: "10px 12px" }}>
              10
            </button>
          </div>
        </label>

        {type === "IN" && (
          <label>
            Nákupná cena (EUR/ks)
            <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </label>
        )}

        <button onClick={submit} style={{ padding: "10px 12px", maxWidth: 240 }}>
          Uložiť pohyb
        </button>

        <p style={{ opacity: 0.75 }}>
          Tip: aby skenovanie našlo produkt, vyplň pri produkte pole <b>barcode (EAN)</b> v /products.
        </p>
      </div>
    </main>
  );
}