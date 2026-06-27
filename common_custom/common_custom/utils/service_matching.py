from urllib.parse import urlparse


def normalize_public_hostname(value: object) -> str:
    """Normalize a catalog service name / public hostname for comparison."""
    if value is None:
        return ""
    s = str(value).strip().lower()
    for prefix in ("http://", "https://"):
        if s.startswith(prefix):
            s = s[len(prefix):]
    if "/" in s:
        s = s.split("/", 1)[0]
    if ":" in s and not s.startswith("["):
        # Strip a trailing :port on hostnames; leave IPv6 literals alone.
        host_part, maybe_port = s.rsplit(":", 1)
        if maybe_port.isdigit():
            s = host_part
    return s


def public_hostname_from_redirect(redirect: str) -> str | None:
    host = urlparse(redirect.strip()).hostname
    if not host:
        return None
    return host.lower()


def find_service_for_redirect(services: list[dict], redirect: str) -> dict | None:
    """Match a redirect URL to a catalog row by public hostname (`name` only).

    `internal_address` is the upstream backend target and must not be used here;
    many services can share the same backend IP or hostname.
    """
    redirect_host = public_hostname_from_redirect(redirect)
    if not redirect_host:
        return None
    for svc in services:
        if normalize_public_hostname(svc.get("name")) == redirect_host:
            return svc
    return None
