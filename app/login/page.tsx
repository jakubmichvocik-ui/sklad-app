"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/dashboard");
  }

  async function signUp() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signUp({ email, password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Účet vytvorený. Skús sa prihlásiť.");
  }

  return (
    <main>
      <h1>Prihlásenie</h1>

      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10 }} />
        </label>
        <label>
          Heslo
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: "100%", padding: 10 }} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={signIn} disabled={busy} style={{ padding: "10px 12px" }}>
            Prihlásiť
          </button>
          <button onClick={signUp} disabled={busy} style={{ padding: "10px 12px" }}>
            Vytvoriť účet
          </button>
        </div>

        {msg && <div style={{ padding: 10, background: "#f3f4f6" }}>{msg}</div>}
        <p style={{ opacity: 0.75 }}>Najprv si vytvor účet, potom sa prihlás.</p>
      </div>
    </main>
  );
}