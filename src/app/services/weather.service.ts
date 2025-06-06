import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, distinctUntilChanged, interval, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { Airport } from '../models/flight.model';
import { AirportWeather, RainViewerData, RainViewerFrame, WMO_WEATHER_LABELS, WeatherOverlayState } from '../models/weather.model';
import { FlightService } from './flight.service';

const INITIAL_OVERLAY_STATE: WeatherOverlayState = {
  precipitation: false,
  clouds: false,
  airportConditions: false,
  opacity: 0.65,
  animateRadar: false,
};

interface RainViewerApiResponse {
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
  satellite: { infrared: RainViewerFrame[] };
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
  };
}

@Injectable({ providedIn: 'root' })
export class WeatherService implements OnDestroy {
  private readonly overlaySubject = new BehaviorSubject<WeatherOverlayState>(INITIAL_OVERLAY_STATE);
  private readonly rainViewerSubject = new BehaviorSubject<RainViewerData | null>(null);
  private readonly airportWeatherSubject = new BehaviorSubject<AirportWeather[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly destroy$ = new Subject<void>();

  readonly overlay$ = this.overlaySubject.asObservable();
  readonly rainViewer$ = this.rainViewerSubject.asObservable();
  readonly airportWeather$ = this.airportWeatherSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  readonly radarFrameIndex$ = new BehaviorSubject<number>(0);

  constructor(
    private http: HttpClient,
    private flightService: FlightService
  ) {
    this.loadRainViewerData();
    this.startAirportWeatherRefresh();
    this.startRadarAnimation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateOverlay(partial: Partial<WeatherOverlayState>): void {
    this.overlaySubject.next({ ...this.overlaySubject.value, ...partial });
  }

  resetOverlay(): void {
    this.overlaySubject.next(INITIAL_OVERLAY_STATE);
    this.radarFrameIndex$.next(0);
  }

  loadRainViewerData(): void {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.http.get<RainViewerApiResponse>('https://api.rainviewer.com/public/weather-maps.json')
      .pipe(
        map((data) => ({
          host: data.host,
          radarFrames: [...data.radar.past, ...data.radar.nowcast],
          satelliteFrames: data.satellite.infrared,
        })),
        tap((data) => {
          this.rainViewerSubject.next(data);
          this.radarFrameIndex$.next(Math.max(0, data.radarFrames.length - 1));
          this.loadingSubject.next(false);
        }),
        catchError(() => {
          this.errorSubject.next('Unable to load weather radar data.');
          this.loadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  private startAirportWeatherRefresh(): void {
    this.flightService.flights$
      .pipe(
        map((flights) => this.getUniqueAirports(flights.flatMap((f) => [f.origin, f.destination]))),
        distinctUntilChanged((prev, next) => this.airportKey(prev) === this.airportKey(next)),
        switchMap((airports) => (airports.length ? this.fetchAirportWeather(airports) : of([]))),
        takeUntil(this.destroy$)
      )
      .subscribe((weather) => this.airportWeatherSubject.next(weather));
  }

  private startRadarAnimation(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const overlay = this.overlaySubject.value;
        const data = this.rainViewerSubject.value;
        if (!overlay.animateRadar || !overlay.precipitation || !data?.radarFrames.length) {
          return;
        }

        const nextIndex = (this.radarFrameIndex$.value + 1) % data.radarFrames.length;
        this.radarFrameIndex$.next(nextIndex);
      });
  }

  private getUniqueAirports(airports: Airport[]): Airport[] {
    const seen = new Set<string>();
    return airports.filter((airport) => {
      if (seen.has(airport.code)) return false;
      seen.add(airport.code);
      return true;
    });
  }

  private airportKey(airports: Airport[]): string {
    return airports.map((a) => a.code).sort().join(',');
  }

  private fetchAirportWeather(airports: Airport[]): Observable<AirportWeather[]> {
    const latitudes = airports.map((a) => a.lat).join(',');
    const longitudes = airports.map((a) => a.lng).join(',');

    return this.http
      .get<OpenMeteoResponse[]>('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: latitudes,
          longitude: longitudes,
          current: 'temperature_2m,weather_code,wind_speed_10m,precipitation',
          timezone: 'auto',
        },
      })
      .pipe(
        map((response) => {
          const results = Array.isArray(response) ? response : [response];
          return airports.map((airport, index) => {
            const current = results[index]?.current;
            const wmo = WMO_WEATHER_LABELS[current?.weather_code ?? -1] ?? {
              label: 'Unknown',
              icon: '🌡️',
            };

            return {
              code: airport.code,
              name: airport.name,
              city: airport.city,
              lat: airport.lat,
              lng: airport.lng,
              temperature: current?.temperature_2m ?? 0,
              windSpeed: current?.wind_speed_10m ?? 0,
              precipitation: current?.precipitation ?? 0,
              weatherCode: current?.weather_code ?? 0,
              condition: wmo.label,
              icon: wmo.icon,
            };
          });
        }),
        catchError(() => of([]))
      );
  }
}
