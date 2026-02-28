"use client";

import BarcodeScanner from "@/components/BarcodeScanner";
import { supabase } from "@/lib/supabaseClient";
import { Location, Product, Warehouse } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type MoveType = "IN" | "OUT" | "TRANSFER";

const LS_LAST_FROM = "sklad:lastFromLoc";
const LS_LAST_TO = "sklad:lastToLoc";
const LS_LAST_TYPE = "sklad:lastMoveType";

function safeVibrate(ms = 50) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // @ts-ignore
      navigator.vibrate(ms);
    }
  } catch {}
}

function beep(freq = 880, durationMs = 80) {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);

    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    o.start();
    o.stop(ctx.currentTime + durationMs / 1000 + 0.02);

    o.onended = () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch {}
}

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

  // Načítanie dát
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

      // Default: pri IN nastav cieľ na Sklad / S-01
      const sklad = (w.data as any[])?.find((x) => x.name === "Sklad");
      const s01 = (l.data as any[])?.find((x) => x.code === "S-01" && x.warehouse_id === sklad?.id);
      if (s01) setToLoc(s01.id);

      // Restore last type/locs
      try {
        const lastType = (localStorage.getItem(LS_LAST_TYPE) as MoveType | null) ?? null;
        if (lastType === "IN" || lastType === "OUT" || lastType === "TRANSFER") {
          setType(lastType);
        }

        const lastFrom = localStorage.getItem(LS_LAST_FROM) ?? "";
        const lastTo = localStorage.getItem(LS_LAST_TO) ?? "";

        // nastav len ak existujú v locations
        const locIds = new Set(((l.data as any[]) ?? []).map((x) => x.id));
        if (lastFrom && locIds.has(lastFrom)) setFromLoc(lastFrom);
        if (lastTo && locIds.has(lastTo)) setToLoc(lastTo);
      } catch {}
    })();
  }, []);

  // Pri zmene typu: automaticky predvyplň posledné lokácie
  useEffect(() => {
    setOk(null);
    setError(null);

    try {
      localStorage.setItem(LS_LAST_TYPE, type);
      const lastFrom = localStorage.getItem(LS_LAST_FROM) ?? "";
      const lastTo = localStorage.getItem(LS_LAST_TO) ?? "";

      const locIds = new Set(locations.map((x) => x.id));

      if (type === "IN") {
        setFromLoc("");
        if (lastTo && locIds.has(lastTo)) setToLoc(lastTo);
      } else if (type === "OUT") {
        setToLoc("");
        setUnitPrice("");
        if (lastFrom && locIds.has(lastFrom)) setFromLoc(lastFrom);
      } else {
        // TRANSFER
        setUnitPrice("");
        if (lastFrom && locIds.has(lastFrom)) setFromLoc(lastFrom);
        if (lastTo && locIds.has(lastTo)) setToLoc(lastTo);
      }
    } catch {}
  }, [type, locations]);

  function onScanned(code: string) {
    setOk(null);
    setError(null);

    const clean = code.trim();
    setQuery(clean);

    const found = products.find((p) => (p.barcode ?? "").trim() === clean);

    if (found) {
      setProductId(found.id);
      setOk(`Našiel som produkt: ${found.name}`);
      // feedback
      safeVibrate(60);
      beep(880, 90);
      return;
    }

    // keď nenájde, aspoň feedback “negatívny”
    safeVibrate(120);
    beep(220, 120);
    setError(`Nenašiel som produkt s EAN: ${clean}. Skontroluj, či má produkt vyplnené barcode (EAN).`);
  }

  async function submit(opts?: { forceQty?: number; forceType?: MoveType }) {
    setError(null);
    setOk(null);

    const actualType = opts?.forceType ?? type;

    const pid = productId;
    if (!pid) return setError("Vyber produkt.");

    const q = opts?.forceQty ?? Number(qty);
    if (!q || q <= 0) return setError("Množstvo musí byť > 0.");

    if (actualType === "IN" && !toLoc) return setError("Vyber cieľovú lokáciu.");
    if (actualType === "OUT" && !fromLoc) return setError("Vyber zdrojovú lokáciu.");
    if (actualType === "TRANSFER" && (!fromLoc || !toLoc)) return setError("Vyber zdroj aj cieľ.");
    if (actualType === "TRANSFER" && fromLoc === toLoc) return setError("Zdroj a cieľ nemôžu byť rovnaké.");

    const price = unitPrice.trim() === "" ? null : Number(unitPrice);
    if (actualType === "IN" && (price === null || Number.isNaN(price))) return setError("Pri príjme zadaj nákupnú cenu.");

    const whId =
      actualType === "IN"
        ? locById.get(toLoc)?.warehouse_id
        : actualType === "OUT"
        ? locById.get(fromLoc)?.warehouse_id
        : locById.get(toLoc)?.warehouse_id;

    // 1) create movement
    const mv = await supabase
      .from("movements")
      .insert({ type: actualType, warehouse_id: whId ?? null, note: null })
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
      p_type: actualType,
      p_product_id: pid,
      p_from_location: fromLoc || null,
      p_to_location: toLoc || null,
      p_qty: q,
      p_unit_price: price,
    });

    if (rpc.error) return setError(rpc.error.message);

    // 4) remember last locs
    try {
      if (fromLoc) localStorage.setItem(LS_LAST_FROM, fromLoc);
      if (toLoc) localStorage.setItem(LS_LAST_TO, toLoc);
    } catch {}

    setOk("Uložené.");
    setQty("1");
    if (actualType !== "IN") setUnitPrice("");
  }

  async function quickSaleMinusOne() {
    // quick sale = OUT -1
    if (!productId) return setError("Najprv vyber produkt (alebo naskenuj EAN).");

    // prepnúť na OUT (len UI), ale vykonáme rovno OUT
    setType("OUT");

    // musí byť fromLoc (posledná lokácia sa väčšinou predvyplní)
    if (!fromLoc) {
      return setError("Pre rýchly predaj vyber 'Z lokácie' (predajňu/miesto). Potom to bude nabudúce automaticky.");
    }

    await submit({ forceQty: 1, forceType: "OUT" });
    safeVibrate(40);
    beep(660, 60);
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

        {/* Quick sale */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={quickSaleMinusOne}
            style={{ padding: "10px 12px" }}
            title="OUT -1 jedným ťukom (použije poslednú lokáciu)"
          >
            Rýchly predaj (OUT −1)
          </button>
          <span style={{ opacity: 0.7, alignSelf: "center" }}>
            Použije poslednú zvolenú „Z lokácie“.
          </span>
        </div>

        {type !== "IN" && (
          <label>
            Z lokácie (posledná sa predvyplní)
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
            Do lokácie (posledná sa predvyplní)
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

            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" style={{ width: 140, padding: 10 }} />

            <button type="button" onClick={() => setQty(String(Number(qty || "0") + 1))} style={{ padding: "10px 12px", minWidth: 44 }}>
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

        <button onClick={() => submit()} style={{ padding: "10px 12px", maxWidth: 240 }}>
          Uložiť pohyb
        </button>

        <p style={{ opacity: 0.75 }}>
          Tip: aby skenovanie našlo produkt, vyplň pri produkte pole <b>barcode (EAN)</b> v /products.
        </p>
      </div>
    </main>
  );
}