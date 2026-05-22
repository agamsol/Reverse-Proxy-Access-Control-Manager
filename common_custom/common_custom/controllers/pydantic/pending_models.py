from pydantic import BaseModel, Field, IPvAnyAddress, EmailStr, field_validator, model_validator
from typing import Optional, Literal
from datetime import datetime, timezone
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


class AcceptPendingConnectionRequestModel(BaseModel):
    """Optional body for `POST /pending/accept/{id}`. When `explicit` is false or omitted, the server uses only the stored pending document (legacy). When `explicit` is true, the admin-edited values are applied."""

    explicit: bool = False
    service_name: str | None = Field(None, max_length=200)
    contact_name: str | None = Field(None, max_length=32)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(None, max_length=64)
    expiry_mode: Literal["inherit", "none", "at"] = "inherit"
    expire_at: datetime | None = None

    @field_validator("service_name", mode="before")
    @classmethod
    def strip_service_name(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @model_validator(mode="after")
    def _validate_explicit(self) -> "AcceptPendingConnectionRequestModel":
        if not self.explicit:
            return self
        if not self.service_name:
            raise ValueError("service_name is required when explicit is true")
        if self.expiry_mode == "at":
            if self.expire_at is None:
                raise ValueError("expire_at is required when expiry_mode is at")
            now = datetime.now(timezone.utc)
            at = self.expire_at
            if at.tzinfo is None:
                at = at.replace(tzinfo=timezone.utc)
            else:
                at = at.astimezone(timezone.utc)
            if at <= now:
                raise ValueError("expire_at must be in the future")
        return self

    def to_contact_methods(self) -> ContactMethodsModel:
        raw_name = (self.contact_name or "").strip()
        name = raw_name if raw_name else None
        email_dict = {str(self.contact_email): False} if self.contact_email else None
        phone_stripped = (self.contact_phone or "").strip()
        phone_dict = {phone_stripped: False} if phone_stripped else None
        return ContactMethodsModel(name=name, email=email_dict, phone_number=phone_dict)
