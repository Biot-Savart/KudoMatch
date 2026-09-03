import os
import unittest
from unittest.mock import patch

os.environ["INTERNAL_API_KEY"] = "test-key"

from fastapi.testclient import TestClient

from app import GatewayFailure, app, is_empty_event_history_path


class GatewayContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_is_public(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_non_health_requires_internal_key(self) -> None:
        response = self.client.get("/v1/events/16393687")
        self.assertEqual(response.status_code, 401)

    def test_only_historical_event_pages_treat_upstream_404_as_empty(self) -> None:
        self.assertTrue(is_empty_event_history_path("/unique-tournament/419/season/98406/events/last/0"))
        self.assertFalse(is_empty_event_history_path("/unique-tournament/419/season/98406/events/next/0"))

    @patch(
        "app.fetch_upstream",
        return_value={"event": {"id": 16393687}},
    )
    def test_event_route_is_fixed_and_validates_payload(self, fetch_upstream) -> None:
        response = self.client.get(
            "/v1/events/16393687",
            headers={"x-internal-api-key": "test-key"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["event"]["id"], 16393687)
        fetch_upstream.assert_called_once_with("/event/16393687")

    @patch(
        "app.fetch_upstream",
        side_effect=GatewayFailure(
            "upstream_forbidden", "SofaScore denied the gateway request."
        ),
    )
    def test_upstream_failures_are_sanitized_and_structured(self, fetch_upstream) -> None:
        response = self.client.get(
            "/v1/events/16393687",
            headers={"x-internal-api-key": "test-key"},
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "upstream_forbidden")


if __name__ == "__main__":
    unittest.main()
