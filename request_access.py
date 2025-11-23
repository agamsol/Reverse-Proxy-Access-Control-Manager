import os
import time
from pymongo import MongoClient
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, status, HTTPException, Request, Query, Path
from typing import Optional, Annotated
from pydantic import BaseModel, Field

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

# # Collections to be used (add, remove, get, list)
# users
# services
# pending_connections
# allowed_connections
# denied_connections

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Manager",
)


class AccessRequest(BaseModel):
    service_name: str | None = Field(None, description="Name of the service to access")
    reason: str | None = Field(None, description="Reason for access request")
    lat: float | None = None
    lon: float | None = None
    expiry_timestamp: Optional[int] = None


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


@app.post("/", tags=['Regular User'], summary="Request access to a service")
async def request_access_landing():
    return {"message": "pong"}

@app.get("/services", tags=['Regular User'], summary="Return all available services")
async def list_services():
    return {"services": ["service1", "service2", "service3"]}
