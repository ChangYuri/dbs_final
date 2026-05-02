# Project Proposal: Lore

## One-Line Description
A location-aware discovery app that surfaces the hidden historical stories underneath the places you walk through every day — for curious travelers and urban explorers who want to see the world differently.

## The Problem
Most of history is invisible. You walk past a random intersection, a nondescript building, a quiet park — and nothing tells you that something remarkable happened there. Existing apps like Clio and HearHere require you to *navigate to* historical sites on purpose. But the most interesting discovery is the one you didn't plan — finding out that the corner you walk past every morning was the site of a labor riot in 1911, or that a famous novelist lived in the building next door.

The gap: no app does passive, walking discovery for ordinary places. That's what Lore is.

## Target User
A curious person — student, traveler, or city-dweller — who finds history interesting but doesn't want to plan a "historical tour." They want to be surprised. They want to look up from their phone and see the place they're standing in a completely different way. Also: someone planning a trip who wants to know the hidden stories of a city before they arrive, not just the tourist highlights.

## Core Features (v1)
1. **Passive detection** — grant location access, open the app while walking, and it automatically surfaces nearby historical stories without you having to search
2. **Map view** — interactive map showing nearby historical markers; tap any marker to read the full story with source attribution
3. **Planning mode** — search any city by name, browse its historical spots, and plan what to visit before you go
4. **AI fallback** — when structured databases have no data for a location, Claude generates a rich historical portrait of the area based on what it knows
5. **Save spots** — bookmark places to revisit or share (requires account)

## Tech Stack
- **Frontend:** Next.js — familiar from prior experience, works as both a full web app and a PWA installable on mobile
- **Styling:** Tailwind CSS
- **Database:** Supabase — stores saved spots, user collections, and caches API responses to avoid rate limits
- **Auth:** Clerk — for saving and personalizing spots; not required to browse
- **APIs:**
  - Wikipedia Geosearch API — query nearby articles by GPS coordinates (free, no key required)
  - Historypin API — 365k geotagged historical stories across 75+ countries (official API, free for non-commercial)
  - Historical Marker Database (HMdb) — 230k+ US markers with coordinates
  - Wikidata SPARQL — structured historical data queries by location
  - Claude API (Anthropic) — intelligent fallback when structured data is sparse; generates local historical context
  - Mapbox or Leaflet — map rendering with custom marker layers
- **Deployment:** Vercel
- **MCP Servers:** Supabase MCP (database management during development), Playwright MCP (end-to-end testing)

Note: PWA architecture means one Next.js codebase serves both the desktop planning experience and the mobile walking experience. No App Store submission, no React Native — just a web app that installs on your phone like a native app.

## Stretch Goals
- **Category expansion** — film shooting locations, literary landmarks, cultural events, street art history; same architecture, new data sources
- **Audio narration** — text-to-speech narration of stories so you can listen while walking, hands-free
- **Walk mode** — curated historical walking routes through a neighborhood, with turn-by-turn story delivery
- **Community layer** — users can submit and verify stories for their own neighborhoods
- **Offline mode** — download stories for a neighborhood before going somewhere with bad reception
- **AR layer** — point your camera at a building and see a historical overlay (ambitious, genuinely experimental)

## Biggest Risk
**Data coverage.** Wikipedia and Historypin are sparse for non-famous locations, rural areas, and much of the world outside North America and Europe. If you walk through a quiet neighborhood and nothing comes up, the app feels broken.

Mitigation strategy: Claude API as intelligent fallback (generates plausible historical context even without structured data), focus the launch on major US cities where coverage is richest (Chicago is a great test city), and be transparent with users about data sources and confidence levels. This is a known limitation to iterate on, not a dealbreaker.

## Week 5 Goal
A working PWA deployed on Vercel where a user can:
1. Open it on their phone, grant location access, and see a map with nearby historical markers populated from real API data
2. Tap any marker and read a full historical story
3. Search for a city by name and browse its historical spots in planning mode
4. Experience the Claude fallback when walking somewhere with sparse data

Demo scenario: walk around UChicago's Hyde Park campus and show the stories that surface — the neighborhood has rich history and should generate compelling, specific results.
