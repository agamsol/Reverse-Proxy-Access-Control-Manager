from bson import ObjectId
from typing import Annotated, Any
from pydantic import BeforeValidator
from fastapi import HTTPException


def validate_document_id(document_id: Any):

    if isinstance(document_id, ObjectId):
        return str(document_id)

    if not ObjectId.is_valid(document_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid ObjectId format. ID must be a 24-character hex string."
        )

    return str(document_id)


MongoID = Annotated[str, BeforeValidator(validate_document_id)]
