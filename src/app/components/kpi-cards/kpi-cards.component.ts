import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FlightKpis } from '../../models/flight.model';
import { FlightService } from '../../services/flight.service';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-cards.component.html',
  styleUrl: './kpi-cards.component.scss',
})
export class KpiCardsComponent {
  readonly kpis$: Observable<FlightKpis> = this.flightService.kpis$;

  constructor(private flightService: FlightService) {}
}
