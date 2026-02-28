"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type StockRow = {
  quantity: number | null;
  avg_purchase_price: number | null;
  locations: { warehouses: { name: string | null } | null } | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    let grand = 0;
    for (const r of rows) {
      const whName = r.locations?.warehouses?.name ?? "Neznámy sklad";
      const qty = Number(r.quantity ?? 0);
      const avg = Number(r.avg_purchase_price ?? 0);
      const v = qty * avg;
      map.set(whName, (map.get(whName) ?? 0) + v);
      grand += v;
    }
    return { map, grand };
  }, [rows]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setError("Nie si prihlásený. Choď na /login.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("stock")
        .select("quantity, avg_purchase_price, locations(warehouses(name))");

      if (error) setError(error.message);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main>
      <h1>Dashboard</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/">Domov</a>
        <a href="/products">Produkty</a>
        <a href="/move">Pohyb</a>
        <a href="/login">Login</a>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {loading && <p>Načítavam…</p>}
      {error && <div style={{ padding: 10, background: "#fee2e2" }}>{error}</div>}

      {!loading && !error && (
        <>
          <h2>Hodnota skladu (EUR)</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            {Array.from(totals.map.entries()).map(([name, val]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#f3f4f6" }}>
                <strong>{name}</strong>
                <span>{val.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#e5e7eb" }}>
              <strong>Spolu</strong>
              <span>{totals.grand.toFixed(2)}</span>
            </div>
          </div>

          <p style={{ opacity: 0.75, marginTop: 10 }}>
            Hodnota = qty × avg_purchase_price. Po príjmoch sa priemer počíta automaticky (WAC).
          </p>
        </>
      )}
    </main>
  );
}