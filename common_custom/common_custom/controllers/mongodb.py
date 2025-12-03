from pymongo import MongoClient, database
from common_custom.controllers.pydantic.pending_models import PendingConnectionDatabaseModel


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
