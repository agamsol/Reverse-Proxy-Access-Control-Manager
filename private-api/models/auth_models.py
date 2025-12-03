from pydantic import BaseModel, Field
from fastapi import Form
from fastapi.security import OAuth2PasswordBearer

oauth2_token_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


class LoginRequestModel(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=20, description="Administrator user username")
    password: str | None = Field(None, max_length=199, description="Administrator user password")
    remember_me: bool = Field(False, description="Whether to remember the login for 60 days or 24 hours day")


class LoginResponseModel(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayloadModel(BaseModel):
    username: str = Field(None, min_length=3, max_length=20, description="Administrator user username")
    exp: int = Field(..., ge=1_000_000_000, le=9_999_999_999, description="Expiration time as UNIX timestamp")


class AuthenticatedUserResponseModel(BaseModel):
    payload: TokenPayloadModel
    message: str = Field(..., max_length=50)


class TokenPayloadModel(BaseModel):
    username: str = Field(None, min_length=3, max_length=20, description="Administrator user username")
    exp: int = Field(..., ge=1_000_000_000, le=9_999_999_999, description="Expiration time as UNIX timestamp")


def get_login_form(
    username: str = Form(..., min_length=3, max_length=20, description="Administrator user username"),
    password: str = Form(..., max_length=199, description="Administrator user password"),
    remember_me: bool = Form(False, description="Whether to remember the login for 60 days or 24 hours day"),
) -> LoginRequestModel:

    return LoginRequestModel(
        username=username,
        password=password,
        remember_me=remember_me
    )
