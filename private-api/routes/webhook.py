import os
from dotenv import load_dotenv
from typing import Literal, Optional  # NOQA: F401
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from common_custom.controllers.mongodb import MongoDb
from common_custom.utils.pydantic.webhook_models import HTTPRequest, CreateWebhookResponseModel

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
