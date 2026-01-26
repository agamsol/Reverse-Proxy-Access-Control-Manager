import os
from dotenv import load_dotenv
from fastapi import APIRouter, status
from common_custom.utils.webhook_events import Events
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
    "/get-pending-connections",
    summary="Show all of the pending connection requests",
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
    
    # Trigger event: pending.accepted
    await Events.pending_accepted(allowed_connection_payload)

    return allowed_connection_payload


@router.delete(
    "/deny/{id}",
    summary="Deny (optionally ignore) a pending connection (block specific IP Address from sending connection request)",
    status_code=status.HTTP_200_OK,
    response_model=DeniedSuccessResponseModel
)
async def deny_connection(
    id: MongoID,
    payload: DenyConnectionRequestModel
):

    pending_connection = await mongodb_helper.get_document(document_id=id)

    denied_connection = await mongodb_helper.deny_pending_connection(
        connection_id=id,
        ignore_connection=payload.ignore_connection
    )

    # Trigger event: pending.denied
    await Events.pending_denied(pending_connection)

    if payload.ignore_connection:

        await mongodb_helper.ignore_connection(denied_connection)

    response_complete = DeniedSuccessResponseModel(
        message="You denied this connection",
        ip_address=denied_connection.ip_address,
        service_name=denied_connection.service_name,
        ignore=payload.ignore_connection
    )

    return response_complete
