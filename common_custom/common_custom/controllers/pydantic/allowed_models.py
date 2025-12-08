from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, IPvAnyAddress
from common_custom.controllers.validators import MongoID


class AllowedConnectionModel(BaseModel):
    id: Optional[MongoID] = Field(alias="_id", default=None)
    ip_address: IPvAnyAddress
    service_name: str
    ExpireAt: datetime | None


class DeniedConnectionModel(BaseModel):
    ip_address: IPvAnyAddress
    service_name: str
    ignore: bool = Field(description="Whether to ignore (prevent) the IP Address from sending requests")


class DeniedSuccessResponseModel(BaseModel):
    message: str = Field(max_length=100)
    service_name: str = Field(description="Applies to a specific service of the network")
    ignore: bool = Field(description="Whether the IP Address was ignored")
