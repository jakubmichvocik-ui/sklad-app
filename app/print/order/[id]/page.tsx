"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function PrintOrder({ params }: any) {
  const orderId = params.id as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("orders").select("order_no,created_at,status,customer_id").eq("id", orderId).single();
      const { data: c } = await supabase.from("customers").select("name,email,phone,address").eq("id", o?.customer_id).single();
      const { data: it } = await supabase.from("order_items").select("name,ean,qty_ordered,qty_picked").eq("order_id", orderId).order("name");
      setData({ o, c, it });
      setTimeout(() => window.print(), 300);
    })();
  }, []);

  if (!data) return <p>Načítavam…</p>;

  return (
    <main style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Dodací list</h1>
      <div><strong>Objednávka:</strong> #{data.o.order_no}</div>
      <div><strong>Dátum:</strong> {new Date(data.o.created_at).toLocaleString()}</div>
      <div><strong>Status:</strong> {data.o.status}</div>

      <hr />

      <h3>Zákazník</h3>
      <div><strong>Meno:</strong> {data.c?.name}</div>
      <div><strong>Email:</strong> {data.c?.email ?? ""}</div>
      <div><strong>Tel:</strong> {data.c?.phone ?? ""}</div>
      <div><strong>Adresa:</strong> {data.c?.address ?? ""}</div>

      <hr />

      <h3>Položky</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #000", textAlign: "left" }}>Produkt</th>
            <th style={{ borderBottom: "1px solid #000", textAlign: "left" }}>EAN</th>
            <th style={{ borderBottom: "1px solid #000", textAlign: "right" }}>Objednané</th>
            <th style={{ borderBottom: "1px solid #000", textAlign: "right" }}>Vychystané</th>
          </tr>
        </thead>
        <tbody>
          {data.it?.map((x: any, idx: number) => (
            <tr key={idx}>
              <td style={{ padding: "6px 0" }}>{x.name}</td>
              <td style={{ padding: "6px 0" }}>{x.ean ?? ""}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{x.qty_ordered}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{x.qty_picked}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24 }}>
        Podpis: _______________________
      </div>
    </main>
  );
}