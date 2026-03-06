import requests
from datetime import datetime, timezone
from utilities.logger import create_logger

log = create_logger(logger_name="ProxyListener_util_privateapi", alias="Private-API")


class Backend:

    def __init__(self, host: str, port: str):
        """Connect to the private API and verify it is reachable via /status.

        Raises:
            ConnectionError: If the server is unreachable or returns a non-200 status.
        """
        self._base_url = f"http://{host}:{port}"
        self._token: str = ""

        try:

            self.get_status()

        except requests.exceptions.ConnectionError:

            raise ConnectionError(f"Cannot reach private API at {self._base_url}")

        except requests.exceptions.HTTPError as e:

            raise ConnectionError(f"Private API status check failed: {e}")

        log.info(f"Connected to private API at {self._base_url}")

    def authenticate(self, username: str, password: str) -> str:
        """POST /auth/token — obtain and store a Bearer token.

        Raises:
            ConnectionError: If credentials are invalid or the request fails.

        Returns:
            The access token.
        """

        response = requests.post(
            url=f"{self._base_url}/auth/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={"username": username, "password": password},
        )

        if response.status_code != 200:
            raise ConnectionError(
                f"Authentication failed ({response.status_code}): {response.text}"
            )

        self._token = response.json()["access_token"]
        log.info("Authenticated with private API")

        return self._token

    def _auth_headers(self) -> dict[str, str]:

        if not self._token:
            raise RuntimeError("Not authenticated — call .authenticate() first")

        return {"Authorization": f"Bearer {self._token}"}

    def get_status(self) -> dict:
        """GET /status — no auth required."""
        response = requests.get(f"{self._base_url}/status")

        response.raise_for_status()

        return response.json()

    def get_service_list(self) -> list[dict]:
        """GET /service/get-service-list — requires auth."""

        response = requests.get(
            f"{self._base_url}/service/get-service-list",
            headers=self._auth_headers(),
        )

        response.raise_for_status()

        return response.json()

    def get_connection_list(self, all_services: list[dict]) -> list[dict]:
        """GET /connection/get-connection-list — requires auth."""

        response = requests.get(
            f"{self._base_url}/connection/get-connection-list",
            headers=self._auth_headers(),
        )

        response.raise_for_status()

        valid_connections = []

        for connection in response.json():

            try:

                if connection["service_name"] not in {s["name"] for s in all_services}:
                    log.warning(f"Connection document from address {connection['ip_address']} has a service {connection['service_name']} that does not exist - denying connection")
                    continue

                if connection["ExpireAt"]:

                    if datetime.fromisoformat(connection["ExpireAt"]) < datetime.now(timezone.utc):
                        log.warning(f"Connection document from address {connection['ip_address']} has expired - denying connection")
                        continue

            except Exception as e:

                log.warning(f"Error processing connection document ID {connection['_id']} (skipping document): {e}")

                continue  # So that comparing corrupt document would'nt crash the script

            valid_connections.append(connection)

        return valid_connections
