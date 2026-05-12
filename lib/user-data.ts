import type { PlanningLocation, Spot } from "@/lib/spots";

export type UserModePreference = "travel" | "discover";

export type UserPreferences = {
  defaultMode?: UserModePreference;
  lastLocation?: {
    lat: number;
    lng: number;
    label: string;
  };
};

export type SavedSpot = Spot;
export type UserPlace = Spot;

export type UserDataState = {
  savedSpots: SavedSpot[];
  userPlaces: UserPlace[];
  recentPlanningLocations: PlanningLocation[];
  preferences: UserPreferences;
};

const USER_DATA_STORAGE_KEY = "lore:user-data";
const MAX_RECENT_PLACES = 5;

const EMPTY_USER_DATA: UserDataState = {
  savedSpots: [],
  userPlaces: [],
  recentPlanningLocations: [],
  preferences: {}
};

let activeUserDataStorageKey = USER_DATA_STORAGE_KEY;
let cachedUserData: UserDataState = readLocalUserData();
let bootstrapPromise: Promise<UserDataState> | null = null;
let bootstrapComplete = false;

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isSavedSpot(value: unknown): value is SavedSpot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedSpot>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.lat === "number" &&
    typeof candidate.lng === "number" &&
    typeof candidate.sourceName === "string" &&
    typeof candidate.sourceUrl === "string"
  );
}

function isPlanningLocation(value: unknown): value is PlanningLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PlanningLocation>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.lat === "number" &&
    typeof candidate.lng === "number"
  );
}

function isUserModePreference(value: unknown): value is UserModePreference {
  return value === "travel" || value === "discover";
}

function normalizeSpot(spot: Spot): SavedSpot {
  const sources = spot.sources?.length
    ? spot.sources
    : [
        {
          name: spot.sourceName,
          url: spot.sourceUrl,
          quality: spot.sourceName === "Wikipedia" ? 4 : 3
        }
      ];

  return {
    id: spot.id,
    title: spot.title,
    lat: spot.lat,
    lng: spot.lng,
    distanceMeters: spot.distanceMeters,
    summary: spot.summary,
    teaser: spot.teaser ?? (spot.summary ? spot.summary.split(/(?<=[.!?])\s+/)[0] : spot.title),
    narrative: spot.narrative?.length ? spot.narrative : spot.summary ? spot.summary.split(/(?<=[.!?])\s+/).slice(0, 8) : [spot.title],
    facts: spot.facts ?? [],
    sourceName: spot.sourceName,
    sourceUrl: spot.sourceUrl,
    imageUrl: spot.imageUrl,
    sources,
    sourceLabel: spot.sourceLabel ?? sources.map((source) => source.name).join(" + "),
    matchCount: spot.matchCount ?? sources.length,
    relevanceScore: spot.relevanceScore ?? 0,
    theme: spot.theme ?? "landmarks",
    signals: spot.signals ?? [],
    whyThisMatters: spot.whyThisMatters ?? ""
  };
}

function normalizeUserPlace(place: UserPlace): UserPlace {
  const introduction = place.teaser || place.summary || place.narrative[0] || place.title;

  return {
    id: place.id,
    title: place.title,
    lat: place.lat,
    lng: place.lng,
    distanceMeters: place.distanceMeters,
    summary: introduction,
    teaser: introduction,
    narrative: place.narrative?.length ? place.narrative : [introduction],
    facts: place.facts ?? [],
    sourceName: "User note",
    sourceUrl: place.sourceUrl || "",
    imageUrl: place.imageUrl,
    sources: [
      {
        name: "User note",
        url: place.sourceUrl || "",
        quality: 5
      }
    ],
    sourceLabel: "User note",
    matchCount: 1,
    relevanceScore: place.relevanceScore ?? 100,
    theme: place.theme ?? "places",
    signals: place.signals ?? ["User place"],
    whyThisMatters: place.whyThisMatters ?? ""
  };
}

function normalizePlanningLocation(location: PlanningLocation): PlanningLocation {
  return {
    id: location.id,
    label: location.label,
    description: location.description,
    lat: location.lat,
    lng: location.lng
  };
}

function normalizeUserData(raw: unknown): UserDataState {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_USER_DATA };
  }

  const candidate = raw as Partial<UserDataState> & {
    preferences?: Partial<UserPreferences>;
  };

  return {
    savedSpots: Array.isArray(candidate.savedSpots) ? candidate.savedSpots.filter(isSavedSpot).map(normalizeSpot) : [],
    userPlaces: Array.isArray(candidate.userPlaces) ? candidate.userPlaces.filter(isSavedSpot).map(normalizeUserPlace) : [],
    recentPlanningLocations: Array.isArray(candidate.recentPlanningLocations)
      ? candidate.recentPlanningLocations.filter(isPlanningLocation).map(normalizePlanningLocation).slice(0, MAX_RECENT_PLACES)
      : [],
    preferences: {
      defaultMode: isUserModePreference(candidate.preferences?.defaultMode) ? candidate.preferences?.defaultMode : undefined,
      lastLocation:
        candidate.preferences?.lastLocation &&
        typeof candidate.preferences.lastLocation.lat === "number" &&
        typeof candidate.preferences.lastLocation.lng === "number" &&
        typeof candidate.preferences.lastLocation.label === "string"
          ? {
              lat: candidate.preferences.lastLocation.lat,
              lng: candidate.preferences.lastLocation.lng,
              label: candidate.preferences.lastLocation.label
            }
          : undefined
    }
  };
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return items.reduce<T[]>((nextItems, item) => {
    if (!nextItems.some((existing) => existing.id === item.id)) {
      nextItems.push(item);
    }

    return nextItems;
  }, []);
}

function readLocalUserData(): UserDataState {
  if (!canUseStorage()) {
    return { ...EMPTY_USER_DATA };
  }

  try {
    const raw = window.localStorage.getItem(activeUserDataStorageKey);

    if (!raw) {
      return { ...EMPTY_USER_DATA };
    }

    return normalizeUserData(JSON.parse(raw));
  } catch {
    return { ...EMPTY_USER_DATA };
  }
}

function writeLocalUserData(nextData: UserDataState) {
  if (!canUseStorage()) {
    return nextData;
  }

  try {
    window.localStorage.setItem(activeUserDataStorageKey, JSON.stringify(nextData));
  } catch {
    // Local persistence is best-effort.
  }

  return nextData;
}

async function getPersistedUserData() {
  const localData = readLocalUserData();
  cachedUserData = localData;
  return localData;
}

async function updateUserData(mutator: (current: UserDataState) => UserDataState) {
  if (!bootstrapComplete) {
    await bootstrapUserData();
  }

  const nextData = normalizeUserData(mutator(cachedUserData));
  cachedUserData = nextData;
  writeLocalUserData(nextData);

  return nextData;
}

export async function bootstrapUserData() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = getPersistedUserData().finally(() => {
    bootstrapComplete = true;
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export function setUserDataOwner(ownerId: string | null) {
  const nextStorageKey = ownerId ? `${USER_DATA_STORAGE_KEY}:${ownerId}` : USER_DATA_STORAGE_KEY;

  if (nextStorageKey === activeUserDataStorageKey) {
    return cachedUserData;
  }

  activeUserDataStorageKey = nextStorageKey;
  bootstrapPromise = null;
  bootstrapComplete = false;
  cachedUserData = readLocalUserData();

  return cachedUserData;
}

export function getUserData() {
  return cachedUserData;
}

export function getSavedSpots() {
  return cachedUserData.savedSpots;
}

export function getUserPlaces() {
  return cachedUserData.userPlaces;
}

export function getRecentPlanningLocations() {
  return cachedUserData.recentPlanningLocations;
}

export function getUserPreferences() {
  return cachedUserData.preferences;
}

export async function setSavedSpots(spots: SavedSpot[]) {
  const deduped = dedupeById(spots.map(normalizeSpot));

  return updateUserData((current) => ({
    ...current,
    savedSpots: deduped
  })).then((nextData) => nextData.savedSpots);
}

export function isSpotSaved(spotId: string, savedSpots = getSavedSpots()) {
  return savedSpots.some((spot) => spot.id === spotId);
}

export async function saveSpot(spot: Spot) {
  const nextSpot = normalizeSpot(spot);

  return updateUserData((current) => ({
    ...current,
    savedSpots: dedupeById([nextSpot, ...current.savedSpots.filter((savedSpot) => savedSpot.id !== spot.id)])
  })).then((nextData) => nextData.savedSpots);
}

export async function unsaveSpot(spotId: string) {
  return updateUserData((current) => ({
    ...current,
    savedSpots: current.savedSpots.filter((spot) => spot.id !== spotId)
  })).then((nextData) => nextData.savedSpots);
}

export async function upsertUserPlace(place: UserPlace) {
  const nextPlace = normalizeUserPlace(place);

  return updateUserData((current) => ({
    ...current,
    userPlaces: dedupeById([nextPlace, ...current.userPlaces.filter((userPlace) => userPlace.id !== nextPlace.id)])
  })).then((nextData) => nextData.userPlaces);
}

export async function deleteUserPlace(placeId: string) {
  return updateUserData((current) => ({
    ...current,
    userPlaces: current.userPlaces.filter((place) => place.id !== placeId)
  })).then((nextData) => nextData.userPlaces);
}

export async function rememberPlanningLocation(location: PlanningLocation) {
  const nextLocation = normalizePlanningLocation(location);

  return updateUserData((current) => ({
    ...current,
    recentPlanningLocations: dedupeById([nextLocation, ...current.recentPlanningLocations.filter((recentLocation) => recentLocation.id !== location.id)]).slice(
      0,
      MAX_RECENT_PLACES
    )
  })).then((nextData) => nextData.recentPlanningLocations);
}

export async function setUserPreferences(patch: Partial<UserPreferences>) {
  return updateUserData((current) => ({
    ...current,
    preferences: {
      ...current.preferences,
      ...patch
    }
  })).then((nextData) => nextData.preferences);
}

export function getUserDataStorageKey() {
  return activeUserDataStorageKey;
}
