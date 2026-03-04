"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type RoleKey = "admin" | "manager" | "clerk" | "viewer" | string;

type Perms = {
  can_admin: boolean;
  can_products: boolean;
  can_warehouses: boolean;
  can_stock: boolean;
  can_move: boolean;
  can_orders: boolean;
  can_picker: boolean;
  can_inventory: boolean;
};

const DEFAULT_PERMS: Perms = {
  can_admin: false,
  can_products: false,
  can_warehouses: false,
  can_stock: true,
  can_move: false,
  can_orders: false,
  can_picker: false,
  can_inventory: false,
};

function roleDefaults(role: RoleKey): Perms {
  if (role === "admin")
    return {
      can_admin: true,
      can_products: true,
      can_warehouses: true,
      can_stock: true,
      can_move: true,
      can_orders: true,
      can_picker: true,
      can_inventory: true,
    };

  if (role === "manager")
    return {
      can_admin: false,
      can_products: true,
      can_warehouses: true,
      can_stock: true,
      can_move: true,
      can_orders: true,
      can_picker: true,
      can_inventory: true,
    };

  if (role === "clerk")
    return {
      can_admin: false,
      can_products: false,
      can_warehouses: false,
      can_stock: true,
      can_move: true,
      can_orders: true,
      can_picker: true,
      can_inventory: true,
    };

  return DEFAULT_PERMS;
}

export default function TopBar() {
  const pathname = usePathname();

  const [email, setEmail] = useState<string>("—");
  const [role, setRole] = useState<RoleKey>("—");
  const [perms, setPerms] = useState<Perms>(DEFAULT_PERMS);
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ build-safe: načítaj user len raz, bez závislostí čo spôsobujú loop
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: sess } = await supabase.auth.getSession();
        const session = sess.session;

        if (!alive) return;

        if (!session) {
          setEmail("Neprihlásený");
          setRole("viewer");
          setPerms(DEFAULT_PERMS);
          setLoading(false);
          return;
        }

        setEmail(session.user.email ?? "(bez emailu)");

        // rola
        const { data: r, error: rErr } = await supabase.rpc("current_role");
        const rk: RoleKey = rErr ? "viewer" : ((r ?? "viewer") as RoleKey);

        if (!alive) return;

        setRole(rk);

        // práva (ak tabuľka existuje), inak fallback na default role
        const { data: pRow, error: pErr } = await supabase
          .from("user_permissions")
          .select("can_admin,can_products,can_warehouses,can_stock,can_move,can_orders,can_picker,can_inventory")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        if (!pErr && pRow) setPerms(pRow as any);
        else setPerms(roleDefaults(rk));

        setLoading(false);
      } catch {
        if (!alive) return;
        setEmail("—");
        setRole("viewer");
        setPerms(DEFAULT_PERMS);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const nav = useMemo(() => {
    return [
      { key: "admin", label: "Admin", href: "/admin/users", icon: "🔐", show: perms.can_admin },
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "🏠", show: true },

      { key: "products", label: "Produkty", href: "/products", icon: "📦", show: perms.can_products },
      { key: "warehouses", label: "Sklady", href: "/warehouses", icon: "🏬", show: perms.can_warehouses },

      { key: "stock", label: "Prehľad skladu", href: "/stock", icon: "📊", show: perms.can_stock },
      { key: "map", label: "Mapa skladu", href: "/map", icon: "🗺️", show: perms.can_stock },

      { key: "move", label: "Pohyb", href: "/move", icon: "🔄", show: perms.can_move },
      { key: "orders", label: "Objednávky", href: "/orders", icon: "📋", show: perms.can_orders },
      { key: "picker", label: "Picker", href: "/picker", icon: "📦", show: perms.can_picker },
      { key: "inventory", label: "Inventúra", href: "/inventory", icon: "🧾", show: perms.can_inventory },
    ].filter((x) => x.show);
  }, [perms]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: 12,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>🧩 Sklad</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {loading ? "Načítavam…" : `${email} • rola: ${role}`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "white",
              fontWeight: 700,
            }}
            aria-label="Menu"
          >
            ☰
          </button>

          <button
            onClick={signOut}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "white",
              fontWeight: 800,
            }}
          >
            Odhlásiť
          </button>
        </div>
      </div>

      {menuOpen && (
        <div style={{ maxWidth: 1180, margin: "10px auto 0", padding: 10 }}>
          <nav
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 16,
              padding: 12,
            }}
          >
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    border: active ? "1px solid #111827" : "1px solid #E5E7EB",
                    background: active ? "#111827" : "#F3F4F6",
                    color: active ? "white" : "#111827",
                    fontWeight: active ? 800 : 700,
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}