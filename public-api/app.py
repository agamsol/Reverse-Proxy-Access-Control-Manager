import os
import time
import uvicorn
from dotenv import load_dotenv
from common_custom.utils.webhook_events import Events
from fastapi import FastAPI, status, HTTPException, Request
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from common_custom.controllers.mongodb import MongoDb
from common_custom.utils.pydantic.webhook_models import HTTPRequest, WebhookValidator
from common_custom.controllers.pydantic.service_models import ServiceItem
from common_custom.utils.pydantic.health_models import StatusResponseModel
from common_custom.controllers.pydantic.service_models import ServiceResponseModel
from common_custom.controllers.pydantic.pending_models import ContactMethodsRequestModel, ContactMethodsModel


load_dotenv(".env")

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

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Guests",
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])


class AccessRequest(BaseModel):
    services: list[ServiceItem] | None = Field(None, description="List of all of the service that will be requested")
    contact_methods: ContactMethodsRequestModel
    note: str | None = Field(None, max_length=200, examples=[None], description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90, examples=[None], description="Latitude of the requester")
    lon: float | None = Field(None, ge=-180, le=180, examples=[None], description="Longitude of the requester")


class RequestAccessResponseModel(BaseModel):
    ip_address: IPvAnyAddress
    services_requested: list[ServiceItem]
    message: str = Field(..., max_length=200)


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
                    request_latitude=access_request.lat,
                    request_longitude=access_request.lon
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


if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0", port=8000)
