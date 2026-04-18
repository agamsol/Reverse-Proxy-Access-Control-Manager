import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor
from utilities.logger import create_logger

log = create_logger(logger_name="ProxyListener_util_privateapi", alias="Private-API")

_ESTABLISHING = "Establishing connection with private API"
_AQUA = "\033[96m"
_RESET = "\033[0m"


def _stderr_spin_while(condition) -> None:
    """Aqua | / - \\ at line start, then _ESTABLISHING, while condition() is true."""
    frames = "|/-\\"
    i = 0
    clear_w = max(len(_ESTABLISHING) + 10, 72)
    while condition():
        sys.stderr.write(
            f"\r{_AQUA}{frames[i % 4]}{_RESET} {_ESTABLISHING}   "
        )
        sys.stderr.flush()
        time.sleep(0.1)
        i += 1
    sys.stderr.write("\r" + " " * clear_w + "\r")
    sys.stderr.flush()


class Backend:

    def __init__(self, host: str, port: str):
        """Connect to the private API and verify it is reachable via /status.

        Raises:
            ConnectionError: If the server is unreachable or returns a non-200 status.
        """
        self._base_url = f"http://{host}:{port}"
        self._token: str = ""

        while True:

            try:

                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(self.get_status)
                    _stderr_spin_while(lambda: not future.done())
                    future.result()

                break

            except (ConnectionError, requests.exceptions.HTTPError):

                deadline = time.monotonic() + 5
                _stderr_spin_while(lambda: time.monotonic() < deadline)

        log.info(f"Connected to private API ({self._base_url}).")

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

        try:

            response = requests.get(f"{self._base_url}/status")

        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Cannot reach private API at {self._base_url}")

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

        return response.json()
