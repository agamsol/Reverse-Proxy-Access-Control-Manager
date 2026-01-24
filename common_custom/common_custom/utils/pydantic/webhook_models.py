import asyncio
import requests
from jinja2 import Template
from pydantic import BaseModel
from typing import Any, Dict, Optional, Literal


class HTTPRequest(BaseModel):
    event: Literal["pending.new", "pending.accepted", "pending.denied", "connection.revoked"]
    method: Literal["GET", "HEAD", "POST", "PUT", "DELETE"]
    url: str
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    cookies: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None


class CreateWebhookResponseModel(HTTPRequest):
    message: Literal["The webhook has been successfully created!"]


class WebhookValidator:

    @staticmethod
    def render_recursive(data: Any, context: Dict[str, Any]) -> Any:
        if isinstance(data, str):
            return Template(data).render(**context)
        if isinstance(data, dict):
            return {k: WebhookValidator.render_recursive(v, context) for k, v in data.items()}
        if isinstance(data, list):
            return [WebhookValidator.render_recursive(item, context) for item in data]
        return data

    @staticmethod
    async def execute_webhook(request: HTTPRequest, context: Dict[str, Any]):
        try:
            url = WebhookValidator.render_recursive(request.url, context)
            headers = WebhookValidator.render_recursive(request.headers or {}, context)
            params = WebhookValidator.render_recursive(request.query_params or {}, context)
            cookies = WebhookValidator.render_recursive(request.cookies or {}, context)
            body = WebhookValidator.render_recursive(request.body or {}, context)

            print(f"Sending {request.method} to {url}...")

            response = await asyncio.to_thread(
                requests.request,
                method=request.method,
                url=url,
                headers=headers,
                params=params,
                cookies=cookies,
                json=body,
                timeout=10
            )

            return response

        except requests.exceptions.Timeout:
            print(f"Webhook timed out: {url}")
            return None
        except requests.exceptions.ConnectionError:
            print(f"Webhook connection failed: {url}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Webhook error: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error processing webhook: {e}")
            return None
