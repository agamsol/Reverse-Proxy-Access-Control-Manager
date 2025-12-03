from typing import Literal
from pymongo import MongoClient, database
from common_custom.controllers.pydantic.pending_models import PendingConnectionDatabaseModel
from common_custom.controllers.pydantic.service_models import ServiceResponseModel


class MongoDb:

    def __init__(self, database_name: str):
        self.database_name: str = database_name
        self.host: str = None
        self.port: int = None
        self.username: str = None
        self.client: MongoClient = None
        self.database: database.Database = None

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
        collection_name: str = "pending_connections"
    ) -> PendingConnectionDatabaseModel:

        document_payload = PendingConnectionDatabaseModel(
            ip_address=remote_address,
            service=service,
            notes=additional_notes,
            lat=request_latitude,
            lon=request_longitude,
        )

        validated_document = document_payload.model_dump(mode="json", exclude={"id"})
        self.database[collection_name].insert_one(validated_document)

        return validated_document

    async def list_all_services(self, collection_name: str = "services"):

        cursor = self.database[collection_name].find()
        available_services = cursor.to_list(length=None)

        return available_services

    async def get_service(self, service_name: str, collection_name: str = "services"):

        services_collection = self.database[collection_name]

        service_payload = services_collection.find_one(
            {"name": service_name}
        )

        return service_payload

    async def create_service(self, service_name: str, description: str, internal_address: str, port: int, protocol: Literal["http", "https"], collection_name: str = "services"):

        service_payload = ServiceResponseModel(
            name=service_name,
            description=description,
            internal_address=internal_address,
            port=port,
            protocol=protocol
        )

        self.database[collection_name].insert_one(
            service_payload.model_dump(mode="json")
        )

        return service_payload

    async def modify_service(self, service_name, description, internal_address, port, protocol, new_service_name: str = None, collection_name: str = "services") -> ServiceResponseModel:

        if not new_service_name:
            new_service_name = service_name

        updated_service_payload = ServiceResponseModel(
            name=new_service_name,
            description=description,
            internal_address=internal_address,
            port=port,
            protocol=protocol
        )

        self.database[collection_name].update_one(
            filter={"name": service_name},
            update={"$set": updated_service_payload.model_dump(mode="json")}
        )

        return updated_service_payload

    async def delete_service(self, service_name, collection_name: str = "services"):

        self.database[collection_name].delete_one(
            {"name": service_name}
        )

        return
