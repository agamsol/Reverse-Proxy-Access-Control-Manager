import os
import requests
from dotenv import load_dotenv
from common_custom.controllers.mongodb import MongoDb

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

    def __init__(self):
        self.methods = {
            "GET": requests.get,
            "HEAD": requests.head,
            "POST": requests.post,
            "PUT": requests.put,
            "DELETE": requests.delete
        }

    async def _invoke_request(self):
        pass

    async def pending_new(self):

        # Send patterns to this function (variables used in the request that is invoked)
        # This is for tomorrow lol good night...

        pass

    async def pending_accepted(self):
        pass

    async def pending_denied(self):
        pass

    async def connection_revoked(self):
        pass
