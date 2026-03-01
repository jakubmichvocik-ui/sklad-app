"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
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

type Notif = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

function roleDefaults(role: RoleKey): Perms {
  // fallback – keď ešte nemáš user_permissions tabuľku
  if (role === "admin") {
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
  }
  if (role === "manager") {
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
  }
  if (role === "clerk") {
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
  }
  return {
    can_admin: false,
    can_products: false,
    can_warehouses: false,
    can_stock: true,
    can_move: false,
    can_orders: false,
    can_picker: false,
    can_inventory: false,
  };
}

export default function TopBar() {
  const pathname = usePathname();

  const [email, setEmail] = useState<string>("-");
  const [role, setRole] = useState<RoleKey>("-");
  const [perms, setPerms] = useState<Perms>(roleDefaults("viewer"));
  const [loading, setLoading] = useState(true);

  // mobile menu
  const [menuOpen, setMenuOpen] = useState(false);

  // orders badge
  const [openOrders, setOpenOrders] = useState<number>(0);

  // notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState<number>(0);

  const notifBoxRef = useRef<HTMLDivElement | null>(null);

  const nav = useMemo(() => {
    return [
      { key: "admin", label: "Admin", href: "/admin/users", icon: "🔐", show: perms.can_admin },
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "🏠", show: true },
      { key: "products", label: "Produkty", href: "/products", icon: "📦", show: perms.can_products },
      { key: "warehouses", label: "Sklady", href: "/warehouses", icon: "🏬", show: perms.can_warehouses },
      { key: "stock", label: "Prehľad skladu", href: "/stock", icon: "📊", show: perms.can_stock },
      { key: "move", label: "Pohyb", href: "/move", icon: "🔄", show: perms.can_move },
      { key: "orders", label: "Objednávky", href: "/orders", icon: "📋", show: perms.can_orders, badge: openOrders },
      { key: "picker", label: "Picker", href: "/picker", icon: "📦", show: perms.can_picker },
      { key: "inventory", label: "Inventúra", href: "/inventory", icon: "🧾", show: perms.can_inventory },
    ].filter((x) => x.show);
  }, [perms, openOrders]);

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + "/");
  }

  function linkStyle(active: boolean) {
    return {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 10,
      textDecoration: "none",
      background: active ? "#111827" : "#EEF2F7",
      color: active ? "white" : "#111827",
      fontWeight: active ? 700 : 600,
      border: active ? "1px solid #111827" : "1px solid #E5E7EB",
      userSelect: "none" as const,
    };
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function loadMe() {
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setEmail("Neprihlásený");
      setRole("-");
      setPerms(roleDefaults("viewer"));
      setLoading(false);
      return;
    }

    setEmail(session.user.email ?? "(bez emailu)");

    // rola
    const { data: r } = await supabase.rpc("current_role");
    const rKey = (r ?? "viewer") as RoleKey;
    setRole(rKey);

    // permissions (ak tabuľka existuje). Ak nie, fallback na role defaults.
    try {
      const { data: pRow, error: pErr } = await supabase
        .from("user_permissions")
        .select("can_admin,can_products,can_warehouses,can_stock,can_move,can_orders,can_picker,can_inventory")
        .eq("user_id", session.user.id)
        .single();

      if (!pErr && pRow) {
        setPerms(pRow as any);
      } else {
        setPerms(roleDefaults(rKey));
      }
    } catch {
      setPerms(roleDefaults(rKey));
    }

    setLoading(false);
  }

  async function loadOpenOrdersCount() {
    // keď tabuľka orders ešte nie je, toto sa len “ticho” preskočí
    try {
      // predpoklad: orders.status
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["NEW", "CONFIRMED", "PICKING"]);

      if (!error) setOpenOrders(count ?? 0);
    } catch {
      // ignore
    }
  }

  async function loadNotifications() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,created_at,read_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) return;

      const list = (data as any) ?? [];
      setNotifs(list);

      const unreadCount = list.filter((n: Notif) => !n.read_at).length;
      setUnread(unreadCount);
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", uid)
        .is("read_at", null);

      await loadNotifications();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadMe();
    loadOpenOrdersCount();
    loadNotifications();

    const interval = setInterval(() => {
      loadOpenOrdersCount();
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // klik mimo notif dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!notifOpen) return;
      const el = notifBoxRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [notifOpen]);

  const title = loading ? "Načítavam…" : email;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: 12,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* LEFT: brand + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "#111827",
              color: "white",
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
          >
            🧩 Sklad
          </div>

          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <div style={{ fontWeight: 700, color: "#111827" }}>{title}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              rola: <strong>{loading ? "…" : role}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* notifications */}
          <div ref={notifBoxRef} style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              style={{
                position: "relative",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Notifikácie"
            >
              🔔
              {unread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: "#ef4444",
                    color: "white",
                    borderRadius: 999,
                    padding: "2px 7px",
                    fontSize: 12,
                    fontWeight: 800,
                    border: "2px solid white",
                  }}
                >
                  {unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 46,
                  width: 340,
                  maxWidth: "85vw",
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 14,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Notifikácie</strong>
                  <button
                    onClick={markAllRead}
                    style={{ border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 10, padding: "6px 10px" }}
                  >
                    Označiť všetko prečítané
                  </button>
                </div>

                <div style={{ maxHeight: 340, overflow: "auto", borderTop: "1px solid #E5E7EB" }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: 12, opacity: 0.7 }}>Žiadne notifikácie.</div>
                  ) : (
                    notifs.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #F1F5F9",
                          background: n.read_at ? "white" : "#F0F9FF",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{n.title}</div>
                        {n.body && <div style={{ marginTop: 4, opacity: 0.8 }}>{n.body}</div>}
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
            title="Menu"
          >
            ☰
          </button>

          <button
            onClick={signOut}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Odhlásiť
          </button>
        </div>
      </div>

      {/* MENU (responsive drawer-ish) */}
      {menuOpen && (
        <div style={{ maxWidth: 1180, margin: "10px auto 0", padding: 10 }}>
          <nav
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 16,
              padding: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <a key={item.key} href={item.href} style={linkStyle(active)} onClick={() => setMenuOpen(false)}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>

                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      style={{
                        background: "#0ea5e9",
                        color: "white",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
            Tip: menu sa prispôsobí podľa role/permissions (role-based).
          </div>
        </div>
      )}
    </header>
  );
}