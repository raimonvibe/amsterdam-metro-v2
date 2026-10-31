"""The memory status line logged every MEMORY_LOG_SECONDS."""
from app import main
from app.memory import rss_mb


def test_rss_read_from_proc_status(tmp_path):
    status = tmp_path / "status"
    status.write_text("Name:\tuvicorn\nVmPeak:\t  900000 kB\nVmRSS:\t  262144 kB\nThreads:\t5\n")
    assert rss_mb(status) == 256.0


def test_rss_unknown_without_proc(tmp_path):
    assert rss_mb(tmp_path / "missing") is None


def test_memory_report_names_what_the_process_holds(monkeypatch):
    monkeypatch.setattr(main, "rss_mb", lambda: 140.4)
    line = main.memory_report()
    assert line.startswith("Memory: 140 MB RSS, ")
    for part in ("threads", "streams", "departures", "journeys", "stations"):
        assert part in line
