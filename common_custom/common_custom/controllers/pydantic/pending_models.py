from pydantic import BaseModel, Field, IPvAnyAddress, EmailStr
from typing import Optional
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.service_models import ServiceItem


class ContactMethodsRequestModel(BaseModel):
    name: Optional[str] = Field(..., examples=[None])
    email: Optional[EmailStr] = Field(..., examples=["mail@example.com"])
    phone_number: Optional[str] = Field(..., examples=[None])


class ContactMethodsModel(BaseModel):
    name: Optional[str] = Field(..., examples=[None])
    email: Optional[dict[EmailStr, bool]] = Field(..., examples=[{"mail@example.com"}])
    phone_number: Optional[dict[Optional[str], bool]] = Field(..., examples=[{"+12021234567"}])


class PendingConnectionDatabaseModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    contact_methods: ContactMethodsModel
    ip_address: IPvAnyAddress
    service: ServiceItem | None = None
    notes: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)


class DenyConnectionRequestModel(BaseModel):
    ignore_connection: bool = Field(False, description="Prevent this connection from sending more requests")
