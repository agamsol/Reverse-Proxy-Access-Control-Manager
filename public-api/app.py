import os
import json
import time
import uvicorn
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, IPvAnyAddress, Field
from common_custom.controllers.mongodb import MongoDb
from common_custom.utils.webhook_events import Events
from fastapi import FastAPI, status, HTTPException, Request
from fastapi.responses import FileResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from common_custom.controllers.pydantic.service_models import ServiceItem
from common_custom.utils.pydantic.health_models import StatusResponseModel
from common_custom.controllers.pydantic.service_models import ServiceResponseModel
from common_custom.controllers.pydantic.pending_models import ContactMethodsRequestModel, ContactMethodsModel, LocationRequestModel


DATA_DIR = (Path(__file__).resolve().parent.parent / "data").resolve()
CONTACT_FIELDS_PATH = DATA_DIR / "contact-fields.json"

load_dotenv(DATA_DIR / ".env")


CONTACT_FIELDS: tuple[str, ...] = ("name", "email", "phone_number")


def _ensure_contact_fields_file() -> None:
    if CONTACT_FIELDS_PATH.exists():
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    default = {
        field: {
            "visible": True,
            "required": field == "name",
        }
        for field in CONTACT_FIELDS
    }

    with open(CONTACT_FIELDS_PATH, "w", encoding="utf-8") as fh:
        json.dump(default, fh, indent=2)
        fh.write("\n")


def _default_field_flags() -> dict[str, bool]:
    return {"visible": True, "required": False}


def _coerce_field_entry(value: object) -> dict[str, bool]:
    """Build ``visible`` / ``required`` from JSON.

    New format: ``{ "name": { "visible": true, "required": false } }`` — if
    ``visible`` is false the field is omitted from the form; when visible, an
    asterisk is shown and enforced only when ``required`` is true.

    Legacy: a bare boolean is treated as ``{ "visible": true, "required": <bool> }``.
    """
    if isinstance(value, bool):
        return {"visible": True, "required": value}
    if isinstance(value, dict):
        vis = bool(value.get("visible", True))
        req = bool(value.get("required", False)) and vis
        return {"visible": vis, "required": req}
    return _default_field_flags()


def _load_contact_fields_config() -> dict[str, dict[str, bool]]:
    """Load ``data/contact-fields.json`` with per-field ``visible``/``required``."""
    out = {field: _default_field_flags() for field in CONTACT_FIELDS}
    try:
        with open(CONTACT_FIELDS_PATH, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return out
    if not isinstance(raw, dict):
        return out
    for field in CONTACT_FIELDS:
        if field in raw:
            out[field] = _coerce_field_entry(raw.get(field))
    return out


_ensure_contact_fields_file()
contact_fields_config: dict[str, dict[str, bool]] = _load_contact_fields_config()

SERVICE_VERSION = os.getenv("SERVICE_VERSION")
SERVICE_UNDER_MAINTENANCE = os.getenv("SERVICE_UNDER_MAINTENANCE") == 'True'

mongodb_helper = MongoDb(
    database_name=os.getenv("MONGODB_DATABASE")
)

mongodb = mongodb_helper.connect(
    host=os.getenv("MONGODB_HOST"),
    port=int(os.getenv("MONGODB_PORT")),
    username=os.getenv("MONGODB_USERNAME"),
    password=os.getenv("MONGODB_PASSWORD")
)

services_collection = mongodb_helper.database["services"]

STATIC_ROOT = (Path(__file__).resolve().parent / "frontend" / "dist").resolve()

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Guests",
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])


class AccessRequest(BaseModel):
    services: list[ServiceItem] | None = Field(None, description="List of all of the service that will be requested")
    contact_methods: ContactMethodsRequestModel
    note: str | None = Field(None, max_length=200, examples=[None], description="Note for the access request")
    location: LocationRequestModel


class RequestAccessResponseModel(BaseModel):
    ip_address: IPvAnyAddress
    services_requested: list[ServiceItem]
    message: str = Field(..., max_length=200)


class ContactFieldFlagsModel(BaseModel):
    visible: bool = Field(..., description="Whether the field is shown on the access form")
    required: bool = Field(
        ...,
        description="When visible, whether the value is mandatory (asterisk in the UI)"
    )


class ContactFieldsConfigResponseModel(BaseModel):
    name: ContactFieldFlagsModel
    email: ContactFieldFlagsModel
    phone_number: ContactFieldFlagsModel


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):

    start_time = time.perf_counter()
    response = await call_next(request)

    process_time = time.perf_counter() - start_time

    response.headers["X-Process-Time"] = f"{process_time:.4f}"

    return response


@app.get(
    "/status",
    tags=['Health'],
    summary="Get service status",
    response_model=StatusResponseModel
)
async def service_status():

    status_reponse = StatusResponseModel(
        version=SERVICE_VERSION,
        filesystem=os.name,
        maintenance=SERVICE_UNDER_MAINTENANCE
    )

    return status_reponse


@app.post(
    "/request-access",
    tags=['Regular'],
    summary="Request access to a service",
    response_model=RequestAccessResponseModel,
    status_code=status.HTTP_201_CREATED
)
async def request_access_landing(access_request: AccessRequest, request: Request):

    # Enforce the dynamic contact-field requirements defined in
    # `data/contact-fields.json`. A value is considered "provided" when it is
    # a non-empty string once stripped of surrounding whitespace.
    missing_required: list[str] = []
    for field_name, flags in contact_fields_config.items():
        if not flags.get("visible") or not flags.get("required"):
            continue
        value = getattr(access_request.contact_methods, field_name, None)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            missing_required.append(field_name)

    if missing_required:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Required contact fields are missing.",
                "missing_fields": missing_required,
            },
        )

    services_allowed_to_request = []
    remote_address = request.client.host
    user_requested_services = access_request.services

    if user_requested_services is not None:

        for service in user_requested_services:

            if service.name in services_collection.distinct("name"):

                # Search for existing requests from this IP for this service

                # I only need to do this when the request is accepted
                # existing_request = pending_connections_collection.find_one(
                #     {"ip_address": remote_address, "service": service.name}
                # )

                services_allowed_to_request.append(service)

                contact_methods_db = ContactMethodsModel(
                    name=access_request.contact_methods.name,
                    email={} if not access_request.contact_methods.email else {access_request.contact_methods.email: False},
                    phone_number={} if not access_request.contact_methods.phone_number else {access_request.contact_methods.phone_number: False}
                )

                await mongodb_helper.create_pending_connection(
                    contact_methods=contact_methods_db,
                    remote_address=remote_address,
                    service=service.model_dump(),
                    additional_notes=access_request.note,
                    request_latitude=access_request.location.lat,
                    request_longitude=access_request.location.lon
                )

                # Trigger event: pending.new
                await Events.pending_new(access_request, remote_address, service)

    if len(services_allowed_to_request) == 0:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid services were requested."
        )

    return {
        "ip_address": remote_address,
        "services_requested": services_allowed_to_request,
        "message": "Your request has been received and is pending approval."
    }


@app.get(
    "/services",
    tags=['Services'],
    summary="Get a list of all available services",
    status_code=status.HTTP_200_OK,
    response_model=list[ServiceResponseModel]
)
async def list_services():

    available_services = await mongodb_helper.list_all_services()

    return available_services


@app.get(
    "/config/contact-fields",
    tags=['Config'],
    summary="Get which contact fields are required vs. optional",
    status_code=status.HTTP_200_OK,
    response_model=ContactFieldsConfigResponseModel,
)
async def get_contact_fields_config():
    c = contact_fields_config
    return ContactFieldsConfigResponseModel(
        name=ContactFieldFlagsModel(**c["name"]),
        email=ContactFieldFlagsModel(**c["email"]),
        phone_number=ContactFieldFlagsModel(**c["phone_number"]),
    )


def _frontend_file_response(path_within: str) -> FileResponse:
    if not STATIC_ROOT.is_dir():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Frontend not built. Run: cd public-api/frontend && npm install && npm run build",
        )
    if path_within:
        candidate = (STATIC_ROOT / path_within).resolve()
        try:
            candidate.relative_to(STATIC_ROOT)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if candidate.is_file():
            return FileResponse(candidate)
    index = STATIC_ROOT / "index.html"
    if not index.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Frontend build is incomplete (missing index.html).",
        )
    return FileResponse(index)


@app.get("/", include_in_schema=False)
async def guest_portal_index(redirect: str | None = None):
    # `redirect` is the absolute URL of the protected resource that the
    # reverse proxy intercepted. The SPA reads it from window.location and
    # uses it for the "Check access" / "Continue" flow after approval.
    _ = redirect
    return _frontend_file_response("")


@app.get("/{full_path:path}", include_in_schema=False)
async def guest_portal_static(full_path: str, redirect: str | None = None):
    # See `guest_portal_index` for details on the `redirect` query parameter.
    _ = redirect
    return _frontend_file_response(full_path)


if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0", port=8000)
