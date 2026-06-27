import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from common_custom.utils.webhook_events import Events
from fastapi import APIRouter, status
from common_custom.controllers.database import Database
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.allowed_models import (
    AdminCreateAllowedConnectionRequestModel,
    AdminUpdateAllowedConnectionRequestModel,
    AllowedConnectionModel,
    DeniedConnectionModel,
)

DATA_DIR = (Path(__file__).resolve().parents[2] / "data").resolve()

load_dotenv(DATA_DIR / ".env")


mongodb_helper = Database(
    db_path=os.getenv("SQLITE_DB_PATH") or str(DATA_DIR / "app.db")
)

mongodb_helper.connect()

services = mongodb_helper.services_collection_name
allowed_connections = mongodb_helper.allowed_collection_name
ignored_connections = mongodb_helper.ignored_collection_name

router = APIRouter(
    prefix="/connection",
    tags=["Connections Management"],
    responses={404: {"description": "Not found"}}
)


@router.get(
    "/get-connection-list",
    summary="Show a list of all of the allowed IP addresses",
    status_code=status.HTTP_200_OK,
    response_model=list[AllowedConnectionModel]
)
async def get_all_connections():

    connections = await mongodb_helper.get_all_documents(table_name=allowed_connections)
    all_services = await mongodb_helper.get_all_documents(table_name=services)

    valid_service_names = {service["name"] for service in all_services}
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    filtered = [
        conn for conn in connections
        if conn.get("service_name") in valid_service_names
        and (conn.get("ExpireAt") is None or conn["ExpireAt"] > now)
    ]

    return filtered


@router.post(
    "/create-allowed",
    summary="Create an allowed connection without a pending request (admin grant)",
    status_code=status.HTTP_201_CREATED,
    response_model=AllowedConnectionModel,
)
async def create_allowed_connection(body: AdminCreateAllowedConnectionRequestModel):

    contact = body.to_contact_methods()
    return await mongodb_helper.create_allowed_connection_admin(
        ip_address=body.ip_address,
        service_name=body.service_name,
        contact_methods=contact,
        expiry_minutes=body.expiry_minutes if body.expire_at is None else None,
        expire_at=body.expire_at,
    )


@router.patch(
    "/edit/{id}",
    summary="Update contact details and expiry on an allowed connection",
    status_code=status.HTTP_200_OK,
    response_model=AllowedConnectionModel,
)
async def update_allowed_connection(id: MongoID, body: AdminUpdateAllowedConnectionRequestModel):

    contact = body.to_contact_methods()
    return await mongodb_helper.update_allowed_connection(
        connection_id=id,
        contact_methods=contact,
        expiry_minutes=body.expiry_minutes if body.expire_at is None else None,
        expire_at=body.expire_at,
    )


@router.delete(
    "/revoke/{id}",
    summary="Revoke access for a specific IP Address",
    status_code=status.HTTP_200_OK,
    response_model=AllowedConnectionModel
)
async def revoke_connection(id: MongoID):

    document_payload = await mongodb_helper.get_document(document_id=id, table_name=allowed_connections)

    await mongodb_helper.revoke_connection(connection_id=id)

    await Events.connection_revoked(document_payload)

    return document_payload


@router.get(
    "/ignored/get-ignored-list",
    summary="Show a list of all of the ignored IP Addresses",
    status_code=status.HTTP_200_OK,
    response_model=list[DeniedConnectionModel]
)
async def show_all_ignored_connections():

    all_ignored_connections = await mongodb_helper.get_all_documents(table_name=ignored_connections)

    return all_ignored_connections


@router.post(
    "/ignored/remove/{id}",
    summary="Remove an IP address that has peviously been ignored",
    status_code=status.HTTP_200_OK,
    response_model=DeniedConnectionModel
)
async def unignore_connection(id: MongoID):

    ignored_document = await mongodb_helper.get_document(document_id=id, table_name=ignored_connections)

    await mongodb_helper.unignore_connection(connection_id=id)

    return ignored_document
