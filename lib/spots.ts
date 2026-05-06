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
  | "people"
  | "places"
  | "events"
  | "institutions"
  | "transport"
  | "culture"
  | "landmarks";

export type SpotSourceName = "Wikipedia" | "Wikidata";

export type SpotSource = {
  name: SpotSourceName;
  url: string;
  quality: number;
};

export type Spot = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  summary?: string;
  teaser: string;
  narrative: string[];
  facts: string[];
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
};

type SpotSeed = Omit<Spot, "theme" | "signals" | "whyThisMatters">;

type WikipediaPage = {
  pageid: number;
  title: string;
  index?: number;
  fullurl?: string;
  extract?: string;
  missing?: string;
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
    normalized?: Array<{
      from: string;
      to: string;
    }>;
    redirects?: Array<{
      from: string;
      to: string;
    }>;
  };
};

type WikipediaPagesResponse = WikipediaResponse;

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
  inception?: {
    value: string;
  };
  architectLabel?: {
    value: string;
  };
  instanceOfLabel?: {
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
  "people",
  "places",
  "events",
  "institutions",
  "transport",
  "culture",
  "landmarks"
];

const THEME_LABELS: Record<SpotTheme, string> = {
  people: "People",
  places: "Places",
  events: "Events",
  institutions: "Institutions",
  transport: "Transport",
  culture: "Culture",
  landmarks: "Landmarks"
};

const THEME_REASONS: Record<SpotTheme, string> = {
  people: "A place linked to an important person or family story.",
  places: "A place with a local story worth noticing.",
  events: "A notable event happened here or nearby.",
  institutions: "A school, organization, or civic institution shaped this place.",
  transport: "A road, bridge, station, or route that carried daily movement and history.",
  culture: "A cultural, artistic, or community history spot.",
  landmarks: "A landmark or built place that anchors the area."
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
const WIKIPEDIA_EXTRACT_SENTENCES = 10;
const MAX_NARRATIVE_SENTENCES = 12;
const WIKIPEDIA_TITLE_CONCURRENCY = 8;

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

  const dedupedSpots = dedupeSpots(spots);
  const hydratedSpots = await hydrateWikipediaProse(dedupedSpots);

  return rankSpots(hydratedSpots, location);
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
    explaintext: "1",
    exsentences: String(WIKIPEDIA_EXTRACT_SENTENCES),
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
        teaser: buildTeaser(page.extract),
        narrative: buildNarrative(page.extract),
        facts: [],
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
SELECT ?item ?itemLabel ?itemDescription ?coord ?article ?inception ?architectLabel ?instanceOfLabel WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:center "Point(${location.lng} ${location.lat})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "${radiusKilometers}".
  }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL {
    ?item wdt:P84 ?architect.
    ?architect rdfs:label ?architectLabel.
    FILTER(LANG(?architectLabel) = "en")
  }
  OPTIONAL {
    ?item wdt:P31 ?instanceOf.
    ?instanceOf rdfs:label ?instanceOfLabel.
    FILTER(LANG(?instanceOfLabel) = "en")
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
  const articleTitles = uniqueStrings(
    bindings
      .flatMap((binding) => [extractWikipediaTitle(binding.article?.value), binding.itemLabel?.value])
      .filter((title): title is string => Boolean(title))
  );
  const wikipediaPagesByTitle = await fetchWikipediaPagesByTitles(articleTitles);

  return bindings
    .map((binding): Spot | null => {
      const point = parseWikidataPoint(binding.coord?.value);
      const title = binding.itemLabel?.value;

      if (!point || !title || title.startsWith("Q")) {
        return null;
      }

      const sourceUrl = binding.article?.value ?? binding.item.value;
      const articleTitle = extractWikipediaTitle(binding.article?.value);
      const wikipediaPage =
        (articleTitle ? wikipediaPagesByTitle.get(articleTitle) : undefined) ?? wikipediaPagesByTitle.get(title);
      const summarySource = wikipediaPage?.extract ?? binding.itemDescription?.value;
      const sourceName: SpotSourceName = wikipediaPage ? "Wikipedia" : "Wikidata";
      const sourceLabel = wikipediaPage ? "Wikipedia + Wikidata" : "Wikidata";
      const sources = wikipediaPage
        ? [
            {
              name: "Wikipedia" as const,
              url: wikipediaPage.fullurl ?? sourceUrl,
              quality: WIKIPEDIA_SOURCE_QUALITY
            },
            {
              name: "Wikidata" as const,
              url: binding.item.value,
              quality: WIKIDATA_SOURCE_QUALITY
            }
          ]
        : [
            {
              name: "Wikidata" as const,
              url: sourceUrl,
              quality: WIKIDATA_SOURCE_QUALITY
            }
          ];

      return enrichSpot({
        id: `wikidata:${binding.item.value.split("/").pop() ?? title}`,
        title,
        lat: point.lat,
        lng: point.lng,
        distanceMeters: distanceMeters(location, point),
        summary: cleanSummary(summarySource),
        teaser: buildTeaser(summarySource),
        narrative: buildNarrative(summarySource),
        facts: buildWikidataFacts(binding),
        sourceName,
        sourceUrl: wikipediaPage?.fullurl ?? sourceUrl,
        sources,
        sourceLabel,
        matchCount: sources.length,
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

export async function hydrateSpotFromWikipediaTitle(spot: Spot): Promise<Spot> {
  const wikipediaPagesByTitle = await fetchWikipediaPagesByTitles([spot.title]);
  const wikipediaPage = wikipediaPagesByTitle.get(spot.title);

  if (!wikipediaPage?.extract) {
    return spot;
  }

  const prose = cleanSummary(wikipediaPage.extract);

  if (!prose) {
    return spot;
  }

  const wikipediaSource: SpotSource = {
    name: "Wikipedia",
    url: wikipediaPage.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaPage.title.replace(/\s+/g, "_"))}`,
    quality: WIKIPEDIA_SOURCE_QUALITY
  };
  const sources = [
    wikipediaSource,
    ...spot.sources.filter((source) => source.name !== "Wikipedia")
  ].sort((a, b) => b.quality - a.quality);

  return enrichSpot({
    ...spot,
    sourceName: "Wikipedia",
    sourceUrl: wikipediaSource.url,
    sourceLabel: sources.length > 1 ? "Wikipedia + Wikidata" : "Wikipedia",
    sources,
    matchCount: sources.length,
    summary: prose,
    teaser: buildTeaser(prose),
    narrative: buildNarrative(prose)
  });
}

function enrichSpot(spot: SpotSeed): Spot {
  const context = [spot.title, spot.summary ?? "", spot.sourceLabel].join(" ");
  const theme = detectTheme(context);
  const signals = extractSignals(context);
  const narrative = normalizeUniqueStrings(
    [spot.teaser, ...spot.narrative].filter((line): line is string => Boolean(line && line.trim()))
  );
  const facts = normalizeUniqueStrings(spot.facts.filter((fact) => Boolean(fact && fact.trim()))).slice(0, 5);

  return {
    ...spot,
    teaser: spot.teaser || narrative[0] || spot.summary || spot.title,
    narrative: narrative.length > 0 ? narrative : [spot.teaser || spot.summary || spot.title],
    facts,
    theme,
    signals,
    whyThisMatters: buildWhyThisMatters(theme)
  };
}

function cleanSummary(summary?: string) {
  if (!summary) {
    return undefined;
  }

  return summary.replace(/\s+/g, " ").trim();
}

function buildNarrative(text?: string) {
  const cleaned = cleanSummary(text);

  if (!cleaned) {
    return [];
  }

  return splitSentences(cleaned).slice(0, MAX_NARRATIVE_SENTENCES);
}

function buildTeaser(text?: string) {
  const sentences = buildNarrative(text);

  if (sentences.length === 0) {
    return cleanSummary(text) ?? "";
  }

  const highlight = sentences.slice(1).find(isCompellingSentence);
  const teaserSentences = highlight && highlight !== sentences[0] ? [sentences[0], highlight] : sentences.slice(0, 2);
  const teaser = teaserSentences.filter(Boolean).join(" ");

  if (teaser.length <= 320) {
    return teaser;
  }

  const firstTwo = sentences.slice(0, 2).join(" ");
  return firstTwo.length <= 260 ? firstTwo : sentences[0];
}

function buildWikidataFacts(binding: WikidataBinding) {
  const facts: string[] = [];

  if (binding.architectLabel?.value) {
    facts.push(`Architect: ${binding.architectLabel.value}`);
  }

  if (binding.inception?.value) {
    const year = formatYear(binding.inception.value);

    if (year) {
      facts.push(`Opened: ${year}`);
    }
  }

  return facts;
}

function isCompellingSentence(sentence: string) {
  return /(\bserved as\b|\bhost\b|\bvisited\b|\bstayed\b|\bbrought\b|\bwelcomed\b|\bpeople\b|\bdignitaries\b|\bopened\b|\bbuilt\b|\bfounded\b|\bfirst\b|\boldest\b|\bpresident\b|\bprince\b|\bqueen\b|\bking\b|\barchitect\b)/i.test(
    sentence
  );
}

async function fetchWikipediaPagesByTitles(titles: string[]) {
  const uniqueTitles = uniqueStrings(titles.map((title) => title.trim()).filter(Boolean));

  if (uniqueTitles.length === 0) {
    return new Map<string, WikipediaPage>();
  }

  const pageMap = new Map<string, WikipediaPage>();

  for (let index = 0; index < uniqueTitles.length; index += WIKIPEDIA_TITLE_CONCURRENCY) {
    const titleBatch = uniqueTitles.slice(index, index + WIKIPEDIA_TITLE_CONCURRENCY);
    const pages = await Promise.all(titleBatch.map((title) => fetchWikipediaPageByTitle(title)));

    pages.forEach(({ requestedTitle, page }) => {
      if (!page) {
        return;
      }

      pageMap.set(requestedTitle, page);
      pageMap.set(page.title, page);
    });
  }

  return pageMap;
}

async function fetchWikipediaPageByTitle(requestedTitle: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: requestedTitle,
    redirects: "1",
    prop: "coordinates|pageimages|extracts|info",
    inprop: "url",
    explaintext: "1",
    exsentences: String(WIKIPEDIA_EXTRACT_SENTENCES),
    piprop: "thumbnail",
    pithumbsize: "700"
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Wikipedia returned ${response.status}`);
  }

  const data = (await response.json()) as WikipediaPagesResponse;
  const page = Object.values(data.query?.pages ?? {}).find((candidate) => !candidate.missing);

  return {
    requestedTitle,
    page
  };
}

async function hydrateWikipediaProse(spots: Spot[]): Promise<Spot[]> {
  const titles = uniqueStrings(
    spots.flatMap((spot) => {
      return spot.sources
        .map((source) => extractWikipediaTitle(source.url))
        .filter((title): title is string => Boolean(title));
    })
  );

  if (titles.length === 0) {
    return spots;
  }

  const wikipediaPagesByTitle = await fetchWikipediaPagesByTitles(titles);

  return spots.map((spot) => {
    const wikipediaTitle = spot.sources
      .map((source) => extractWikipediaTitle(source.url))
      .find((title): title is string => Boolean(title));

    if (!wikipediaTitle) {
      return spot;
    }

    const wikipediaPage = wikipediaPagesByTitle.get(wikipediaTitle);

    if (!wikipediaPage?.extract) {
      return spot;
    }

    const prose = cleanSummary(wikipediaPage.extract);

    if (!prose) {
      return spot;
    }

    return {
      ...spot,
      sourceName: "Wikipedia" as SpotSourceName,
      sourceUrl: wikipediaPage.fullurl ?? spot.sourceUrl,
      sourceLabel: spot.sources.length > 1 ? "Wikipedia + Wikidata" : "Wikipedia",
      summary: prose,
      teaser: buildTeaser(prose),
      narrative: buildNarrative(prose)
    };
  });
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

function extractWikipediaTitle(value?: string) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const title = url.pathname.split("/").pop();
    return title ? decodeURIComponent(title.replace(/_/g, " ")) : null;
  } catch {
    return null;
  }
}

function formatYear(value: string) {
  const yearMatch = value.match(/^(\d{4})/);
  return yearMatch?.[1] ?? null;
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
  const incomingIsWikipedia = incoming.sourceName === "Wikipedia";
  const mergedNarrative = incomingIsWikipedia
    ? normalizeUniqueStrings([...incoming.narrative, ...target.narrative]).slice(0, MAX_NARRATIVE_SENTENCES)
    : normalizeUniqueStrings([...target.narrative, ...incoming.narrative]).slice(0, MAX_NARRATIVE_SENTENCES);
  const mergedFacts = normalizeUniqueStrings([...target.facts, ...incoming.facts]).slice(0, 5);

  target.sources = mergedSources;
  target.sourceName = bestSource.name;
  target.sourceUrl = bestSource.url;
  target.sourceLabel = mergedSources.map((source) => source.name).join(" + ");
  target.matchCount = mergedSources.length;
  target.teaser = incomingIsWikipedia
    ? incoming.teaser || target.teaser || mergedNarrative[0] || target.title
    : target.teaser || incoming.teaser || mergedNarrative[0] || target.title;
  target.narrative = mergedNarrative.length > 0 ? mergedNarrative : [target.teaser];
  target.facts = mergedFacts;
  target.theme = betterTheme;
  target.signals = mergedSignals;
  target.whyThisMatters = buildWhyThisMatters(betterTheme);

  if (incomingIsWikipedia) {
    target.summary = incoming.summary ?? target.summary;
  } else if (!target.summary || (incoming.summary && incoming.summary.length > target.summary.length)) {
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
      const summaryBonus = spot.summary || spot.teaser ? 1.3 : 0;
      const imageBonus = spot.imageUrl ? 0.5 : 0;
      const signalBonus = Math.min(spot.signals.length, 4) * 0.35;
      const themeBonus =
        spot.theme === "events"
          ? 1.3
          : spot.theme === "institutions"
            ? 1.15
            : spot.theme === "people"
              ? 1
              : spot.theme === "landmarks"
                ? 0.95
                : spot.theme === "transport"
                  ? 0.9
                  : spot.theme === "culture"
                    ? 0.85
                    : 0.7;
      const historicCueBonus = countHistoricalCues(`${spot.title} ${spot.summary ?? spot.teaser}`);
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
          themeBonus +
          historicCueBonus -
          distancePenalty
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

function detectTheme(text: string) {
  const normalizedText = text.toLowerCase();

  if (/\b(school|academy|university|college|institute|education|students?|teachers?|museum|church|organization|society)\b/.test(normalizedText)) {
    return "institutions";
  }

  if (/\b(battle|riot|massacre|fire|flood|earthquake|war|event|tragedy)\b/.test(normalizedText)) {
    return "events";
  }

  if (/\b(emperor|king|queen|ruler|president|leader|born|lived|home|residence|memorial|statue|person|family)\b/.test(normalizedText)) {
    return "people";
  }

  if (/\b(former site|site of|district|neighborhood|square|park|field|block|grounds|location)\b/.test(normalizedText)) {
    return "places";
  }

  if (/\b(road|street|avenue|bridge|station|railway|railroad|canal|tunnel|port|harbor|highway)\b/.test(normalizedText)) {
    return "transport";
  }

  if (/\b(theater|theatre|art|music|film|literary|writer|poet|culture)\b/.test(normalizedText)) {
    return "culture";
  }

  if (/\b(building|house|residence|church|library|museum|hall|tower|courthouse|hotel|architecture|landmark)\b/.test(normalizedText)) {
    return "landmarks";
  }

  if (/\b(first|oldest|earliest|inaugural|pioneer)\b/.test(normalizedText)) {
    return "events";
  }

  return "places";
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

function buildWhyThisMatters(theme: SpotTheme) {
  return THEME_REASONS[theme];
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

function normalizeUniqueStrings(values: string[]) {
  return uniqueStrings(values.map((value) => value.trim()).filter(Boolean));
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
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
