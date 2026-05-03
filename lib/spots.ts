export type LocationPoint = {
  lat: number;
  lng: number;
  label: string;
};

export type PlanningLocation = LocationPoint & {
  id: string;
  description: string;
};

export type Spot = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  summary?: string;
  sourceName: "Wikipedia";
  sourceUrl: string;
  imageUrl?: string;
};

type WikipediaPage = {
  pageid: number;
  title: string;
  index?: number;
  fullurl?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  coordinates?: Array<{
    lat: number;
    lon: number;
  }>;
};

type WikipediaResponse = {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
};

type NominatimPlace = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

export const HYDE_PARK_LOCATION: LocationPoint = {
  lat: 41.7943,
  lng: -87.5907,
  label: "Hyde Park, Chicago"
};

export const DEFAULT_RADIUS_METERS = 1400;
export const REFRESH_DISTANCE_METERS = 180;

export function distanceMeters(a: Pick<LocationPoint, "lat" | "lng">, b: Pick<LocationPoint, "lat" | "lng">) {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(meters?: number) {
  if (typeof meters !== "number") {
    return "Nearby";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

export function cacheCellKey(point: Pick<LocationPoint, "lat" | "lng">) {
  return `${Math.round(point.lat * 500)}:${Math.round(point.lng * 500)}`;
}

export function shouldRefreshSpots(
  previous: Pick<LocationPoint, "lat" | "lng"> | null,
  next: Pick<LocationPoint, "lat" | "lng">
) {
  if (!previous) {
    return true;
  }

  return distanceMeters(previous, next) >= REFRESH_DISTANCE_METERS;
}

export async function fetchWikipediaSpots(location: LocationPoint, radiusMeters = DEFAULT_RADIUS_METERS) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggscoord: `${location.lat}|${location.lng}`,
    ggsradius: String(radiusMeters),
    ggslimit: "45",
    prop: "coordinates|pageimages|extracts|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    piprop: "thumbnail",
    pithumbsize: "700"
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Wikipedia returned ${response.status}`);
  }

  const data = (await response.json()) as WikipediaResponse;
  const pages = Object.values(data.query?.pages ?? {});

  return pages
    .map((page): Spot | null => {
      const coordinate = page.coordinates?.[0];

      if (!coordinate) {
        return null;
      }

      const point = {
        lat: coordinate.lat,
        lng: coordinate.lon
      };

      return {
        id: `wikipedia:${page.pageid}`,
        title: page.title,
        lat: point.lat,
        lng: point.lng,
        distanceMeters: distanceMeters(location, point),
        summary: cleanSummary(page.extract),
        sourceName: "Wikipedia",
        sourceUrl: page.fullurl ?? `https://en.wikipedia.org/?curid=${page.pageid}`,
        imageUrl: page.thumbnail?.source
      };
    })
    .filter((spot): spot is Spot => Boolean(spot))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

export async function searchPlanningLocations(query: string): Promise<PlanningLocation[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    dedupe: "1",
    "accept-language": "en"
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Location search returned ${response.status}`);
  }

  const places = (await response.json()) as NominatimPlace[];

  return places
    .map((place): PlanningLocation | null => {
      const lat = Number.parseFloat(place.lat);
      const lng = Number.parseFloat(place.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const label = place.name?.trim() || place.display_name.split(",")[0]?.trim() || trimmedQuery;

      return {
        id: `nominatim:${place.place_id}`,
        lat,
        lng,
        label,
        description: describePlanningLocation(place, label)
      };
    })
    .filter((place): place is PlanningLocation => Boolean(place));
}

function cleanSummary(summary?: string) {
  if (!summary) {
    return undefined;
  }

  return summary.replace(/\s+/g, " ").trim();
}

function describePlanningLocation(place: NominatimPlace, label: string) {
  const address = place.address;

  if (!address) {
    return place.display_name;
  }

  const locality = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  const normalizedLabel = label.toLocaleLowerCase();
  const locationParts = [locality, address.state, address.country].filter((part): part is string => Boolean(part));
  const parts = locationParts.filter(
    (part, index, values) => part.toLocaleLowerCase() !== normalizedLabel && values.indexOf(part) === index
  );

  return parts.join(", ") || place.display_name;
}
