import requests
from typing import Any, Dict, Optional, Literal
from pydantic import BaseModel


def convert_method_to_function(method: str):
    method_mapping = {
        "GET": requests.get,
        "HEAD": requests.head,
        "POST": requests.post,
        "PUT": requests.put,
        "DELETE": requests.delete
    }
    return method_mapping.get(method.upper())


class HTTPRequest(BaseModel):
    event: Literal["pending.new", "pending.accepted", "pending.denied" "connection.revoked"]
    contact: Optional[Dict[str, Any]] = None
    method: Literal["GET", "HEAD", "POST", "PUT", "DELETE"]
    url: str
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    path_params: Optional[Dict[str, Any]] = None
    cookies: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    form_data: Optional[Dict[str, Any]] = None
    client_ip: Optional[str] = None


class CreateWebhookResponseModel(HTTPRequest):
    message: Literal["The webhook has been successfully created!"]
