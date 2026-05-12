export default function NotFound() {
  return (
    <main className="app-shell" style={{ display: "grid", placeItems: "center" }}>
      <section className="hero-card" style={{ maxWidth: 520, textAlign: "center" }}>
        <p className="hero-kicker">404</p>
        <h1 className="hero-title">That page is not here.</h1>
      </section>
    </main>
  );
}
