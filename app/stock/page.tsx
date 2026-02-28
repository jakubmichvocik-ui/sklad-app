"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type StockRow = {
  id: string;
  quantity: number | null;
  avg_purchase_price: number | null;
  products: {
    name: string;
    sku: string;
  } | null;
  locations: {
    code: string;
    name: string | null;
    warehouses: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setError("Nie si prihlásený.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("stock")
      .select(`
        id,
        quantity,
        avg_purchase_price,
        products(name, sku),
        locations(
          code,
          name,
          warehouses(id, name)
        )
      `)
      .order("id");

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setRows((data as any) ?? []);
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    if (!warehouseFilter) return rows;
    return rows.filter(
      (r) => r.locations?.warehouses?.id === warehouseFilter
    );
  }, [rows, warehouseFilter]);

  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const w = r.locations?.warehouses;
      if (w) map.set(w.id, w.name);
    });
    return Array.from(map.entries());
  }, [rows]);

  const totalValue = useMemo(() => {
    return filteredRows.reduce((sum, r) => {
      const qty = Number(r.quantity ?? 0);
      const avg = Number(r.avg_purchase_price ?? 0);
      return sum + qty * avg;
    }, 0);
  }, [filteredRows]);

  return (
    <main>
      <h1>Prehľad skladu</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/products">Produkty</a>
        <a href="/move">Pohyb</a>
        <a href="/admin/users">Admin</a>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {error && (
        <div style={{ padding: 10, background: "#fee2e2" }}>{error}</div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label>
          Filter sklad:
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            style={{ marginLeft: 10, padding: 6 }}
          >
            <option value="">Všetky</option>
            {warehouses.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Načítavam…</p>
      ) : (
        <>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 800,
              }}
            >
              <thead style={{ background: "#f3f4f6" }}>
                <tr>
                  <th style={th}>Sklad</th>
                  <th style={th}>Lokácia</th>
                  <th style={th}>Produkt</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Množstvo</th>
                  <th style={th}>Priemerná cena</th>
                  <th style={th}>Hodnota</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const qty = Number(r.quantity ?? 0);
                  const avg = Number(r.avg_purchase_price ?? 0);
                  const value = qty * avg;

                  return (
                    <tr key={r.id}>
                      <td style={td}>
                        {r.locations?.warehouses?.name ?? "—"}
                      </td>
                      <td style={td}>
                        {r.locations?.code}{" "}
                        {r.locations?.name ? `(${r.locations?.name})` : ""}
                      </td>
                      <td style={td}>{r.products?.name ?? "—"}</td>
                      <td style={td}>{r.products?.sku ?? "—"}</td>
                      <td style={td}>{qty}</td>
                      <td style={td}>{avg.toFixed(2)} €</td>
                      <td style={td}>{value.toFixed(2)} €</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#e5e7eb",
              borderRadius: 8,
              fontWeight: "bold",
            }}
          >
            Celková hodnota: {totalValue.toFixed(2)} €
          </div>
        </>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f3f4f6",
};