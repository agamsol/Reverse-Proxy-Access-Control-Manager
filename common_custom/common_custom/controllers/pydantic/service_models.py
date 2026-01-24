from pydantic import BaseModel, Field, IPvAnyAddress
from typing import Optional, Literal
from common_custom.controllers.validators import MongoID


class ServiceResponseModel(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = Field(None, max_length=200)
    internal_address: IPvAnyAddress = "127.0.0.1"
    port: int = 80
    protocol: Literal["http", "https"] = "http"


class ServiceModel(ServiceResponseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)


class ServiceItem(BaseModel):
    name: str = Field(..., description="Name of the service to request access to")
    expiry: Optional[int] = Field(None, description="Amount of time (in minutes) the access is requested for")
