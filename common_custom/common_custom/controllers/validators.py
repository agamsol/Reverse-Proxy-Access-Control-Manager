from bson import ObjectId
from typing import Annotated
from pydantic import AfterValidator
from fastapi import HTTPException


def validate_document_id(document_id: str):

    if not ObjectId.is_valid(document_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid ObjectId format. ID must be a 24-character hex string."
        )

    return document_id


MongoID = Annotated[str, AfterValidator(validate_document_id)]
