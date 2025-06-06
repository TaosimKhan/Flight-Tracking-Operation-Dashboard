export type FlightStatus = 'Scheduled' | 'Active' | 'Delayed' | 'Arrived' | 'Cancelled';

export interface Airport {
  code: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Flight {
  id: string;
  flightNumber: string;
  callsign: string;
  aircraftType: string;
  origin: Airport;
  destination: Airport;
  status: FlightStatus;
  estimatedDeparture: string;
  estimatedArrival: string;
  currentLat: number;
  currentLng: number;
  heading: number;
}

export interface FlightKpis {
  total: number;
  active: number;
  delayed: number;
  arrived: number;
}

export interface FlightFilters {
  callsign: string;
  status: FlightStatus | '';
  origin: string;
  destination: string;
}
