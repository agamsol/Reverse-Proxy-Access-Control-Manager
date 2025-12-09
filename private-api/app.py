import os
import time
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from typing import Optional, Annotated, Literal  # NOQA: F401
from fastapi.security import OAuth2PasswordBearer  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from routes import service, auth, pending, connection
from models.auth_models import oauth2_token_scheme

load_dotenv(".env")
load_dotenv("private-api\\administrator.env")

SERVICE_VERSION = os.getenv("SERVICE_VERSION")
SERVICE_UNDER_MAINTENANCE = os.getenv("SERVICE_UNDER_MAINTENANCE") == 'True'


app = FastAPI(
    title="Reverse-Proxy-Access-Control-Manager",
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])


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

    return status_reponse.model_dump(mode="json")

app.include_router(
    router=auth.router
)

app.include_router(
    router=service.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

app.include_router(
    router=pending.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

app.include_router(
    router=connection.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

# Tags for API documentation
# ✅ Health
# ✅ Authentication
# - Login for jwt
# Services Management
# - ✅ Add
# - ✅ Remove
# - ✅ Edit
# - ✅ List
# Pending Connections Management
# - Allow
# - Deny (only remove request)
# - Ignore (And Deny)
# - List
# Access Management (Currently Allowed)
# - Revoke Access
# - List
# Notifications Webhook Route
# - Add Request

# Users Management

if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0", port=8001)
