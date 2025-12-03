from pydantic import BaseModel, Field, IPvAnyAddress
from typing import Optional
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.service_models import ServiceItem


class PendingConnectionDatabaseModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    ip_address: IPvAnyAddress
    service: ServiceItem | None = None
    notes: str | None = Field(None, max_length=200, description="Note for the access request")
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
