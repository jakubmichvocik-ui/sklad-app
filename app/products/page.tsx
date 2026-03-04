"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  ean: string | null;
  price: number | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type RoleKey = "admin" | "manager" | "clerk" | "viewer" | string;

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [ean, setEan] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("0");

  const [role, setRole] = useState<RoleKey>("viewer");
  const [loadingRole, setLoadingRole] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canCreate = role === "admin" || role === "manager";

  async function loadRole() {
    setLoadingRole(true);

    const { data } = await supabase.rpc("current_role");
    setRole((data ?? "viewer") as RoleKey);

    setLoadingRole(false);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,ean,price")
      .order("name")
      .limit(5000);

    if (error) {
      setErr(error.message);
      return;
    }

    setItems(data ?? []);
  }

  async function loadWarehouses() {
    const { data } = await supabase
      .from("warehouses")
      .select("id,name")
      .order("name");

    const list = data ?? [];
    setWarehouses(list);

    if (list[0]) setWarehouseId(list[0].id);
  }

  useEffect(() => {
    loadRole();
    loadProducts();
    loadWarehouses();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    if (!s) return items;

    return items.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(s) ||
        (p.ean ?? "").toLowerCase().includes(s)
    );
  }, [q, items]);

  async function create() {
    setErr(null);
    setMsg(null);

    if (!canCreate) {
      setErr("Nemáš oprávnenie vytvárať produkty.");
      return;
    }

    const n = name.trim();
    const e = ean.trim() || null;

    if (!n) {
      setErr("Zadaj názov produktu.");
      return;
    }

    // EAN môže byť ľubovoľný počet čísiel
    if (e && !/^\d+$/.test(e)) {
      setErr("EAN musí obsahovať iba čísla.");
      return;
    }

    const priceNum =
      price.trim() === "" ? null : Number(price.replace(",", "."));

    const qtyNum = Number(qty.replace(",", "."));

    // ak DB vyžaduje SKU tak ho vygenerujeme
    const sku = n.replace(/\s+/g, "_").toUpperCase() + "_" + Date.now();

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        name: n,
        ean: e,
        price: priceNum,
        sku: sku,
      })
      .select("id")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    // uložiť počiatočný stav do skladu
    if (qtyNum !== 0) {
      const { error: stockErr } = await supabase.from("stock").upsert(
        {
          warehouse_id: warehouseId,
          product_id: product.id,
          qty: qtyNum,
        },
        { onConflict: "warehouse_id,product_id" }
      );

      if (stockErr) {
        setErr("Produkt vytvorený, ale stav sa neuložil: " + stockErr.message);
      }
    }

    setMsg("Produkt vytvorený.");

    setName("");
    setEan("");
    setPrice("");
    setQty("0");

    loadProducts();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />

      <h1 style={{ marginTop: 12 }}>Produkty</h1>

      {err && (
        <div style={{ marginTop: 10, padding: 10, background: "#fee2e2" }}>
          {err}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 10, padding: 10, background: "#dcfce7" }}>
          {msg}
        </div>
      )}

      {/* CREATE PRODUCT */}

      {loadingRole ? (
        <div style={{ marginTop: 12 }}>Načítavam práva…</div>
      ) : canCreate ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#f3f4f6",
            borderRadius: 12,
            maxWidth: 700,
          }}
        >
          <h3>Vytvoriť produkt</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="Názov produktu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: 10 }}
            />

            <input
              placeholder="EAN (môže byť aj 1 alebo 22)"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              style={{ padding: 10 }}
            />

            <input
              placeholder="Cena"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ padding: 10 }}
            />

            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={{ padding: 10 }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Počet"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{ padding: 10 }}
            />

            <button
              onClick={create}
              style={{
                padding: "10px 12px",
                maxWidth: 200,
              }}
            >
              Vytvoriť produkt
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#f3f4f6",
            borderRadius: 12,
          }}
        >
          Nemáš oprávnenie vytvárať produkty.
        </div>
      )}

      {/* SEARCH */}

      <div style={{ marginTop: 16, maxWidth: 700 }}>
        <input
          placeholder="Hľadať názov alebo EAN"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: 10, width: "100%" }}
        />
      </div>

      {/* LIST */}

      <h2 style={{ marginTop: 18 }}>Zoznam produktov</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 10,
              background: "#f3f4f6",
              borderRadius: 10,
            }}
          >
            <strong>{p.name}</strong>

            <div style={{ opacity: 0.7 }}>
              EAN: {p.ean ?? "bez EAN"}
            </div>

            <div style={{ opacity: 0.7 }}>
              Cena: {p.price ?? 0} €
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}