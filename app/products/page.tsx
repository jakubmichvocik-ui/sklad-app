"use client";

import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; ean: string | null };
type RoleKey = "admin" | "manager" | "clerk" | "viewer" | string;

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [ean, setEan] = useState("");

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

  async function loadProducts() {
    setErr(null);
    const { data, error } = await supabase.from("products").select("id,name,ean").order("name").limit(2000);
    if (error) return setErr(error.message);
    setItems((data as any) ?? []);
  }

  useEffect(() => {
    (async () => {
      await loadRole();
      await loadProducts();
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => (p.name ?? "").toLowerCase().includes(s) || (p.ean ?? "").toLowerCase().includes(s));
  }, [q, items]);

  async function create() {
    setErr(null);
    setMsg(null);

    // bezpečnostná kontrola aj tu
    if (!canCreate) {
      setErr("Nemáš oprávnenie vytvárať produkty (iba admin alebo skladník/manager).");
      return;
    }

    const n = name.trim();
    const e = ean.trim() || null;

    if (!n) return setErr("Zadaj názov produktu.");

    const { error } = await supabase.from("products").insert({ name: n, ean: e });
    if (error) return setErr(error.message);

    setMsg("Produkt vytvorený.");
    setName("");
    setEan("");
    await loadProducts();
  }

  return (
    <main style={{ padding: 16 }}>
      <TopBar />
      <h1 style={{ marginTop: 12 }}>Produkty</h1>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      {/* CREATE FORM */}
      {roleLoading ? (
        <div style={{ marginTop: 12, opacity: 0.7 }}>Načítavam oprávnenia…</div>
      ) : canCreate ? (
        <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 680 }}>
          <h3>Vytvoriť produkt</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Názov produktu"
              style={{ padding: 10 }}
            />
            <input
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              placeholder="EAN (voliteľné)"
              style={{ padding: 10 }}
            />
            <button onClick={create} style={{ padding: "10px 12px", maxWidth: 220 }}>
              Vytvoriť produkt
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 12, maxWidth: 680 }}>
          <strong>Nemáš oprávnenie pridávať produkty.</strong>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Produkty môže vytvárať iba admin alebo skladník (manager).</div>
        </div>
      )}

      {/* SEARCH */}
      <div style={{ marginTop: 16, maxWidth: 680 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hľadať (názov/EAN)"
          style={{ padding: 10, width: "100%" }}
        />
      </div>

      {/* LIST */}
      <h2 style={{ marginTop: 18 }}>Zoznam</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 680 }}>
        {filtered.map((p) => (
          <div key={p.id} style={{ padding: 10, background: "#f3f4f6", borderRadius: 10 }}>
            <strong>{p.name}</strong>
            <div style={{ opacity: 0.7 }}>{p.ean ?? "bez EAN"}</div>
          </div>
        ))}
      </div>
    </main>
  );
}