import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { Flight } from '../../models/flight.model';
import { FlightService } from '../../services/flight.service';

@Component({
  selector: 'app-flight-details-panel',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './flight-details-panel.component.html',
  styleUrl: './flight-details-panel.component.scss',
})
export class FlightDetailsPanelComponent {
  readonly selectedFlight$: Observable<Flight | null> = this.flightService.selectedFlight$;

  constructor(private flightService: FlightService) {}

  clearSelection(): void {
    this.flightService.selectFlight(null);
  }

  getStatusClass(status: string): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }
}
