"""Read-only SofaScore access proof for Phase 2.

This is evidence tooling, not the Phase 4 gateway. It makes only fixed GET
requests, emits sanitized metadata, and requires an explicit confirmation that
the access method is permitted before contacting SofaScore.
"""

from __future__ import annotations

import argparse
import json
import secrets
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from curl_cffi import requests


BASE_URL = "https://www.sofascore.com/api/v1"
USER_AGENT = "KudoMatch-provider-proof/1.0 (read-only evidence; contact project maintainers)"
TIMEOUT_SECONDS = 20
MAX_RETRIES = 2
MAX_RETRY_AFTER_SECONDS = 10
PROBES = (
    {
        "case": "currie-cup-seasons",
        "path": "/unique-tournament/796/seasons",
        "expected": "seasons",
    },
    {
        "case": "urc-seasons",
        "path": "/unique-tournament/419/seasons",
        "expected": "seasons",
    },
    {
        "case": "currie-cup-event-16393687",
        "path": "/event/16393687",
        "expected": "event",
    },
)


def shape(value: Any, prefix: str = "") -> list[str]:
    if isinstance(value, list):
        if not value:
            return [f"{prefix}[]"]
        return [f"{prefix}[]", *shape(value[0], f"{prefix}[]")][:24]
    if not isinstance(value, dict):
        return [prefix] if prefix else []
    result: list[str] = []
    for key in sorted(value)[:24]:
        next_path = f"{prefix}.{key}" if prefix else key
        result.append(next_path)
    return result


def retry_after_seconds(value: str | None) -> float:
    if not value:
        return 0
    try:
        return min(MAX_RETRY_AFTER_SECONDS, max(0, float(value)))
    except ValueError:
        return 0


def classify(status: int | None, payload: Any, expected: str, error: str | None) -> str:
    if error == "timeout":
        return "timeout"
    if error == "network_error":
        return "network_error"
    if status is None or status < 200 or status >= 300:
        return "http_error"
    if isinstance(payload, dict) and ("error" in payload or "errors" in payload):
        return "provider_error"
    if isinstance(payload, dict) and expected not in payload:
        return "schema_error"
    return "success"


def request_probe(session: requests.Session, path: str) -> dict[str, Any]:
    last: dict[str, Any] = {
        "status": None,
        "payload": None,
        "contentType": None,
        "retryAfter": None,
        "responseBytes": 0,
        "durationMs": 0,
        "error": "network_error",
    }

    for attempt in range(MAX_RETRIES + 1):
        started = time.monotonic()
        try:
            response = session.get(
                f"{BASE_URL}{path}",
                headers={
                    "Accept": "application/json, text/plain, */*",
                    "Referer": "https://www.sofascore.com/",
                    "Origin": "https://www.sofascore.com",
                    "User-Agent": USER_AGENT,
                    "X-Requested-With": f"KudoMatchProof-{secrets.token_hex(8)}",
                },
                timeout=TIMEOUT_SECONDS,
            )
            body_text = response.text
            try:
                payload: Any = response.json() if body_text else None
            except ValueError:
                payload = None
            last = {
                "status": response.status_code,
                "payload": payload,
                "contentType": response.headers.get("content-type"),
                "retryAfter": response.headers.get("retry-after"),
                "responseBytes": len(body_text.encode("utf-8")),
                "durationMs": round((time.monotonic() - started) * 1000),
                "error": None,
            }
            if response.status_code != 429 and not response.status_code >= 500:
                return last
            time.sleep(retry_after_seconds(last["retryAfter"]))
        except requests.exceptions.Timeout:
            last = {
                "status": None,
                "payload": None,
                "contentType": None,
                "retryAfter": None,
                "responseBytes": 0,
                "durationMs": round((time.monotonic() - started) * 1000),
                "error": "timeout",
            }
            if attempt < MAX_RETRIES:
                time.sleep(min(MAX_RETRY_AFTER_SECONDS, 0.25 * 2**attempt))
        except requests.RequestsError:
            last = {
                "status": None,
                "payload": None,
                "contentType": None,
                "retryAfter": None,
                "responseBytes": 0,
                "durationMs": round((time.monotonic() - started) * 1000),
                "error": "network_error",
            }
            if attempt < MAX_RETRIES:
                time.sleep(min(MAX_RETRY_AFTER_SECONDS, 0.25 * 2**attempt))

    return last


def run(write: bool) -> dict[str, Any]:
    captured_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    report: dict[str, Any] = {
        "schemaVersion": 1,
        "provider": "sofascore",
        "capturedAt": captured_at,
        "runtime": "local-curl-cffi",
        "baseUrl": BASE_URL,
        "mode": "write" if write else "read-only",
        "probes": [],
        "policy": {
            "maxRequests": len(PROBES),
            "maxRetries": MAX_RETRIES,
            "timeoutSeconds": TIMEOUT_SECONDS,
            "maxRetryAfterSeconds": MAX_RETRY_AFTER_SECONDS,
        },
    }

    with requests.Session(impersonate="chrome") as session:
        for spec in PROBES:
            response = request_probe(session, spec["path"])
            category = classify(response["status"], response["payload"], spec["expected"], response["error"])
            payload = response["payload"]
            event = payload.get("event") if isinstance(payload, dict) else None
            probe = {
                "case": spec["case"],
                "path": spec["path"],
                "status": response["status"],
                "category": category,
                "durationMs": response["durationMs"],
                "responseBytes": response["responseBytes"],
                "contentType": response["contentType"],
                "retryAfter": response["retryAfter"],
                "shape": shape(payload),
                "eventId": event.get("id") if isinstance(event, dict) else None,
                "statusType": event.get("status", {}).get("type") if isinstance(event, dict) and isinstance(event.get("status"), dict) else None,
                "scoreFieldsObserved": isinstance(event, dict) and "homeScore" in event and "awayScore" in event,
            }
            if response["error"]:
                probe["error"] = response["error"]
            report["probes"].append(probe)

    if write:
        destination = Path("tests/fixtures/providers/sofascore/rugby-union/curl-cffi-proof.json")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write the sanitized proof summary fixture")
    parser.add_argument(
        "--confirm-permitted-access",
        action="store_true",
        help="confirm that this provider-permitted access method may be used",
    )
    args = parser.parse_args()
    if not args.confirm_permitted_access:
        print("Refusing to contact SofaScore without --confirm-permitted-access.", file=sys.stderr)
        return 2
    print(json.dumps(run(args.write), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
