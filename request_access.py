import os
import time
import uvicorn
from pymongo import MongoClient
from dotenv import load_dotenv
from utils.core_functions import validate_and_convert_objectid
from fastapi import FastAPI, status, HTTPException, Request  # NOQA: F401
from typing import Optional, Annotated
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

load_dotenv()

SERVICE_VERSION = os.getenv("SERVICE_VERSION")
SERVICE_UNDER_MAINTENANCE = os.getenv("SERVICE_UNDER_MAINTENANCE") == 'True'

mongo_client = MongoClient(
    host=os.getenv("MONGODB_HOST"),
    port=int(os.getenv("MONGODB_PORT")),
    username=os.getenv("MONGODB_USERNAME"),
    password=os.getenv("MONGODB_PASSWORD"),
    ServerSelectionTimeoutMS=10000
)

monogo_database = mongo_client["Reverse-Proxy-Access-Control"]
pending_connections_collection = monogo_database["pending_connections"]
services_collection = monogo_database["services"]

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Guests",
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
MongoID = Annotated[str, AfterValidator(validate_and_convert_objectid)]


class ServiceItem(BaseModel):
    name: str = Field(..., description="Name of the service to request access to")
    expiry: int = Field(..., description="Amount of time (in seconds) the access is requested for")


class AccessRequest(BaseModel):
    services: list[ServiceItem] | None = Field(None, description="List of all of the service that will be requested")
    note: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90, description="Latitude of the requester")
    lon: float | None = Field(None, ge=-180, le=180, description="Longitude of the requester")


class PendingConnectionDatabaseModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    ip_address: IPvAnyAddress
    service: ServiceItem | None = None
    notes: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)


class RequestAccessResponseModel(BaseModel):
    ip_address: IPvAnyAddress
    services_requested: list[ServiceItem]
    message: str = Field(..., max_length=200)


class ServiceResponseModel(BaseModel):
    name: str
    description: str | None = None
    internal_address: IPvAnyAddress
    port: int
    protocol: str


class ServiceModel(ServiceResponseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)


class StatusResponseModel(BaseModel):
    version: str = Field("1.0", max_length=10)
    filesystem: str = Field(..., max_length=10)
    maintenance: bool


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

                database_object = PendingConnectionDatabaseModel(
                    ip_address=remote_address,
                    service=service,
                    notes=access_request.note,
                    lat=access_request.lat,
                    lon=access_request.lon,
                )

                save_document = database_object.model_dump(mode="json", exclude={"id"})
                pending_connections_collection.insert_one(save_document)

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

    cursor = services_collection.find()
    available_services = cursor.to_list(length=None)

    return available_services


if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0", port=8000)
