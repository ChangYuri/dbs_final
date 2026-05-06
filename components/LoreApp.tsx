"use client";

import dynamic from "next/dynamic";
import SaveSpotButton from "@/components/SaveSpotButton";
import {
  BookOpenText,
  Clock3,
  ExternalLink,
  Landmark,
  MapPin,
  LocateFixed,
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
  hydrateSpotFromWikipediaTitle,
  HYDE_PARK_LOCATION,
  LocationPoint,
  PlanningLocation,
  searchPlanningLocations,
  shouldRefreshSpots,
  Spot,
  themeLabel
} from "@/lib/spots";
import { getSavedSpots, saveSpot, SAVED_SPOTS_STORAGE_KEY, setSavedSpots, unsaveSpot } from "@/lib/saved-spots";

const LoreMap = dynamic(() => import("@/components/LoreMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map</div>
});

type LoadState = "idle" | "loading" | "success" | "error";
type AppMode = "travel" | "discover";

const RECENT_PLACES_STORAGE_KEY = "lore:recent-planning-locations";
const MAX_RECENT_PLACES = 5;

export default function LoreApp() {
  const [activeLocation, setActiveLocation] = useState<LocationPoint>(HYDE_PARK_LOCATION);
  const [userLocation, setUserLocation] = useState<LocationPoint | null>(null);
  const [mode, setMode] = useState<AppMode>("travel");
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
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<LocationPoint | null>(null);

  const cacheRef = useRef(new Map<string, Spot[]>());
  const watchIdRef = useRef<number | null>(null);
  const lastFetchLocationRef = useRef<LocationPoint | null>(null);

  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId) ?? savedSpots.find((spot) => spot.id === selectedSpotId) ?? null,
    [savedSpots, selectedSpotId, spots]
  );

  const savedSpotIds = useMemo(() => new Set(savedSpots.map((spot) => spot.id)), [savedSpots]);
  const selectedSpotDistance = useMemo(
    () => (selectedSpot ? distanceMeters(activeLocation, selectedSpot) : undefined),
    [activeLocation, selectedSpot]
  );
  const selectedSpotSources = selectedSpot?.sources ?? [];
  const selectedSpotIntro = selectedSpot ? selectedSpot.narrative.slice(0, 5).join(" ") : "";
  const selectedSpotMoreNarrative = selectedSpot ? selectedSpot.narrative.slice(5) : [];
  const hasMoreDetail = Boolean(
    selectedSpot && (selectedSpot.narrative.length > 1 || selectedSpot.facts.length > 0 || selectedSpot.whyThisMatters)
  );
  const travelLocation = userLocation ?? HYDE_PARK_LOCATION;
  const savedSpotCount = savedSpots.length;
  const mapUserLocation = mode === "discover" ? pinnedLocation : userLocation;

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

  const loadTravelSpots = useCallback(
    (options?: { force?: boolean; reason?: "manual" | "walk" | "preset" | "planning" }) => {
      void loadSpots(travelLocation, options ?? { reason: userLocation ? "walk" : "preset" });
    },
    [loadSpots, travelLocation, userLocation]
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
    setDetailExpanded(false);
  }, [selectedSpotId]);

  useEffect(() => {
    if (!selectedSpot || selectedSpot.sourceName === "Wikipedia") {
      return;
    }

    let cancelled = false;

    void hydrateSpotFromWikipediaTitle(selectedSpot)
      .then((hydratedSpot) => {
        if (cancelled || hydratedSpot.sourceName !== "Wikipedia") {
          return;
        }

        setSpots((currentSpots) =>
          currentSpots.map((spot) => (spot.id === hydratedSpot.id ? hydratedSpot : spot))
        );
        setSavedSpotsState((currentSavedSpots) => {
          if (!currentSavedSpots.some((spot) => spot.id === hydratedSpot.id)) {
            return currentSavedSpots;
          }

          return setSavedSpots(currentSavedSpots.map((spot) => (spot.id === hydratedSpot.id ? hydratedSpot : spot)));
        });
      })
      .catch(() => {
        // A missed Wikipedia hydration should not block the sourced Wikidata record.
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpot]);

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

  const pinExploreLocation = useCallback(
    (location: LocationPoint, options?: { message?: string }) => {
      stopWalkMode({ silent: true });
      setMode("discover");
      setPinnedLocation(location);
      setUserLocation(null);
      setPlanningResults([]);
      setSearchState("idle");
      setSelectedSpotId(null);
      setMessage(options?.message ?? `Pinned ${location.label}.`);
      void loadSpots(location, { reason: "planning" });
    },
    [loadSpots, stopWalkMode]
  );

  const selectPlanningLocation = useCallback(
    (location: PlanningLocation) => {
      setPlanningQuery(location.label);
      rememberPlanningLocation(location);
      pinExploreLocation(location, { message: `Exploring ${location.label}.` });
    },
    [pinExploreLocation, rememberPlanningLocation]
  );

  const switchMode = useCallback(
    (nextMode: AppMode) => {
      if (nextMode === mode) {
        return;
      }

      stopWalkMode({ silent: true });
      setMode(nextMode);
      setPinnedLocation(null);
      setUserLocation(null);

      if (nextMode === "discover") {
        setMessage("Discover mode: search for a city or place.");
        return;
      }

      setPlanningResults([]);
      setSearchState("idle");
      setPlanningQuery("");
      loadTravelSpots();
    },
    [loadTravelSpots, mode, stopWalkMode]
  );

  const searchForPlanningLocation = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMode("discover");

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

    setMode("travel");
    setPinnedLocation(null);
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
    setMode("travel");
    setUserLocation(null);
    setPinnedLocation(null);
    setPlanningQuery("");
    setPlanningResults([]);
    setSearchState("idle");
    void loadSpots(HYDE_PARK_LOCATION, { reason: "preset" });
  }, [loadSpots, stopWalkMode]);

  const refresh = useCallback(() => {
    void loadSpots(activeLocation, { force: true, reason: "manual" });
  }, [activeLocation, loadSpots]);

  const pinCurrentView = useCallback(() => {
    if (mode !== "discover") {
      return;
    }

    pinExploreLocation(activeLocation, { message: `Pinned ${activeLocation.label}.` });
  }, [activeLocation, mode, pinExploreLocation]);

  const handleDiscoverMapClick = useCallback(
    (location: LocationPoint) => {
      if (mode !== "discover") {
        return;
      }

      pinExploreLocation(location);
    },
    [mode, pinExploreLocation]
  );

  const mapSpots = useMemo(() => {
    if (!selectedSpot || spots.some((spot) => spot.id === selectedSpot.id)) {
      return spots;
    }

    return [...spots, selectedSpot];
  }, [selectedSpot, spots]);

  const surpriseSpot = useMemo(() => {
    if (spots.length === 0) {
      return null;
    }

    return spots.find((spot) => spot.id !== selectedSpot?.id) ?? spots[0] ?? null;
  }, [selectedSpot?.id, spots]);

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
      : mode === "discover"
        ? searchState !== "idle" || planningResults.length > 0
          ? updatedAt
            ? `Planned ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "Discover mode"
          : "Discover mode"
        : walkMode
          ? "Live history"
          : updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : "Travel mode";
  const sectionNote =
    mode === "discover"
      ? "Search a city or click the map to drop a pin, then explore what is nearby."
      : "Live location stays foreground-only while you walk.";
  const sidebarPrompt = mode === "discover" ? "Plan ahead" : "Walk mode";

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="Lore controls">
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

        <div className="mode-switch" role="tablist" aria-label="Lore mode">
          <button
            className={`mode-switch-button${mode === "travel" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={mode === "travel"}
            onClick={() => switchMode("travel")}
          >
            Travel
          </button>
          <button
            className={`mode-switch-button${mode === "discover" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={mode === "discover"}
            onClick={() => switchMode("discover")}
          >
            Discover
          </button>
        </div>

        <section className="control-summary" aria-label="Mode summary">
          <p className="control-summary-kicker">{sidebarPrompt}</p>
          <h2 className="control-summary-title">{activeLocation.label}</h2>
          <p className="control-summary-copy">{sectionNote}</p>
        </section>

        <div className="quick-actions" aria-label="Quick actions">
          {mode === "discover" ? (
            <button className="action-button primary" type="button" onClick={pinCurrentView}>
              <MapPin size={17} />
              Pin here
            </button>
          ) : (
            <button className={`action-button${walkMode ? " live" : ""}`} type="button" onClick={startWalkMode}>
              {walkMode ? <Radio size={17} /> : <LocateFixed size={17} />}
              {walkMode ? "Live" : "Near me"}
            </button>
          )}
          <button className="action-button" type="button" onClick={handleSurprise} disabled={!surpriseSpot}>
            <Sparkles size={17} />
            Surprise me
          </button>
        </div>

        {mode === "discover" ? (
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
        ) : (
          <section className="mode-callout" aria-label="Planning mode hint">
            <p className="mode-callout-title">Discover owns planning.</p>
            <p className="mode-callout-copy">Switch to Discover to search for a city or place before exploring it.</p>
          </section>
        )}

        <details className="saved-drawer" open={savedDrawerOpen} onToggle={(event) => setSavedDrawerOpen(event.currentTarget.open)}>
          <summary className="saved-drawer-summary">
            <span>Saved spots</span>
            <span className="saved-drawer-count">{savedSpotCount}</span>
          </summary>

          {savedSpots.length > 0 ? (
            <div className="saved-drawer-list">
              {savedSpots.map((spot) => (
                <article className={`saved-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`} key={spot.id}>
                  <button className="saved-card-main" type="button" onClick={() => selectSpot(spot)}>
                    <h3 className="saved-title">{spot.title}</h3>
                    <span className="saved-meta">{themeLabel(spot.theme)}</span>
                  </button>
                  <SaveSpotButton spot={spot} saved={savedSpotIds.has(spot.id)} onToggle={toggleSavedSpot} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">Save spots from the detail panel to keep them here.</div>
          )}
        </details>
      </aside>

      <section className="map-region" aria-label="Map">
        <LoreMap
          center={activeLocation}
          spots={mapSpots}
          selectedSpotId={selectedSpot?.id ?? null}
          onSelectSpot={selectSpot}
          userLocation={mapUserLocation}
          onMapClick={mode === "discover" ? handleDiscoverMapClick : undefined}
        />
        <div className="map-vignette" />

        <div className="map-toolbar">
          <button className="icon-button" type="button" onClick={handleSurprise} disabled={!surpriseSpot} aria-label="Surprise me">
            <Sparkles size={18} />
          </button>
          {mode === "discover" ? (
            <button className="icon-button" type="button" onClick={pinCurrentView} aria-label="Pin current map view">
              <MapPin size={18} />
            </button>
          ) : (
            <button className="icon-button" type="button" onClick={startWalkMode} aria-label="Toggle walk mode">
              {walkMode ? <Radio size={18} /> : <Navigation size={18} />}
            </button>
          )}
          <button className="icon-button" type="button" onClick={refresh} disabled={loadState === "loading"} aria-label="Refresh stories">
            <RefreshCw size={18} />
          </button>
        </div>

        {selectedSpot ? (
          <article className="detail-panel" aria-label={`${selectedSpot.title} details`}>
            <button
              className="icon-button close-button detail-close"
              type="button"
              onClick={() => setSelectedSpotId(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>
            {selectedSpot.imageUrl ? <img className="detail-media" src={selectedSpot.imageUrl} alt="" /> : null}
            <div className="detail-kicker-row">
              <span className="detail-theme">{themeLabel(selectedSpot.theme)}</span>
            </div>
            <h2 className="detail-title">{selectedSpot.title}</h2>
            <div className="spot-meta">
              <span>
                {formatDistance(selectedSpotDistance)} from {activeLocation.label}
              </span>
              <span className="spot-source">
                <BookOpenText size={13} />
                {selectedSpot.sourceName === "Wikipedia" ? "Wikipedia article" : "Wikidata record"}
              </span>
            </div>
            {selectedSpotIntro ? <p className="detail-summary">{selectedSpotIntro}</p> : null}
            {selectedSpot.facts.length > 0 ? (
              <div className="detail-fact-list" aria-label="Spot facts">
                {selectedSpot.facts.slice(0, 2).map((fact) => (
                  <span className="detail-fact" key={fact}>
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
            {hasMoreDetail ? (
              <button
                className="learn-more-button"
                type="button"
                onClick={() => setDetailExpanded((current) => !current)}
                aria-expanded={detailExpanded}
              >
                {detailExpanded ? "Show less" : "Show more"}
              </button>
            ) : null}
            {detailExpanded && hasMoreDetail ? (
              <div className="detail-deep">
                {selectedSpotMoreNarrative.map((sentence) => (
                  <p className="detail-copy" key={sentence}>
                    {sentence}
                  </p>
                ))}
                {selectedSpot.facts.length > 2 ? (
                  <div className="detail-fact-list" aria-label="More spot facts">
                    {selectedSpot.facts.slice(2).map((fact) => (
                      <span className="detail-fact" key={fact}>
                        {fact}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedSpot.whyThisMatters ? <p className="detail-context">Context: {selectedSpot.whyThisMatters}</p> : null}
              </div>
            ) : null}
            {!detailExpanded ? <p className="detail-note">Click Show more for the longer article excerpt and more facts.</p> : null}
            <div className="detail-actions">
              <div className="detail-primary-actions">
                <SaveSpotButton spot={selectedSpot} saved={savedSpotIds.has(selectedSpot.id)} onToggle={toggleSavedSpot} showLabel />
                <a className="source-link" href={selectedSpot.sourceUrl} target="_blank" rel="noreferrer">
                  Open source
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>
            {selectedSpotSources.length > 1 ? (
              <div className="detail-source-note" aria-label="Sources">
                <span className="detail-source-label">Sources:</span>
                <div className="detail-source-list">
                  {selectedSpotSources.map((source) => (
                    <a className="detail-source-link" href={source.url} target="_blank" rel="noreferrer" key={source.name}>
                      {source.name}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ) : null}

        {message ? <div className="toast">{message}</div> : null}
      </section>
    </main>
  );
}
