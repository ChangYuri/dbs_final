# Lore Project Summary

Lore is a location-aware historical discovery PWA that surfaces nearby stories about ordinary places. The product is aimed at curious users who want to discover history while walking or planning a trip, without needing to search for specific landmarks first.

## Current State

The app has a working Next.js foundation and a first vertical slice:

- mobile-first PWA shell
- Leaflet map with a muted cartographic style
- Hyde Park, Chicago as the default demo location
- Wikipedia-based nearby story lookup
- marker selection and detail drawer
- foreground walk mode using browser geolocation
- movement-throttled refresh and local caching
- planning mode with city/place search
- local saved spots

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Leaflet
- TypeScript

## Core Data Flow

1. The app selects a location, either Hyde Park by default, a planned city search, or the user’s current position.
2. It fetches nearby place data from Wikipedia.
3. Results are normalized into a `Spot` model.
4. The map renders markers and the sidebar renders a ranked nearby list.
5. A selected spot opens in a detail panel with attribution and source links.
6. Saved spots are stored locally with `localStorage`.

## Working Assumptions

- The app is a Next.js web app, not a native mobile app.
- Live location updates only happen while the page is open.
- Historical data is not truly real-time, so the app refreshes on meaningful movement rather than every GPS update.
- Source attribution is part of the product, not optional metadata.

## Version Direction

### Version 1

Prove the discovery loop with real nearby data and a polished map experience.

### Version 2

Improve planning mode and add more data sources, especially Wikidata.

### Version 3

Add persistence and sync with Supabase and auth if needed.

### Version 4

Add AI fallback for sparse areas and richer storytelling.

## Known Risk

The biggest product risk is data coverage. Wikipedia can be sparse in less documented areas, so the app works best when launched around well-covered cities and neighborhoods first.

## Practical Next Step

The next strongest improvement is to harden the production deployment path on Vercel and then keep building out planning mode and data quality.
