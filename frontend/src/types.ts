export interface Line {
  id: string;
  name: string;
  color: string;
  /** Representative (longest) shape. Kept for callers that want one polyline
   *  for the whole line; the map draws `tracks` instead. */
  shape: [number, number][];
  /** Every distinct stretch of rail the line runs on, each drawn once. A line
   *  is not one polyline — the two directions have separate GTFS shapes, and
   *  in separate tunnel bores they are metres apart. Optional so the frontend
   *  still renders against a backend that predates the field. */
  tracks?: [number, number][][];
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
  /** Platform where it stands while dwelling, else where it arrives next;
   *  null/absent where the timetable has none. */
  platform?: string | null;
  /** Departure from prev_station — start of the current segment. */
  prev_departure_ts?: number;
  /** Calls still ahead, terminus included. */
  stops_remaining?: number;
  /** Arrival at the terminus. */
  final_arrival_ts?: number;
  realtime: boolean;
  /** How sure the position is: the signalling system recently reported the
   *  train at or heading to a stop ("confirmed"), a clock estimate on live
   *  predictions ("live"), or the timetable alone ("schedule"). Absent from a
   *  backend that predates it. */
  confidence?: "confirmed" | "live" | "schedule";
  /** Latest stop report, however old: where, "at" or heading "to", when. */
  seen_station?: string | null;
  seen_status?: "at" | "to" | null;
  seen_ts?: number | null;
}

/** Text GVB publishes in both languages; English can be missing. */
export interface LocalText {
  nl: string;
  en?: string | null;
}

/** A GVB service message (KV15) for the metro that is in force now. */
export interface ServiceAlert {
  id: string;
  header: LocalText;
  /** Only when it says more than the header. */
  description?: LocalText | null;
  lines: string[];
  /** Station names; empty when the message concerns its lines as a whole. */
  stations: string[];
  /** Names every station of its lines: about the line as a whole. */
  whole_line?: boolean;
  start_ts?: number | null;
  end_ts?: number | null;
  effect: string;
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
