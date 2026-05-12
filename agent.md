# Lore Build Plan

## Product Direction

Lore is a location-aware historical discovery PWA.

Core promise:

> Open Lore, choose or grant a location, see nearby sourced historical places, tap a marker, and read a short attributed story.

Rules:

- Treat browser geolocation as foreground-only while the page is open.
- Do not frame Lore as a native background location service.
- Do not assume the app should store every global geo record locally or in a database.

## Current State

Version 1 is complete enough to serve as the baseline.

The current app already has:

- Next.js + Tailwind shell
- Leaflet map
- fixed Hyde Park / Chicago default
- browser geolocation for foreground walk mode
- Wikipedia nearby lookups
- Wikidata ingestion
- multi-source dedupe and ranking
- saved spots in local storage
- city/place planning search

## Version Roadmap

### Version 1: Discovery Loop, complete

Goal: prove that real nearby data feels compelling.

Keep:

- map-first nearby discovery
- marker tap and list tap
- short source-backed summaries
- fixed demo location plus `Use my location`

Do not add:

- auth
- Supabase
- AI fallback
- offline mode
- community editing
- background location tracking

### Version 2: Planning Mode and UI Simplification

Goal: make Lore easier to plan with, easier to scan, and easier to deploy.

#### 2A. Planning Entry

Goal: define two product modes and their switching logic.

- Travel mode:
  - based on current location or a chosen live location
  - emphasizes nearby stories while the user is moving
- Discover mode:
  - based on search
  - emphasizes planning for a city or place before arriving
- Add a simple mode switch control.
- Keep the same nearby fetch pipeline behind both modes.
- Decide which mode is the default on load.

Open decision:

- Decide whether the mode switch is a top-bar button, a segmented control, or a separate tab row.
- Decide whether `Discover` owns the search bar completely or whether search stays shared with `Travel`.

Implementation boundary:

- This item is only about the mode model, the switch behavior, and the search-mode relationship.
- Do not redesign the rest of the sidebar here.

#### 2B. Simplified Sidebar

Goal: decide which controls stay visible in the sidebar and how the panel is arranged.

- Remove or collapse the dense side-panel sections that are not pulling their weight.
- Keep the sidebar focused on the controls that matter most.
- Likely keep only:
  - live location / walk mode
  - surprise me
  - optional search entry if the search is not fully owned by `Discover`
- Decide whether saved spots remain visible in the main shell.
- Decide whether the panel becomes a compact control rail, a drawer, or a thinner sidebar.

Open decision:

- Decide later whether saved spots stay on the main screen, move to a drawer, or become a separate view.
- Decide whether the sidebar still carries any story list at all, or becomes control-only.

#### 2C. Category System

Goal: use broader, more understandable story buckets.

- Replace the current fine-grained categories with general buckets.
- Suggested buckets:
  - People
  - Places
  - Events
  - Institutions
  - Routes
  - Culture
  - Landmarks

Notes:

- The current category logic is heuristic-based, derived from the page title/extract and local rules, not a strict Wikipedia category dump.
- If Wikipedia categories are used later, map them into the simpler buckets above instead of exposing them directly.
- Remove the `high / medium / low` confidence labels if they are not helping the product.
- The `signals` are local heuristics for ranking and internal explanation only: they come from regex matches against the title, summary, and source label.
- Do not surface `signals` as first-class UI content unless we later replace them with more useful evidence snippets.
- Prefer source summaries and source links in the UI; treat `signals` as implementation detail, not source metadata or facts from Wikipedia/Wikidata.

#### 2D. Data Strategy

Goal: make deployment realistic without storing the world.

- Use Supabase for two things only:
  - saved spots and other user-owned data
  - cached discovery results for Travel and Discover
- Keep Wikipedia and Wikidata as the source of truth for story content.
- Do not store the whole global geo corpus in Supabase.
- Cache query results, not the entire world.
- Make cache keys depend on:
  - mode (`Travel` or `Discover`)
  - location or city
  - radius
  - source set
  - freshness window
- Treat cached rows as replaceable, not canonical.
- Prefer a single generic cache table over separate tables unless the schema starts to split naturally.

Implementation shape:

- Travel mode should check Supabase cache by live/current location cell.
- Discover mode should check Supabase cache by searched city or geocoded place.
- If the cache is fresh, return it.
- If the cache is stale or missing, fetch the APIs, normalize the spots, store the response, and return it.

Open decision:

- Decide the TTL window for cache freshness.
- Decide whether the frontend calls Supabase directly or goes through a small server route/function.

#### 2E. Marker Simplification

Goal: keep the map readable by shrinking the default place markers.

- Replace the current large label-like marker treatment with a compact dot or circle.
- Keep selected markers slightly larger, but still unobtrusive.
- Make sure the marker color still reflects the story bucket without covering too much of the map.
- Preserve clickability and selection behavior.

#### 2F. Content Depth

Goal: give each spot a short, useful summary first, then let the user learn more if they want to.

- Lead with a compact summary in the list card.
- Use Wikipedia prose as the primary source for the summary when available.
- Use Wikidata facts to enrich the summary with 2 to 4 short sourced details.
- Keep the first view brief enough that it is easy to scan.
- Move richer material into the detail panel or an explicit `Learn more` section.
- Make the detail view show:
  - a slightly longer summary
  - fact chips or bullets
  - source links
  - the path to the original source pages
- Do not surface every possible detail by default.
- Prefer one good summary plus a clear invitation to open the full source.

Open decision:

- Decide whether `Learn more` is a button, an expand/collapse region, or a deeper panel.
- Decide how many facts should appear before the UI starts feeling crowded.

### Version 3: Persistence and Personalization

Goal: make Lore feel worth returning to without turning it into an account-heavy app.

- Keep the app usable without login by default.
- Use Supabase as the database layer for saved spots and other user-owned data.
- Move saved spots off `localStorage` once persistence is wired through Supabase.
- Use Vercel-backed authentication only when the user tries to save a place or open the deeper `Read more` experience.
- Persist lightweight user-owned data first:
  - saved spots
  - recent planning searches
  - simple preferences like default mode or last-used location
- Keep discovery cache separate from user-owned data so cached places remain replaceable and not part of the user profile.
- Add shareable spot links if the routing model is stable enough to reopen a specific place cleanly.
- Add per-user collections only if a clear collection workflow appears in the product.

#### 3A. Persistence Model

- Keep browsing public and low-friction.
- Treat auth as a targeted gate for saving and richer personal actions, not as a requirement for basic discovery.
- Keep the Supabase schema small and practical.
- Prefer one clean user-data layer instead of splitting persistence across multiple systems.

#### 3B. Frontend Polish

Goal: make the app feel clean, simple, and intuitive.

- Greatly improve the frontend UI and UX.
- Favor a straightforward information hierarchy with fewer competing controls.
- Make the map, sidebar, and detail panel feel seamless together.
- Reduce visual noise, dense copy, and unclear interaction states.
- Keep actions obvious and the reading flow easy to follow.
- Prioritize clarity, consistency, and speed of understanding over feature count.

Implementation bias:

- Prefer a local-first UX with optional account features layered on top.
- Avoid introducing a full social or collaboration model at this stage.
- Treat personalization as convenience, not a requirement for basic browsing.

### Version 4: AI Fallback and Richer Storytelling

Goal: handle sparse areas without pretending generated content is sourced fact.

- Add AI fallback only after sourced discovery works well.
- Label generated content clearly as context, not verified marker data.
- Use structured source summaries before fallback text.
- Consider other providers only after checking licensing and allowed use.

## Version 2 Work Queue

This is the next work queue for another agent.

1. Simplify the sidebar to the minimal control set.
2. Replace the category labels with broad buckets.
3. Remove the confidence badge system if it remains unnecessary.
4. Implement the Supabase cache strategy for Travel and Discover.
5. Keep planning search working with the same nearby fetch pipeline.

## Open Questions

- Should saved spots stay visible in the main shell, move to a drawer, or become a separate view?
- Should category assignment stay heuristic-based, or should we map Wikipedia/Wikidata signals into our own buckets?
- What TTL should the Supabase cache use for Travel and Discover?
- Should the frontend talk to Supabase directly, or should a server route wrap cache reads/writes?
- Do we keep both Wikipedia and Wikidata for all places, or prefer one source by default and use the other as enrichment?

## Practical Constraints

- Browser geolocation requires HTTPS and explicit user permission.
- Continuous location watching is practical only while the page is open.
- Nearby histories do not need minute-by-minute freshness.
- Source attribution is not optional.
- Data coverage is still the biggest product risk.

## Build Priority

1. Simplify the UI to the controls we actually want to keep.
2. Narrow the category system to broader buckets.
3. Define and implement the Supabase cache approach for deployment.
4. Keep planning search aligned with the nearby-fetch pipeline.
5. Revisit saved spots only after the main shell is simplified.
