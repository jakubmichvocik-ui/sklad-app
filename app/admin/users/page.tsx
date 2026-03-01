"use client";
// admin users page v2

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type RoleKey = "admin" | "manager" | "clerk" | "viewer";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: RoleKey;
};

export default function AdminUsersPage() {
  const [meRole, setMeRole] = useState<string>("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleKey>("clerk");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadMeRole() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    window.location.href = "/login";
    return;
  }

  const { data, error } = await supabase.rpc("current_role");
  const r = error ? "" : (data ?? "");
  setMeRole(r);

  if (r !== "admin") {
    window.location.href = "/dashboard";
  }
}

  async function loadUsers() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    const token = await getAccessToken();
    if (!token) {
      setErr("Nie si prihlásený. Choď na /login.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/list-users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json?.error ?? "Chyba načítania userov");
      setLoading(false);
      return;
    }

    setUsers(json.users ?? []);
    setLoading(false);
  }

useEffect(() => {
  (async () => {
    await loadMeRole();
    await loadUsers();
  })();
}, []);

  async function createUser() {
    setErr(null);
    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setErr("Zadaj email a heslo.");
      return;
    }

   const token = await getAccessToken();
if (!token) return setErr("Nie si prihlásený.");

const res = await fetch("/api/admin/create-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    email: email.trim(),
    password: password.trim(),
    role_key: role,
    warehouse_ids: warehouseIds,   // ak používaš scope
    permissions: perms,            // ak používaš checkbox práva
  }),
});

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json?.error ?? "Create user failed");

    setMsg("Používateľ vytvorený.");
    setEmail("");
    setPassword("");
    setRole("clerk");
    await loadUsers();
  }

  async function setUserRole(user_id: string, role_key: RoleKey) {
    setErr(null);
    setMsg(null);

    const token = await getAccessToken();
    if (!token) return setErr("Nie si prihlásený.");

    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id, role_key }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json?.error ?? "Set role failed");

    setMsg("Rola uložená.");
    await loadUsers();
  }

  return (
    <main>
      <h1>Admin – Používatelia</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/products">Produkty</a>
        <a href="/move">Pohyb</a>
        <a href="/login">Login</a>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ padding: 10, background: "#f3f4f6", borderRadius: 8 }}>
        <strong>Moja rola:</strong> {meRole || "—"}
      </div>

      {err && <div style={{ marginTop: 12, padding: 10, background: "#fee2e2" }}>{err}</div>}
      {msg && <div style={{ marginTop: 12, padding: 10, background: "#dcfce7" }}>{msg}</div>}

      <h2 style={{ marginTop: 18 }}>Vytvoriť účet</h2>
      <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="Dočasné heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10 }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as RoleKey)} style={{ padding: 10 }}>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="clerk">clerk</option>
          <option value="viewer">viewer</option>
        </select>
        <button onClick={createUser} style={{ padding: "10px 12px", maxWidth: 220 }}>
          Vytvoriť používateľa
        </button>
      </div>

      <h2 style={{ marginTop: 22 }}>Zoznam používateľov</h2>
      {loading ? (
        <p>Načítavam…</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {users.map((u) => (
            <div key={u.id} style={{ padding: 10, background: "#f3f4f6", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{u.email ?? "(no email)"}</strong>
                <span style={{ opacity: 0.75 }}>ID: {u.id}</span>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ opacity: 0.8 }}>Rola:</span>
                <select
                  value={u.role}
                  onChange={(e) => setUserRole(u.id, e.target.value as RoleKey)}
                  style={{ padding: 8 }}
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="clerk">clerk</option>
                  <option value="viewer">viewer</option>
                </select>

                <span style={{ opacity: 0.7 }}>
                  created: {u.created_at ? new Date(u.created_at).toLocaleString() : "—"} • last login:{" "}
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}