"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; ean: string | null };

export default function NewOrderPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [whId, setWhId] = useState<string>("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.ean ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [query, products]);

  const [items, setItems] = useState<{ product: Product; qty: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: wh, error: whErr } = await supabase
        .from("warehouses")
        .select("id,name")
        .order("name");

      if (!whErr) {
        setWarehouses((wh as any) ?? []);
        if (wh && wh[0]) setWhId((wh[0] as any).id);
      }

      const { data: pr, error: prErr } = await supabase
        .from("products")
        .select("id,name,ean")
        .order("name")
        .limit(2000);

      if (!prErr) setProducts((pr as any) ?? []);
    })();
  }, []);

  function addProduct(p: Product) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  async function create() {
    setErr(null);
    setMsg(null);

    if (!whId) return setErr("Vyber sklad.");
    if (!customerName.trim()) return setErr("Zadaj meno zákazníka.");
    if (items.length === 0) return setErr("Pridaj aspoň jednu položku.");

    // customer
    const { data: cust, error: cErr } = await supabase
      .from("customers")
      .insert({ name: customerName.trim(), email: customerEmail.trim() || null })
      .select("id")
      .single();

    if (cErr) return setErr(cErr.message);

    // order
    const { data: ord, error: oErr } = await supabase
      .from("orders")
      .insert({ customer_id: (cust as any).id, warehouse_id: whId, status: "CONFIRMED" })
      .select("id,order_no")
      .single();

    if (oErr) return setErr(oErr.message);

    // items
    const rows = items.map((i) => ({
      order_id: (ord as any).id,
      product_id: i.product.id,
      ean: i.product.ean,
      name: i.product.name,
      qty_ordered: i.qty,
      qty_picked: 0,
    }));

    const { error: iErr } = await supabase.from("order_items").insert(rows);
    if (iErr) return setErr(iErr.message);

    setMsg(`Objednávka #${(ord as any).order_no} vytvorená (CONFIRMED).`);
    setItems([]);
    setQuery("");
    setCustomerName("");
    setCustomerEmail("");
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Nová objednávka</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <div style={{ display: "grid", gap: 10, maxWidth: 640, marginTop: 12 }}>
        <label>
          Sklad:
          <select value={whId} onChange={(e) => setWhId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Zákazník (meno):
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ padding: 10, width: "100%" }} />
        </label>

        <label>
          Email (voliteľné):
          <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ padding: 10, width: "100%" }} />
        </label>

        <hr />

        <label>
          Hľadať produkt (meno/EAN):
          <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: 10, width: "100%" }} />
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((p) => (
            <button key={p.id} onClick={() => addProduct(p)} style={{ textAlign: "left", padding: 10 }}>
              <strong>{p.name}</strong> <span style={{ opacity: 0.7 }}>({p.ean ?? "bez EAN"})</span>
            </button>
          ))}
        </div>

        <hr />

        <h3>Položky</h3>
        {items.length === 0 ? (
          <p>Žiadne položky.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((i) => (
              <div
                key={i.product.id}
                style={{
                  padding: 10,
                  background: "#f3f4f6",
                  borderRadius: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <strong>{i.product.name}</strong>
                  <div style={{ opacity: 0.7 }}>{i.product.ean ?? ""}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setItems((prev) => prev.map((x) => x.product.id === i.product.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}>−</button>
                  <strong>{i.qty}</strong>
                  <button onClick={() => setItems((prev) => prev.map((x) => x.product.id === i.product.id ? { ...x, qty: x.qty + 1 } : x))}>+</button>
                  <button onClick={() => setItems((prev) => prev.filter((x) => x.product.id !== i.product.id))}>X</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={create} style={{ padding: "12px 14px", maxWidth: 320 }}>
          Vytvoriť objednávku (CONFIRMED)
        </button>
      </div>
    </main>
  );
}