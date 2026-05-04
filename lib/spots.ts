export type LocationPoint = {
  lat: number;
  lng: number;
  label: string;
};

export type PlanningLocation = LocationPoint & {
  id: string;
  description: string;
};

export type SpotTheme =
  | "firsts"
  | "education"
  | "civil-rights"
  | "events"
  | "people"
  | "architecture"
  | "transport"
  | "culture"
  | "landmark";

export type SpotSourceName = "Wikipedia" | "Wikidata";

export type SpotSource = {
  name: SpotSourceName;
  url: string;
  quality: number;
};

export type SpotConfidence = "high" | "medium" | "low";

export type Spot = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  summary?: string;
  sourceName: SpotSourceName;
  sourceUrl: string;
  imageUrl?: string;
  sources: SpotSource[];
  sourceLabel: string;
  matchCount: number;
  relevanceScore: number;
  theme: SpotTheme;
  signals: string[];
  whyThisMatters: string;
  confidence: SpotConfidence;
};

type SpotSeed = Omit<Spot, "theme" | "signals" | "whyThisMatters" | "confidence">;

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

type WikidataBinding = {
  item: {
    value: string;
  };
  itemLabel?: {
    value: string;
  };
  itemDescription?: {
    value: string;
  };
  coord?: {
    value: string;
  };
  article?: {
    value: string;
  };
};

type WikidataResponse = {
  results?: {
    bindings?: WikidataBinding[];
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

const HISTORY_THEME_ORDER: SpotTheme[] = [
  "firsts",
  "education",
  "civil-rights",
  "events",
  "people",
  "architecture",
  "transport",
  "culture",
  "landmark"
];

const THEME_LABELS: Record<SpotTheme, string> = {
  firsts: "Firsts",
  education: "Education",
  "civil-rights": "Civil rights",
  events: "Events",
  people: "People",
  architecture: "Architecture",
  transport: "Transport",
  culture: "Culture",
  landmark: "Landmark"
};

const THEME_REASONS: Record<SpotTheme, string> = {
  firsts: "A first-of-its-kind or earliest-known local story.",
  education: "A school, campus, or learning milestone with local history.",
  "civil-rights": "A place tied to rights, access, or social change.",
  events: "A notable event happened here or nearby.",
  people: "A place linked to an important person or family story.",
  architecture: "A building, structure, or former site with a strong place story.",
  transport: "A road, bridge, or route that carried daily movement and history.",
  culture: "A cultural, artistic, or community history spot.",
  landmark: "A good general history lead with a useful sourced location."
};

const SIGNAL_RULES: Array<{
  label: string;
  patterns: RegExp[];
}> = [
  {
    label: "First",
    patterns: [/\bfirst\b/i, /\bearliest\b/i, /\binaugural\b/i, /\bfirst-of-its-kind\b/i]
  },
  {
    label: "Oldest",
    patterns: [/\boldest\b/i]
  },
  {
    label: "Former site",
    patterns: [/\bformer\b/i, /\bonce\b/i, /\bpreviously\b/i, /\bsite of\b/i, /\bformer site\b/i]
  },
  {
    label: "School",
    patterns: [/\bschool\b/i, /\bacademy\b/i, /\buniversity\b/i, /\bcollege\b/i, /\binstitute\b/i]
  },
  {
    label: "Women / girls",
    patterns: [/\bgirls?\b/i, /\bwomen\b/i, /\bsuffrage\b/i, /\bfemale\b/i, /\bwomen's\b/i]
  },
  {
    label: "Civil rights",
    patterns: [/\bcivil rights\b/i, /\bdesegregation\b/i, /\bstrike\b/i, /\bunion\b/i, /\bprotest\b/i, /\blabor\b/i]
  },
  {
    label: "Emperor / ruler",
    patterns: [/\bemperor\b/i, /\bking\b/i, /\bqueen\b/i, /\bruler\b/i, /\bpresident\b/i]
  },
  {
    label: "Road / route",
    patterns: [/\broad\b/i, /\bstreet\b/i, /\bavenue\b/i, /\bbridge\b/i, /\bstation\b/i, /\brailway\b/i, /\brailroad\b/i, /\bcanal\b/i]
  },
  {
    label: "Architecture",
    patterns: [/\bbuilding\b/i, /\bhouse\b/i, /\bresidence\b/i, /\bchurch\b/i, /\blibrary\b/i, /\bmuseum\b/i, /\bhall\b/i, /\btower\b/i, /\bcourthouse\b/i, /\bhotel\b/i]
  },
  {
    label: "Culture",
    patterns: [/\btheater\b/i, /\btheatre\b/i, /\bart\b/i, /\bmusic\b/i, /\bfilm\b/i, /\bliterary\b/i, /\bwriter\b/i]
  }
];

export const HYDE_PARK_LOCATION: LocationPoint = {
  lat: 41.7943,
  lng: -87.5907,
  label: "Hyde Park, Chicago"
};

export const DEFAULT_RADIUS_METERS = 1400;
export const REFRESH_DISTANCE_METERS = 180;
const WIKIPEDIA_SOURCE_QUALITY = 4;
const WIKIDATA_SOURCE_QUALITY = 3;

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

export async function fetchNearbySpots(location: LocationPoint, radiusMeters = DEFAULT_RADIUS_METERS) {
  const [wikipediaResult, wikidataResult] = await Promise.allSettled([
    fetchWikipediaSpots(location, radiusMeters),
    fetchWikidataSpots(location, radiusMeters)
  ]);

  const spots = [
    ...(wikipediaResult.status === "fulfilled" ? wikipediaResult.value : []),
    ...(wikidataResult.status === "fulfilled" ? wikidataResult.value : [])
  ];

  if (spots.length === 0) {
    if (wikipediaResult.status === "rejected") {
      throw wikipediaResult.reason instanceof Error ? wikipediaResult.reason : new Error("Unable to load Wikipedia spots.");
    }

    if (wikidataResult.status === "rejected") {
      throw wikidataResult.reason instanceof Error ? wikidataResult.reason : new Error("Unable to load Wikidata spots.");
    }
  }

  return rankSpots(dedupeSpots(spots), location);
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

      return enrichSpot({
        id: `wikipedia:${page.pageid}`,
        title: page.title,
        lat: point.lat,
        lng: point.lng,
        distanceMeters: distanceMeters(location, point),
        summary: cleanSummary(page.extract),
        sourceName: "Wikipedia",
        sourceUrl: page.fullurl ?? `https://en.wikipedia.org/?curid=${page.pageid}`,
        imageUrl: page.thumbnail?.source,
        sources: [
          {
            name: "Wikipedia",
            url: page.fullurl ?? `https://en.wikipedia.org/?curid=${page.pageid}`,
            quality: WIKIPEDIA_SOURCE_QUALITY
          }
        ],
        sourceLabel: "Wikipedia",
        matchCount: 1,
        relevanceScore: 0
      });
    })
    .filter((spot): spot is Spot => Boolean(spot))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

export async function fetchWikidataSpots(location: LocationPoint, radiusMeters = DEFAULT_RADIUS_METERS) {
  const radiusKilometers = Math.max(0.1, radiusMeters / 1000);
  const query = `
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?item ?itemLabel ?itemDescription ?coord ?article WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:center "Point(${location.lng} ${location.lat})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "${radiusKilometers}".
  }
  OPTIONAL {
    ?article schema:about ?item;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
    ?item rdfs:label ?itemLabel.
    ?item schema:description ?itemDescription.
  }
}
LIMIT 60
`;

  const params = new URLSearchParams({
    query,
    format: "json"
  });

  const response = await fetch(`https://query.wikidata.org/sparql?${params.toString()}`, {
    headers: {
      Accept: "application/sparql-results+json"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikidata returned ${response.status}`);
  }

  const data = (await response.json()) as WikidataResponse;
  const bindings = data.results?.bindings ?? [];

  return bindings
    .map((binding): Spot | null => {
      const point = parseWikidataPoint(binding.coord?.value);
      const title = binding.itemLabel?.value;

      if (!point || !title || title.startsWith("Q")) {
        return null;
      }

      const sourceUrl = binding.article?.value ?? binding.item.value;

      return enrichSpot({
        id: `wikidata:${binding.item.value.split("/").pop() ?? title}`,
        title,
        lat: point.lat,
        lng: point.lng,
        distanceMeters: distanceMeters(location, point),
        summary: cleanSummary(binding.itemDescription?.value),
        sourceName: "Wikidata",
        sourceUrl,
        sources: [
          {
            name: "Wikidata",
            url: sourceUrl,
            quality: WIKIDATA_SOURCE_QUALITY
          }
        ],
        sourceLabel: "Wikidata",
        matchCount: 1,
        relevanceScore: 0
      });
    })
    .filter((spot): spot is Spot => Boolean(spot));
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

function enrichSpot(spot: SpotSeed): Spot {
  const context = [spot.title, spot.summary ?? "", spot.sourceLabel].join(" ");
  const theme = detectTheme(context);
  const signals = extractSignals(context);
  const confidence = deriveConfidence(spot.sources.length, Boolean(spot.summary), Boolean(spot.imageUrl), signals.length);

  return {
    ...spot,
    theme,
    signals,
    confidence,
    whyThisMatters: buildWhyThisMatters(theme, signals)
  };
}

function cleanSummary(summary?: string) {
  if (!summary) {
    return undefined;
  }

  return summary.replace(/\s+/g, " ").trim();
}

function parseWikidataPoint(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/);

  if (!match) {
    return null;
  }

  const lng = Number.parseFloat(match[1]);
  const lat = Number.parseFloat(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function dedupeSpots(spots: Spot[]) {
  return spots.reduce<Spot[]>((mergedSpots, spot) => {
    const duplicate = mergedSpots.find((candidate) => areLikelySameSpot(candidate, spot));

    if (!duplicate) {
      mergedSpots.push(spot);
      return mergedSpots;
    }

    mergeSpot(duplicate, spot);
    return mergedSpots;
  }, []);
}

function areLikelySameSpot(a: Spot, b: Spot) {
  const normalizedA = normalizeTitle(a.title);
  const normalizedB = normalizeTitle(b.title);

  if (!normalizedA || !normalizedB) {
    return false;
  }

  const titleMatches =
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA);

  return titleMatches && distanceMeters(a, b) <= 90;
}

function mergeSpot(target: Spot, incoming: Spot) {
  const knownSources = new Set(target.sources.map((source) => source.name));
  const mergedSources = [
    ...target.sources,
    ...incoming.sources.filter((source) => !knownSources.has(source.name))
  ].sort((a, b) => b.quality - a.quality);
  const bestSource = mergedSources[0];
  const betterTheme = pickBetterTheme(target.theme, incoming.theme);
  const mergedSignals = uniqueStrings([...target.signals, ...incoming.signals]).slice(0, 4);

  target.sources = mergedSources;
  target.sourceName = bestSource.name;
  target.sourceUrl = bestSource.url;
  target.sourceLabel = mergedSources.map((source) => source.name).join(" + ");
  target.matchCount = mergedSources.length;
  target.theme = betterTheme;
  target.signals = mergedSignals;
  target.confidence = deriveConfidence(mergedSources.length, Boolean(target.summary || incoming.summary), Boolean(target.imageUrl || incoming.imageUrl), mergedSignals.length);
  target.whyThisMatters = buildWhyThisMatters(betterTheme, mergedSignals);

  if (!target.summary && incoming.summary) {
    target.summary = incoming.summary;
  }

  if (!target.imageUrl && incoming.imageUrl) {
    target.imageUrl = incoming.imageUrl;
  }
}

function rankSpots(spots: Spot[], location: LocationPoint) {
  return spots
    .map((spot) => {
      const distance = distanceMeters(location, spot);
      const sourceQuality = spot.sources.reduce((total, source) => total + source.quality, 0);
      const summaryBonus = spot.summary ? 1.3 : 0;
      const imageBonus = spot.imageUrl ? 0.5 : 0;
      const signalBonus = Math.min(spot.signals.length, 4) * 0.35;
      const confidenceBonus = spot.confidence === "high" ? 0.7 : spot.confidence === "medium" ? 0.35 : 0;
      const themeBonus =
        spot.theme === "firsts"
          ? 1.6
          : spot.theme === "education"
            ? 1.2
            : spot.theme === "civil-rights"
              ? 1.1
              : spot.theme === "events"
                ? 0.8
                : spot.theme === "people"
                  ? 0.7
                  : 0.4;
      const historicCueBonus = countHistoricalCues(`${spot.title} ${spot.summary ?? ""}`);
      const distancePenalty = Math.min(distance / DEFAULT_RADIUS_METERS, 1.6);

      return {
        ...spot,
        distanceMeters: distance,
        relevanceScore:
          sourceQuality +
          spot.matchCount * 1.6 +
          summaryBonus +
          imageBonus +
          signalBonus +
          confidenceBonus +
          themeBonus +
          historicCueBonus -
          distancePenalty
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

function detectTheme(text: string) {
  const normalizedText = text.toLowerCase();

  if (/\b(first|oldest|earliest|inaugural|pioneer)\b/.test(normalizedText)) {
    return "firsts";
  }

  if (/\b(school|academy|university|college|institute|education|students?|teachers?)\b/.test(normalizedText)) {
    return "education";
  }

  if (/\b(civil rights|suffrage|desegregation|labor|strike|union|protest|equality)\b/.test(normalizedText)) {
    return "civil-rights";
  }

  if (/\b(battle|riot|massacre|fire|flood|earthquake|war|event|tragedy)\b/.test(normalizedText)) {
    return "events";
  }

  if (/\b(emperor|king|queen|ruler|president|leader|born|lived|home|residence|memorial|statue)\b/.test(normalizedText)) {
    return "people";
  }

  if (/\b(building|house|residence|church|library|museum|hall|tower|courthouse|hotel|architecture)\b/.test(normalizedText)) {
    return "architecture";
  }

  if (/\b(road|street|avenue|bridge|station|railway|railroad|canal|tunnel|port|harbor|highway)\b/.test(normalizedText)) {
    return "transport";
  }

  if (/\b(theater|theatre|art|music|film|literary|writer|poet|culture)\b/.test(normalizedText)) {
    return "culture";
  }

  return "landmark";
}

function extractSignals(text: string) {
  const signals = SIGNAL_RULES.flatMap((rule) => {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return [rule.label];
    }

    return [];
  });

  return uniqueStrings(signals).slice(0, 4);
}

function deriveConfidence(
  sourceCount: number,
  hasSummary: boolean,
  hasImage: boolean,
  signalCount: number
): SpotConfidence {
  if (sourceCount >= 2 && hasSummary) {
    return "high";
  }

  if (hasSummary || hasImage || signalCount >= 2) {
    return "medium";
  }

  return "low";
}

function buildWhyThisMatters(theme: SpotTheme, signals: string[]) {
  const parts = [THEME_REASONS[theme]];

  if (signals.length > 0) {
    parts.push(`Signals: ${signals.slice(0, 2).join(", ")}.`);
  }

  return parts.join(" ");
}

function countHistoricalCues(text: string) {
  const cues = [
    /\bfirst\b/i,
    /\boldest\b/i,
    /\bearliest\b/i,
    /\bformer\b/i,
    /\bsite of\b/i,
    /\baccepted\b/i,
    /\bgirls\b/i,
    /\bemperor\b/i,
    /\bpresident\b/i,
    /\bcivil rights\b/i,
    /\bstrike\b/i
  ];

  return cues.reduce((total, cue) => total + (cue.test(text) ? 0.35 : 0), 0);
}

function pickBetterTheme(current: SpotTheme, incoming: SpotTheme) {
  return themeRank(incoming) < themeRank(current) ? incoming : current;
}

function themeRank(theme: SpotTheme) {
  return HISTORY_THEME_ORDER.indexOf(theme);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeTitle(title: string) {
  return title
    .toLocaleLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

export function themeLabel(theme: SpotTheme) {
  return THEME_LABELS[theme];
}

export function themeChoices() {
  return HISTORY_THEME_ORDER.map((theme) => ({
    value: theme,
    label: THEME_LABELS[theme]
  }));
}
