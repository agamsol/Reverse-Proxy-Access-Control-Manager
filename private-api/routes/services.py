from typing import Literal, Optional
from fastapi import APIRouter, status, HTTPException, Request, Depends, Form, Path  # NOQA: F401
from pydantic import BaseModel, Field, IPvAnyAddress, BeforeValidator, AfterValidator  # NOQA: F401
from dependencies import MongoID, services_collection

router = APIRouter(
    prefix="/service",
    tags=["Service Management"],
    responses={404: {"description": "Not found"}}
)


class ServiceResponseModel(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = Field(None, max_length=200)
    internal_address: IPvAnyAddress = "127.0.0.1"
    port: int = 80
    protocol: Literal["http", "https"] = "http"


class ServiceModel(ServiceResponseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)


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
    "/all_services",
    summary="Get a list of all available services",
    status_code=status.HTTP_200_OK,
    response_model=list[ServiceResponseModel]
)
async def list_services():

    cursor = services_collection.find()
    available_services = cursor.to_list(length=None)

    return available_services


@router.post(
    "/create",
    response_model=ServiceResponseModel
)
async def service_create(
    service: ServiceResponseModel
):

    service_found = services_collection.find_one(
        {"name": service.name}
    )

    service_payload = ServiceResponseModel(
        name=service.name,
        description=service.description,
        internal_address=service.internal_address,
        port=service.port,
        protocol=service.protocol
    )

    if service_found:

        raise HTTPException(
            status_code=409,
            detail="This service already exists, please try a different name"
        )

    services_collection.insert_one(
        service_payload.model_dump(mode="json")
    )

    return service_payload


@router.put(
    "/edit/{service_name}",
    response_model=ServiceResponseModel
)
async def service_edit(
    service: ServiceEditRequestModel,
    service_name: str = Path(..., max_length=200),
):

    service_found: dict = services_collection.find_one(
        filter={"name": service_name}
    )

    if not service_found:

        raise HTTPException(
            status_code=404,
            detail="The service specified does not exist!"
        )

    print(f"{service_found=}")

    new_service_payload = ServiceResponseModel(
        name=service.name if service.name else service_found.get("name"),
        description=service.description if service.description else service_found.get("description"),
        internal_address=service.internal_address if service.internal_address else service_found.get("internal_address"),
        port=service.port if service.port else service_found.get("port"),
        protocol=service.protocol if service.protocol else service_found.get("protocol")
    )

    services_collection.update_one(
        filter={"name": service_name},
        update={"$set": new_service_payload.model_dump(mode="json")}
    )

    return new_service_payload


@router.delete(
    "/delete/{service_name}",
    response_model=dict[str, str]
)
async def service_delete(
    service_name: str = Path(..., max_length=200)
):

    service_found = services_collection.find_one(
        {"name": service_name}
    )

    if not service_found:

        raise HTTPException(
            status_code=404,
            detail=""
        )

    services_collection.delete_one(
        {"name": service_name}
    )

    return {"service": service_name, "message": "The service has been deleted!"}
