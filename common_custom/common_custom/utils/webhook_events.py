import os
import time
import requests
from datetime import datetime
from dotenv import load_dotenv
from common_custom.controllers.mongodb import MongoDb
from common_custom.utils.pydantic.webhook_models import HTTPRequest, WebhookValidator
from common_custom.controllers.pydantic.allowed_models import AllowedConnectionModel

load_dotenv(".env")

mongodb_helper = MongoDb(
    database_name=os.getenv("MONGODB_DATABASE")
)

mongodb = mongodb_helper.connect(
    host=os.getenv("MONGODB_HOST"),
    port=int(os.getenv("MONGODB_PORT")),
    username=os.getenv("MONGODB_USERNAME"),
    password=os.getenv("MONGODB_PASSWORD")
)

webhooks_collection = mongodb_helper.database[mongodb_helper.webhooks_collection_name]


class Events:

    async def _invoke_request():
        pass

    @staticmethod
    async def default_context(name: str = None, phone_number: str = None, email: str = None):

        if isinstance(email, dict):
            email = next(iter(email), None)
        
        if isinstance(phone_number, dict):
            phone_number = next(iter(phone_number), None)
        
        context = {
            "owner_name": os.getenv("OWNER_NAME", "Unknown"),
            "owner_email": os.getenv("OWNER_EMAIL", None),
            "owner_phone_number": os.getenv("OWNER_PHONE_NUMBER", None),
            "nl": "\n",
            "newline": "\n",
            "date": time.strftime("%Y-%m-%d", time.gmtime()),
            "time": time.strftime("%H:%M", time.gmtime()),
            "time_seconds": time.strftime("%H:%M:%S", time.gmtime()),
            "name": name,
            "phone_number": phone_number,
            "email": email

        }

        return context

    @staticmethod
    async def pending_new(access_request, remote_address: str, service):
        
        webhook_available = await mongodb_helper.get_webhook(event="pending.new")

        if webhook_available:

            webhook_request = HTTPRequest(
                **webhook_available
            )

            # Available message variables: {{ip_address}}, {{service}}, {{note}}, {{date}}, {{time}} {{time_seconds}}, {{nl}}

            context = await Events.default_context(access_request.contact_methods.name, access_request.contact_methods.phone_number, access_request.contact_methods.email)
            
            additional_context = {
                "ip_address": remote_address,
                "service": service.name,
                "note": "" if access_request.note is None else str(access_request.note),
            }

            context.update(additional_context)

            response = await WebhookValidator.execute_webhook(webhook_request, context)

            print(f"Webhook invoked with status code: {response.status_code}")
            print(f"Response content: {response.text}")

            return response

    @staticmethod
    async def pending_accepted(allowed_connection_payload: AllowedConnectionModel):

        webhook_available = await mongodb_helper.get_webhook(event="pending.accepted")

        if webhook_available:

            webhook_request = HTTPRequest(
                **webhook_available
            )

            context = await Events.default_context(allowed_connection_payload.contact_methods.name, allowed_connection_payload.contact_methods.phone_number, allowed_connection_payload.contact_methods.email)

            # Available message variables: {{phone_number}}, {{service}}, {{expiry_date}}, {{expiry_time}}, {{expiry_time_seconds}}, {{nl}}
            additional_context = {
                "service": allowed_connection_payload.service_name,
                "expiry_date": allowed_connection_payload.ExpireAt.strftime("%Y-%m-%d"),
                "expiry_time": allowed_connection_payload.ExpireAt.strftime("%H:%M"),
                "expiry_time_seconds": allowed_connection_payload.ExpireAt.strftime("%H:%M:%S"),
            }

            context.update(additional_context)

            response = await WebhookValidator.execute_webhook(webhook_request, context)

            print(f"Webhook invoked with status code: {response.status_code}")
            print(f"Response content: {response.text}")

            return response

    @staticmethod
    async def pending_denied(pending_connection):

        webhook_available = await mongodb_helper.get_webhook(event="pending.denied")

        if webhook_available:

            webhook_request = HTTPRequest(
                **webhook_available
            )

            context = await Events.default_context(pending_connection.get("contact_methods", {}).get("name", {}), pending_connection.get("contact_methods", {}).get("phone_number", {}), pending_connection.get("contact_methods", {}).get("email", {}))

            additional_context = {
                "service": pending_connection.get("service", {}).get("name", "Unknown"),
            }

            context.update(additional_context)

            response = await WebhookValidator.execute_webhook(webhook_request, context)

            print(f"Webhook invoked with status code: {response.status_code}")
            print(f"Response content: {response.text}")

            return response

    @staticmethod
    async def connection_revoked(document_payload: dict):

        webhook_available = await mongodb_helper.get_webhook(event="connection.revoked")

        if webhook_available:

            webhook_request = HTTPRequest(
                **webhook_available
            )

            expiry_date = datetime.fromisoformat(document_payload.get("ExpireAt"))

            context = await Events.default_context(document_payload.get("contact_methods", {}).get("name", {}), document_payload.get("contact_methods", {}).get("phone_number", {}), document_payload.get("contact_methods", {}).get("email", {}))

            additional_context = {
                "service": document_payload.get("service_name"),
                "expiry_date": expiry_date.strftime("%Y-%m-%d"),
                "expiry_time": expiry_date.strftime("%H:%M"),
                "expiry_time_seconds": expiry_date.strftime("%H:%M:%S"),
            }

            context.update(additional_context)

            response = await WebhookValidator.execute_webhook(webhook_request, context)

            print(f"Webhook invoked with status code: {response.status_code}")
            print(f"Response content: {response.text}")

            return response
