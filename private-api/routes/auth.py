import os
import jwt
import time
from dotenv import load_dotenv
from typing import Annotated
from fastapi import APIRouter, status, HTTPException, Depends
from common_custom.controllers.mongodb import MongoDb
from models.auth_models import LoginRequestModel, LoginResponseModel, TokenPayloadModel, AuthenticatedUserResponseModel, get_login_form, oauth2_token_scheme

load_dotenv(".env")

mongodb_helper = MongoDb(
    database_name=os.getenv("MONGODB_DATABASE")
)

mongodb = mongodb_helper.connect(
    host=os.getenv("MONGODB_HOST"),
    port=int(os.getenv("MONGODB_PORT")),
    username=os.getenv("MONGODB_USERNAME"),
    password=os.getenv("MONGODB_PASSWORD")
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    responses={404: {"description": "Not found"}}
)


@router.post(
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


@router.get(
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
