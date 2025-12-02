import os
from dotenv import load_dotenv
from bson import ObjectId
from pymongo import MongoClient
from fastapi import HTTPException
from typing import Annotated
from pydantic import AfterValidator
from fastapi.security import OAuth2PasswordBearer  # NOQA: F401

load_dotenv(".env")
load_dotenv("administrator.env")

# -- MONGODB DATABASE --
mongo_client = MongoClient(
    host=os.getenv("MONGODB_HOST"),
    port=int(os.getenv("MONGODB_PORT")),
    username=os.getenv("MONGODB_USERNAME"),
    password=os.getenv("MONGODB_PASSWORD"),
    ServerSelectionTimeoutMS=10000
)

monogo_database = mongo_client["Reverse-Proxy-Access-Control"]
pending_connections_collection = monogo_database["pending_connections"]
users_collection = monogo_database["users"]
services_collection = monogo_database["services"]
pending_connections_collection = monogo_database["pending_connections"]
allowed_connections_collection = monogo_database["allowed_connections"]
ignored_connections_collection = monogo_database["ignored_connections"]
# /END/ -- MONGODB DATABASE --

# -- AUTHENTICATION SCHEME --
oauth2_token_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
# /END/ -- AUTHENTICATION SCHEME --

# -- FAST API --


def validate_and_convert_objectid(document_id: str):

    if not ObjectId.is_valid(document_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid ObjectId format. ID must be a 24-character hex string."
        )

    return document_id


# /END/ -- FAST API --

# -- PYDANTIC OBJECTS --
MongoID = Annotated[str, AfterValidator(validate_and_convert_objectid)]
# /END/ PYDANTIC OBJECTS --
