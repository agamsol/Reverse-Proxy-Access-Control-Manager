import os
from dotenv import load_dotenv, set_key
from colorama import Fore, Style
from utilities.nginx import Nginx
from utilities.backend import Backend
from utilities.logger import create_logger

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

load_dotenv(ENV_PATH)

log = create_logger(alias="main")

PROMPT_ICON = f"{Fore.CYAN}>{Style.RESET_ALL} "


def prompt_or_env(env_key: str, label: str, description: str, example: str, force_prompt: bool = False) -> str:
    """Return the env value if set, otherwise prompt the user and persist it."""
    if not force_prompt:
        value = os.getenv(env_key, "").strip()
        if value:
            return value

    hint = f"{Fore.LIGHTBLACK_EX}{example}{Style.RESET_ALL}"
    value = input(
        f"\n  {Fore.YELLOW}{label}{Style.RESET_ALL} — {description}\n"
        f"  {hint}\n"
        f"  {PROMPT_ICON}"
    ).strip()

    if env_key == "SERVER_NAME":
        value = value + ".conf"

    set_key(ENV_PATH, env_key, value)
    return value


def main():
    log.info("Proxy listener starting")

    nginx_path = prompt_or_env(
        "NGINX_PATH", "Nginx Path",
        "path to the nginx configuration directory",
        "e.g. /etc/nginx"
    )

    while True:

        try:

            nginx_path = Nginx.find_nginx(nginx_path)
            break

        except FileNotFoundError:

            log.warning(f"Nginx not found at {nginx_path}")
            nginx_path = prompt_or_env(
                "NGINX_PATH", "Nginx Path",
                "path to the nginx configuration directory",
                "e.g. /etc/nginx",
                force_prompt=True
            )

        continue

    log.info(f"Nginx config directory: {nginx_path}")

    log.info("Starting Access Control Server configuration")

    server_name = prompt_or_env(
        "SERVER_NAME", "Server Name",
        "the domain that will serve the access request page",
        "e.g. request-access.example.com",
    )
    public_api_host = prompt_or_env(
        "PUBLIC_API_HOST", "Public API Host",
        "IP or hostname where the access request landing page is running",
        "e.g. 127.0.0.1",
    )
    public_api_port = prompt_or_env(
        "PUBLIC_API_PORT", "Public API Port",
        "port the access request landing page is listening on",
        "e.g. 8000",
    )

    log.info(f"Configured: server_name={server_name}, backend={public_api_host}:{public_api_port}")

    Nginx.generate_nginx_config_for_request_access_server(
        nginx_path=nginx_path,
        server_name=server_name,
        backend_host=public_api_host,
        backend_port=public_api_port,
    )

    force_prompt_private_api_machine = False

    while True:

        private_api_host = prompt_or_env(
            "PRIVATE_API_HOST", "Private API Host",
            "IP or hostname where the private API is running",
            "e.g. 127.0.0.1",
            force_prompt=force_prompt_private_api_machine
        )
        private_api_port = prompt_or_env(
            "PRIVATE_API_PORT", "Private API Port",
            "port the private API is listening on",
            "e.g. 8001",
            force_prompt=force_prompt_private_api_machine
        )

        try:

            backend = Backend(host=private_api_host, port=private_api_port)
            break

        except ConnectionError as e:

            log.error(f"Private API is unreachable: {e}")
            force_prompt_private_api_machine = True
            continue

    force_prompt_username = False

    while True:

        private_api_username = prompt_or_env(
            "PRIVATE_API_USERNAME", "Private API Username",
            "username to authenticate with the private API",
            "e.g. admin",
            force_prompt=force_prompt_username
        )
        private_api_password = prompt_or_env(
            "PRIVATE_API_PASSWORD", "Private API Password",
            "password to authenticate with the private API",
            "e.g. admin",
            force_prompt=force_prompt_username
        )

        try:

            backend.authenticate(
                username=private_api_username,
                password=private_api_password,
            )

            break

        except ConnectionError as e:

            log.error(f"Failed to authenticate with the private API: {e}")
            force_prompt_username = True

        continue

    try:

        all_services = backend.get_service_list()

    except Exception as e:

        log.error(f"Failed to fetch services at startup: {e}")
        return

    log.info(f"Loaded {len(all_services)} services")

    try:

        all_connections = backend.get_connection_list(all_services=all_services)

    except Exception as e:

        log.error(f"Failed to fetch connections at startup: {e}")
        return

    log.info(f"All connections: {all_connections}")

    # Essambling the connections config generator by all connections (And auto reload on changes)


if __name__ == "__main__":
    main()
