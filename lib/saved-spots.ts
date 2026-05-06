import type { Spot } from "@/lib/spots";

const SAVED_SPOTS_STORAGE_KEY = "lore:saved-spots";

export type SavedSpot = Spot;

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

export function getSavedSpots(): SavedSpot[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_SPOTS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedSpot).map((spot) => normalizeSpot(spot));
  } catch {
    return [];
  }
}

export function setSavedSpots(spots: SavedSpot[]) {
  if (!canUseStorage()) {
    return [];
  }

  const deduped = spots.reduce<SavedSpot[]>((nextSpots, spot) => {
    if (!nextSpots.some((savedSpot) => savedSpot.id === spot.id)) {
      nextSpots.push(spot);
    }

    return nextSpots;
  }, []);

  try {
    window.localStorage.setItem(SAVED_SPOTS_STORAGE_KEY, JSON.stringify(deduped));
    return deduped;
  } catch {
    return getSavedSpots();
  }
}

export function isSpotSaved(spotId: string, savedSpots = getSavedSpots()) {
  return savedSpots.some((spot) => spot.id === spotId);
}

export function saveSpot(spot: Spot) {
  const savedSpots = getSavedSpots();
  const nextSpot = normalizeSpot(spot);
  return setSavedSpots([nextSpot, ...savedSpots.filter((savedSpot) => savedSpot.id !== spot.id)]);
}

export function unsaveSpot(spotId: string) {
  return setSavedSpots(getSavedSpots().filter((spot) => spot.id !== spotId));
}

export { SAVED_SPOTS_STORAGE_KEY };
