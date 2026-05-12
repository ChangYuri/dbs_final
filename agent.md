# Lore Agent Notes

## 1. Product

Lore is a location-aware historical discovery PWA.

Core loop: choose or grant a location, see nearby sourced historical places, tap a marker or list item, and read a short attributed story.

Constraints:

- Treat geolocation as foreground-only while the page is open.
- Keep the app useful without login.
- Do not store a global geo corpus locally or in Supabase.
- Keep Wikipedia/Wikidata as source-of-truth content.

## 2. Current State

The app currently includes:

- Next.js App Router frontend with Tailwind/global CSS styling.
- Leaflet standard map and MapLibre 3D map toggle.
- Hyde Park, Chicago default location.
- Travel mode for current/live nearby discovery.
- Discover mode for city/place planning search.
- Wikipedia nearby lookup plus Wikidata fallback/enrichment.
- Broad story buckets: People, Places, Events, Institutions, Routes, Culture, Landmarks.
- Compact markers, selected marker states, and current-location marker.
- Sidebar controls, nearby story list, saved spots drawer, and detail panel.
- `Read more` expansion with source links and fact chips.
- Clerk sign-in gate for personal actions.
- Local/user data layer with saved spots, recent planning locations, preferences, and Supabase schema/migrations started.
- Warm historical UI direction with flat colors, distinctive typography, and no gradient surfaces.

## 3. Architecture Notes

Main files:

- `app/page.tsx`: renders `LoreApp`.
- `components/LoreApp.tsx`: app state, modes, search, saved spots, detail panel.
- `components/LoreMap.tsx`: Leaflet/MapLibre rendering and map markers.
- `components/SaveSpotButton.tsx`: save/unsave control.
- `components/PersonalAccessGate.tsx`: Clerk auth prompt.
- `lib/spots.ts`: discovery, normalization, ranking, geocoding/search helpers.
- `lib/user-data.ts`: user-owned persistence abstraction.
- `app/globals.css`: full UI theme and responsive layout.
- `supabase/`: user-data schema and migrations.

Important behavior:

- Switching between Travel and Discover should not remount or blank the map.
- Discover search should show result choices first; the map moves only after the user selects a place or pins the view.
- Map containers need resize/invalidation handling so tiles repaint reliably.
- Saved spots should remain a personal feature, not a requirement for browsing.

## 4. UI Design Frame

Lore should feel like a field notebook, civic archive, and quiet map room rather than a generic SaaS dashboard.

Frontend aesthetics:

- Avoid generic "AI app" styling. The interface should feel intentionally designed for historical discovery, not assembled from default cards, soft purple gradients, and predictable component layouts.
- Typography should carry character. Avoid default-feeling stacks such as Arial, Inter, Roboto, and plain system fonts when choosing new type. Prefer distinctive editorial, archival, cartographic, or museum-adjacent type choices that remain readable in dense UI.
- Keep the current warm historical direction: flat colors, material-like surfaces, readable contrast, and no glossy gradient cards or decorative gradient blobs. Use CSS variables for theme consistency.
- Commit to a cohesive palette. Warm neutrals, ink tones, archival greens, muted reds, map yellows, and sharp accent colors are more appropriate than timid evenly distributed color or purple-on-white tech styling.
- Use atmosphere through texture, borders, spacing, typography, map context, and subtle patterning. Backgrounds may have depth, but should support the app's map-and-story workflow instead of becoming decoration.
- Motion should be purposeful and restrained. Use CSS animations for page entry, drawer/panel transitions, marker/list selection, and meaningful state changes. One well-composed reveal or transition is better than many unrelated effects.
- Layout should prioritize the core loop: location, nearby places, map selection, and attributed story. Surprise should come from craft and context-specific details, not from hiding controls or making the workflow unfamiliar.
- Avoid repeated defaults across redesigns. Do not fall back to the same common fonts, symmetrical card grids, oversized marketing hero sections, or one-note palettes unless the existing screen specifically calls for them.

## 5. Data Strategy

Use Supabase for:

- saved spots and user-owned data
- recent planning locations
- simple preferences
- optionally cached discovery responses

Do not use Supabase for:

- storing all global places
- replacing Wikipedia/Wikidata as canonical sources

If discovery caching is added:

- cache query results, not the world
- key by mode, location/city, radius, source set, and freshness window
- treat cached rows as replaceable
- decide TTL before implementation

## 6. Wikipedia/Wikidata Notes

Wikipedia prose is the preferred summary source. Wikidata enriches and backs up missing Wikipedia detail.

Regression checklist for missing `Read more` content:

- Inspect `selectedSpot.narrative.length`.
- Confirm whether `selectedSpot.sourceName` is `Wikipedia` or `Wikidata`.
- Confirm Wikipedia responses include `extract`.
- For batched title lookups, include `exintro=1`, `exlimit=max`, and `pilimit=max`.
- Do not cache temporary `429` or `503` responses as permanent misses.
- Avoid switching back to many per-title requests unless rate limits are handled.

## 7. Roadmap

Completed:

- V1 discovery loop.
- V2 Travel/Discover modes.
- Sidebar simplification.
- Broad category buckets.
- Compact marker system.
- Wikipedia/Wikidata enrichment.
- Saved spots drawer.
- Major frontend redesign.

Next priorities:

1. Harden Vercel production deployment.
2. Finish Supabase-backed persistence for saved spots/preferences.
3. Add discovery-result caching with a clear TTL.
4. Add stable shareable spot links if routing remains clean.
5. Improve sparse-area coverage before considering AI fallback.

## 8. Open Questions

- What TTL should cached Travel and Discover results use?
- Should cache reads/writes happen directly from the frontend or through a server route?
- Should saved spots become collections, or stay as a simple list?
- Should AI fallback exist, and how should it be labeled so users do not confuse it with sourced fact?
