"use client";

import dynamic from "next/dynamic";
import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import PersonalAccessGate from "@/components/PersonalAccessGate";
import SaveSpotButton from "@/components/SaveSpotButton";
import {
  BookOpenText,
  Check,
  Clock3,
  ExternalLink,
  Flame,
  LogIn,
  LogOut,
  Box,
  Map as MapIcon,
  MapPin,
  LocateFixed,
  Navigation,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { type SyntheticEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  bootstrapUserData,
  deleteUserPlace,
  getRecentPlanningLocations,
  getSavedSpots,
  getUserPlaces,
  getUserDataStorageKey,
  rememberPlanningLocation as recordRecentPlanningLocation,
  saveSpot,
  setSavedSpots,
  setUserDataOwner,
  setUserPreferences,
  unsaveSpot,
  upsertUserPlace
} from "@/lib/user-data";

const LoreMap = dynamic(() => import("@/components/LoreMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map</div>
});

type LoadState = "idle" | "loading" | "success" | "error";
type AppMode = "travel" | "discover";
type MapVariant = "standard" | "three-d";
type AuthStatus = "loading" | "guest" | "signed-in";
type PendingPersonalAction =
  | { type: "auth-only" }
  | { type: "save"; spot: Spot; shouldSave: boolean };
type PlaceDraft = {
  id: string | null;
  title: string;
  introduction: string;
  theme: Spot["theme"];
  lat: number;
  lng: number;
};

const DEFAULT_PLACE_THEME: Spot["theme"] = "places";

function readSharedSpotParams() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const spotId = params.get("spot")?.trim();
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lng = Number.parseFloat(params.get("lng") ?? "");

  if (!spotId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    spotId,
    location: {
      lat,
      lng,
      label: params.get("label")?.trim() || "Shared spot"
    }
  };
}

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
  const [userPlaces, setUserPlaces] = useState<Spot[]>([]);
  const [recentLocations, setRecentLocations] = useState<PlanningLocation[]>([]);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [placeEditorOpen, setPlaceEditorOpen] = useState(false);
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft | null>(null);
  const [pinnedLocation, setPinnedLocation] = useState<LocationPoint | null>(null);
  const [discoverMapCenter, setDiscoverMapCenter] = useState<LocationPoint>(HYDE_PARK_LOCATION);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authNote, setAuthNote] = useState<string | null>(null);
  const [pendingPersonalAction, setPendingPersonalAction] = useState<PendingPersonalAction | null>(null);
  const [mapVariant, setMapVariant] = useState<MapVariant>("standard");
  const { isLoaded, isSignedIn, user } = useUser();
  const [pendingSharedSpotId, setPendingSharedSpotId] = useState<string | null>(null);

  const cacheRef = useRef(new Map<string, Spot[]>());
  const watchIdRef = useRef<number | null>(null);
  const lastFetchLocationRef = useRef<LocationPoint | null>(null);
  const initialSharedSpotRef = useRef<ReturnType<typeof readSharedSpotParams>>(null);
  const discoverMapCenterRef = useRef<LocationPoint>(HYDE_PARK_LOCATION);

  const selectedSpot = useMemo(
    () =>
      spots.find((spot) => spot.id === selectedSpotId) ??
      userPlaces.find((spot) => spot.id === selectedSpotId) ??
      savedSpots.find((spot) => spot.id === selectedSpotId) ??
      null,
    [savedSpots, selectedSpotId, spots, userPlaces]
  );

  const savedSpotIds = useMemo(() => new Set(savedSpots.map((spot) => spot.id)), [savedSpots]);
  const selectedSpotIsUserPlace = selectedSpot?.sourceName === "User note";
  const selectedSpotDistance = useMemo(
    () => (selectedSpot ? distanceMeters(activeLocation, selectedSpot) : undefined),
    [activeLocation, selectedSpot]
  );
  const selectedSpotSources = selectedSpot?.sources ?? [];
  const selectedSpotIntro = selectedSpot ? selectedSpot.teaser || selectedSpot.narrative.slice(0, 2).join(" ") : "";
  const selectedSpotMoreNarrative = selectedSpot
    ? selectedSpot.narrative
        .filter((line) => line && line !== selectedSpotIntro && !selectedSpotIntro.includes(line))
        .slice(0, 10)
    : [];
  const hasMoreDetail = Boolean(
    selectedSpot && (selectedSpotMoreNarrative.length > 0 || selectedSpot.facts.length > 2 || selectedSpot.whyThisMatters)
  );
  const travelLocation = userLocation ?? HYDE_PARK_LOCATION;
  const savedSpotCount = savedSpots.length;
  const mapUserLocation = mode === "discover" ? null : userLocation;
  const heroTitle =
    mode === "discover"
      ? "Search"
      : walkMode
        ? "Live"
        : "Nearby";
  const heroKicker = mode === "discover" ? "Discover" : walkMode ? "Travel" : "Travel";
  const authStatus: AuthStatus = !isLoaded ? "loading" : isSignedIn ? "signed-in" : "guest";
  const authUserLabel = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account";
  const draftPlaceSpot = useMemo<Spot | null>(() => {
    if (!placeEditorOpen || !placeDraft) {
      return null;
    }

    const title = placeDraft.title.trim() || "Draft place";
    const introduction = placeDraft.introduction.trim() || "Draft map note";

    return {
      id: placeDraft.id ?? "user-place:draft",
      title,
      lat: placeDraft.lat,
      lng: placeDraft.lng,
      distanceMeters: distanceMeters(activeLocation, placeDraft),
      summary: introduction,
      teaser: introduction,
      narrative: [introduction],
      facts: [`${placeDraft.lat.toFixed(5)}, ${placeDraft.lng.toFixed(5)}`],
      sourceName: "User note",
      sourceUrl: "",
      sources: [
        {
          name: "User note",
          url: "",
          quality: 5
        }
      ],
      sourceLabel: "User note",
      matchCount: 1,
      relevanceScore: 100,
      theme: placeDraft.theme,
      signals: ["Draft place"],
      whyThisMatters: ""
    };
  }, [activeLocation, placeDraft, placeEditorOpen]);

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpotId(spot.id);
  }, []);

  const requestPersonalAccess = useCallback((action: PendingPersonalAction, note?: string) => {
    setPendingPersonalAction(action);
    setAuthNote(note ?? null);
    setAuthGateOpen(true);
  }, []);

  const toggleSavedSpot = useCallback(
    async (spot: Spot, shouldSave: boolean) => {
      if (authStatus !== "signed-in") {
        requestPersonalAccess(
          { type: "save", spot, shouldSave },
          authStatus === "loading" ? "Loading your Clerk session." : "Sign in to save spots to your collection."
        );
        return;
      }

      const nextSavedSpots = shouldSave ? await saveSpot(spot) : await unsaveSpot(spot.id);

      setSavedSpotsState(nextSavedSpots);
      setMessage(shouldSave ? "Saved to your collection." : "Removed from saved spots.");
    },
    [authStatus, requestPersonalAccess]
  );

  const rememberPlanningLocation = useCallback(async (location: PlanningLocation) => {
    const nextLocations = await recordRecentPlanningLocation(location);

    setRecentLocations(nextLocations);
  }, []);

  const loadSpots = useCallback(
    async (location: LocationPoint, options?: { force?: boolean; reason?: "manual" | "walk" | "preset" | "planning" }) => {
      const key = cacheCellKey(location);
      const cached = cacheRef.current.get(key);

      setActiveLocation(location);
      void setUserPreferences({ lastLocation: location });

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
    let cancelled = false;

    const hydrate = async () => {
      const sharedSpot = initialSharedSpotRef.current ?? readSharedSpotParams();
      initialSharedSpotRef.current = sharedSpot;

      setUserDataOwner(isSignedIn ? user?.id ?? null : null);
      const userData = await bootstrapUserData();

      if (cancelled) {
        return;
      }

      const initialMode = sharedSpot ? "discover" : userData.preferences.defaultMode ?? "travel";
      const initialLocation = sharedSpot?.location ?? userData.preferences.lastLocation ?? HYDE_PARK_LOCATION;

      setMode(initialMode);
      setActiveLocation(initialLocation);
      setDiscoverMapCenter(initialLocation);
      discoverMapCenterRef.current = initialLocation;
      setPinnedLocation(sharedSpot?.location ?? null);
      setPendingSharedSpotId(sharedSpot?.spotId ?? null);
      setSavedSpotsState(userData.savedSpots);
      setUserPlaces(userData.userPlaces);
      setRecentLocations(userData.recentPlanningLocations);

      void loadSpots(initialLocation, { reason: sharedSpot ? "planning" : "preset" });
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, loadSpots, user?.id]);

  useEffect(() => {
    const syncUserData = (event: StorageEvent) => {
      if (event.key === getUserDataStorageKey()) {
        setSavedSpotsState(getSavedSpots());
        setUserPlaces(getUserPlaces());
        setRecentLocations(getRecentPlanningLocations());
      }
    };

    window.addEventListener("storage", syncUserData);
    return () => window.removeEventListener("storage", syncUserData);
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
    if (!pendingSharedSpotId) {
      return;
    }

    const sharedSpot =
      spots.find((spot) => spot.id === pendingSharedSpotId) ??
      userPlaces.find((spot) => spot.id === pendingSharedSpotId) ??
      savedSpots.find((spot) => spot.id === pendingSharedSpotId);

    if (sharedSpot) {
      setSelectedSpotId(sharedSpot.id);
      setPendingSharedSpotId(null);
      return;
    }

    if (loadState === "success" || loadState === "error") {
      setPendingSharedSpotId(null);
      setMessage("That shared spot is not available in this map view.");
    }
  }, [loadState, pendingSharedSpotId, savedSpots, spots, userPlaces]);

  useEffect(() => {
    if (authStatus !== "signed-in" || !pendingPersonalAction) {
      return;
    }

    const action = pendingPersonalAction;
    setPendingPersonalAction(null);
    setAuthGateOpen(false);
    setAuthNote(null);

    if (action.type === "save") {
      void (action.shouldSave ? saveSpot(action.spot) : unsaveSpot(action.spot.id)).then((nextSavedSpots) => {
        setSavedSpotsState(nextSavedSpots);
        setMessage(action.shouldSave ? "Saved to your collection." : "Removed from saved spots.");
      });
    }
  }, [authStatus, pendingPersonalAction]);

  useEffect(() => {
    if (!selectedSpot || selectedSpot.sourceName !== "Wikidata") {
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

          const nextSavedSpots = currentSavedSpots.map((spot) => (spot.id === hydratedSpot.id ? hydratedSpot : spot));
          void setSavedSpots(nextSavedSpots);
          return nextSavedSpots;
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
      void setUserPreferences({ defaultMode: "discover", lastLocation: location });
      setPinnedLocation(location);
      setDiscoverMapCenter(location);
      discoverMapCenterRef.current = location;
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
      void rememberPlanningLocation(location);
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
      void setUserPreferences({ defaultMode: nextMode });
      setPinnedLocation(null);
      setUserLocation(null);
      setPlaceEditorOpen(false);
      setPlaceDraft(null);

      if (nextMode === "discover") {
        setDiscoverMapCenter(activeLocation);
        discoverMapCenterRef.current = activeLocation;
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
      void setUserPreferences({ defaultMode: "discover" });

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

        setMessage("Choose a place from the results.");
      } catch (error) {
        setSearchState("error");
        setMessage(error instanceof Error ? error.message : "Unable to search that place.");
      }
    },
    [planningQuery]
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
    void setUserPreferences({ defaultMode: "travel" });
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

  const refresh = useCallback(() => {
    void loadSpots(activeLocation, { force: true, reason: "manual" });
  }, [activeLocation, loadSpots]);

  const handleSavedDrawerToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      const nextOpen = event.currentTarget.open;

      setSavedDrawerOpen(nextOpen);
    },
    []
  );

  const pinCurrentView = useCallback(() => {
    if (mode !== "discover") {
      return;
    }

    pinExploreLocation(discoverMapCenterRef.current, { message: "Loading stories around this pin." });
  }, [mode, pinExploreLocation]);

  const handleDiscoverCenterChange = useCallback((location: LocationPoint) => {
    setDiscoverMapCenter(location);
    discoverMapCenterRef.current = location;
  }, []);

  const handleDiscoverMapClick = useCallback(
    (location: LocationPoint) => {
      if (mode !== "discover") {
        return;
      }

      setActiveLocation(location);
      setDiscoverMapCenter(location);
      discoverMapCenterRef.current = location;
      setPinnedLocation(location);
      setSelectedSpotId(null);
      setMessage("Pin placed. Click Pin here to load nearby stories.");
    },
    [mode]
  );

  const openNewPlaceEditor = useCallback(() => {
    const draftLocation = userLocation ?? activeLocation;

    setPlaceDraft({
      id: null,
      title: "",
      introduction: "",
      theme: DEFAULT_PLACE_THEME,
      lat: draftLocation.lat,
      lng: draftLocation.lng
    });
    setPlaceEditorOpen(true);
    setMessage("Click the map to move the place marker.");
  }, [activeLocation, userLocation]);

  const openEditPlaceEditor = useCallback((spot: Spot) => {
    setPlaceDraft({
      id: spot.id,
      title: spot.title,
      introduction: spot.teaser || spot.summary || spot.narrative[0] || "",
      theme: spot.theme,
      lat: spot.lat,
      lng: spot.lng
    });
    setPlaceEditorOpen(true);
    setMessage("Update the note or click the map to move it.");
  }, []);

  const closePlaceEditor = useCallback(() => {
    setPlaceEditorOpen(false);
    setPlaceDraft(null);
  }, []);

  const handleTravelMapClick = useCallback(
    (location: LocationPoint) => {
      if (mode !== "travel" || !placeEditorOpen) {
        return;
      }

      setPlaceDraft((draft) =>
        draft
          ? {
              ...draft,
              lat: location.lat,
              lng: location.lng
            }
          : draft
      );
      setMessage("Place marker moved.");
    },
    [mode, placeEditorOpen]
  );

  const saveUserPlace = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!placeDraft) {
        return;
      }

      const title = placeDraft.title.trim();
      const introduction = placeDraft.introduction.trim();

      if (!title || !introduction) {
        setMessage("Add a label and introduction for this place.");
        return;
      }

      const id = placeDraft.id ?? `user-place:${Date.now()}`;
      const nextPlace: Spot = {
        id,
        title,
        lat: placeDraft.lat,
        lng: placeDraft.lng,
        distanceMeters: distanceMeters(activeLocation, placeDraft),
        summary: introduction,
        teaser: introduction,
        narrative: [introduction],
        facts: [`${placeDraft.lat.toFixed(5)}, ${placeDraft.lng.toFixed(5)}`],
        sourceName: "User note",
        sourceUrl: "",
        sources: [
          {
            name: "User note",
            url: "",
            quality: 5
          }
        ],
        sourceLabel: "User note",
        matchCount: 1,
        relevanceScore: 100,
        theme: placeDraft.theme,
        signals: ["User place"],
        whyThisMatters: ""
      };

      const nextPlaces = await upsertUserPlace(nextPlace);

      setUserPlaces(nextPlaces);
      setSelectedSpotId(id);
      closePlaceEditor();
      setMessage(placeDraft.id ? "Place updated." : "Place added to your map.");
    },
    [activeLocation, closePlaceEditor, placeDraft]
  );

  const removeUserPlace = useCallback(
    async (spot: Spot) => {
      const nextPlaces = await deleteUserPlace(spot.id);

      setUserPlaces(nextPlaces);
      setSelectedSpotId(null);
      closePlaceEditor();
      setMessage("Place removed from your map.");
    },
    [closePlaceEditor]
  );

  const copySpotLink = useCallback(async () => {
    if (!selectedSpot || typeof window === "undefined") {
      return;
    }

    const url = new URL("/app", window.location.origin);

    url.searchParams.set("spot", selectedSpot.id);
    url.searchParams.set("lat", String(selectedSpot.lat));
    url.searchParams.set("lng", String(selectedSpot.lng));
    url.searchParams.set("label", selectedSpot.title);

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedSpot.title,
          text: selectedSpot.teaser || selectedSpot.summary || "Open this Lore spot.",
          url: url.toString()
        });
        return;
      }

      await navigator.clipboard.writeText(url.toString());
      setMessage("Spot link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessage("Unable to copy this link.");
    }
  }, [selectedSpot]);

  const mapSpots = useMemo(() => {
    const visibleUserPlaces = draftPlaceSpot ? userPlaces.filter((place) => place.id !== draftPlaceSpot.id) : userPlaces;
    const nearbySpots = [...(draftPlaceSpot ? [draftPlaceSpot] : []), ...visibleUserPlaces, ...spots];

    if (!selectedSpot || nearbySpots.some((spot) => spot.id === selectedSpot.id)) {
      return nearbySpots;
    }

    return [...nearbySpots, selectedSpot];
  }, [draftPlaceSpot, selectedSpot, spots, userPlaces]);

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
  const authGateTitle = "Sign in with Clerk";
  const authGateCopy =
    authStatus === "loading"
      ? "Loading your Clerk session."
      : "Sign in to continue.";

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="Lore controls">
        <header className="brand-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div className="brand-copy">
              <h1 className="brand-title">Lore</h1>
            </div>
          </div>

          <div className="header-actions">
            <div className={`status-pill${walkMode ? " is-live" : ""}`}>
              <span className="pulse" />
              {statusText}
            </div>

            {authStatus === "signed-in" ? (
              <SignOutButton>
                <button className="account-action" type="button" aria-label="Sign out" title={authUserLabel}>
                  <LogOut size={18} />
                </button>
              </SignOutButton>
            ) : (
              <SignInButton mode="modal">
                <button className="account-action" type="button" aria-label="Sign in" title="Sign in">
                  <LogIn size={18} />
                </button>
              </SignInButton>
            )}
          </div>
        </header>

        <section className="hero-card">
          <p className="hero-kicker">{heroKicker}</p>
          <h2 className="hero-title">{heroTitle}</h2>
          <div className="hero-stats" aria-label="Current context">
            <div className="stat-card">
              <span className="stat-label">Area</span>
              <strong className="stat-value">{activeLocation.label}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Saved</span>
              <strong className="stat-value">{savedSpotCount}</strong>
            </div>
          </div>
        </section>

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

        {mode === "discover" ? (
          <form className="planning-form" onSubmit={searchForPlanningLocation}>
            <label className="section-heading" htmlFor="planning-search">
              Place
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
                placeholder="City or landmark"
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
        ) : null}

        <div className="action-grid" aria-label="Quick actions">
          {mode === "discover" ? (
            <button className="action-button primary" type="button" onClick={pinCurrentView}>
              <MapPin size={17} />
              Pin here
            </button>
          ) : (
            <button className={`action-button${walkMode ? " live" : ""}`} type="button" onClick={startWalkMode}>
              {walkMode ? <Radio size={17} /> : <LocateFixed size={17} />}
              {walkMode ? "Pause live" : "Use my location"}
            </button>
          )}
          {mode === "travel" ? (
            <button className="action-button primary" type="button" onClick={openNewPlaceEditor}>
              <Plus size={17} />
              Add place
            </button>
          ) : null}
          <button className="action-button" type="button" onClick={handleSurprise} disabled={!surpriseSpot}>
            <Sparkles size={17} />
            Surprise me
          </button>
        </div>

        {mode === "travel" && placeEditorOpen && placeDraft ? (
          <form className="place-editor" onSubmit={saveUserPlace}>
            <div className="section-title-row">
              <label className="section-heading" htmlFor="place-label">
                Place note
              </label>
              <button className="icon-button compact" type="button" onClick={closePlaceEditor} aria-label="Close place editor">
                <X size={15} />
              </button>
            </div>
            <input
              id="place-label"
              className="place-input"
              value={placeDraft.title}
              onChange={(event) => setPlaceDraft((draft) => (draft ? { ...draft, title: event.target.value } : draft))}
              placeholder="Label this location"
              maxLength={80}
            />
            <textarea
              className="place-textarea"
              value={placeDraft.introduction}
              onChange={(event) => setPlaceDraft((draft) => (draft ? { ...draft, introduction: event.target.value } : draft))}
              placeholder="Write a short introduction"
              rows={4}
              maxLength={420}
            />
            <select
              className="place-select"
              value={placeDraft.theme}
              onChange={(event) => setPlaceDraft((draft) => (draft ? { ...draft, theme: event.target.value as Spot["theme"] } : draft))}
              aria-label="Place theme"
            >
              <option value="places">Place</option>
              <option value="landmarks">Landmark</option>
              <option value="culture">Culture</option>
              <option value="events">Event</option>
              <option value="people">People</option>
              <option value="institutions">Institution</option>
              <option value="transport">Transport</option>
            </select>
            <p className="place-coordinates">
              {placeDraft.lat.toFixed(5)}, {placeDraft.lng.toFixed(5)}
            </p>
            <button className="action-button primary" type="submit">
              <Check size={17} />
              {placeDraft.id ? "Update place" : "Save place"}
            </button>
          </form>
        ) : null}

        {mode === "travel" && userPlaces.length > 0 ? (
          <section className="user-place-section" aria-label="Your places">
            <div className="section-title-row">
              <span className="section-heading">Your places</span>
              <span className="saved-count">{userPlaces.length}</span>
            </div>
            <div className="user-place-list">
              {userPlaces.slice(0, 4).map((place) => (
                <article className={`saved-card${place.id === selectedSpot?.id ? " is-selected" : ""}`} key={place.id}>
                  <button className="saved-card-main" type="button" onClick={() => selectSpot(place)}>
                    <h3 className="saved-title">{place.title}</h3>
                    <span className="saved-meta">{themeLabel(place.theme)}</span>
                  </button>
                  <button className="icon-button compact" type="button" onClick={() => openEditPlaceEditor(place)} aria-label={`Edit ${place.title}`}>
                    <Pencil size={15} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <details className="saved-drawer" open={savedDrawerOpen} onToggle={handleSavedDrawerToggle}>
          <summary className="saved-drawer-summary">
            <div>
              <span className="mini-heading">Saved spots</span>
            </div>
            <span className="saved-drawer-count">{savedSpotCount}</span>
          </summary>

          {authStatus === "signed-in" ? (
            savedSpots.length > 0 ? (
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
              <div className="empty-state">No saved spots.</div>
            )
          ) : (
            <div className="empty-state empty-state-auth">
              <p>Sign in to continue.</p>
              <button
                className="action-button primary"
                type="button"
                onClick={() =>
                  requestPersonalAccess(
                    { type: "auth-only" },
                    "Sign in to continue."
                  )
                }
              >
                Sign in
              </button>
            </div>
          )}
        </details>

        <section className="spot-section" aria-label="Nearby stories">
          <div className="section-title-row">
            <span className="section-heading">Signal Stack</span>
            <span className="saved-count">{spots.length}</span>
          </div>
          <p className="section-note">
            {loadState === "loading"
              ? "Scanning the map for public records."
              : spots.length > 0
                ? "Tap a record to pull it into focus."
                : "No nearby records loaded yet."}
          </p>
          <div className="spot-list">
            {spots.slice(0, 6).map((spot, index) => (
              <article className={`spot-card${spot.id === selectedSpot?.id ? " is-selected" : ""}`} key={spot.id}>
                <button className="spot-card-main" type="button" onClick={() => selectSpot(spot)}>
                  <div className="spot-copy">
                    <div className="spot-headline">
                      <span className="spot-index">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="spot-title">{spot.title}</h3>
                    </div>
                    <div className="spot-meta">
                      <span>{themeLabel(spot.theme)}</span>
                      <span>{formatDistance(distanceMeters(activeLocation, spot))}</span>
                    </div>
                    <p className="spot-summary">{spot.teaser || spot.narrative[0] || "Open the record for sourced context."}</p>
                  </div>
                  {spot.imageUrl ? <img className="spot-image" src={spot.imageUrl} alt="" /> : <Flame className="spot-glyph" size={24} />}
                </button>
              </article>
            ))}
          </div>
        </section>
      </aside>

      <section className="map-region" aria-label="Map">
        <LoreMap
          center={activeLocation}
          spots={mapSpots}
          selectedSpotId={selectedSpot?.id ?? null}
          onSelectSpot={selectSpot}
          userLocation={mapUserLocation}
          pinnedLocation={mode === "discover" ? pinnedLocation : null}
          onMapClick={mode === "discover" ? handleDiscoverMapClick : mode === "travel" && placeEditorOpen ? handleTravelMapClick : undefined}
          onCenterChange={mode === "discover" ? handleDiscoverCenterChange : undefined}
          variant={mapVariant}
        />
        <div className="map-vignette" />

        <div className="map-toolbar">
          <div className="map-variant-switch" role="group" aria-label="Map style">
            <button
              className={`icon-button map-variant-button${mapVariant === "standard" ? " is-active" : ""}`}
              type="button"
              onClick={() => setMapVariant("standard")}
              aria-label="Use standard map"
              title="Standard map"
            >
              <MapIcon size={18} />
            </button>
            <button
              className={`icon-button map-variant-button${mapVariant === "three-d" ? " is-active" : ""}`}
              type="button"
              onClick={() => setMapVariant("three-d")}
              aria-label="Use 3D map"
              title="3D map"
            >
              <Box size={18} />
            </button>
          </div>
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
          {mode === "discover" && pinnedLocation ? (
            <div className="map-pin-label" aria-live="polite" title={`Pinned at ${pinnedLocation.lat.toFixed(4)}, ${pinnedLocation.lng.toFixed(4)}`}>
              <span className="map-pin-label-kicker">Pinned view</span>
              <span className="map-pin-label-value">{pinnedLocation.label}</span>
            </div>
          ) : null}
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
              <span className="detail-distance">{formatDistance(selectedSpotDistance)}</span>
              <span className="source-count">
                {selectedSpot.sourceName}
              </span>
            </div>
            <h2 className="detail-title">{selectedSpot.title}</h2>
            <div className="detail-meta">
              <span>{formatDistance(selectedSpotDistance)} from {activeLocation.label}</span>
              <span className="spot-source">
                <BookOpenText size={13} />
                {selectedSpot.sourceName === "User note"
                  ? "Personal map note"
                  : selectedSpot.sourceName === "Wikipedia"
                    ? "Wikipedia article"
                    : "Wikidata record"}
              </span>
            </div>
            {selectedSpotIntro ? <p className="detail-summary">{selectedSpotIntro}</p> : null}
            {selectedSpot.facts.length > 0 ? (
              <div className="detail-fact-list" aria-label="Spot facts">
                {selectedSpot.facts.slice(0, 3).map((fact) => (
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
                onClick={() => {
                  setDetailExpanded((expanded) => !expanded);
                }}
                aria-expanded={detailExpanded}
              >
                {detailExpanded ? "Show less" : "Read more"}
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
            <div className="detail-actions">
              <div className="detail-primary-actions">
                <button className="source-link secondary" type="button" onClick={() => void copySpotLink()}>
                  Share
                  <Share2 size={15} />
                </button>
                {selectedSpotIsUserPlace ? (
                  <>
                    <button className="source-link" type="button" onClick={() => openEditPlaceEditor(selectedSpot)}>
                      Edit place
                      <Pencil size={15} />
                    </button>
                    <button className="source-link danger" type="button" onClick={() => void removeUserPlace(selectedSpot)}>
                      Remove
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <SaveSpotButton spot={selectedSpot} saved={savedSpotIds.has(selectedSpot.id)} onToggle={toggleSavedSpot} showLabel />
                    <a className="source-link" href={selectedSpot.sourceUrl} target="_blank" rel="noreferrer">
                      Read source
                      <ExternalLink size={15} />
                    </a>
                  </>
                )}
              </div>
            </div>
            {!selectedSpotIsUserPlace && selectedSpotSources.length > 1 ? (
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
        <PersonalAccessGate
          open={authGateOpen}
          title={authGateTitle}
          copy={authGateCopy}
          onClose={() => {
            setAuthGateOpen(false);
            setPendingPersonalAction(null);
            setAuthNote(null);
          }}
          statusNote={authNote ?? null}
        />
      </section>
    </main>
  );
}
