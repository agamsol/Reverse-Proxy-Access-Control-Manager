import os
from dotenv import load_dotenv
from typing import Literal, Optional  # NOQA: F401
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from common_custom.controllers.mongodb import MongoDb
from common_custom.utils.pydantic.webhook_models import (
    HTTPRequest,
    CreateWebhookResponseModel,
    DeleteWebhookRequestModel,
    DeleteWebhookResponseModel,
    ModifyWebhookRequestModel,
    ModifyWebhookResponseModel
)

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

webhooks_collection = mongodb_helper.database[mongodb_helper.webhooks_collection_name]

router = APIRouter(
    prefix="/webhook",
    tags=["Webhook Management"],
    responses={404: {"description": "Not found"}}
)


@router.get(
    "/get-webhook-list",
    summary="Show all of the notification events & how they are handled",
    status_code=status.HTTP_200_OK,
    response_model=list[HTTPRequest]
)
async def get_all_webhooks():

    webhook_documents = await mongodb_helper.get_all_documents(collection=webhooks_collection)

    return webhook_documents


@router.post(
    "/add-webhook",
    summary="Create a webhook that will be sent on a specific event",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateWebhookResponseModel
)
async def create_webhook(request_payload: HTTPRequest):

    event_document = await mongodb_helper.get_webhook(event=request_payload.event)

    if event_document:
        raise HTTPException(
            detail="This event already has a request setup, it cannot be created again.",
            status_code=status.HTTP_409_CONFLICT
        )

    await mongodb_helper.create_webhook_request(request_payload)

    return CreateWebhookResponseModel(
        **request_payload.model_dump(),
        message="The webhook has been successfully created!"
    )

@router.delete(
    "/remove-webhook",
    summary="Remove a webhook for a specific event",
    status_code=status.HTTP_200_OK,
    response_model=DeleteWebhookResponseModel
)
async def remove_webhook(request_payload: DeleteWebhookRequestModel):

    event_document = await mongodb_helper.get_webhook(event=request_payload.event)

    if not event_document:
        raise HTTPException(
            detail="No webhook found for this event.",
            status_code=status.HTTP_404_NOT_FOUND
        )

    await mongodb_helper.delete_webhook(event=request_payload.event)

    return DeleteWebhookResponseModel(
        event=request_payload.event,
        message="The webhook has been successfully deleted!"
    )


@router.patch(
    "/modify-webhook",
    summary="Modify an existing webhook's details",
    status_code=status.HTTP_200_OK,
    response_model=ModifyWebhookResponseModel
)
async def modify_webhook(request_payload: ModifyWebhookRequestModel):

    event_document = await mongodb_helper.get_webhook(event=request_payload.event)

    if not event_document:
        raise HTTPException(
            detail="No webhook found for this event.",
            status_code=status.HTTP_404_NOT_FOUND
        )

    # Extract only the fields that should be updated (exclude event as it's the identifier)
    update_fields = request_payload.model_dump(exclude={"event"}, exclude_none=True)

    updated_document = await mongodb_helper.modify_webhook(
        event=request_payload.event,
        update_fields=update_fields
    )

    return ModifyWebhookResponseModel(
        event=updated_document.get("event"),
        method=updated_document.get("method"),
        url=updated_document.get("url"),
        headers=updated_document.get("headers"),
        query_params=updated_document.get("query_params"),
        cookies=updated_document.get("cookies"),
        body=updated_document.get("body"),
        message="The webhook has been successfully modified!"
    )