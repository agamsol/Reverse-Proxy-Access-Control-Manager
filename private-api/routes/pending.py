import os
from dotenv import load_dotenv
from typing import Literal, Optional  # NOQA: F401
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from common_custom.controllers.mongodb import MongoDb
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.allowed_models import AllowedConnectionModel, DeniedSuccessResponseModel
from common_custom.controllers.pydantic.pending_models import PendingConnectionDatabaseModel, DenyConnectionRequestModel

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
    prefix="/pending",
    tags=["Pending Connections Management"],
    responses={404: {"description": "Not found"}}
)


@router.get(
    "/show",
    summary="Show all of the pending connections",
    status_code=status.HTTP_200_OK,
    response_model=list[PendingConnectionDatabaseModel]
)
async def get_pending_connections():

    pending_connections = await mongodb_helper.get_all_documents()

    return pending_connections


@router.post(
    "/accept/{id}",
    summary="Accept a pending connection",
    status_code=status.HTTP_200_OK,
    response_model=AllowedConnectionModel
)
async def accept_connection(id: MongoID):

    allowed_connection_payload = await mongodb_helper.accept_pending_connection(connection_id=id)

    return allowed_connection_payload


@router.delete(
    "/deny/{id}",
    summary="Deny or Ignore a pending connection",
    status_code=status.HTTP_200_OK,
    response_model=DeniedSuccessResponseModel
)
async def deny_connection(
    id: MongoID,
    payload: DenyConnectionRequestModel
):

    deny_mongo_payload = await mongodb_helper.deny_pending_connection(
        connection_id=id,
        ignore_connection=payload.ignore_connection
    )

    response_complete = DeniedSuccessResponseModel(
        message="You denied this connection",
        service_name=deny_mongo_payload.service_name,
        ignore=deny_mongo_payload.ignore
    )

    return response_complete
