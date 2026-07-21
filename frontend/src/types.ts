export interface Line {
  id: string;
  name: string;
  color: string;
  shape: [number, number][];
}

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lines: string[];
}

export interface Train {
  id: string;
  line: string;
  latitude: number;
  longitude: number;
  bearing: number;
  distance_m: number;
  speed_m_s: number;
  shape_id: string;
  headsign?: string;
  delay_s: number;
  status: "moving" | "dwelling";
  prev_station?: string;
  next_station?: string;
  next_arrival_ts?: number;
  realtime: boolean;
}

export interface ShapeGeom {
  coords: [number, number][];
  cum: number[];
}

export interface Status {
  static_loaded: boolean;
  static_age_hours?: number;
  rt_last_success_ts?: number;
  rt_trip_count: number;
  active_trains: number;
  is_live: boolean;
}

/** A train enriched with its fetch timestamp for client-side dead reckoning. */
export interface AnimatedTrain extends Train {
  fetchedAt: number; // ms epoch when this position was computed
}

export interface Departure {
  trip_id: string;
  line: string;
  headsign: string;
  departure_ts: number;
  delay_s: number;
  realtime: boolean;
}
