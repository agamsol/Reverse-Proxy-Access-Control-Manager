import re
from typing import Annotated, Any
from pydantic import BeforeValidator
from fastapi import HTTPException


_HEX_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{24}$")


def validate_document_id(document_id: Any):

    candidate = str(document_id)

    if not _HEX_ID_PATTERN.match(candidate):

        raise HTTPException(
            status_code=400,
            detail="Invalid ID format. ID must be a 24-character hex string."
        )

    return candidate


MongoID = Annotated[str, BeforeValidator(validate_document_id)]
