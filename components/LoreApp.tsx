"use client";

import dynamic from "next/dynamic";
import SaveSpotButton from "@/components/SaveSpotButton";
import {
  BookOpenText,
  Clock3,
  ExternalLink,
  Landmark,
  Layers3,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cacheCellKey,
  DEFAULT_RADIUS_METERS,
  distanceMeters,
  fetchNearbySpots,
  formatDistance,
  HYDE_PARK_LOCATION,
  LocationPoint,
  PlanningLocation,
  searchPlanningLocations,
  shouldRefreshSpots,
  Spot,
  SpotTheme,
  themeChoices,
  themeLabel
} from "@/lib/spots";
import { getSavedSpots, saveSpot, SAVED_SPOTS_STORAGE_KEY, unsaveSpot } from "@/lib/saved-spots";

const LoreMap = dynamic(() => import("@/components/LoreMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map</div>
});

type LoadState = "idle" | "loading" | "success" | "error";
type ThemeFilter = SpotTheme | "all";

const RECENT_PLACES_STORAGE_KEY = "lore:recent-planning-locations";
const MAX_RECENT_PLACES = 5;
const THEME_FILTERS: Array<{ value: ThemeFilter; label: string }> = [
  { value: "all", label: "All history" },
  ...themeChoices()
];

export default function LoreApp() {
  const [activeLocation, setActiveLocation] = useState<LocationPoint>(HYDE_PARK_LOCATION);
  const [userLocation, setUserLocation] = useState<LocationPoint | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [walkMode, setWalkMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [planningQuery, setPlanningQuery] = useState("");
  const [planningResults, setPlanningResults] = useState<PlanningLocation[]>([]);
  const [searchState, setSearchState] = useState<LoadState>("idle");
  const [savedSpots, setSavedSpotsState] = useState<Spot[]>([]);
  const [recentLocations, setRecentLocations] = useState<PlanningLocation[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeFilter>("all");

  const cacheRef = useRef(new Map<string, Spot[]>());
  const watchIdRef = useRef<number | null>(null);
  const lastFetchLocationRef = useRef<LocationPoint | null>(null);

  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId) ?? savedSpots.find((spot) => spot.id === selectedSpotId) ?? spots[0] ?? null,
    [savedSpots, selectedSpotId, spots]
  );

  const savedSpotIds = useMemo(() => new Set(savedSpots.map((spot) => spot.id)), [savedSpots]);
  const selectedSpotDistance = useMemo(
    () => (selectedSpot ? distanceMeters(activeLocation, selectedSpot) : undefined),
    [activeLocation, selectedSpot]
  );
  const selectedSpotSources = selectedSpot?.sources ?? [];

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpotId(spot.id);
  }, []);

  const toggleSavedSpot = useCallback((spot: Spot, shouldSave: boolean) => {
    const nextSavedSpots = shouldSave ? saveSpot(spot) : unsaveSpot(spot.id);

    setSavedSpotsState(nextSavedSpots);
    setMessage(shouldSave ? "Saved to your collection." : "Removed from saved spots.");
  }, []);

  const rememberPlanningLocation = useCallback(
    (location: PlanningLocation) => {
      const nextLocations = [
        location,
        ...recentLocations.filter((recentLocation) => recentLocation.id !== location.id)
      ].slice(0, MAX_RECENT_PLACES);

      setRecentLocations(nextLocations);

      try {
        window.localStorage.setItem(RECENT_PLACES_STORAGE_KEY, JSON.stringify(nextLocations));
      } catch {
        // Recent places are a convenience only; failing storage should not block search.
      }
    },
    [recentLocations]
  );

  const loadSpots = useCallback(
    async (location: LocationPoint, options?: { force?: boolean; reason?: "manual" | "walk" | "preset" | "planning" }) => {
      const key = cacheCellKey(location);
      const cached = cacheRef.current.get(key);

      setActiveLocation(location);

      if (cached && !options?.force) {
        setSpots(cached);
        setSelectedSpotId((current) => current ?? cached[0]?.id ?? null);
        setUpdatedAt(new Date());
        lastFetchLocationRef.current = location;
        setLoadState("success");

        if (options?.reason === "walk") {
          setMessage("Nearby history refreshed from cache.");
        }

        return;
      }

      setLoadState("loading");

      try {
        const nextSpots = await fetchNearbySpots(location, DEFAULT_RADIUS_METERS);
        cacheRef.current.set(key, nextSpots);
        setSpots(nextSpots);
        setSelectedSpotId((current) => {
          if (current && nextSpots.some((spot) => spot.id === current)) {
            return current;
          }

          return nextSpots[0]?.id ?? null;
        });
        setUpdatedAt(new Date());
        lastFetchLocationRef.current = location;
        setLoadState("success");

        if (options?.reason === "walk") {
          setMessage("Nearby history updated.");
        }
      } catch (error) {
        setLoadState("error");
        setMessage(error instanceof Error ? error.message : "Unable to load nearby stories.");
      }
    },
    []
  );

  useEffect(() => {
    void loadSpots(HYDE_PARK_LOCATION, { reason: "preset" });
  }, [loadSpots]);

  useEffect(() => {
    setSavedSpotsState(getSavedSpots());

    const syncSavedSpots = (event: StorageEvent) => {
      if (event.key === SAVED_SPOTS_STORAGE_KEY) {
        setSavedSpotsState(getSavedSpots());
      }
    };

    window.addEventListener("storage", syncSavedSpots);
    return () => window.removeEventListener("storage", syncSavedSpots);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_PLACES_STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return;
      }

      setRecentLocations(
        parsed
          .filter((location): location is PlanningLocation => {
            return (
              location &&
              typeof location === "object" &&
              typeof location.id === "string" &&
              typeof location.label === "string" &&
              typeof location.description === "string" &&
              typeof location.lat === "number" &&
              typeof location.lng === "number"
            );
          })
          .slice(0, MAX_RECENT_PLACES)
      );
    } catch {
      setRecentLocations([]);
    }
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const stopWalkMode = useCallback((options?: { silent?: boolean }) => {
    const hadActiveWatch = watchIdRef.current !== null;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setWalkMode(false);

    if (hadActiveWatch && !options?.silent) {
      setMessage("Walk mode paused.");
    }
  }, []);

  const selectPlanningLocation = useCallback(
    (location: PlanningLocation) => {
      stopWalkMode({ silent: true });
      setUserLocation(null);
      setShowSavedOnly(false);
      setPlanningQuery(location.label);
      rememberPlanningLocation(location);
      void loadSpots(location, { reason: "planning" });
    },
    [loadSpots, rememberPlanningLocation, stopWalkMode]
  );

  const searchForPlanningLocation = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const query = planningQuery.trim();

      if (!query) {
        setPlanningResults([]);
        setSearchState("idle");
        setMessage("Enter a city or place to plan.");
        return;
      }

      setSearchState("loading");
      setMessage(null);

      try {
        const results = await searchPlanningLocations(query);
        setPlanningResults(results);
        setSearchState("success");

        if (results.length === 0) {
          setMessage("No places matched that search.");
          return;
        }

        selectPlanningLocation(results[0]);
      } catch (error) {
        setSearchState("error");
        setMessage(error instanceof Error ? error.message : "Unable to search that place.");
      }
    },
    [planningQuery, selectPlanningLocation]
  );

  const startWalkMode = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setMessage("Location is not available in this browser.");
      return;
    }

    if (watchIdRef.current !== null) {
      stopWalkMode();
      return;
    }

    setWalkMode(true);
    setMessage("Waiting for location permission.");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Current location"
        };

        setUserLocation(nextLocation);
        setActiveLocation(nextLocation);
        setMessage(null);

        if (shouldRefreshSpots(lastFetchLocationRef.current, nextLocation)) {
          void loadSpots(nextLocation, { reason: "walk" });
        }
      },
      (error) => {
        setWalkMode(false);
        setMessage(error.message || "Location permission was not granted.");

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 45_000,
        timeout: 12_000
      }
    );
  }, [loadSpots, stopWalkMode]);

  const resetToHydePark = useCallback(() => {
    stopWalkMode({ silent: true });
    setUserLocation(null);
    setShowSavedOnly(false);
    setActiveTheme("all");
    setPlanningQuery("");
    setPlanningResults([]);
    setSearchState("idle");
    void loadSpots(HYDE_PARK_LOCATION, { reason: "preset" });
  }, [loadSpots, stopWalkMode]);

  const refresh = useCallback(() => {
    void loadSpots(activeLocation, { force: true, reason: "manual" });
  }, [activeLocation, loadSpots]);

  const currentPool = useMemo(() => {
    if (showSavedOnly) {
      return savedSpots.map((spot) => ({
        ...spot,
        distanceMeters: distanceMeters(activeLocation, spot)
      }));
    }

    return spots;
  }, [activeLocation, savedSpots, showSavedOnly, spots]);

  const filteredSpots = useMemo(() => {
    const themedPool = activeTheme === "all" ? currentPool : currentPool.filter((spot) => spot.theme === activeTheme);
    return themedPool;
  }, [activeTheme, currentPool]);

  const visibleSpots = useMemo(() => filteredSpots.slice(0, showSavedOnly ? 24 : 18), [filteredSpots, showSavedOnly]);

  const previewSavedSpots = useMemo(() => {
    const themedSaved = activeTheme === "all" ? savedSpots : savedSpots.filter((spot) => spot.theme === activeTheme);
    return showSavedOnly ? themedSaved : themedSaved.slice(0, 4);
  }, [activeTheme, savedSpots, showSavedOnly]);

  const mapSpots = useMemo(() => {
    if (!selectedSpot || visibleSpots.some((spot) => spot.id === selectedSpot.id)) {
      return visibleSpots;
    }

    return [...visibleSpots, selectedSpot];
  }, [selectedSpot, visibleSpots]);

  const discoveryCounts = useMemo(() => {
    return spots.reduce<Record<ThemeFilter, number>>(
      (counts, spot) => {
        counts.all += 1;
        counts[spot.theme] += 1;
        return counts;
      },
      {
        all: 0,
        firsts: 0,
        education: 0,
        "civil-rights": 0,
        events: 0,
        people: 0,
        architecture: 0,
        transport: 0,
        culture: 0,
        landmark: 0
      }
    );
  }, [spots]);

  const themeSpotCount = activeTheme === "all" ? filteredSpots.length : discoveryCounts[activeTheme];

  const surpriseSpot = useMemo(() => {
    if (filteredSpots.length === 0) {
      return null;
    }

    return filteredSpots.find((spot) => spot.id !== selectedSpot?.id) ?? filteredSpots[0] ?? null;
  }, [filteredSpots, selectedSpot?.id]);

  useEffect(() => {
    if (!selectedSpotId || activeTheme === "all") {
      return;
    }

    if (filteredSpots.length > 0 && !filteredSpots.some((spot) => spot.id === selectedSpotId)) {
      setSelectedSpotId(filteredSpots[0].id);
    }
  }, [activeTheme, filteredSpots, selectedSpotId]);

  const handleSurprise = useCallback(() => {
    if (!surpriseSpot) {
      setMessage("No surprise history found yet.");
      return;
    }

    setSelectedSpotId(surpriseSpot.id);
    setMessage(`Try ${surpriseSpot.title}.`);
  }, [surpriseSpot]);

  const statusText =
    loadState === "loading"
      ? "Finding stories"
      : walkMode
        ? "Live history"
        : updatedAt
          ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : "Ready";

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="Nearby stories">
        <header className="brand-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div className="brand-mark" aria-hidden="true">
              <Landmark size={22} strokeWidth={2.4} />
            </div>
            <div className="brand-copy">
              <h1 className="brand-title">Lore</h1>
              <p className="brand-subtitle">Discover hidden history around normal places.</p>
            </div>
          </div>

          <div className={`status-pill${walkMode ? " is-live" : ""}`}>
            <span className="pulse" />
            {statusText}
          </div>
        </header>

        <section className="hero-card" aria-label="Discovery summary">
          <div className="hero-copy">
            <p className="hero-kicker">Nearby history, not just landmarks</p>
            <h2 className="hero-title">{activeLocation.label}</h2>
            <p className="hero-deck">
              Find the firsts, institutions, routes, and small places with a bigger story than their appearance suggests.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-value">{spots.length}</span>
              <span className="stat-label">stories</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{savedSpots.length}</span>
              <span className="stat-label">saved</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{themeSpotCount}</span>
              <span className="stat-label">{activeTheme === "all" ? "visible" : themeLabel(activeTheme)}</span>
            </div>
          </div>
        </section>

        <div className="action-grid">
          <button className="action-button primary" type="button" onClick={resetToHydePark}>
            <MapPin size={17} />
            Hyde Park
          </button>
          <button className={`action-button${walkMode ? " live" : ""}`} type="button" onClick={startWalkMode}>
            {walkMode ? <Radio size={17} /> : <LocateFixed size={17} />}
            {walkMode ? "Live" : "Near me"}
          </button>
          <button className="action-button" type="button" onClick={handleSurprise} disabled={!surpriseSpot}>
            <Sparkles size={17} />
            Surprise me
          </button>
          <button className="action-button" type="button" onClick={refresh} disabled={loadState === "loading"}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        <section className="discovery-strip" aria-label="History filters">
          {THEME_FILTERS.map((theme) => (
            <button
              key={theme.value}
              type="button"
              className={`discovery-chip${activeTheme === theme.value ? " is-active" : ""}`}
              onClick={() => setActiveTheme(theme.value)}
            >
              <span>{theme.label}</span>
              <span className="discovery-chip-count">{discoveryCounts[theme.value]}</span>
            </button>
          ))}
        </section>

        <form className="planning-form" onSubmit={searchForPlanningLocation}>
          <label className="section-heading" htmlFor="planning-search">
            Plan ahead
          </label>
          <div className="planning-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="planning-search"
              type="search"
              value={planningQuery}
              onChange={(event) => {
                setPlanningQuery(event.target.value);

                if (!event.target.value.trim()) {
                  setPlanningResults([]);
                  setSearchState("idle");
                }
              }}
              placeholder="Search city or landmark"
              autoComplete="off"
            />
            <button className="planning-submit" type="submit" disabled={searchState === "loading"} aria-label="Search place">
              <Search size={16} />
            </button>
          </div>

          {planningResults.length > 0 ? (
            <div className="planning-results" aria-label="Planning search results">
              {planningResults.map((location) => (
                <button
                  className={`planning-result${activeLocation.label === location.label ? " is-selected" : ""}`}
                  key={location.id}
                  type="button"
                  onClick={() => selectPlanningLocation(location)}
                >
                  <span className="planning-result-title">{location.label}</span>
                  <span className="planning-result-meta">{location.description}</span>
                </button>
              ))}
            </div>
          ) : null}

          {recentLocations.length > 0 ? (
            <div className="recent-locations" aria-label="Recent planning locations">
              <div className="mini-heading">
                <Clock3 size={13} />
                Recent
              </div>
              <div className="recent-location-list">
                {recentLocations.map((location) => (
                  <button
                    className={`recent-location${activeLocation.label === location.label ? " is-selected" : ""}`}
                    key={location.id}
                    type="button"
                    onClick={() => selectPlanningLocation(location)}
                  >
                    {location.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>

        {previewSavedSpots.length > 0 ? (
          <section className="saved-section" aria-label="Saved spots">
            <div className="section-title-row">
              <h2 className="section-heading">Saved</h2>
              <button className="saved-toggle" type="button" onClick={() => setShowSavedOnly((current) => !current)}>
                <Layers3 size={14} />
                {showSavedOnly ? "Nearby" : savedSpots.length}
              </button>
            </div>

            <div className="saved-list">
              {previewSavedSpots.map((spot) => (
                <article className={`saved-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`} key={spot.id}>
                  <button className="saved-card-main" type="button" onClick={() => selectSpot(spot)}>
                    <h3 className="saved-title">{spot.title}</h3>
                    <span className="saved-meta">{themeLabel(spot.theme)}</span>
                  </button>
                  <SaveSpotButton spot={spot} saved={savedSpotIds.has(spot.id)} onToggle={toggleSavedSpot} />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="spot-section">
          <div className="section-title-row">
            <h2 className="section-heading">{showSavedOnly ? "Saved history" : "Nearby history"}</h2>
            {!showSavedOnly && spots.length > 0 ? (
              <span className="source-count">
                <Layers3 size={13} />
                {spots.filter((spot) => spot.matchCount > 1).length} multi-source
              </span>
            ) : null}
          </div>

          <p className="section-note">
            {showSavedOnly
              ? "Your saved places, filtered as a history collection."
              : "The app favors locations with concrete historical clues, not just famous attractions."}
          </p>

          {loadState === "loading" && spots.length === 0 ? (
            <div className="empty-state">Loading nearby sourced places.</div>
          ) : visibleSpots.length > 0 ? (
            <div className="spot-list">
              {visibleSpots.map((spot) => (
                <article className={`spot-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`} key={spot.id}>
                  <button className="spot-card-main" type="button" onClick={() => selectSpot(spot)}>
                    <div className="spot-copy">
                      <div className="spot-headline">
                        <h3 className="spot-title">{spot.title}</h3>
                        <span className={`confidence-badge confidence-${spot.confidence}`}>{spot.confidence}</span>
                      </div>
                      <div className="spot-meta">
                        <span>{formatDistance(spot.distanceMeters)}</span>
                        <span className="spot-source">
                          <BookOpenText size={13} />
                          {spot.sourceLabel}
                        </span>
                      </div>
                      <div className="spot-badges">
                        <span className="spot-badge is-theme">{themeLabel(spot.theme)}</span>
                        {spot.signals.slice(0, 3).map((signal) => (
                          <span className="spot-badge" key={signal}>
                            {signal}
                          </span>
                        ))}
                      </div>
                      {spot.summary ? <p className="spot-summary">{spot.summary}</p> : null}
                    </div>

                    {spot.imageUrl ? <img className="spot-image" src={spot.imageUrl} alt="" /> : null}
                  </button>

                  <SaveSpotButton spot={spot} saved={savedSpotIds.has(spot.id)} onToggle={toggleSavedSpot} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No history matches this filter yet. Try a different topic, turn off saved-only mode, or hit Surprise me.
            </div>
          )}
        </section>
      </aside>

      <section className="map-region" aria-label="Map">
        <LoreMap
          center={activeLocation}
          spots={mapSpots}
          selectedSpotId={selectedSpot?.id ?? null}
          onSelectSpot={selectSpot}
          userLocation={userLocation}
        />
        <div className="map-vignette" />

        <div className="map-toolbar">
          <button className="icon-button" type="button" onClick={handleSurprise} disabled={!surpriseSpot} aria-label="Surprise me">
            <Sparkles size={18} />
          </button>
          <button className="icon-button" type="button" onClick={startWalkMode} aria-label="Toggle walk mode">
            {walkMode ? <Radio size={18} /> : <Navigation size={18} />}
          </button>
          <button className="icon-button" type="button" onClick={refresh} disabled={loadState === "loading"} aria-label="Refresh stories">
            <RefreshCw size={18} />
          </button>
        </div>

        {selectedSpot ? (
          <article className="detail-panel" aria-label={`${selectedSpot.title} details`}>
            {selectedSpot.imageUrl ? <img className="detail-media" src={selectedSpot.imageUrl} alt="" /> : null}
            <div className="detail-kicker-row">
              <span className={`confidence-badge confidence-${selectedSpot.confidence}`}>{selectedSpot.confidence}</span>
              <span className="detail-theme">{themeLabel(selectedSpot.theme)}</span>
            </div>
            <h2 className="detail-title">{selectedSpot.title}</h2>
            <div className="spot-meta">
              <span>
                {formatDistance(selectedSpotDistance)} from {activeLocation.label}
              </span>
              <span className="spot-source">
                <BookOpenText size={13} />
                {selectedSpot.sourceLabel}
              </span>
            </div>
            {selectedSpotSources.length > 1 ? (
              <div className="source-stack" aria-label="Spot sources">
                {selectedSpotSources.map((source) => (
                  <a className="source-chip" href={source.url} target="_blank" rel="noreferrer" key={source.name}>
                    {source.name}
                  </a>
                ))}
              </div>
            ) : null}
            <p className="detail-copy">{selectedSpot.whyThisMatters}</p>
            {selectedSpot.signals.length > 0 ? (
              <div className="detail-tags">
                {selectedSpot.signals.map((signal) => (
                  <span className="detail-tag" key={signal}>
                    {signal}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="detail-note">
              {selectedSpot.summary ??
                "This place has a sourced location marker, but the summary is not available yet."}
            </p>
            <div className="detail-actions">
              <div className="detail-primary-actions">
                <SaveSpotButton spot={selectedSpot} saved={savedSpotIds.has(selectedSpot.id)} onToggle={toggleSavedSpot} showLabel />
                <a className="source-link" href={selectedSpot.sourceUrl} target="_blank" rel="noreferrer">
                  Open source
                  <ExternalLink size={15} />
                </a>
              </div>
              <button
                className="icon-button close-button"
                type="button"
                onClick={() => setSelectedSpotId(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>
          </article>
        ) : null}

        {message ? <div className="toast">{message}</div> : null}
      </section>
    </main>
  );
}
