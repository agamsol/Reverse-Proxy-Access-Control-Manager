import os
import jwt
import time
import uvicorn
from pymongo import MongoClient
from dotenv import load_dotenv
from utils.core_functions import validate_and_convert_objectid
from fastapi import FastAPI, status, HTTPException, Request, Depends, Form  # NOQA: F401
from typing import Optional, Annotated  # NOQA: F401
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


load_dotenv(".env")
load_dotenv("administrator.env")

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
users_collection = monogo_database["users"]
services_collection = monogo_database["services"]
pending_connections_collection = monogo_database["pending_connections"]
allowed_connections_collection = monogo_database["allowed_connections"]
ignored_connections_collection = monogo_database["ignored_connections"]

app = FastAPI(
    title="Reverse-Proxy-Access-Control-Manager",
)
oauth2_token_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
MongoID = Annotated[str, AfterValidator(validate_and_convert_objectid)]


class StatusResponseModel(BaseModel):
    version: str = Field("1.0", max_length=10)
    filesystem: str = Field(..., max_length=10)
    maintenance: bool


class LoginRequestModel(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=20, description="Administrator user username")
    password: str | None = Field(None, max_length=199, description="Administrator user password")
    remember_me: bool = Field(False, description="Whether to remember the login for 60 days or 24 hours day")


class LoginResponseModel(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayloadModel(BaseModel):
    username: str = Field(None, min_length=3, max_length=20, description="Administrator user username")
    exp: int = Field(..., ge=1_000_000_000, le=9_999_999_999, description="Expiration time as UNIX timestamp")


class AuthenticatedUserResponseModel(BaseModel):
    payload: TokenPayloadModel
    message: str = Field(..., max_length=50)


def get_login_form(
    username: str = Form(..., min_length=3, max_length=20, description="Administrator user username"),
    password: str = Form(..., max_length=199, description="Administrator user password"),
    remember_me: bool = Form(False, description="Whether to remember the login for 60 days or 24 hours day"),
) -> LoginRequestModel:

    return LoginRequestModel(
        username=username,
        password=password,
        remember_me=remember_me
    )


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


@app.post(
    "/auth/token",
    tags=['Authentication'],
    summary="Login to obtain token",
    response_model=LoginResponseModel
)
async def login(
    data: Annotated[LoginRequestModel, Depends(get_login_form)]
):

    if data.username != os.getenv("ADMIN_USERNAME") or data.password != os.getenv("ADMIN_PASSWORD"):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 86400 seconds = 24 hours
    # 5184000 seconds = 60 days
    remember_me_timestamp = 86400 if data.remember_me is False else 5184000

    access_token = jwt.encode(
        payload={
            "username": data.username,
            "exp": int(time.time()) + remember_me_timestamp
        },
        key=os.getenv("JWT_SECRET_KEY"),
        algorithm=os.getenv("JWT_ALGORITHM")
    )

    login_response = LoginResponseModel(
        access_token=access_token
    )

    return login_response


@app.get(
    "/auth/me",
    tags=['Authentication'],
    summary="Get current authorized user",
    response_model=AuthenticatedUserResponseModel
)
async def read_users_me(token: Annotated[str, Depends(oauth2_token_scheme)]):

    decoded_token = jwt.decode_complete(token, algorithms=[os.getenv("JWT_ALGORITHM")], key=os.getenv("JWT_SECRET_KEY"))

    payload: dict = decoded_token.get("payload")

    pydantic_token_payload = TokenPayloadModel(
        username=payload.get("username"),
        exp=payload.get("exp")
    )

    return {"payload": pydantic_token_payload, "message": "You are authorized!"}

# Tags for API documentation
# ✅ Health
# ✅ Authentication
# - Login for jwt
# Services Management
# - Add
# - Remove
# - Edit
# - List
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
