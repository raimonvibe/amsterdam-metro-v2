"""Process memory, for the periodic status line in the log.

Render's memory graph shows the instance creeping up over days until it is
killed at 512 MB (29 Oct 2026), while everything Python itself holds stays
around 130 MB. The log line this feeds says which of the two is growing:
resident memory with steady cache and stream counts points at the allocator,
a growing count at the code.
"""
from pathlib import Path
from typing import Optional

PROC_STATUS = Path("/proc/self/status")


def rss_mb(status_path: Path = PROC_STATUS) -> Optional[float]:
    """Resident memory of this process in MB, or None where /proc is missing
    (Windows, macOS: local development only)."""
    try:
        text = status_path.read_text()
    except OSError:
        return None
    for line in text.splitlines():
        if line.startswith("VmRSS:"):
            return int(line.split()[1]) / 1024  # reported in kB
    return None
