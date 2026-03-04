"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; ean: string | null; price: number | null };
type Warehouse = { id: string; name: string };
type RoleKey = "admin" | "manager" | "clerk" | "viewer" | string;

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [q, setQ] = useState("");

  // create form
  const [name, setName] = useState("");
  const [ean, setEan] = useState("");
  const [price, setPrice] = useState<string>(""); // text input -> number
  const [qty, setQty] = useState<string>("0");

  const [role, setRole] = useState<RoleKey>("-");
  const [roleLoading, setRoleLoading] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canCreate = role === "admin" || role === "manager";

  async function loadRole() {
    setRoleLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setRole("-");
      setRoleLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("current_role");
    setRole(error ? "viewer" : ((data ?? "viewer") as RoleKey));
    setRoleLoading(false);
  }

  async function loadWarehouses() {
    const { data, error } = await supabase.from("warehouses").select("id,name").order("name");
    if (!error) {
      const list = (data as any[]) ?? [];
      setWarehouses(list);
      if (!warehouseId && list[0]) setWarehouseId(list[0].id);
    }
  }

  async function loadProducts() {
    setErr(null);
    const { data, error } = await supabase.from("products").select("id,name,ean,price").order("name").limit(5000);
    if (error) return setErr(error.message);
    setItems((data as any) ?? []);
  }

  useEffect(() => {
    (async () => {
      await loadRole();
      await loadWarehouses();
      await loadProducts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (p) => (p.name ?? "").toLowerCase().includes(s) || (p.ean ?? "").toLowerCase().includes(s)
    );
  }, [q, items]);

  async function create() {
    setErr(null);
    setMsg(null);

    if (!canCreate) {
      setErr("Nemáš oprávnenie vytvárať produkty (iba admin alebo skladník/manager).");
      return;
    }

    const n = name.trim();
    const e = ean.trim() || null;

    if (!n) return setErr("Zadaj názov produktu.");
    if (e && !/^\d{8,14}$/.test(e)) {
      // EAN zvyčajne 8–14 číslic (EAN-13 = 13)
      return setErr("EAN má byť číslo (8 až 14 číslic).");
    }

    const p = price.trim() === "" ? null : Number(price.replace(",", "."));
    if (p != null && Number.isNaN(p)) return setErr("Cena nie je číslo.");

    const qn = Number((qty || "0").replace(",", "."));
    if (Number.isNaN(qn)) return setErr("Počet nie je číslo.");
    if (!warehouseId) return setErr("Vyber sklad.");

    // 1) insert product
    const { data: prod, error: pErr } = await supabase
      .from("products")
      .insert({ name: n, ean: e, price: p })
      .select("id")
      .single();

    if (pErr) return setErr(pErr.message);

    // 2) set opening stock (upsert to stock)
    if (qn !== 0) {
      const { error: sErr } = await supabase
        .from("stock")
        .upsert({ warehouse_id: warehouseId, product_id: prod.id, qty: qn }, { onConflict: "warehouse_id,product_id" });

      if (sErr) return setErr("Produkt sa vytvoril, ale stav sa neuložil: " + sErr.message);
    }

    setMsg("Produkt vytvorený.");
    setName("");
    setEan("");
    setPrice("");
    setQty("0");
    await loadProducts();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Produkty</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      {/* CREATE */}
      {roleLoading ? (
        <div style={{ marginTop: 12, opacity: 0.7 }}>Načítavam oprávnenia…</div>
      ) : canCreate ? (
        <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 760 }}>
          <h3>Vytvoriť produkt</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Názov produktu" style={{ padding: 10 }} />
            <input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="EAN (napr. 858…)" style={{ padding: 10 }} />
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Predajná cena (napr. 9.90)" style={{ padding: 10 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Sklad (počiatočný stav)</span>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ padding: 10 }}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Počet (ks)</span>
                <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={{ padding: 10 }} />
              </label>
            </div>

            <button onClick={create} style={{ padding: "10px 12px", maxWidth: 240 }}>
              Vytvoriť produkt
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Tip: Ak neskôr naskenuješ EAN v inventúre, produkt sa nájde podľa `products.ean`.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 680 }}>
          <strong>Nemáš oprávnenie pridávať produkty.</strong>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Produkty môže vytvárať iba admin alebo skladník (manager).</div>
        </div>
      )}

      {/* SEARCH */}
      <div style={{ marginTop: 16, maxWidth: 760 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hľadať (názov/EAN)" style={{ padding: 10, width: "100%" }} />
      </div>

      {/* LIST */}
      <h2 style={{ marginTop: 18 }}>Zoznam</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
        {filtered.map((p) => (
          <div key={p.id} style={{ padding: 10, background: "#f3f4f6", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{p.name}</strong>
              <span style={{ opacity: 0.75 }}>{p.price != null ? `${p.price} €` : "bez ceny"}</span>
            </div>
            <div style={{ opacity: 0.7 }}>{p.ean ?? "bez EAN"}</div>
          </div>
        ))}
      </div>
    </main>
  );
}