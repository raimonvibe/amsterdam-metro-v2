"""Security headers on every API response (audit M1).

Pure ASGI rather than Starlette's BaseHTTPMiddleware: that one wraps the
response body, which can buffer /api/trains/stream. Here the headers are
added to the response start message and the body passes through untouched.
"""
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The API returns JSON and an event stream, never a page: nothing may load
# from it, frame it, or sniff it into something else.
API_SECURITY_HEADERS = {
    b"content-security-policy": b"default-src 'none'; frame-ancestors 'none'",
    b"strict-transport-security": b"max-age=31536000",
    b"x-content-type-options": b"nosniff",
    b"x-frame-options": b"DENY",
    b"referrer-policy": b"no-referrer",
    b"cross-origin-resource-policy": b"cross-site",  # the site on another origin reads it
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                present = {k.lower() for k, _ in message.get("headers", [])}
                extra = [(k, v) for k, v in API_SECURITY_HEADERS.items() if k not in present]
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)

        await self.app(scope, receive, send_with_headers)
