import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { FlightService } from '../../services/flight.service';

@Component({
  selector: 'app-flight-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './flight-filters.component.html',
  styleUrl: './flight-filters.component.scss',
})
export class FlightFiltersComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  readonly airports$: Observable<{ origins: string[]; destinations: string[] }> = this.flightService.airports$;
  readonly statusOptions = this.flightService.getStatusOptions();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private flightService: FlightService
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      callsign: [''],
      status: [''],
      origin: [''],
      destination: [''],
    });
    this.filterForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((values) => this.flightService.updateFilters(values));
  }

  resetFilters(): void {
    this.filterForm.reset({
      callsign: '',
      status: '',
      origin: '',
      destination: '',
    });
    this.flightService.resetFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
