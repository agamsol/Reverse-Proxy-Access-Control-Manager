from bson import ObjectId
from typing import Literal
from fastapi import HTTPException
from pymongo import MongoClient, database
from pymongo.collection import Collection
from datetime import datetime, timedelta, timezone
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.pending_models import PendingConnectionDatabaseModel
from common_custom.controllers.pydantic.service_models import ServiceResponseModel
from common_custom.controllers.pydantic.allowed_models import AllowedConnectionModel, DeniedConnectionModel
from common_custom.utils.pydantic.webhook_models import HTTPRequest

# # Collections to be used (add, remove, get, list)
# users
# services
# pending_connections
# allowed_connections
# denied_connections


class MongoDb:

    def __init__(self, database_name: str):
        self.database_name: str = database_name
        self.host: str = None
        self.port: int = None
        self.username: str = None
        self.client: MongoClient = None
        self.database: database.Database = None

        self.services_collection_name = "services"
        self.pending_collection_name = "pending_connections"
        self.allowed_collection_name = "allowed_connections"
        self.ignored_collection_name = "ignored_collection"
        self.webhooks_collection_name = "webhooks"

    def connect(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        force_database_name: str = None,
        server_selection_timeout: int = 10000
    ) -> database.Database:

        if force_database_name:

            self.database_name: str = force_database_name

        if not self.database_name:
            raise ValueError("No database was specified during the connection.")

        self.host = host
        self.port = port
        self.username = username

        mongo_client = MongoClient(
            host=host,
            port=port,
            username=username,
            password=password,
            ServerSelectionTimeoutMS=server_selection_timeout
        )

        self.client = mongo_client
        self.database = mongo_client[self.database_name]

        return mongo_client[self.database_name]

    async def create_pending_connection(
        self,
        remote_address,
        service,
        additional_notes,
        request_latitude,
        request_longitude,
    ) -> PendingConnectionDatabaseModel:

        document_payload = PendingConnectionDatabaseModel(
            ip_address=remote_address,
            service=service,
            notes=additional_notes,
            lat=request_latitude,
            lon=request_longitude,
        )

        validated_document = document_payload.model_dump(mode="json", exclude={"id"})
        self.database[self.pending_collection_name].insert_one(validated_document)

        return validated_document

    async def list_all_services(self):

        cursor = self.database[self.services_collection_name].find()
        available_services = cursor.to_list(length=None)

        return available_services

    async def get_service(self, service_name: str):

        services_collection = self.database[self.services_collection_name]

        service_payload = services_collection.find_one(
            {"name": service_name}
        )

        return service_payload

    async def create_service(self, service_name: str, description: str, internal_address: str, port: int, protocol: Literal["http", "https"]):

        service_payload = ServiceResponseModel(
            name=service_name,
            description=description,
            internal_address=internal_address,
            port=port,
            protocol=protocol
        )

        self.database[self.services_collection_name].insert_one(
            service_payload.model_dump(mode="json")
        )

        return service_payload

    async def modify_service(self, service_name, description, internal_address, port, protocol, new_service_name: str = None) -> ServiceResponseModel:

        if not new_service_name:
            new_service_name = service_name

        updated_service_payload = ServiceResponseModel(
            name=new_service_name,
            description=description,
            internal_address=internal_address,
            port=port,
            protocol=protocol
        )

        self.database[self.services_collection_name].update_one(
            filter={"name": service_name},
            update={"$set": updated_service_payload.model_dump(mode="json")}
        )

        return updated_service_payload

    async def delete_service(self, service_name):

        self.database[self.services_collection_name].delete_one(
            {"name": service_name}
        )

        return

    async def get_all_documents(self, collection: Collection = None):

        if collection is None:
            collection = self.database[self.pending_collection_name]

        cursor = collection.find()
        all_pending = cursor.to_list(length=None)

        return all_pending

    async def get_document(self, document_id: str, collection: Collection = None):

        if collection is None:
            collection = self.database[self.pending_collection_name]

        pending_connection_document: dict = collection.find_one(
            filter={"_id": ObjectId(document_id)}
        )

        if pending_connection_document is None:

            raise HTTPException(
                detail="The specified connection ID was not found",
                status_code=404
            )

        return pending_connection_document

    async def accept_pending_connection(self, connection_id: MongoID):

        pending_collection = self.database[self.pending_collection_name]
        allowed_collection = self.database[self.allowed_collection_name]

        await self.get_document(connection_id)

        pending_connection_payload: dict = pending_collection.find_one_and_delete(
            filter={"_id": ObjectId(connection_id)}
        )

        print(f"{pending_connection_payload=}")

        requested_service: dict = pending_connection_payload.get("service")
        service_expiry = datetime.now(timezone.utc) + timedelta(hours=requested_service.get("expiry")) if requested_service.get("expiry") is not None else None

        allowed_connection_payload = AllowedConnectionModel(
            ip_address=pending_connection_payload.get("ip_address"),
            service_name=requested_service.get("name"),
            ExpireAt=service_expiry
        )

        allowed_collection.insert_one(
            allowed_connection_payload.model_dump(mode="json", exclude={"id"})
        )

        return allowed_connection_payload

    async def deny_pending_connection(self, connection_id: MongoID, ignore_connection=False):

        deleted_document: dict = self.database[self.pending_collection_name].find_one_and_delete(
            filter={"_id": ObjectId(connection_id)}
        )

        service_payload: dict = deleted_document.get("service")

        denied_connection = DeniedConnectionModel(
            id=ObjectId(connection_id),
            ip_address=deleted_document.get("ip_address"),
            service_name=service_payload.get("name"),
        )

        return denied_connection

    async def ignore_connection(self, denied_connection: DeniedConnectionModel):

        self.database[self.ignored_collection_name].insert_one(
            denied_connection.model_dump(mode="json")
        )

        return denied_connection

    async def revoke_connection(self, connection_id: MongoID):

        deleted_document: dict = self.database[self.allowed_collection_name].find_one_and_delete(
            filter={"_id": ObjectId(connection_id)}
        )

        return deleted_document

    async def unignore_connection(self, connection_id: MongoID):

        deleted_document: dict = self.database[self.ignored_collection_name].find_one_and_delete(
            filter={"_id": ObjectId(connection_id)}
        )

        return deleted_document

    async def get_webhook(self, event: str):

        event_document = self.database[self.webhooks_collection_name].find_one(
            {"event": event}
        )

        return event_document

    async def create_webhook_request(self, http_request: HTTPRequest):

        http_request_document = self.database[self.webhooks_collection_name].insert_one(
            http_request.model_dump(mode="json")
        )

        return http_request_document

    async def modify_webhook(self):
        pass

    async def delete_webhook(self):
        pass
