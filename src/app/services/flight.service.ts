import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, combineLatest, interval, map, of, shareReplay, takeUntil, tap } from 'rxjs'; 
import { Flight, FlightFilters, FlightKpis, FlightStatus } from '../models/flight.model';

const INITIAL_FILTERS: FlightFilters = {
  callsign: '',
  status: '',
  origin: '',
  destination: '',
};

@Injectable({ providedIn: 'root' })
export class FlightService implements OnDestroy {
  private readonly flightsSubject = new BehaviorSubject<Flight[]>([]);
  private readonly selectedFlightSubject = new BehaviorSubject<Flight | null>(null);
  private readonly filtersSubject = new BehaviorSubject<FlightFilters>(INITIAL_FILTERS);
  private readonly destroy$ = new Subject<void>();

  readonly flights$ = this.flightsSubject.asObservable();
  readonly selectedFlight$ = this.selectedFlightSubject.asObservable();
  readonly filters$ = this.filtersSubject.asObservable();

  readonly filteredFlights$: Observable<Flight[]> = combineLatest([
    this.flights$,
    this.filters$,
  ]).pipe(
    map(([flights, filters]) => this.applyFilters(flights, filters)),
    shareReplay(1)
  );

  readonly kpis$: Observable<FlightKpis> = this.flights$.pipe(
    map((flights) => ({
      total: flights.length,
      active: flights.filter((f) => f.status === 'Active').length,
      delayed: flights.filter((f) => f.status === 'Delayed').length,
      arrived: flights.filter((f) => f.status === 'Arrived').length,
    })),
    shareReplay(1)
  );

  readonly airports$: Observable<{ origins: string[]; destinations: string[] }> =
    this.flights$.pipe(
      map((flights) => ({
        origins: [...new Set(flights.map((f) => f.origin.code))].sort(),
        destinations: [...new Set(flights.map((f) => f.destination.code))].sort(),
      })),
      shareReplay(1)
    );

  constructor(private http: HttpClient) {
    this.loadFlights();
    this.startPositionUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFlights(): void {
    this.http.get<Flight[]>('assets/data/flights.json').pipe(
      tap((flights) => this.flightsSubject.next(flights)),
      catchError((error) => {
        console.error('Error loading flights:', error);
        return of([]);
      })
    ).subscribe();
  }

  private startPositionUpdates(): void {
    interval(3000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateActiveFlightPositions());
  }

  private updateActiveFlightPositions(): void {
    const flights = this.flightsSubject.value;
    if (!flights.length) return;

    const updated = flights.map((flight) => {
      if (flight.status !== 'Active' && flight.status !== 'Delayed') {
        return flight;
      }

      const destLat = flight.destination.lat;
      const destLng = flight.destination.lng;
      const latDiff = destLat - flight.currentLat;
      const lngDiff = destLng - flight.currentLng;
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      if (distance < 0.15) {
        return { ...flight, status: 'Arrived' as FlightStatus, currentLat: destLat, currentLng: destLng, heading: 0 };
      }

      const step = Math.min(0.12, distance * 0.08);
      const ratio = step / distance;
      const newLat = flight.currentLat + latDiff * ratio;
      const newLng = flight.currentLng + lngDiff * ratio;
      const heading = (Math.atan2(lngDiff, latDiff) * 180) / Math.PI;

      return { ...flight, currentLat: newLat, currentLng: newLng, heading };
    });

    this.flightsSubject.next(updated);

    const selected = this.selectedFlightSubject.value;
    if (selected) {
      const refreshed = updated.find((f) => f.id === selected.id);
      if (refreshed) {
        this.selectedFlightSubject.next(refreshed);
      }
    }
  }

  selectFlight(flight: Flight | null): void {
    this.selectedFlightSubject.next(flight);
  }

  updateFilters(filters: Partial<FlightFilters>): void {
    this.filtersSubject.next({ ...this.filtersSubject.value, ...filters });
  }

  resetFilters(): void {
    this.filtersSubject.next(INITIAL_FILTERS);
  }

  getStatusOptions(): FlightStatus[] {
    return ['Scheduled', 'Active', 'Delayed', 'Arrived', 'Cancelled'];
  }

  private applyFilters(flights: Flight[], filters: FlightFilters): Flight[] {
    return flights.filter((flight) => {
      const callsignMatch = !filters?.callsign || this.matchesCallsignSearch(flight, filters.callsign);
      const statusMatch = !filters?.status || flight?.status === filters?.status;
      const originMatch = !filters?.origin || flight?.origin.code === filters?.origin;
      const destinationMatch = !filters?.destination || flight?.destination.code === filters?.destination;
      return callsignMatch && statusMatch && originMatch && destinationMatch;
    });
  }

  private matchesCallsignSearch(flight: Flight, search: string): boolean {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const normalizedQuery = this.normalizeSearchTerm(query);
    const fields = [flight.callsign, flight.flightNumber];

    return fields.some((field) => {
      const value = field.toLowerCase();
      return (
        value.includes(query) ||
        this.normalizeSearchTerm(value).includes(normalizedQuery)
      );
    });
  }

  private normalizeSearchTerm(term: string): string {
    return term.replace(/[^a-z0-9]/g, '');
  }
}
