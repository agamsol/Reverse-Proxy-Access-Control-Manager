from pathlib import Path

from fastapi import APIRouter, status

from common_custom.utils.contact_fields import (
    contact_fields_to_response,
    ensure_contact_fields_file,
    load_contact_fields_config,
    response_to_contact_fields_dict,
    save_contact_fields_config,
)
from common_custom.utils.pydantic.contact_fields_models import ContactFieldsConfigResponseModel

DATA_DIR = (Path(__file__).resolve().parents[2] / "data").resolve()
CONTACT_FIELDS_PATH = DATA_DIR / "contact-fields.json"

ensure_contact_fields_file(CONTACT_FIELDS_PATH)

router = APIRouter(
    prefix="/config",
    tags=["Configuration"],
    responses={404: {"description": "Not found"}},
)


@router.get(
    "/get-contact-fields",
    summary="Get guest access form contact field settings",
    status_code=status.HTTP_200_OK,
    response_model=ContactFieldsConfigResponseModel,
)
async def get_contact_fields():
    config = load_contact_fields_config(CONTACT_FIELDS_PATH)
    return contact_fields_to_response(config)


@router.put(
    "/update-contact-fields",
    summary="Update guest access form contact field settings",
    status_code=status.HTTP_200_OK,
    response_model=ContactFieldsConfigResponseModel,
)
async def update_contact_fields(body: ContactFieldsConfigResponseModel):
    saved = save_contact_fields_config(
        CONTACT_FIELDS_PATH,
        response_to_contact_fields_dict(body),
    )
    return contact_fields_to_response(saved)
