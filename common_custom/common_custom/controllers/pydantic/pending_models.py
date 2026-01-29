from pydantic import BaseModel, Field, IPvAnyAddress, EmailStr
from typing import Optional
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.service_models import ServiceItem


class ContactMethodsRequestModel(BaseModel):
    name: Optional[str] = Field(..., examples=[None])
    email: Optional[EmailStr] = Field(..., examples=[None])
    phone_number: Optional[str] = Field(..., examples=[None])


class ContactMethodsModel(BaseModel):
    name: Optional[str] = Field(..., examples=[None], max_length=32)
    email: Optional[dict[EmailStr, bool]]
    phone_number: Optional[dict[Optional[str], bool]]


class LocationRequestModel(BaseModel):
    lat: Optional[float] = Field(None, ge=-90, le=90, examples=[None], description="Latitude of the requester")
    lon: Optional[float] = Field(None, ge=-180, le=180, examples=[None], description="Longitude of the requester")


class PendingConnectionDatabaseModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    contact_methods: ContactMethodsModel
    ip_address: IPvAnyAddress
    service: ServiceItem | None = None
    location: LocationRequestModel
    notes: str | None = Field(None, max_length=200, description="Leave a note for the admin")


class DenyConnectionRequestModel(BaseModel):
    ignore_connection: bool = Field(False, description="Prevent this connection from sending more requests")
