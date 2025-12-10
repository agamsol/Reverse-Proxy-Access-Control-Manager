import os
from dotenv import load_dotenv
from typing import Literal, Optional  # NOQA: F401
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from common_custom.controllers.mongodb import MongoDb
from common_custom.controllers.pydantic.service_models import ServiceResponseModel

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
    prefix="/service",
    tags=["Service Management"],
    responses={404: {"description": "Not found"}}
)


class ServiceEditRequestModel(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=200)
    internal_address: IPvAnyAddress | None = None
    port: int = None
    protocol: Literal["http", "https"] = None

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": None,
                    "description": None,
                    "internal_address": None,
                    "port": None,
                    "protocol": None
                }
            ]
        }
    }


@router.get(
    "/get-service-list",
    summary="Get all of the available services",
    status_code=status.HTTP_200_OK,
    response_model=list[ServiceResponseModel]
)
async def list_services():

    available_services = await mongodb_helper.list_all_services()

    return available_services


@router.post(
    "/create",
    summary="Add the subdomain as a service pointing to a different application as in your nginx configuration",
    response_model=ServiceResponseModel
)
async def service_create(
    service: ServiceResponseModel
):

    service_found = await mongodb_helper.get_service(service_name=service.name)

    if service_found:

        raise HTTPException(
            status_code=409,
            detail="This service already exists, please try a different name"
        )

    service_payload = await mongodb_helper.create_service(
        service.name,
        service.description,
        service.internal_address,
        service.port,
        service.protocol
    )

    return service_payload


@router.patch(
    "/edit/{service_name}",
    summary="Edit specific service information",
    response_model=ServiceResponseModel
)
async def service_edit(
    service: ServiceEditRequestModel,
    service_name: str = Path(..., max_length=200),
):

    service_found = await mongodb_helper.get_service(service_name=service_name)

    if not service_found:

        raise HTTPException(
            status_code=404,
            detail="The service specified does not exist!"
        )

    new_service_payload = mongodb_helper.modify_service(
        service_name=service_name,
        description=service.description if service.description else service_found.get("description"),
        internal_address=service.internal_address if service.internal_address else service_found.get("internal_address"),
        port=service.port if service.port else service_found.get("port"),
        protocol=service.protocol if service.protocol else service_found.get("protocol"),
        new_service_name=service.name if service.name else service_found.get("name")
    )

    return new_service_payload


@router.delete(
    "/delete/{service_name}",
    summary="Delete a service from the database",
    response_model=dict[str, str]
)
async def service_delete(
    service_name: str = Path(..., max_length=200)
):

    service_found = await mongodb_helper.get_service(service_name=service_name)

    if not service_found:

        raise HTTPException(
            status_code=404,
            detail="The service specified does not exist!"
        )

    await mongodb_helper.delete_service(service_name)

    return {"service": service_name, "message": "The service has been deleted!"}
