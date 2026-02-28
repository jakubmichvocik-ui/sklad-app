"use client";

import { supabase } from "@/lib/supabaseClient";
import { Product } from "@/lib/types";
import { useEffect, useState } from "react";

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [minStock, setMinStock] = useState("0");

  async function load() {
    setLoading(true);
    setError(null);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setLoading(false);
      setError("Nie si prihlásený. Choď na /login.");
      return;
    }

    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });
    if (error) setError(error.message);
    setItems((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addProduct() {
    setError(null);
    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      barcode: barcode.trim() || null,
      unit: "ks",
      selling_price: Number(sellingPrice || "0"),
      min_stock: Number(minStock || "0"),
      active: true,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) return setError(error.message);

    setSku("");
    setName("");
    setBarcode("");
    setSellingPrice("0");
    setMinStock("0");
    await load();
  }

  return (
    <main>
      <h1>Produkty</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/move">Pohyb</a>
        <a href="/login">Login</a>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {error && <div style={{ padding: 10, background: "#fee2e2" }}>{error}</div>}

      <h2>Pridať produkt</h2>
      <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <input placeholder="SKU (unikátne)" value={sku} onChange={(e) => setSku(e.target.value)} style={{ padding: 10 }} />
        <input placeholder="Názov" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10 }} />
        <input placeholder="Čiarový kód (EAN) – voliteľné" value={barcode} onChange={(e) => setBarcode(e.target.value)} style={{ padding: 10 }} />
        <input placeholder="Predajná cena" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} style={{ padding: 10 }} />
        <input placeholder="Min. zásoba" value={minStock} onChange={(e) => setMinStock(e.target.value)} style={{ padding: 10 }} />
        <button onClick={addProduct} style={{ padding: "10px 12px" }}>Uložiť</button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2>Zoznam</h2>
      {loading ? (
        <p>Načítavam…</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((p) => (
            <div key={p.id} style={{ padding: 10, background: "#f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{p.name}</strong>
                <span style={{ opacity: 0.8 }}>SKU: {p.sku}</span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                EAN: {p.barcode ?? "—"} • Predaj: {(p.selling_price ?? 0).toFixed(2)} € • Min: {p.min_stock ?? 0} ks
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}