# Design Explanation — Flight Operations Dashboard

## Overview

The Flight Operations Dashboard is designed for aviation operations personnel who need to monitor multiple flights simultaneously across Indian airspace. The interface prioritizes the map as the primary visual element, with supporting controls and information organized in a professional side panel. Live weather overlays on the map help operators assess conditions that may affect departure, en-route, and arrival operations.

## Design Principles

### 1. Map-First Layout

The interactive map occupies approximately 75% of the viewport on desktop screens. This reflects the operational reality that geographic context is the most critical information for flight monitoring. The map uses a dark CartoDB basemap that reduces eye strain during extended monitoring sessions and provides high contrast for colored flight markers.

### 2. Information Hierarchy

Information is organized in three tiers:

| Tier | Content | Location |
|------|---------|----------|
| **Primary** | Flight map, route visualization | Center/main area |
| **Secondary** | KPI cards, flight list | Top bar, sidebar |
| **Tertiary** | Filters, detailed flight info | Sidebar panels |

KPI cards sit above the map to provide an at-a-glance operational summary without obscuring the map. The sidebar groups filters, the scrollable flight list, and the details panel in a logical top-to-bottom flow: search → browse → inspect.

### 3. Status-Driven Color System

Flight status drives color coding consistently across all UI elements:

- **Active** — Green (`#22c55e`): flights currently in the air
- **Delayed** — Amber (`#f59e0b`): flights experiencing delays
- **Scheduled** — Slate (`#94a3b8`): flights not yet departed
- **Arrived** — Purple (`#8b5cf6`): completed flights
- **Cancelled** — Red (`#ef4444`): cancelled flights

This color system appears on map markers, KPI card accents, flight list badges, popup labels, and the details panel status badge.

## Component Architecture

```
Dashboard (page)
├── KpiCards          — Reads kpis$ from FlightService
├── FlightMap         — Renders Leaflet map, markers, routes, weather overlays
└── Sidebar
    ├── FlightFilters — Reactive form → updates FlightService filters
    ├── FlightList    — Clickable list bound to filteredFlights$
    └── FlightDetailsPanel — Displays selectedFlight$ details

WeatherService (singleton)
└── Consumed by FlightMapComponent for overlay tiles and airport conditions
```

### State Management

Flight and weather state are managed through dedicated services:

**FlightService**

- `flights$` — Raw flight data loaded from JSON
- `filteredFlights$` — Derived stream combining flights + active filters
- `selectedFlight$` — Currently selected flight for map/details
- `kpis$` — Computed KPI metrics from flight statuses
- `filters$` — Current filter state

**WeatherService**

- `overlay$` — Active overlay toggles, opacity, and radar animation state
- `rainViewer$` — Radar and satellite tile frame metadata from RainViewer
- `radarFrameIndex$` — Current frame index when radar animation is enabled
- `airportWeather$` — Live conditions at airports derived from flight data
- `loading$` / `error$` — Fetch status for external weather APIs

Components subscribe to these observables and remain stateless, promoting reusability and testability.

### Map Interaction Flow

1. User clicks a flight marker or list item
2. `FlightService.selectFlight()` updates `selectedFlight$`
3. `FlightMapComponent` reacts: enlarges marker, draws route polyline (green = completed, blue = remaining), adds origin/destination circle markers, and flies the map to fit the route bounds
4. `FlightDetailsPanelComponent` displays full flight information
5. User can clear selection via the close button or by selecting another flight

## Weather Overlays

Weather overlays provide operational context on top of the India-focused map without displacing flight markers. Controls live in a compact panel anchored to the top-right of the map.

### Overlay Types

| Overlay | Source | Purpose |
|---------|--------|---------|
| **Precipitation Radar** | [RainViewer](https://www.rainviewer.com/) tile API | Shows rain and storm activity across the region; supports animated playback through recent radar frames |
| **Cloud Cover** | RainViewer satellite (infrared) tiles | Highlights cloud density and storm systems that may impact visibility or routing |
| **Airport Conditions** | [Open-Meteo](https://open-meteo.com/) forecast API | Displays live temperature, wind, precipitation, and WMO weather codes at each airport in the flight dataset |

All three overlays are independently toggleable. Precipitation and cloud layers share an opacity slider (20%–90%, default 65%) so operators can balance weather detail against map readability.

### Data Flow

1. On startup, `WeatherService` fetches RainViewer frame metadata (`weather-maps.json`) for radar and satellite tile paths.
2. When flights load, unique origin/destination airports are extracted and batch-queried from Open-Meteo for current conditions.
3. `FlightMapComponent` subscribes to `overlay$`, `rainViewer$`, `radarFrameIndex$`, and `airportWeather$`.
4. Toggling an overlay adds or removes the corresponding Leaflet layer; flight markers remain above weather tiles.

### Layer Stacking

Weather tiles render in a custom Leaflet pane (`weatherPane`, z-index 350) between the basemap and flight markers. This keeps precipitation and cloud imagery visible while ensuring aircraft icons, route polylines, and airport weather badges stay on top and remain interactive.

### Radar Animation

When **Animate radar** is enabled, the service cycles through available past and nowcast frames every second. The panel displays the timestamp of the current frame so operators know how recent the radar snapshot is.

### Airport Weather Markers

With **Airport Conditions** enabled, each airport shows a compact badge (weather icon + temperature). Clicking a badge opens a popup with airport name, temperature, wind speed, and precipitation. Conditions refresh automatically when the underlying flight dataset changes.

### Error Handling

If RainViewer data fails to load, the panel shows an error message with a **Retry** button. Tile overlays are disabled until data is available; airport conditions continue to work independently via Open-Meteo.

## Responsive Design

### Desktop (>1024px)
- Side-by-side layout: map (flexible) + sidebar (22rem fixed)
- 4-column KPI grid
- Full sidebar with filters, list, and details

### Tablet (≤1024px)
- Stacked layout: map on top (50vh), sidebar below
- 2-column KPI grid
- Sidebar scrolls naturally with page content

### Mobile (≤640px)
- Compact header with stacked brand/meta
- Map reduced to 40vh
- Single-column KPI cards

## Accessibility

- Semantic HTML: `<header>`, `<main>`, `<aside>`, `<section>`, `<dl>` for details
- ARIA labels on map, filters, flight list (`role="listbox"`, `role="option"`)
- Keyboard navigation: flight list items support Enter/Space selection
- Focus-visible outlines on all interactive elements
- `aria-live` region for live monitoring indicator
- Sufficient color contrast on dark theme (WCAG AA compliant text colors)

## Typography

- **Inter** — UI text (clean, professional sans-serif)
- **JetBrains Mono** — Callsigns, coordinates, timestamps (monospace for data alignment)

## Technology Choices

| Requirement | Implementation |
|-------------|----------------|
| Angular 16+ | Angular 17 with standalone components |
| Reactive Forms | `FormBuilder` in FlightFiltersComponent |
| Routing | Lazy-loaded dashboard route |
| Services | FlightService and WeatherService with RxJS streams |
| RxJS | BehaviorSubject, combineLatest, shareReplay, interval |
| Leaflet | Custom DivIcon markers, polylines, tooltips, custom panes |
| Flight Data | JSON file served from assets |
| Weather Data | RainViewer (radar/satellite tiles), Open-Meteo (airport conditions) |
