"""Allowlisted internal gateway for SofaScore Rugby Union requests.

The gateway deliberately exposes generated, fixed upstream paths only. It is
not a URL proxy: callers cannot choose an upstream host, path, or headers.
"""

from __future__ import annotations

import hmac
import json
import os
import time
from typing import Any, Literal

from curl_cffi import requests
from fastapi import Depends, FastAPI, Header, HTTPException, Path
from fastapi.responses import JSONResponse


app = FastAPI(title="KudoMatch SofaScore Gateway", version="1.0.0")

BASE_URL = os.getenv("SOFASCORE_BASE_URL", "https://www.sofascore.com/api/v1").rstrip("/")
USER_AGENT = os.getenv(
    "SOFASCORE_USER_AGENT",
    "KudoMatch-sofascore-gateway/1.0 (server-side provider access)",
)
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
TIMEOUT_SECONDS = min(max(float(os.getenv("SOFASCORE_TIMEOUT_SECONDS", "20")), 1.0), 30.0)
MAX_RETRIES = min(max(int(os.getenv("SOFASCORE_MAX_RETRIES", "2")), 0), 2)
MAX_RETRY_AFTER_SECONDS = 10.0


def structured_log(event: str, **fields: Any) -> None:
    """Emit only bounded, non-secret operational fields as JSON."""
    print(json.dumps({"event": event, **fields}, separators=(",", ":")), flush=True)


class GatewayFailure(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def failure_response(failure: GatewayFailure) -> JSONResponse:
    return JSONResponse(
        status_code=failure.status_code,
        content={"error": {"code": failure.code, "message": failure.message}},
    )


def require_internal_key(x_internal_api_key: str | None = Header(default=None)) -> None:
    if not INTERNAL_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={"code": "gateway_not_configured", "message": "Internal gateway key is not configured."},
        )
    supplied = x_internal_api_key or ""
    if not hmac.compare_digest(supplied, INTERNAL_API_KEY):
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_api_key", "message": "A valid internal API key is required."},
        )


def retry_after_seconds(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return min(MAX_RETRY_AFTER_SECONDS, max(0.0, float(value)))
    except ValueError:
        return 0.0


def upstream_error(status_code: int) -> GatewayFailure:
    mapping = {
        403: ("upstream_forbidden", "SofaScore denied the gateway request."),
        404: ("upstream_not_found", "SofaScore did not find the requested resource."),
        429: ("upstream_rate_limited", "SofaScore rate-limited the gateway request."),
    }
    code, message = mapping.get(
        status_code,
        ("upstream_unavailable", "SofaScore is unavailable to the gateway."),
    )
    return GatewayFailure(code, message)


def is_empty_event_history_path(path: str) -> bool:
    """SofaScore uses 404 for empty historical or upcoming event pages in some active seasons."""
    return "/events/last/" in path or "/events/next/" in path


def require_array(payload: Any, key: str) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get(key), list):
        raise GatewayFailure("schema_error", f"SofaScore response did not contain a valid '{key}' array.")
    return payload


def require_object(payload: Any, key: str) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get(key), dict):
        raise GatewayFailure("schema_error", f"SofaScore response did not contain a valid '{key}' object.")
    return payload


def fetch_upstream(path: str) -> Any:
    """Fetch one generated allowlisted path with bounded, status-aware retries."""

    last_failure: GatewayFailure | None = None
    for attempt in range(MAX_RETRIES + 1):
        started = time.monotonic()
        try:
            with requests.Session(impersonate="chrome") as session:
                response = session.get(
                    f"{BASE_URL}{path}",
                    headers={
                        "Accept": "application/json, text/plain, */*",
                        "Referer": "https://www.sofascore.com/",
                        "Origin": "https://www.sofascore.com",
                        "User-Agent": USER_AGENT,
                    },
                    timeout=TIMEOUT_SECONDS,
                )
            if response.status_code < 200 or response.status_code >= 300:
                if response.status_code == 404 and is_empty_event_history_path(path):
                    structured_log(
                        "sofascore_upstream_response",
                        path=path,
                        status=response.status_code,
                        attempt=attempt + 1,
                        duration_ms=round((time.monotonic() - started) * 1000),
                        outcome="empty_event_history",
                    )
                    return {"events": [], "hasNextPage": False}
                failure = upstream_error(response.status_code)
                last_failure = failure
                structured_log(
                    "sofascore_upstream_response",
                    path=path,
                    status=response.status_code,
                    attempt=attempt + 1,
                    duration_ms=round((time.monotonic() - started) * 1000),
                    outcome=failure.code,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    delay = retry_after_seconds(response.headers.get("retry-after"))
                    if not delay:
                        delay = min(MAX_RETRY_AFTER_SECONDS, 0.25 * (2**attempt))
                    time.sleep(delay)
                    continue
                raise failure
            try:
                payload = response.json()
            except (ValueError, json.JSONDecodeError) as exc:
                raise GatewayFailure("schema_error", "SofaScore returned malformed JSON.") from exc
            if isinstance(payload, dict) and ("error" in payload or "errors" in payload):
                raise GatewayFailure("provider_error", "SofaScore returned a provider error payload.")
            structured_log(
                "sofascore_upstream_response",
                path=path,
                status=response.status_code,
                attempt=attempt + 1,
                duration_ms=round((time.monotonic() - started) * 1000),
                outcome="success",
            )
            return payload
        except GatewayFailure:
            raise
        except (requests.exceptions.Timeout, TimeoutError) as exc:
            last_failure = GatewayFailure("timeout", "SofaScore request timed out.")
            structured_log(
                "sofascore_upstream_failure",
                path=path,
                attempt=attempt + 1,
                duration_ms=round((time.monotonic() - started) * 1000),
                outcome="timeout",
            )
            if attempt >= MAX_RETRIES:
                raise last_failure from exc
            time.sleep(min(MAX_RETRY_AFTER_SECONDS, 0.25 * (2**attempt)))
        except requests.RequestsError as exc:
            last_failure = GatewayFailure("network_error", "SofaScore request failed at the network boundary.")
            structured_log(
                "sofascore_upstream_failure",
                path=path,
                attempt=attempt + 1,
                duration_ms=round((time.monotonic() - started) * 1000),
                outcome="network_error",
            )
            if attempt >= MAX_RETRIES:
                raise last_failure from exc
            time.sleep(min(MAX_RETRY_AFTER_SECONDS, 0.25 * (2**attempt)))
    raise last_failure or GatewayFailure("network_error", "SofaScore request failed.")


def bounded_id(value: int) -> int:
    if value <= 0:
        raise HTTPException(status_code=422, detail="Identifier must be positive.")
    return value


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sofascore-gateway"}


@app.get("/v1/events/{event_id}")
def event_detail(
    event_id: int = Path(..., ge=1),
    _: None = Depends(require_internal_key),
) -> JSONResponse:
    try:
        payload = require_object(fetch_upstream(f"/event/{bounded_id(event_id)}"), "event")
        return JSONResponse(content=payload)
    except GatewayFailure as failure:
        return failure_response(failure)


@app.get("/v1/tournaments/{tournament_id}/seasons")
def seasons(
    tournament_id: int = Path(..., ge=1),
    _: None = Depends(require_internal_key),
) -> JSONResponse:
    try:
        payload = require_array(fetch_upstream(f"/unique-tournament/{bounded_id(tournament_id)}/seasons"), "seasons")
        return JSONResponse(content=payload)
    except GatewayFailure as failure:
        return failure_response(failure)


@app.get("/v1/tournaments/{tournament_id}/seasons/{season_id}/events/{direction}/{page}")
def events(
    tournament_id: int = Path(..., ge=1),
    season_id: int = Path(..., ge=1),
    direction: Literal["next", "last"] = "next",
    page: int = Path(..., ge=0, le=100),
    _: None = Depends(require_internal_key),
) -> JSONResponse:
    try:
        payload = require_array(
            fetch_upstream(
                f"/unique-tournament/{bounded_id(tournament_id)}/season/{bounded_id(season_id)}/events/{direction}/{page}"
            ),
            "events",
        )
        return JSONResponse(content=payload)
    except GatewayFailure as failure:
        return failure_response(failure)


@app.get("/v1/tournaments/{tournament_id}/seasons/{season_id}/teams")
def teams(
    tournament_id: int = Path(..., ge=1),
    season_id: int = Path(..., ge=1),
    _: None = Depends(require_internal_key),
) -> JSONResponse:
    try:
        payload = require_array(
            fetch_upstream(f"/unique-tournament/{bounded_id(tournament_id)}/season/{bounded_id(season_id)}/teams"),
            "teams",
        )
        return JSONResponse(content=payload)
    except GatewayFailure as failure:
        return failure_response(failure)
