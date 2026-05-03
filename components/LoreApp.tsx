"use client";

import dynamic from "next/dynamic";
import {
  BookOpenText,
  ExternalLink,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cacheCellKey,
  DEFAULT_RADIUS_METERS,
  fetchWikipediaSpots,
  formatDistance,
  HYDE_PARK_LOCATION,
  LocationPoint,
  PlanningLocation,
  searchPlanningLocations,
  shouldRefreshSpots,
  Spot
} from "@/lib/spots";

const LoreMap = dynamic(() => import("@/components/LoreMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map</div>
});

type LoadState = "idle" | "loading" | "success" | "error";

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

  const cacheRef = useRef(new Map<string, Spot[]>());
  const watchIdRef = useRef<number | null>(null);
  const lastFetchLocationRef = useRef<LocationPoint | null>(null);

  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId) ?? spots[0] ?? null,
    [selectedSpotId, spots]
  );

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpotId(spot.id);
  }, []);

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
          setMessage("Nearby stories refreshed from cache.");
        }

        return;
      }

      setLoadState("loading");

      try {
        const nextSpots = await fetchWikipediaSpots(location, DEFAULT_RADIUS_METERS);
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
          setMessage("Nearby stories updated.");
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
      setPlanningQuery(location.label);
      void loadSpots(location, { reason: "planning" });
    },
    [loadSpots, stopWalkMode]
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
    setPlanningQuery("");
    setPlanningResults([]);
    setSearchState("idle");
    void loadSpots(HYDE_PARK_LOCATION, { reason: "preset" });
  }, [loadSpots, stopWalkMode]);

  const refresh = useCallback(() => {
    void loadSpots(activeLocation, { force: true, reason: "manual" });
  }, [activeLocation, loadSpots]);

  const visibleSpots = spots.slice(0, 18);
  const statusText =
    loadState === "loading"
      ? "Finding stories"
      : walkMode
        ? "Walk mode"
        : updatedAt
          ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : "Ready";

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="Nearby stories">
        <div className="brand-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div className="brand-mark" aria-hidden="true">
              <Landmark size={22} strokeWidth={2.4} />
            </div>
            <div className="brand-copy">
              <h1 className="brand-title">Lore</h1>
              <p className="brand-subtitle">{activeLocation.label}</p>
            </div>
          </div>

          <div className={`status-pill${walkMode ? " is-live" : ""}`}>
            <span className="pulse" />
            {statusText}
          </div>
        </div>

        <div className="action-grid">
          <button className="action-button primary" type="button" onClick={resetToHydePark}>
            <MapPin size={17} />
            Hyde Park
          </button>
          <button className={`action-button${walkMode ? " live" : ""}`} type="button" onClick={startWalkMode}>
            {walkMode ? <Radio size={17} /> : <LocateFixed size={17} />}
            {walkMode ? "Live" : "Near me"}
          </button>
          <button className="action-button" type="button" onClick={refresh} disabled={loadState === "loading"}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        <form className="planning-form" onSubmit={searchForPlanningLocation}>
          <label className="section-heading" htmlFor="planning-search">
            Plan
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
            <button
              className="planning-submit"
              type="submit"
              disabled={searchState === "loading"}
              aria-label="Search place"
            >
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
        </form>

        <section style={{ display: "grid", gap: 12 }}>
          <h2 className="section-heading">Nearby</h2>

          {loadState === "loading" && spots.length === 0 ? (
            <div className="empty-state">Loading nearby sourced places.</div>
          ) : visibleSpots.length > 0 ? (
            <div className="spot-list">
              {visibleSpots.map((spot) => (
                <button
                  className={`spot-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`}
                  key={spot.id}
                  type="button"
                  onClick={() => selectSpot(spot)}
                >
                  <div>
                    <h3 className="spot-title">{spot.title}</h3>
                    <div className="spot-meta">
                      <span>{formatDistance(spot.distanceMeters)}</span>
                      <span className="spot-source">
                        <BookOpenText size={13} />
                        {spot.sourceName}
                      </span>
                    </div>
                    {spot.summary ? <p className="spot-summary">{spot.summary}</p> : null}
                  </div>

                  {spot.imageUrl ? <img className="spot-image" src={spot.imageUrl} alt="" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No sourced places found here yet. Try refreshing, moving the map with walk mode, or returning to Hyde Park.
            </div>
          )}
        </section>
      </aside>

      <section className="map-region" aria-label="Map">
        <LoreMap
          center={activeLocation}
          spots={visibleSpots}
          selectedSpotId={selectedSpot?.id ?? null}
          onSelectSpot={selectSpot}
          userLocation={userLocation}
        />
        <div className="map-vignette" />

        <div className="map-toolbar">
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
            <h2 className="detail-title">{selectedSpot.title}</h2>
            <div className="spot-meta">
              <span>{formatDistance(selectedSpot.distanceMeters)} from {activeLocation.label}</span>
              <span className="spot-source">
                <BookOpenText size={13} />
                {selectedSpot.sourceName}
              </span>
            </div>
            <p className="detail-copy">
              {selectedSpot.summary ??
                "This place has a sourced location marker, but the summary is not available from Wikipedia yet."}
            </p>
            <div className="detail-actions">
              <a className="source-link" href={selectedSpot.sourceUrl} target="_blank" rel="noreferrer">
                Open source
                <ExternalLink size={15} />
              </a>
              <button className="icon-button close-button" type="button" onClick={() => setSelectedSpotId(null)} aria-label="Close details">
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
