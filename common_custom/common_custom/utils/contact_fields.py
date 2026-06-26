import json
from pathlib import Path

from common_custom.utils.pydantic.contact_fields_models import (
    ContactFieldFlagsModel,
    ContactFieldsConfigResponseModel,
)

CONTACT_FIELD_NAMES: tuple[str, ...] = ("name", "email", "phone_number")


def default_field_flags() -> dict[str, bool]:
    return {"visible": True, "required": False}


def coerce_field_entry(value: object) -> dict[str, bool]:
    """Build ``visible`` / ``required`` from JSON or legacy bare boolean."""
    if isinstance(value, bool):
        return {"visible": True, "required": value}
    if isinstance(value, dict):
        vis = bool(value.get("visible", True))
        req = bool(value.get("required", False)) and vis
        return {"visible": vis, "required": req}
    return default_field_flags()


def ensure_contact_fields_file(path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    default = {
        field: {
            "visible": True,
            "required": field == "name",
        }
        for field in CONTACT_FIELD_NAMES
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(default, fh, indent=2)
        fh.write("\n")


def load_contact_fields_config(path: Path) -> dict[str, dict[str, bool]]:
    """Load ``contact-fields.json`` with per-field ``visible``/``required``."""
    out = {field: default_field_flags() for field in CONTACT_FIELD_NAMES}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return out
    if not isinstance(raw, dict):
        return out
    for field in CONTACT_FIELD_NAMES:
        if field in raw:
            out[field] = coerce_field_entry(raw.get(field))
    return out


def normalize_contact_fields_config(
    config: dict[str, dict[str, bool]],
) -> dict[str, dict[str, bool]]:
    normalized: dict[str, dict[str, bool]] = {}
    for field in CONTACT_FIELD_NAMES:
        entry = config.get(field) or default_field_flags()
        vis = bool(entry.get("visible", True))
        req = bool(entry.get("required", False)) and vis
        normalized[field] = {"visible": vis, "required": req}
    return normalized


def save_contact_fields_config(
    path: Path,
    config: dict[str, dict[str, bool]],
) -> dict[str, dict[str, bool]]:
    normalized = normalize_contact_fields_config(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {field: normalized[field] for field in CONTACT_FIELD_NAMES}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")
    return normalized


def contact_fields_to_response(
    config: dict[str, dict[str, bool]],
) -> ContactFieldsConfigResponseModel:
    return ContactFieldsConfigResponseModel(
        name=ContactFieldFlagsModel(**config["name"]),
        email=ContactFieldFlagsModel(**config["email"]),
        phone_number=ContactFieldFlagsModel(**config["phone_number"]),
    )


def response_to_contact_fields_dict(
    body: ContactFieldsConfigResponseModel,
) -> dict[str, dict[str, bool]]:
    return {
        "name": body.name.model_dump(),
        "email": body.email.model_dump(),
        "phone_number": body.phone_number.model_dump(),
    }
