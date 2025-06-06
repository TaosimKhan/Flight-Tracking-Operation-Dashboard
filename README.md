# Flight Operations Dashboard

A responsive aviation operations dashboard built with **Angular 17** and **Leaflet Maps** for monitoring flights in real time. Designed for operations personnel to track active flights, view routes, filter by status/airport, and review operational KPIs.

![Angular](https://img.shields.io/badge/Angular-17-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-green)

## Features

- **Interactive Flight Map** — 20 mock flights plotted on a dark-themed Leaflet map with status-colored aircraft markers
- **Route Visualization** — Select a flight to highlight its route with origin/destination markers and completed/remaining path segments
- **Flight Details Panel** — View flight number, callsign, aircraft type, route, status, and estimated times
- **Operations KPIs** — Total, Active, Delayed, and Arrived flight counts
- **Search & Filters** — Reactive forms for callsign search, status filter, and origin/destination airport filters
- **Responsive Layout** — Optimized for desktop and tablet screens

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (tested with v22)
- npm 9+

## Setup Instructions

```bash
# Clone the repository
git clone <your-repo-url>
cd flight-dashboard

# Install dependencies
npm install

# Start the development server
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server at `localhost:4200` |
| `npm run build` | Production build to `dist/flight-dashboard` |
| `npm test` | Run unit tests via Karma/Jasmine |
| `npm run watch` | Build in watch mode |

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── flight-details-panel/   # Selected flight info panel
│   │   ├── flight-filters/         # Reactive form filters
│   │   ├── flight-map/             # Leaflet map integration
│   │   └── kpi-cards/              # Operations KPI cards
│   ├── models/
│   │   └── flight.model.ts         # TypeScript interfaces
│   ├── pages/
│   │   └── dashboard/              # Main dashboard layout
│   ├── services/
│   │   └── flight.service.ts       # Flight data & state management
│   ├── app.config.ts
│   └── app.routes.ts
├── assets/
│   └── data/
│       └── flights.json            # Mock flight data (20 flights)
└── styles.scss                     # Global styles & Leaflet overrides
```

## Architecture

- **Standalone Components** — All components use Angular's standalone API (no NgModules)
- **Reactive State** — `FlightService` manages flight data, selection, and filters via RxJS `BehaviorSubject` streams
- **Lazy Routing** — Dashboard page is lazy-loaded via `loadComponent`
- **Reactive Forms** — Filter inputs use `FormBuilder` with `valueChanges` subscriptions
- **Leaflet Integration** — Custom `DivIcon` markers with heading rotation, route polylines, and popup tooltips

## Mock Data

Flight data is loaded from `src/assets/data/flights.json`. Each flight includes:

- Flight number, callsign, aircraft type
- Origin and destination airports (with coordinates)
- Current position and heading
- Status (Scheduled, Active, Delayed, Arrived, Cancelled)
- Estimated departure and arrival times

## Screenshots

> Add screenshots of the dashboard here after running the app.

1. **Full Dashboard** — Map with KPI cards and sidebar
2. **Selected Flight** — Route highlighted with details panel
3. **Filtered View** — Filters applied showing subset of flights
4. **Tablet Layout** — Responsive stacked layout

## License

MIT
