from typing import List, Optional
from pydantic import BaseModel


class Line(BaseModel):
    id: str                      # "50".."54"
    name: str
    color: str
    shape: List[List[float]]     # representative [lon, lat] polyline (longest shape)
    # Every distinct track the line runs on, the representative one first. A
    # metro line is not one polyline: the two directions have their own GTFS
    # shapes, and where they run in separate tunnel bores they are metres
    # apart. Drawing only `shape` leaves trains on the other bore floating
    # visibly beside the rail — 17m at Noorderpark. Near-identical shapes are
    # collapsed (see TRACK_DEDUP_M), so this stays 1-3 entries per line rather
    # than one per trip pattern.
    tracks: List[List[List[float]]] = []


class StationOut(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    lines: List[str]


class TrainOut(BaseModel):
    id: str                      # trip_id
    line: str                    # "50".."54"
    latitude: float
    longitude: float
    bearing: float
    distance_m: float            # distance along its shape
    speed_m_s: float             # current segment speed (0 while dwelling)
    shape_id: str
    headsign: Optional[str] = None
    delay_s: int = 0
    status: str = "moving"       # "moving" | "dwelling"
    prev_station: Optional[str] = None
    next_station: Optional[str] = None
    next_arrival_ts: Optional[int] = None
    # Platform where it stands while dwelling, else where it arrives next.
    # None where the timetable has none (the big interchanges).
    platform: Optional[str] = None
    # When the current segment began: departure from prev_station. Paired with
    # next_arrival_ts it gives the client segment progress without re-solving.
    prev_departure_ts: Optional[int] = None
    stops_remaining: int = 0     # calls still ahead, terminus included
    final_arrival_ts: Optional[int] = None  # arrival at the terminus
    realtime: bool = False


class StatusOut(BaseModel):
    static_loaded: bool
    static_age_hours: Optional[float]
    rt_last_success_ts: Optional[int]
    rt_trip_count: int
    active_trains: int
    is_live: bool
