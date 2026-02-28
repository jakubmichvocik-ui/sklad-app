export default function Home() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Skladový systém</h1>
      <p>Web + mobilná aplikácia pre 3 sklady.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <a href="/login">Prihlásenie</a>
        <a href="/products">Produkty</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/move">Pohyb + skenovanie</a>
      </div>
    </main>
  );
}