from pydantic import BaseModel, Field, model_validator


class ContactFieldFlagsModel(BaseModel):
    visible: bool = Field(..., description="Whether the field is shown on the access form")
    required: bool = Field(
        ...,
        description="When visible, whether the value is mandatory (asterisk in the UI)",
    )

    @model_validator(mode="after")
    def _required_only_when_visible(self) -> "ContactFieldFlagsModel":
        if self.required and not self.visible:
            raise ValueError("required cannot be true when visible is false")
        return self


class ContactFieldsConfigResponseModel(BaseModel):
    name: ContactFieldFlagsModel
    email: ContactFieldFlagsModel
    phone_number: ContactFieldFlagsModel
