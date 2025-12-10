from typing import Literal
from pydantic import BaseModel, Field


class StatusResponseModel(BaseModel):
    version: str = Field("1.0", max_length=10)
    filesystem: Literal["nt", "posix"]
    maintenance: bool
