export default function MovePage() {
  return (
    <main>
      <h1>Pohyb</h1>
      <p>Zatiaľ základná stránka. Po deployi doplníme: príjem/výdaj/presun + skenovanie.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/products">Produkty</a>
        <a href="/login">Login</a>
        <a href="/">Domov</a>
      </div>
    </main>
  );
}