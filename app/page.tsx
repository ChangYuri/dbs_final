import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Compass,
  MapPinned,
  Navigation,
  Search,
  ShieldCheck
} from "lucide-react";

export default function Home() {
  const proofPoints = [
    {
      label: "Travel",
      value: "Open the map where you are and scan nearby public history."
    },
    {
      label: "Discover",
      value: "Search a city or place before you arrive."
    },
    {
      label: "Sources",
      value: "Read short stories with Wikipedia and Wikidata attribution."
    }
  ];

  const steps = [
    {
      icon: <Navigation size={22} />,
      title: "Start with a place",
      copy: "Use your current location, Hyde Park by default, or search ahead for a city."
    },
    {
      icon: <MapPinned size={22} />,
      title: "Follow the markers",
      copy: "Lore ranks nearby people, places, events, institutions, routes, culture, and landmarks."
    },
    {
      icon: <BookOpenText size={22} />,
      title: "Read the trail",
      copy: "Each spot opens into a concise attributed story with source links and saved places."
    }
  ];

  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-atlas" aria-hidden="true">
          <div className="atlas-grid" />
          <div className="atlas-river" />
          <div className="atlas-block atlas-block-a" />
          <div className="atlas-block atlas-block-b" />
          <div className="atlas-block atlas-block-c" />
          <div className="atlas-route atlas-route-a" />
          <div className="atlas-route atlas-route-b" />
          <div className="atlas-pin atlas-pin-a" />
          <div className="atlas-pin atlas-pin-b" />
          <div className="atlas-pin atlas-pin-c" />
          <div className="atlas-tabs">
            <div className="atlas-tab">
              <span>01</span>
              <strong>Travel</strong>
              <small>Nearby stories while the page is open.</small>
            </div>
            <div className="atlas-tab">
              <span>02</span>
              <strong>Discover</strong>
              <small>Search a city before you arrive.</small>
            </div>
            <div className="atlas-tab">
              <span>03</span>
              <strong>Sources</strong>
              <small>Wikipedia and Wikidata attribution.</small>
            </div>
          </div>
        </div>

        <nav className="landing-nav" aria-label="Landing navigation">
          <Link className="landing-mark" href="/">
            Lore
          </Link>
          <Link className="landing-nav-link" href="/app">
            Open app
          </Link>
        </nav>

        <div className="landing-hero-copy">
          <p className="landing-kicker">Location-aware historical discovery</p>
          <h1 id="landing-title">Lore turns the map around you into a sourced field atlas.</h1>
          <p className="landing-lede">
            Find nearby places with public history, choose a marker, and read the story behind the street,
            building, route, or institution you are standing near.
          </p>

          <div className="landing-actions">
            <Link className="landing-primary" href="/app">
              Start exploring
              <ArrowRight size={18} />
            </Link>
            <a className="landing-secondary" href="#how-it-works">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section className="landing-band landing-proof" aria-label="Project highlights">
        {proofPoints.map((point) => (
          <article className="landing-proof-item" key={point.label}>
            <p>{point.label}</p>
            <strong>{point.value}</strong>
          </article>
        ))}
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section-head">
          <p className="landing-kicker">Core loop</p>
          <h2>Built for walking, planning, and reading in place.</h2>
        </div>

        <div className="landing-step-grid">
          {steps.map((step) => (
            <article className="landing-step" key={step.title}>
              <div className="landing-step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-split">
        <div>
          <p className="landing-kicker">Why Lore</p>
          <h2>A quiet interface for public history, not another travel feed.</h2>
        </div>
        <div className="landing-manifest">
          <p>
            Lore keeps browsing useful without login, treats location as foreground-only, and keeps
            Wikipedia and Wikidata as the source of truth. Personal features stay personal: save what matters,
            then keep exploring.
          </p>
          <div className="landing-badges">
            <span><ShieldCheck size={16} /> Source-backed</span>
            <span><Compass size={16} /> Map-first</span>
            <span><Search size={16} /> City planning</span>
          </div>
        </div>
      </section>
    </main>
  );
}
