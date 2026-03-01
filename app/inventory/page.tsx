"use client";

import TopBar from "@/components/TopBar";
import Link from "next/link";

export default function InventoryPage() {
  return (
    <main style={{ padding: 16 }}>
      <TopBar />

      <h1 style={{ marginTop: 16 }}>Inventúra</h1>

      <p>Tu bude zoznam inventúrnych session.</p>

      <Link
        href="/inventory/new"
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "10px 14px",
          background: "#111827",
          color: "white",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        + Nová inventúra
      </Link>
    </main>
  );
}