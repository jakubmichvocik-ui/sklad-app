"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function TopBar() {
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

      const { data: r, error } = await supabase.rpc("current_role");
      setRole(error ? "?" : (r ?? "viewer"));

      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isAdmin = role === "admin";

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 10,
        background: "#f3f4f6",
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Prihlásený:</strong>
        <span>{loading ? "Načítavam…" : email}</span>
        <span style={{ opacity: 0.7 }}>• rola: {loading ? "…" : role}</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isAdmin && (
          <a href="/admin/users" style={{ padding: "8px 10px", background: "#e5e7eb", borderRadius: 8 }}>
            Admin
          </a>
        )}
        <a href="/dashboard" style={{ padding: "8px 10px", background: "#e5e7eb", borderRadius: 8 }}>
          Dashboard
        </a>
        <a href="/products" style={{ padding: "8px 10px", background: "#e5e7eb", borderRadius: 8 }}>
          Produkty
        </a>
        <a href="/move" style={{ padding: "8px 10px", background: "#e5e7eb", borderRadius: 8 }}>
          Pohyb
        </a>
        <a href="/stock" style={{ padding: "8px 10px", background: "#e5e7eb", borderRadius: 8 }}>
          Prehľad skladu
        </a>

        <button onClick={signOut} style={{ padding: "8px 10px" }}>
          Odhlásiť
        </button>
      </div>
    </div>
  );
}