from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, IPvAnyAddress, EmailStr, field_validator, model_validator
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.pending_models import ContactMethodsModel


class AllowedConnectionModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    ip_address: IPvAnyAddress
    contact_methods: ContactMethodsModel
    service_name: str
    ExpireAt: datetime | None


class DeniedConnectionModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    contact_methods: ContactMethodsModel
    ip_address: IPvAnyAddress
    service_name: str


class DeniedSuccessResponseModel(BaseModel):
    message: str = Field(max_length=100)
    ip_address: IPvAnyAddress
    service_name: str = Field(description="Applies to a specific service of the network")
    ignore: bool = Field(description="Whether the IP Address was ignored")


class AdminCreateAllowedConnectionRequestModel(BaseModel):
    """Admin-only: grant access without a prior pending request."""

    ip_address: IPvAnyAddress
    service_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Must match an existing service `name`",
    )
    contact_name: str | None = Field(None, max_length=32)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(None, max_length=64)
    expiry_minutes: int | None = Field(
        None,
        ge=1,
        le=525_600,
        description="If set, access expires this many minutes from grant time; omit for no expiry",
    )
    expire_at: datetime | None = Field(
        None,
        description="Absolute UTC expiry instant; if set, overrides expiry_minutes",
    )

    @field_validator("service_name", mode="before")
    @classmethod
    def strip_service_name(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @model_validator(mode="after")
    def _expire_at_future(self) -> "AdminCreateAllowedConnectionRequestModel":
        if self.expire_at is None:
            return self
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
        name = raw_name if raw_name else "(admin grant)"
        email_dict = {str(self.contact_email): False} if self.contact_email else None
        phone_stripped = (self.contact_phone or "").strip()
        phone_dict = {phone_stripped: False} if phone_stripped else None
        return ContactMethodsModel(name=name, email=email_dict, phone_number=phone_dict)


class AdminUpdateAllowedConnectionRequestModel(BaseModel):
    """Admin-only: update contact details and expiry on an existing allowed connection."""

    contact_name: str | None = Field(None, max_length=32)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(None, max_length=64)
    expiry_minutes: int | None = Field(
        None,
        ge=1,
        le=525_600,
        description="If set, access expires this many minutes from update time; omit with expire_at for no expiry",
    )
    expire_at: datetime | None = Field(
        None,
        description="Absolute UTC expiry instant; if set, overrides expiry_minutes",
    )

    @model_validator(mode="after")
    def _expire_at_future(self) -> "AdminUpdateAllowedConnectionRequestModel":
        if self.expire_at is None:
            return self
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
