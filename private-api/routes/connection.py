import os
from dotenv import load_dotenv
from typing import Literal, Optional  # NOQA: F401
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from common_custom.controllers.mongodb import MongoDb
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.allowed_models import AllowedConnectionModel, DeniedConnectionModel
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

allowed_connections = mongodb_helper.database[mongodb_helper.allowed_collection_name]
ignored_connections = mongodb_helper.database[mongodb_helper.ignored_collection_name]

router = APIRouter(
    prefix="/connection",
    tags=["Connections Management"],
    responses={404: {"description": "Not found"}}
)


@router.get(
    "/show",
    summary="Show a list of all of the allowed IP addresses",
    status_code=status.HTTP_200_OK,
    response_model=list[AllowedConnectionModel]
)
async def get_all_connections():

    connections = await mongodb_helper.get_all_documents(collection=allowed_connections)

    return connections


@router.delete(
    "/revoke/{id}",
    summary="Revoke access for a specific IP Address",
    status_code=status.HTTP_200_OK,
    response_model=AllowedConnectionModel
)
async def revoke_connection(id: MongoID):

    document_payload = await mongodb_helper.get_document(document_id=id, collection=allowed_connections)

    await mongodb_helper.revoke_connection(connection_id=id)

    return document_payload


@router.get(
    "/ignored/show",
    summary="Show a list of all of the ignored IP Addresses",
    status_code=status.HTTP_200_OK,
    response_model=list[DeniedConnectionModel]
)
async def show_all_ignored_connections():

    all_ignored_connections = await mongodb_helper.get_all_documents(collection=ignored_connections)

    return all_ignored_connections


@router.delete(
    "/ignored/remove/{id}",
    summary="Remove an IP address that has peviously been ignored",
    status_code=status.HTTP_200_OK,
    response_model=DeniedConnectionModel
)
async def unignore_connection(id: MongoID):

    ignored_document = await mongodb_helper.get_document(document_id=id, collection=ignored_connections)

    await mongodb_helper.unignore_connection(connection_id=id)

    return ignored_document
