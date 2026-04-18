import os
import time
import subprocess
from dotenv import load_dotenv
from utilities.nginx import Nginx
from utilities.backend import Backend
from utilities.logger import create_logger

DOTENV_FILE = ".env"

load_dotenv(DOTENV_FILE)

POLLING_INTERVAL = int(os.getenv("POLLING_INTERVAL", 60))
DOCKER_CONFIGURATION_PRIMARY_PATH = os.getenv("DOCKER_CONFIGURATION_PRIMARY_PATH", "/etc/nginx/conf.d/")

log = create_logger(logger_name="ProxyListener_util_polling", alias="Polling")


class PollingAndProcessing:

    def __init__(self, nginx_path: str, private_api: Backend) -> None:
        self.nginx_path = nginx_path
        self.private_api = private_api

    def _fetch_all_services(self) -> list[dict] | None:

        try:
            all_services = self.private_api.get_service_list()
            log.debug(f"Fetched {len(all_services)} service(s)")
            return all_services
        except Exception as e:
            log.error(f"Failed to fetch services: {e}")
            return None

    def _fetch_all_connections(self, all_services: list[dict]) -> list[dict] | None:

        try:
            all_connections = self.private_api.get_connection_list(all_services=all_services)
            log.debug(f"Fetched {len(all_connections)} valid connection(s)")
            return all_connections
        except Exception as e:
            log.error(f"Failed to fetch connections: {e}")
            return None

    def poll_and_process(self) -> None:

        log.info(f"Polling started (interval: {POLLING_INTERVAL}s)")

        previous_fetch_connections = []
        had_failure = False

        while True:

            all_services = self._fetch_all_services()

            if all_services is None:
                log.warning("Skipping cycle — could not fetch services")
                had_failure = True
                time.sleep(POLLING_INTERVAL)
                continue

            all_connections = self._fetch_all_connections(all_services)

            if all_connections is None:
                log.warning("Skipping cycle — could not fetch connections")
                had_failure = True
                time.sleep(POLLING_INTERVAL)
                continue

            if had_failure:
                log.info("Connection to private API resumed")
                had_failure = False

            if previous_fetch_connections == all_connections:
                time.sleep(POLLING_INTERVAL)
                continue

            log.info(f"Connection change detected — {len(all_connections)} active connection(s)")
            previous_fetch_connections = all_connections

            if not all_connections:
                log.info("Connection list is now empty, skipping nginx update")
                time.sleep(POLLING_INTERVAL)
                continue

            path = Nginx.address_whitelist_config_generator(
                nginx_path=self.nginx_path,
                services=all_services,
                connections=all_connections,
            )

            saved = os.environ.get("NGINX_BINARY", "").strip()

            if saved and saved.startswith("docker"):

                # Copy the files to the docker container! (Overwrite)

                container_name = Nginx._find_nginx_docker_container()
                container_id = Nginx._get_docker_container_id(container_name)

                result = subprocess.run(
                    f"docker cp {path} {container_name}:{DOCKER_CONFIGURATION_PRIMARY_PATH}",
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

                if result.returncode != 0:
                    log.error(f"Failed to copy files to docker container {container_name} (ID: {container_id})")
                    continue

                n = sum(
                    os.path.getsize(os.path.join(dp, f))
                    for dp, _, fns in os.walk(path)
                    for f in fns
                )
                sz = f"{n} B" if n < 1024 else f"{n / 1024:.1f} KB" if n < 1024**2 else f"{n / 1024**2:.1f} MB"
                log.info(f"Copied {sz} to docker container {container_name} (ID: {container_id})")

            log.info("Nginx whitelist configs updated, reloading nginx")

            Nginx.nginx_run("-s", "reload")

            time.sleep(POLLING_INTERVAL)
