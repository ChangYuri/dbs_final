# Lore Build Plan

## Product Direction

Lore is a location-aware historical discovery PWA. The practical first version should prove the core discovery loop before adding accounts, AI, caching, or multiple data providers.

The first product promise should be:

> Open Lore, choose or grant a location, see nearby sourced historical and cultural places, tap a marker, and read a short attributed story.

Avoid promising true background/passive location tracking in v1. A PWA can watch location while the page/app is open, but it should not be framed as a native background location service.

## Version Roadmap

### Version 1: Discovery Loop

Goal: prove that real nearby data feels compelling.

- Build a Next.js + Tailwind PWA shell.
- Use Leaflet for the map.
- Make the map feel intentional: muted basemap, custom markers, selected marker state, and clean mobile bottom sheet/detail drawer.
- Create a mobile-first interface with map, nearby list, and detail drawer.
- Define one normalized `Spot` model.
- Use Wikipedia Geosearch as the first real data source.
- Start with fixed Hyde Park / Chicago coordinates for repeatable testing.
- Add "Use my location" with browser geolocation after the fixed-location flow works.
- Treat real-time updates as foreground walk-mode updates: use `watchPosition()` while open, throttle refreshes by movement distance, cache by map cell, and prefetch a larger radius than the visible area.
- Show source attribution and source links on every spot.
- Support marker/list tap to open spot details.

Do not add Clerk, Supabase, Claude, Historypin, HMdb, offline mode, or community features in v1.

### Version 2: Planning Mode and Better Data

Goal: make Lore useful before arriving somewhere.

- Add city/place search.
- Geocode a searched city into coordinates.
- Reuse the same nearby spot pipeline for planning mode.
- Add Wikidata as a second source.
- Deduplicate spots from multiple providers.
- Improve ranking by distance, source quality, and title relevance.
- Add simple local bookmarks.

### Version 3: Persistence and Personalization

Goal: support saved spots and repeat use.

- Add Supabase for saved spots, cached API results, and user collections.
- Add auth only when saving/syncing requires it.
- Consider Clerk if it remains the simplest auth path, otherwise use Supabase Auth to reduce stack complexity.
- Add caching for repeated coordinate/city queries.
- Add basic shareable spot links.

### Version 4: AI Fallback and Richer Storytelling

Goal: handle sparse areas without pretending generated content is sourced fact.

- Add Claude fallback only after sourced discovery works.
- Label generated content clearly as area context, not verified marker data.
- Include confidence/source indicators.
- Use AI to summarize sourced pages first, then use fallback only when structured data is thin.
- Consider Historypin and HMdb only after checking API access, licensing, and allowed use.

## Week 1 Scope

This week should focus only on Version 1.

End-of-week demo:

1. Open Lore.
2. Select Hyde Park / Chicago or use current location.
3. See nearby historical/cultural places on a map.
4. Tap a marker or list item.
5. Read a short summary with a source link.

## Initial Data Model

```ts
type Spot = {
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
```

## Practical Constraints

- Browser geolocation requires HTTPS and explicit user permission.
- Continuous location watching is practical only while the app/page is open.
- Nearby histories do not need minute-by-minute freshness. The important v1 behavior is refreshing when the user moves meaningfully, without draining battery or spamming APIs.
- Data coverage is the biggest product risk, so test with real API data early.
- Hyde Park / UChicago is a strong demo area because historical coverage should be relatively dense.
- Source attribution is not optional; every spot should show where it came from.

## Build Priority

1. Scaffold the app.
2. Render the map.
3. Fetch Wikipedia nearby results for fixed Hyde Park coordinates.
4. Normalize results into `Spot`.
5. Render markers and nearby list.
6. Add detail drawer with source link.
7. Add browser geolocation.
8. Polish the mobile interaction enough for a clear demo.
