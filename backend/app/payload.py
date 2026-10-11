"""Pre-serialised API responses.

Every response body is JSON-encoded and gzipped once, when its data changes,
not per request: on a 0.5-CPU instance, re-serialising the 1 MB shapes payload
(or gzipping it) for every page load would be most of the server's work.
"""
import gzip
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

from starlette.requests import Request
from starlette.responses import Response


@dataclass(frozen=True)
class Payload:
    body: bytes
    gzipped: bytes
    etag: str

    @classmethod
    def of(cls, data: Any) -> "Payload":
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
        # Weak: the gzip and identity encodings carry the same tag.
        etag = 'W/"%s"' % hashlib.blake2b(body, digest_size=8).hexdigest()
        return cls(body, gzip.compress(body, compresslevel=6), etag)

    def respond(
        self, request: Request, cache_control: str, extra: Optional[Dict[str, str]] = None,
    ) -> Response:
        headers = {"ETag": self.etag, "Cache-Control": cache_control, "Vary": "Accept-Encoding", **(extra or {})}
        if request.headers.get("if-none-match") == self.etag:
            return Response(status_code=304, headers=headers)
        if "gzip" in request.headers.get("accept-encoding", ""):
            headers["Content-Encoding"] = "gzip"
            return Response(self.gzipped, media_type="application/json", headers=headers)
        return Response(self.body, media_type="application/json", headers=headers)
