import os
from dotenv import load_dotenv, set_key
from colorama import Fore, Style
from utilities.nginx import Nginx
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
    backend_host = prompt_or_env(
        "BACKEND_HOST", "Backend Host",
        "IP or hostname where the access request landing page is running",
        "e.g. 127.0.0.1",
    )
    backend_port = prompt_or_env(
        "BACKEND_PORT", "Backend Port",
        "port the access request landing page is listening on",
        "e.g. 8000",
    )

    log.info(f"Configured: server_name={server_name}, backend={backend_host}:{backend_port}")

    Nginx.generate_nginx_config_for_request_access_server(
        nginx_path=nginx_path,
        server_name=server_name,
        backend_host=backend_host,
        backend_port=backend_port,
    )


if __name__ == "__main__":
    main()
