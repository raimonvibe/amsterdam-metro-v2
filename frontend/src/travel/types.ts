import { Departure } from "../types";

/** A departure with the extra fields the travel board uses. */
export interface BoardDeparture extends Departure {
  scheduled_ts: number;
  stop_id: string;
  /** Platform number from the timetable; null where the feed has none
   *  (the big interchanges) or for data cached before it was added. */
  platform?: string | null;
  stops_remaining: number;
  terminus_ts: number;
  cancelled: boolean;
}

export interface NetworkDirection {
  headsign: string;
  stations: string[];
  /** Typical seconds from each station to the next. */
  runtimes_s: number[];
}

export interface NetworkLine {
  id: string;
  name: string;
  color: string;
  directions: NetworkDirection[];
}

export interface StationDirection {
  line: string;
  headsign: string;
  first_ts: number | null;
  last_ts: number | null;
  headway_min: number | null;
  departures_next_hour: number;
  next_stops: string[];
}

export interface StationInfo {
  station: string;
  lines: string[];
  service_day: string;
  directions: StationDirection[];
}

export interface JourneyLeg {
  trip_id: string;
  line: string;
  headsign: string;
  from: string;
  to: string;
  departure_ts: number;
  arrival_ts: number;
  stops: number;
  delay_s: number;
  realtime: boolean;
}

export interface Journey {
  departure_ts: number;
  arrival_ts: number;
  duration_s: number;
  transfers: number;
  legs: JourneyLeg[];
}
