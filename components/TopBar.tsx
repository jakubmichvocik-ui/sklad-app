"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopBar() {
  const pathname = usePathname();

  const [email, setEmail] = useState<string>("-");
  const [role, setRole] = useState<string>("-");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setEmail("Neprihlásený");
        setRole("-");
        setLoading(false);
        return;
      }

      setEmail(session.user.email ?? "(bez emailu)");

      const { data: r } = await supabase.rpc("current_role");
      setRole(r ?? "viewer");

      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isAdmin = role === "admin";

  function linkStyle(path: string) {
    const active = pathname === path || pathname.startsWith(path + "/");
    return {
      padding: "8px 12px",
      borderRadius: 8,
      textDecoration: "none",
      background: active ? "#111827" : "#e5e7eb",
      color: active ? "white" : "black",
      fontWeight: active ? 600 : 500,
    };
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 12,
        background: "#f3f4f6",
      }}
    >
      {/* USER INFO */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Prihlásený:</strong>
        <span>{loading ? "Načítavam…" : email}</span>
        <span style={{ opacity: 0.7 }}>• rola: {loading ? "…" : role}</span>
      </div>

      {/* NAV */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isAdmin && (
          <a href="/admin/users" style={linkStyle("/admin")}>
            Admin
          </a>
        )}

        <a href="/dashboard" style={linkStyle("/dashboard")}>
          Dashboard
        </a>

        <a href="/products" style={linkStyle("/products")}>
          Produkty
        </a>

        <a href="/move" style={linkStyle("/move")}>
          Pohyb
        </a>

        <a href="/stock" style={linkStyle("/stock")}>
          Prehľad skladu
        </a>

        <a href="/orders" style={linkStyle("/orders")}>
          Objednávky
        </a>

        <a href="/inventory" style={linkStyle("/inventory")}>
          Inventúra
        </a>

        <button
          onClick={signOut}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#ef4444",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Odhlásiť
        </button>
      </div>
    </div>
  );
}