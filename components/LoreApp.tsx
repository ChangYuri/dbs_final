"use client";

import dynamic from "next/dynamic";
import SaveSpotButton from "@/components/SaveSpotButton";
import {
  BookOpenText,
  ExternalLink,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cacheCellKey,
  DEFAULT_RADIUS_METERS,
  distanceMeters,
  fetchWikipediaSpots,
  formatDistance,
  HYDE_PARK_LOCATION,
  LocationPoint,
  shouldRefreshSpots,
  Spot
} from "@/lib/spots";
import { getSavedSpots, saveSpot, SAVED_SPOTS_STORAGE_KEY, unsaveSpot } from "@/lib/saved-spots";

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
  const [savedSpots, setSavedSpotsState] = useState<Spot[]>([]);

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

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpotId(spot.id);
  }, []);

  const toggleSavedSpot = useCallback((spot: Spot, shouldSave: boolean) => {
    const nextSavedSpots = shouldSave ? saveSpot(spot) : unsaveSpot(spot.id);

    setSavedSpotsState(nextSavedSpots);
    setMessage(shouldSave ? "Saved spot." : "Removed from saved spots.");
  }, []);

  const loadSpots = useCallback(
    async (location: LocationPoint, options?: { force?: boolean; reason?: "manual" | "walk" | "preset" }) => {
      const key = cacheCellKey(location);
      const cached = cacheRef.current.get(key);

      setActiveLocation(location);

      if (cached && !options?.force) {
        setSpots(cached);
        setSelectedSpotId((current) => current ?? cached[0]?.id ?? null);
        setUpdatedAt(new Date());
        lastFetchLocationRef.current = location;

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

  const stopWalkMode = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setWalkMode(false);
    setMessage("Walk mode paused.");
  }, []);

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
    stopWalkMode();
    setUserLocation(null);
    void loadSpots(HYDE_PARK_LOCATION, { reason: "preset" });
  }, [loadSpots, stopWalkMode]);

  const refresh = useCallback(() => {
    void loadSpots(activeLocation, { force: true, reason: "manual" });
  }, [activeLocation, loadSpots]);

  const visibleSpots = useMemo(() => spots.slice(0, 18), [spots]);
  const previewSavedSpots = useMemo(() => savedSpots.slice(0, 4), [savedSpots]);
  const mapSpots = useMemo(() => {
    if (!selectedSpot || visibleSpots.some((spot) => spot.id === selectedSpot.id)) {
      return visibleSpots;
    }

    return [...visibleSpots, selectedSpot];
  }, [selectedSpot, visibleSpots]);
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

        {previewSavedSpots.length > 0 ? (
          <section className="saved-section" aria-label="Saved spots">
            <div className="section-title-row">
              <h2 className="section-heading">Saved</h2>
              <span className="saved-count">{savedSpots.length}</span>
            </div>

            <div className="saved-list">
              {previewSavedSpots.map((spot) => (
                <article className={`saved-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`} key={spot.id}>
                  <button className="saved-card-main" type="button" onClick={() => selectSpot(spot)}>
                    <h3 className="saved-title">{spot.title}</h3>
                    <span className="saved-meta">{spot.sourceName}</span>
                  </button>
                  <SaveSpotButton spot={spot} saved={savedSpotIds.has(spot.id)} onToggle={toggleSavedSpot} />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section style={{ display: "grid", gap: 12 }}>
          <h2 className="section-heading">Nearby</h2>

          {loadState === "loading" && spots.length === 0 ? (
            <div className="empty-state">Loading nearby sourced places.</div>
          ) : visibleSpots.length > 0 ? (
            <div className="spot-list">
              {visibleSpots.map((spot) => (
                <article
                  className={`spot-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`}
                  key={spot.id}
                >
                  <button className="spot-card-main" type="button" onClick={() => selectSpot(spot)}>
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

                  <SaveSpotButton spot={spot} saved={savedSpotIds.has(spot.id)} onToggle={toggleSavedSpot} />
                </article>
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
          spots={mapSpots}
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
              <span>{formatDistance(selectedSpotDistance)} from {activeLocation.label}</span>
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
              <div className="detail-primary-actions">
                <SaveSpotButton
                  spot={selectedSpot}
                  saved={savedSpotIds.has(selectedSpot.id)}
                  onToggle={toggleSavedSpot}
                  showLabel
                />
                <a className="source-link" href={selectedSpot.sourceUrl} target="_blank" rel="noreferrer">
                  Open source
                  <ExternalLink size={15} />
                </a>
              </div>
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
