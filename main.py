import os
import time
from pymongo import MongoClient
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, status, HTTPException, Request, Query, Path
from typing import Optional, Annotated
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator

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

# # Collections to be used (add, remove, get, list)
# users
# services
# pending_connections
# allowed_connections
# denied_connections

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Manager",
)

PyObjectId = Annotated[str, BeforeValidator(str)]

class ServiceItem(BaseModel):
    name: str = Field(..., description="Name of the service to request access to")
    expiry: int = Field(..., description="Duration in hours for which access is requested")

class AccessRequest(BaseModel):
    services: list[ServiceItem] | None = Field(None, description="List of all of the service that will be requested")
    note: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)

class PendingConnectionDatabaseModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    ip_address: IPvAnyAddress
    service: ServiceItem | None = None
    notes: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    expire: int | None = None

class ServiceModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    description: str | None = None
    internal_address: str
    port: int
    protocol: str


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


@app.get("/status", tags=['Health'], summary="Get service status")
async def service_status():

    return {
        "version": "1.0",
        "filesystem": os.name,
        "maintenance": SERVICE_UNDER_MAINTENANCE
    }


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
                    expire=1
                )

                pending_connections_collection.insert_one(database_object.model_dump(by_alias=True))

    return {
        "ip_address": remote_address,
        "services_requested": services_allowed_to_request,
        "message": "Your request has been received and is pending approval."
    }


@app.get("/services", tags=['Regular'], summary="Get a list of all available services")
async def list_services():
    return {"services": ["service1", "service2", "service3"]}
