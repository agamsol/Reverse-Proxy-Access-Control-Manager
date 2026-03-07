import os
import shutil
import subprocess
from dotenv import load_dotenv, set_key
from pydantic import IPvAnyAddress
from schemas.nginx_configuration import FALLBACK_WEBSITE_NGINX_CONFIG_TEMPLATE
from utilities.logger import create_logger

DOTENV_PATH = ".env"
DEFAULT_NGINX_PATH = "/etc/nginx"

load_dotenv(DOTENV_PATH)

SERVER_NAME = os.getenv("SERVER_NAME")

log = create_logger(logger_name="ProxyListener_util_nginx", alias="nginx")


class Nginx:

    @staticmethod
    def find_nginx(custom_path: str = DEFAULT_NGINX_PATH) -> str:

        path = custom_path
        nginx_conf = os.path.join(path, "nginx.conf")

        if not os.path.isfile(nginx_conf):
            raise FileNotFoundError(f"nginx.conf not found at {path}")

        if custom_path:
            set_key(DOTENV_PATH, "NGINX_PATH", custom_path)

        for subdir in ("sites-available", "sites-enabled", "allowed-ips"):

            full = os.path.join(path, subdir)

            if not os.path.isdir(full):
                os.makedirs(full, exist_ok=True)

        return path

    @staticmethod
    def nginx_run(*args: str) -> subprocess.CompletedProcess | None:
        """Run an nginx command, resolving the binary location automatically.

        Tries in order:
        1. Saved NGINX_BINARY from .env / environment
        2. Native nginx binary on PATH
        3. nginx inside a running Docker container

        Args:
            *args: Arguments to pass to nginx (e.g. ``"-t"`` or ``"-s", "reload"``).

        Raises:
            RuntimeError: If nginx cannot be found by any method.
        """

        saved = os.environ.get("NGINX_BINARY", "").strip()

        if saved:

            cmd = saved.split() + list(args)

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                log.debug(f"Executed via saved entry: {saved}")
                return result
            except (FileNotFoundError, subprocess.TimeoutExpired):
                log.warning(f"Saved entry '{saved}' is stale, re-discovering...")

        nginx_bin = shutil.which("nginx")

        if nginx_bin:
            prefix = nginx_bin
            log.info(f"Found native binary at: {nginx_bin}")

        else:

            container_name = Nginx._find_nginx_docker_container()

            if container_name:

                container_id = Nginx._get_docker_container_id(container_name)
                prefix = f"docker exec {container_name} nginx"
                log.info(f"Found Docker container: {container_name} (ID: {container_id})")

            else:
                raise RuntimeError(
                    "nginx not found: no saved NGINX_BINARY, no native binary on PATH, "
                    "and no running Docker container with the nginx image"
                )

        os.environ["NGINX_BINARY"] = prefix
        set_key(DOTENV_PATH, "NGINX_BINARY", prefix)

        cmd = prefix.split() + list(args)
        return subprocess.run(cmd, capture_output=True, text=True)

    @staticmethod
    def _find_nginx_docker_container() -> str | None:
        """Return the name of a running Docker container using the 'nginx' image, or None."""

        try:
            result = subprocess.run(
                ["docker", "ps", "--filter", "ancestor=nginx", "--format", "{{.Names}}"],
                capture_output=True, text=True, timeout=10,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None

        if result.returncode != 0 or not result.stdout.strip():
            return None

        return result.stdout.strip().splitlines()[0]

    @staticmethod
    def _get_docker_container_id(container_name: str) -> str | None:
        """Return the short ID of a Docker container by name."""

        try:
            result = subprocess.run(
                ["docker", "inspect", "--format", "{{.Id}}", container_name],
                capture_output=True, text=True, timeout=10,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None

        if result.returncode != 0 or not result.stdout.strip():
            return None

        return result.stdout.strip()[:12]

    @staticmethod
    def generate_nginx_config_for_request_access_server(
        nginx_path: str,
        server_name: str,
        backend_host: IPvAnyAddress,
        backend_port: str
    ):
        """_summary_

        Args:
            nginx_path (str): /etc/nginx/
            server_name (str): request-access.example.com
            backend_host (str): 127.0.0.1
            backend_port (str): 8000

        Raises:
            RuntimeError: _description_

        Returns:
            _type_: _description_
        """

        server_name_no_protocol = server_name.split("://")[1]

        available = os.path.join(nginx_path, "sites-available", server_name_no_protocol + ".conf")
        enabled = os.path.join(nginx_path, "sites-enabled", server_name_no_protocol + ".conf")

        final_configuration_file = FALLBACK_WEBSITE_NGINX_CONFIG_TEMPLATE.format(
            server_name=server_name_no_protocol,
            backend_host=backend_host,
            backend_port=backend_port
        )

        with open(available, "w") as f:
            f.write(final_configuration_file)

        if not os.path.islink(enabled):
            os.symlink(available, enabled)

        result = Nginx.nginx_run("-t")

        if result is None or result.returncode != 0:
            os.unlink(enabled)
            stderr = result.stderr if result else "no output"
            log.error(f"Nginx config test failed:\n{stderr}")
            return None

        log.info(f"Config written: {available}")
        return available

    @staticmethod
    def address_whitelist_config_generator(nginx_path: str, services: list[dict], connections: list[dict]) -> None:
        """Generate a Nginx configuration file for the address whitelist."""

        for service in services:

            filename = service['name'] + ".ips"
            filepath = os.path.join(nginx_path, "allowed-ips", filename)
            allowed_ips = []

            for connection in connections:

                if connection['service_name'] == service['name']:

                    content = "allow " + connection['ip_address'] + ";"

                    if content not in allowed_ips:
                        allowed_ips.append(content)

            allowed_ips.append("deny all;")

            if SERVER_NAME:

                content = "error_page 403 = " + SERVER_NAME + "/;"
                allowed_ips.append(content)

            with open(filepath, "w") as f:
                f.write("\n".join(allowed_ips))

            log.info(f"Address whitelist config generated at {filepath}")

        return
