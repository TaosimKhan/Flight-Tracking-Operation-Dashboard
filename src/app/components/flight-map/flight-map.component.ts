import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { Flight } from '../../models/flight.model';
import { AirportWeather, WeatherOverlayState } from '../../models/weather.model';
import { FlightService } from '../../services/flight.service';
import { WeatherService } from '../../services/weather.service';

@Component({
  selector: 'app-flight-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flight-map.component.html',
  styleUrl: './flight-map.component.scss',
})
export class FlightMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  overlayState: WeatherOverlayState = {
    precipitation: false,
    clouds: false,
    airportConditions: false,
    opacity: 0.65,
    animateRadar: false,
  };

  weatherLoading = false;
  weatherError: string | null = null;
  radarTimestamp: string | null = null;

  private map!: L.Map;
  private readonly markers = new Map<string, L.Marker>();
  private readonly airportMarkers = new Map<string, L.Marker>();
  private routeLayer: L.LayerGroup | null = null;
  private precipitationLayer: L.TileLayer | null = null;
  private cloudsLayer: L.TileLayer | null = null;
  private rainViewerHost = 'https://tilecache.rainviewer.com';
  private radarFrames: { time: number; path: string }[] = [];
  private satelliteFrames: { time: number; path: string }[] = [];
  private latestAirportWeather: AirportWeather[] = [];
  private readonly destroy$ = new Subject<void>();

  constructor(
    private flightService: FlightService,
    private weatherService: WeatherService
  ) {}

  ngAfterViewInit(): void {
    this.initMap();

    combineLatest([
      this.flightService.filteredFlights$,
      this.flightService.selectedFlight$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([flights, selected]) => {
        this.updateMarkers(flights, selected);
        if (selected) {
          this.drawRoute(selected);
          this.centerOnFlight(selected);
        } else {
          this.clearRoute();
        }
      });

    this.weatherService.overlay$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.overlayState = state;
        this.syncWeatherLayers();
        this.updateAirportMarkers(this.latestAirportWeather);
      });

    this.weatherService.rainViewer$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (!data) return;
        this.rainViewerHost = data.host;
        this.radarFrames = data.radarFrames;
        this.satelliteFrames = data.satelliteFrames;
        this.syncWeatherLayers();
      });

    this.weatherService.radarFrameIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.overlayState.precipitation) {
          this.updatePrecipitationLayer();
        }
      });

    this.weatherService.airportWeather$
      .pipe(takeUntil(this.destroy$))
      .subscribe((weather) => {
        this.latestAirportWeather = weather;
        this.updateAirportMarkers(weather);
      });

    this.weatherService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => (this.weatherLoading = loading));

    this.weatherService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => (this.weatherError = error));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.map?.remove();
  }

  togglePrecipitation(): void {
    this.weatherService.updateOverlay({ precipitation: !this.overlayState.precipitation });
  }

  toggleClouds(): void {
    this.weatherService.updateOverlay({ clouds: !this.overlayState.clouds });
  }

  toggleAirportConditions(): void {
    this.weatherService.updateOverlay({ airportConditions: !this.overlayState.airportConditions });
  }

  toggleRadarAnimation(): void {
    this.weatherService.updateOverlay({ animateRadar: !this.overlayState.animateRadar });
  }

  onOpacityChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.weatherService.updateOverlay({ opacity: value });
  }

  retryWeatherLoad(): void {
    this.weatherService.loadRainViewerData();
  }

  private static readonly INDIA_BOUNDS = L.latLngBounds(
    [6.0, 68.0],
    [37.0, 97.5]
  );

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [22.5, 79.0],
      zoom: 5,
      minZoom: 4,
      maxBounds: FlightMapComponent.INDIA_BOUNDS,
      maxBoundsViscosity: 0.85,
      zoomControl: false,
    });

    this.map.createPane('weatherPane');
    const weatherPane = this.map.getPane('weatherPane');
    if (weatherPane) {
      weatherPane.style.zIndex = '350';
    }

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    setTimeout(() => this.map.invalidateSize(), 100);
  }

  private syncWeatherLayers(): void {
    this.updatePrecipitationLayer();
    this.updateCloudsLayer();
  }

  private updatePrecipitationLayer(): void {
    if (this.precipitationLayer) {
      this.precipitationLayer.remove();
      this.precipitationLayer = null;
    }

    if (!this.overlayState.precipitation || !this.radarFrames.length) {
      this.radarTimestamp = null;
      return;
    }

    const frameIndex = this.weatherService.radarFrameIndex$.value;
    const frame = this.radarFrames[frameIndex] ?? this.radarFrames[this.radarFrames.length - 1];
    this.radarTimestamp = new Date(frame.time * 1000).toLocaleTimeString();

    this.precipitationLayer = L.tileLayer(
      `${this.rainViewerHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      {
        opacity: this.overlayState.opacity,
        pane: 'weatherPane',
        maxZoom: 12,
        attribution: '&copy; <a href="https://www.rainviewer.com">RainViewer</a>',
      }
    );
    this.precipitationLayer.addTo(this.map);
  }

  private updateCloudsLayer(): void {
    if (this.cloudsLayer) {
      this.cloudsLayer.remove();
      this.cloudsLayer = null;
    }

    if (!this.overlayState.clouds || !this.satelliteFrames.length) {
      return;
    }

    const frame = this.satelliteFrames[this.satelliteFrames.length - 1];
    this.cloudsLayer = L.tileLayer(
      `${this.rainViewerHost}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`,
      {
        opacity: this.overlayState.opacity,
        pane: 'weatherPane',
        maxZoom: 12,
        attribution: '&copy; <a href="https://www.rainviewer.com">RainViewer</a>',
      }
    );
    this.cloudsLayer.addTo(this.map);
  }

  private updateAirportMarkers(weather: AirportWeather[]): void {
    const visibleCodes = new Set(
      this.overlayState.airportConditions ? weather.map((w) => w.code) : []
    );

    this.airportMarkers.forEach((marker, code) => {
      if (!visibleCodes.has(code)) {
        marker.remove();
        this.airportMarkers.delete(code);
      }
    });

    if (!this.overlayState.airportConditions) return;

    weather.forEach((airport) => {
      const existing = this.airportMarkers.get(airport.code);

      if (existing) {
        existing.setLatLng([airport.lat, airport.lng]);
        existing.setIcon(this.createAirportWeatherIcon(airport));
        existing.setPopupContent(this.createAirportPopupContent(airport));
      } else {
        const marker = L.marker([airport.lat, airport.lng], {
          icon: this.createAirportWeatherIcon(airport),
          title: `${airport.code} weather`,
          zIndexOffset: -100,
        })
          .bindPopup(this.createAirportPopupContent(airport), {
            className: 'flight-popup weather-popup',
            maxWidth: 260,
          })
          .addTo(this.map);
        this.airportMarkers.set(airport.code, marker);
      }
    });
  }

  private createAirportWeatherIcon(airport: AirportWeather): L.DivIcon {
    return L.divIcon({
      className: 'weather-marker',
      html: `
        <div class="weather-marker__wrapper" title="${airport.code}: ${airport.condition}">
          <span class="weather-marker__icon">${airport.icon}</span>
          <span class="weather-marker__temp">${Math.round(airport.temperature)}°</span>
        </div>
      `,
      iconSize: [48, 32],
      iconAnchor: [24, 16],
      popupAnchor: [0, -16],
    });
  }

  private createAirportPopupContent(airport: AirportWeather): string {
    return `
      <div class="popup-content">
        <div class="popup-content__header">
          <strong>${airport.code}</strong>
          <span>${airport.icon} ${airport.condition}</span>
        </div>
        <div class="popup-content__row"><span>Airport</span><span>${airport.name}</span></div>
        <div class="popup-content__row"><span>Temperature</span><span>${airport.temperature.toFixed(1)} °C</span></div>
        <div class="popup-content__row"><span>Wind</span><span>${airport.windSpeed.toFixed(0)} km/h</span></div>
        <div class="popup-content__row"><span>Precipitation</span><span>${airport.precipitation.toFixed(1)} mm</span></div>
      </div>
    `;
  }

  private updateMarkers(flights: Flight[], selected: Flight | null): void {
    const visibleIds = new Set(flights.map((f) => f.id));

    this.markers.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });

    flights.forEach((flight) => {
      const isSelected = selected?.id === flight.id;
      const existing = this.markers.get(flight.id);

      if (existing) {
        existing.setLatLng([flight.currentLat, flight.currentLng]);
        existing.setIcon(this.createFlightIcon(flight, isSelected));
        existing.setPopupContent(this.createPopupContent(flight));
      } else {
        const marker = L.marker([flight.currentLat, flight.currentLng], {
          icon: this.createFlightIcon(flight, isSelected),
          title: flight.callsign,
        }).bindPopup(this.createPopupContent(flight), {
            className: 'flight-popup',
            maxWidth: 280,
          }).on('click', () => this.flightService.selectFlight(flight));
        marker.addTo(this.map);
        this.markers.set(flight.id, marker);
      }
    });
  }

  private createFlightIcon(flight: Flight, isSelected: boolean): L.DivIcon {
    const statusColor = this.getStatusColor(flight.status);
    const size = isSelected ? 36 : 28;

    return L.divIcon({
      className: 'flight-marker',
      html: `
        <div class="flight-marker__wrapper ${isSelected ? 'flight-marker__wrapper--selected' : ''}"
             style="--marker-color: ${statusColor}; --marker-size: ${size}px; --heading: ${flight.heading}deg">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  private createPopupContent(flight: Flight): string {
    return `
      <div class="popup-content">
        <div class="popup-content__header">
          <strong>${flight.flightNumber}</strong>
          <span class="popup-status popup-status--${flight.status.toLowerCase()}">${flight.status}</span>
        </div>
        <div class="popup-content__row"><span>Callsign</span><span>${flight.callsign}</span></div>
        <div class="popup-content__row"><span>Origin</span><span>${flight.origin.code}</span></div>
        <div class="popup-content__row"><span>Destination</span><span>${flight.destination.code}</span></div>
      </div>
    `;
  }

  private drawRoute(flight: Flight): void {
    this.clearRoute();

    const origin = flight.origin;
    const destination = flight.destination;
    const current = { lat: flight.currentLat, lng: flight.currentLng };

    this.routeLayer = L.layerGroup();

    const completedRoute = L.polyline(
      [[origin.lat, origin.lng], [current.lat, current.lng]],
      { color: '#22c55e', weight: 3, opacity: 0.8, dashArray: '8, 6' }
    );

    const remainingRoute = L.polyline(
      [[current.lat, current.lng], [destination.lat, destination.lng]],
      { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '4, 8' }
    );

    const originMarker = L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      fillColor: '#22c55e',
      color: '#fff',
      weight: 2,
      fillOpacity: 1,
    }).bindTooltip(`${origin.code} — Origin`, { permanent: false, direction: 'top' });

    const destMarker = L.circleMarker([destination.lat, destination.lng], {
      radius: 8,
      fillColor: '#3b82f6',
      color: '#fff',
      weight: 2,
      fillOpacity: 1,
    }).bindTooltip(`${destination.code} — Destination`, { permanent: false, direction: 'top' });

    this.routeLayer.addLayer(completedRoute);
    this.routeLayer.addLayer(remainingRoute);
    this.routeLayer.addLayer(originMarker);
    this.routeLayer.addLayer(destMarker);
    this.routeLayer.addTo(this.map);
  }

  private clearRoute(): void {
    if (this.routeLayer) {
      this.routeLayer.remove();
      this.routeLayer = null;
    }
  }

  private centerOnFlight(flight: Flight): void {
    const bounds = L.latLngBounds([
      [flight.origin.lat, flight.origin.lng],
      [flight.destination.lat, flight.destination.lng],
      [flight.currentLat, flight.currentLng],
    ]);
    this.map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2, maxZoom: 8 });
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      Scheduled: '#94a3b8',
      Active: '#22c55e',
      Delayed: '#f59e0b',
      Arrived: '#8b5cf6',
      Cancelled: '#ef4444',
    };
    return colors[status] ?? '#94a3b8';
  }
}
