from bson import ObjectId
from fastapi import HTTPException


def validate_and_convert_objectid(document_id: str):

    if not ObjectId.is_valid(document_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid ObjectId format. ID must be a 24-character hex string."
        )

    return document_id
