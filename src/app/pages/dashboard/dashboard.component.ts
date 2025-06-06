import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, combineLatest, interval } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Flight } from '../../models/flight.model';
import { FlightService } from '../../services/flight.service';
import { KpiCardsComponent } from '../../components/kpi-cards/kpi-cards.component';
import { FlightFiltersComponent } from '../../components/flight-filters/flight-filters.component';
import { FlightDetailsPanelComponent } from '../../components/flight-details-panel/flight-details-panel.component';
import { FlightMapComponent } from '../../components/flight-map/flight-map.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, KpiCardsComponent, FlightFiltersComponent, FlightDetailsPanelComponent, FlightMapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentTime = new Date();

  readonly filteredFlights$: Observable<Flight[]> = this.flightService.filteredFlights$;
  readonly selectedFlight$: Observable<Flight | null> = this.flightService.selectedFlight$;
  readonly flightCount$: Observable<string> = combineLatest([
    this.flightService.filteredFlights$,
    this.flightService.flights$,
  ]).pipe(
    map(([filtered, all]) => `${filtered.length} of ${all.length} flights`)
  );

  private readonly destroy$ = new Subject<void>();

  constructor(private flightService: FlightService) {}

  ngOnInit(): void {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.currentTime = new Date();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectFlight(flight: Flight): void {
    this.flightService.selectFlight(flight);
  }

  isSelected(flight: Flight, selected: Flight | null): boolean {
    return selected?.id === flight.id;
  }

  getStatusClass(status: string): string {
    return `flight-list__status flight-list__status--${status.toLowerCase()}`;
  }
}
