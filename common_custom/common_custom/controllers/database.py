import json
import sqlite3
import secrets
import threading
from pathlib import Path
from typing import Literal
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from common_custom.controllers.validators import MongoID
from common_custom.controllers.pydantic.pending_models import (
    PendingConnectionDatabaseModel,
    ContactMethodsModel,
    LocationRequestModel,
    AcceptPendingConnectionRequestModel,
)
from common_custom.controllers.pydantic.service_models import ServiceResponseModel
from common_custom.controllers.pydantic.allowed_models import AllowedConnectionModel, DeniedConnectionModel
from common_custom.utils.pydantic.webhook_models import HTTPRequest


def _client_ip_query_variants(ip_str: str) -> list[str]:
    """Match a stored `ip_address` whether saved as e.g. `127.0.0.1` or `::ffff:127.0.0.1`."""
    s = (ip_str or "").strip()
    if not s:
        return []
    variants = [s]
    if s.lower().startswith("::ffff:"):
        tail = s[7:]
        if tail and tail not in variants:
            variants.append(tail)
    return variants


def _generate_id() -> str:
    """Generate a 24-character hex identifier compatible with the existing MongoID format."""
    return secrets.token_hex(12)


def _to_iso(value: datetime | None) -> str | None:
    """Serialize a datetime to a naive-UTC ISO-8601 string for storage."""
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.isoformat()


def _from_iso(value: str | None) -> datetime | None:
    """Parse a stored ISO-8601 string back into a naive-UTC datetime."""
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _dump_json(value) -> str | None:
    if value is None:
        return None
    return json.dumps(value)


def _load_json(value: str | None):
    if value is None:
        return None
    return json.loads(value)


class Database:
    """SQLite-backed data-access layer.

    Public method names, async signatures, and return shapes mirror the previous
    MongoDB controller so the API routes, Pydantic models, and frontends are
    unaffected. Documents are returned as dicts keyed exactly like the old Mongo
    documents (including a 24-char hex `_id`).
    """

    def __init__(self, db_path: str):
        self.db_path: str = db_path
        self.connection: sqlite3.Connection = None
        self._lock = threading.Lock()

        self.services_collection_name = "services"
        self.pending_collection_name = "pending_connections"
        self.allowed_collection_name = "allowed_connections"
        self.ignored_collection_name = "ignored_collection"
        self.webhooks_collection_name = "webhooks"

    def connect(self) -> sqlite3.Connection:

        if not self.db_path:
            raise ValueError("No database path was specified during the connection.")

        db_file = Path(self.db_path)
        if db_file.parent and not db_file.parent.exists():
            db_file.parent.mkdir(parents=True, exist_ok=True)

        connection = sqlite3.connect(self.db_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=5000")
        connection.execute("PRAGMA foreign_keys=ON")

        self.connection = connection

        self._create_tables()
        self._purge_expired_allowed()

        return connection

    def _create_tables(self):
        with self._lock:
            self.connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS services (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    internal_address TEXT,
                    port INTEGER,
                    protocol TEXT,
                    category TEXT
                );

                CREATE TABLE IF NOT EXISTS pending_connections (
                    id TEXT PRIMARY KEY,
                    ip_address TEXT,
                    service_name TEXT,
                    contact_methods TEXT,
                    service TEXT,
                    location TEXT,
                    notes TEXT
                );

                CREATE TABLE IF NOT EXISTS allowed_connections (
                    id TEXT PRIMARY KEY,
                    ip_address TEXT,
                    service_name TEXT,
                    contact_methods TEXT,
                    ExpireAt TEXT
                );

                CREATE TABLE IF NOT EXISTS ignored_collection (
                    id TEXT PRIMARY KEY,
                    ip_address TEXT,
                    service_name TEXT,
                    contact_methods TEXT
                );

                CREATE TABLE IF NOT EXISTS webhooks (
                    id TEXT PRIMARY KEY,
                    event TEXT NOT NULL UNIQUE,
                    method TEXT,
                    url TEXT,
                    headers TEXT,
                    query_params TEXT,
                    cookies TEXT,
                    body TEXT
                );
                """
            )
            self.connection.commit()

    def _purge_expired_allowed(self):
        """Mimic MongoDB's TTL index by deleting expired allowed connections."""
        now_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        self._execute(
            "DELETE FROM allowed_connections WHERE ExpireAt IS NOT NULL AND ExpireAt <= ?",
            (now_iso,),
        )

    def _execute(self, sql: str, params: tuple = ()):
        with self._lock:
            cursor = self.connection.execute(sql, params)
            self.connection.commit()
            return cursor

    def _fetchone(self, sql: str, params: tuple = ()):
        with self._lock:
            return self.connection.execute(sql, params).fetchone()

    def _fetchall(self, sql: str, params: tuple = ()):
        with self._lock:
            return self.connection.execute(sql, params).fetchall()

    def _row_to_doc(self, row: sqlite3.Row, table_name: str) -> dict | None:
        if row is None:
            return None

        if table_name == self.services_collection_name:
            return {
                "_id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "internal_address": row["internal_address"],
                "port": row["port"],
                "protocol": row["protocol"],
                "category": row["category"],
            }

        if table_name == self.pending_collection_name:
            return {
                "_id": row["id"],
                "contact_methods": _load_json(row["contact_methods"]),
                "ip_address": row["ip_address"],
                "service": _load_json(row["service"]),
                "location": _load_json(row["location"]),
                "notes": row["notes"],
            }

        if table_name == self.allowed_collection_name:
            return {
                "_id": row["id"],
                "ip_address": row["ip_address"],
                "contact_methods": _load_json(row["contact_methods"]),
                "service_name": row["service_name"],
                "ExpireAt": _from_iso(row["ExpireAt"]),
            }

        if table_name == self.ignored_collection_name:
            return {
                "_id": row["id"],
                "contact_methods": _load_json(row["contact_methods"]),
                "ip_address": row["ip_address"],
                "service_name": row["service_name"],
            }

        if table_name == self.webhooks_collection_name:
            return {
                "_id": row["id"],
                "event": row["event"],
                "method": row["method"],
                "url": row["url"],
                "headers": _load_json(row["headers"]),
                "query_params": _load_json(row["query_params"]),
                "cookies": _load_json(row["cookies"]),
                "body": _load_json(row["body"]),
            }

        return {key: row[key] for key in row.keys()}

    async def create_pending_connection(
        self,
        contact_methods: ContactMethodsModel,
        remote_address,
        service,
        additional_notes,
        request_latitude,
        request_longitude,
    ) -> PendingConnectionDatabaseModel:

        document_payload = PendingConnectionDatabaseModel(
            contact_methods=contact_methods,
            ip_address=remote_address,
            service=service,
            notes=additional_notes,
            location=LocationRequestModel(lat=request_latitude, lon=request_longitude),
        )

        validated_document = document_payload.model_dump(mode="json", exclude={"id"})

        document_id = _generate_id()
        service_payload = validated_document.get("service") or {}

        self._execute(
            """
            INSERT INTO pending_connections
                (id, ip_address, service_name, contact_methods, service, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                validated_document.get("ip_address"),
                service_payload.get("name") if isinstance(service_payload, dict) else None,
                _dump_json(validated_document.get("contact_methods")),
                _dump_json(validated_document.get("service")),
                _dump_json(validated_document.get("location")),
                validated_document.get("notes"),
            ),
        )

        validated_document["_id"] = document_id
        return validated_document

    async def list_all_services(self):
        rows = self._fetchall("SELECT * FROM services")
        return [self._row_to_doc(row, self.services_collection_name) for row in rows]

    async def list_service_names(self) -> list[str]:
        rows = self._fetchall("SELECT DISTINCT name FROM services")
        return [row["name"] for row in rows]

    async def is_connection_ignored_for_service(self, ip_str: str, service_name: str) -> bool:
        """True when an admin denied a pending request with "also block this IP" for this service."""
        ips = _client_ip_query_variants(ip_str)
        if not ips or not service_name:
            return False
        placeholders = ",".join("?" for _ in ips)
        row = self._fetchone(
            f"SELECT id FROM ignored_collection WHERE ip_address IN ({placeholders}) AND service_name = ?",
            (*ips, service_name),
        )
        return row is not None

    async def has_active_pending_for_service(self, ip_str: str, service_name: str) -> bool:
        """True when this client already has a pending access request for the service."""
        ips = _client_ip_query_variants(ip_str)
        if not ips or not service_name:
            return False
        placeholders = ",".join("?" for _ in ips)
        row = self._fetchone(
            f"SELECT id FROM pending_connections WHERE ip_address IN ({placeholders}) AND service_name = ?",
            (*ips, service_name),
        )
        return row is not None

    async def has_active_allowed_for_service(self, ip_str: str, service_name: str) -> bool:
        """True when a non-expired allowed connection exists for this IP and service."""
        ips = _client_ip_query_variants(ip_str)
        if not ips or not service_name:
            return False
        placeholders = ",".join("?" for _ in ips)
        rows = self._fetchall(
            f"SELECT ExpireAt FROM allowed_connections WHERE ip_address IN ({placeholders}) AND service_name = ?",
            (*ips, service_name),
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for row in rows:
            exp = _from_iso(row["ExpireAt"])
            if exp is None or exp > now:
                return True
        return False

    async def get_service(self, service_name: str):
        row = self._fetchone("SELECT * FROM services WHERE name = ?", (service_name,))
        return self._row_to_doc(row, self.services_collection_name)

    async def create_service(self, service_name: str, description: str, internal_address: str, port: int, protocol: Literal["http", "https"]):

        service_payload = ServiceResponseModel(
            name=service_name,
            description=description,
            internal_address=internal_address,
            port=port,
            protocol=protocol
        )

        payload = service_payload.model_dump(mode="json")

        self._execute(
            """
            INSERT INTO services (id, name, description, internal_address, port, protocol, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _generate_id(),
                payload.get("name"),
                payload.get("description"),
                payload.get("internal_address"),
                payload.get("port"),
                payload.get("protocol"),
                payload.get("category"),
            ),
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

        payload = updated_service_payload.model_dump(mode="json")

        self._execute(
            """
            UPDATE services
            SET name = ?, description = ?, internal_address = ?, port = ?, protocol = ?, category = ?
            WHERE name = ?
            """,
            (
                payload.get("name"),
                payload.get("description"),
                payload.get("internal_address"),
                payload.get("port"),
                payload.get("protocol"),
                payload.get("category"),
                service_name,
            ),
        )

        return updated_service_payload

    async def delete_service(self, service_name):
        self._execute("DELETE FROM services WHERE name = ?", (service_name,))
        return

    async def get_all_documents(self, table_name: str = None):

        if table_name is None:
            table_name = self.pending_collection_name

        rows = self._fetchall(f"SELECT * FROM {table_name}")
        return [self._row_to_doc(row, table_name) for row in rows]

    async def get_document(self, document_id: str, table_name: str = None):

        if table_name is None:
            table_name = self.pending_collection_name

        row = self._fetchone(f"SELECT * FROM {table_name} WHERE id = ?", (document_id,))

        document = self._row_to_doc(row, table_name)

        if document is None:

            raise HTTPException(
                detail="The specified connection ID was not found",
                status_code=404
            )

        return document

    def _insert_allowed_row(self, payload: AllowedConnectionModel) -> str:
        document_id = _generate_id()
        self._execute(
            """
            INSERT INTO allowed_connections (id, ip_address, service_name, contact_methods, ExpireAt)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                document_id,
                str(payload.ip_address),
                payload.service_name,
                _dump_json(payload.contact_methods.model_dump(mode="json")),
                _to_iso(payload.ExpireAt),
            ),
        )
        return document_id

    async def _raise_if_active_allowed_duplicate(self, ip_str: str, service_name: str) -> None:
        rows = self._fetchall(
            "SELECT ExpireAt FROM allowed_connections WHERE ip_address = ? AND service_name = ?",
            (ip_str, service_name),
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for row in rows:
            exp = _from_iso(row["ExpireAt"])
            if exp is None or exp > now:
                raise HTTPException(
                    status_code=409,
                    detail="An active allowed connection already exists for this IP and service.",
                )

    async def accept_pending_connection(
        self,
        connection_id: MongoID,
        overrides: AcceptPendingConnectionRequestModel | None = None,
    ):

        await self.get_document(connection_id)

        pending_connection_payload: dict = self._row_to_doc(
            self._fetchone(
                "SELECT * FROM pending_connections WHERE id = ?", (connection_id,)
            ),
            self.pending_collection_name,
        )
        self._execute("DELETE FROM pending_connections WHERE id = ?", (connection_id,))

        requested_service: dict = pending_connection_payload.get("service") or {}
        ip_str = str(pending_connection_payload.get("ip_address"))

        if overrides is not None and overrides.explicit:
            service_name = overrides.service_name
            if not service_name:
                raise HTTPException(
                    status_code=400,
                    detail="service_name is required when explicit is true",
                )
            if not await self.get_service(service_name):
                raise HTTPException(
                    status_code=404,
                    detail="The specified service does not exist",
                )
            await self._raise_if_active_allowed_duplicate(ip_str, service_name)
            contact_methods = overrides.to_contact_methods()
            if overrides.expiry_mode == "inherit":
                if requested_service.get("expiry"):
                    connection_expiry = datetime.now(timezone.utc) + timedelta(
                        minutes=requested_service.get("expiry")
                    )
                else:
                    connection_expiry = None
            elif overrides.expiry_mode == "none":
                connection_expiry = None
            else:
                at = overrides.expire_at
                if at is None:
                    raise HTTPException(
                        status_code=400,
                        detail="expire_at is required when expiry_mode is at",
                    )
                if at.tzinfo is None:
                    connection_expiry = at.replace(tzinfo=timezone.utc)
                else:
                    connection_expiry = at.astimezone(timezone.utc)
        else:
            service_name = requested_service.get("name")
            if requested_service.get("expiry"):
                connection_expiry = datetime.now(timezone.utc) + timedelta(
                    minutes=requested_service.get("expiry")
                )
            else:
                connection_expiry = None
            contact_methods = pending_connection_payload.get("contact_methods")
            if service_name:
                await self._raise_if_active_allowed_duplicate(ip_str, service_name)

        allowed_connection_payload = AllowedConnectionModel(
            contact_methods=contact_methods,
            ip_address=pending_connection_payload.get("ip_address"),
            service_name=service_name,
            ExpireAt=connection_expiry,
        )

        self._insert_allowed_row(allowed_connection_payload)

        return allowed_connection_payload

    async def create_allowed_connection_admin(
        self,
        *,
        ip_address,
        service_name: str,
        contact_methods: ContactMethodsModel,
        expiry_minutes: int | None,
        expire_at: datetime | None = None,
    ) -> AllowedConnectionModel:

        if not await self.get_service(service_name):
            raise HTTPException(
                status_code=404,
                detail="The specified service does not exist",
            )

        ip_str = str(ip_address)

        await self._raise_if_active_allowed_duplicate(ip_str, service_name)

        if expire_at is not None:
            at = expire_at
            if at.tzinfo is None:
                connection_expiry = at.replace(tzinfo=timezone.utc)
            else:
                connection_expiry = at.astimezone(timezone.utc)
        elif expiry_minutes is not None:
            connection_expiry = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        else:
            connection_expiry = None

        allowed_connection_payload = AllowedConnectionModel(
            contact_methods=contact_methods,
            ip_address=ip_address,
            service_name=service_name,
            ExpireAt=connection_expiry,
        )

        document_id = self._insert_allowed_row(allowed_connection_payload)
        inserted = self._row_to_doc(
            self._fetchone("SELECT * FROM allowed_connections WHERE id = ?", (document_id,)),
            self.allowed_collection_name,
        )
        return AllowedConnectionModel.model_validate(inserted)

    async def update_allowed_connection(
        self,
        connection_id: MongoID,
        *,
        contact_methods: ContactMethodsModel,
        expiry_minutes: int | None,
        expire_at: datetime | None = None,
    ) -> AllowedConnectionModel:

        existing = self._fetchone(
            "SELECT id FROM allowed_connections WHERE id = ?", (connection_id,)
        )
        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="The specified connection ID was not found",
            )

        if expire_at is not None:
            at = expire_at
            if at.tzinfo is None:
                connection_expiry = at.replace(tzinfo=timezone.utc)
            else:
                connection_expiry = at.astimezone(timezone.utc)
        elif expiry_minutes is not None:
            connection_expiry = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        else:
            connection_expiry = None

        self._execute(
            """
            UPDATE allowed_connections
            SET contact_methods = ?, ExpireAt = ?
            WHERE id = ?
            """,
            (
                _dump_json(contact_methods.model_dump(mode="json")),
                _to_iso(connection_expiry),
                connection_id,
            ),
        )

        updated = self._row_to_doc(
            self._fetchone("SELECT * FROM allowed_connections WHERE id = ?", (connection_id,)),
            self.allowed_collection_name,
        )
        return AllowedConnectionModel.model_validate(updated)

    async def deny_pending_connection(self, connection_id: MongoID, ignore_connection=False):

        deleted_document: dict = self._row_to_doc(
            self._fetchone(
                "SELECT * FROM pending_connections WHERE id = ?", (connection_id,)
            ),
            self.pending_collection_name,
        )
        self._execute("DELETE FROM pending_connections WHERE id = ?", (connection_id,))

        service_payload: dict = deleted_document.get("service") or {}

        denied_connection = DeniedConnectionModel(
            id=connection_id,
            contact_methods=deleted_document.get("contact_methods"),
            ip_address=deleted_document.get("ip_address"),
            service_name=service_payload.get("name"),
        )

        return denied_connection

    async def ignore_connection(self, denied_connection: DeniedConnectionModel):

        self._execute(
            """
            INSERT INTO ignored_collection (id, ip_address, service_name, contact_methods)
            VALUES (?, ?, ?, ?)
            """,
            (
                denied_connection.id or _generate_id(),
                str(denied_connection.ip_address),
                denied_connection.service_name,
                _dump_json(denied_connection.contact_methods.model_dump(mode="json")),
            ),
        )

        return denied_connection

    async def revoke_connection(self, connection_id: MongoID):

        deleted_document: dict = self._row_to_doc(
            self._fetchone(
                "SELECT * FROM allowed_connections WHERE id = ?", (connection_id,)
            ),
            self.allowed_collection_name,
        )
        self._execute("DELETE FROM allowed_connections WHERE id = ?", (connection_id,))

        return deleted_document

    async def unignore_connection(self, connection_id: MongoID):

        deleted_document: dict = self._row_to_doc(
            self._fetchone(
                "SELECT * FROM ignored_collection WHERE id = ?", (connection_id,)
            ),
            self.ignored_collection_name,
        )
        self._execute("DELETE FROM ignored_collection WHERE id = ?", (connection_id,))

        return deleted_document

    async def get_webhook(self, event: str):
        row = self._fetchone("SELECT * FROM webhooks WHERE event = ?", (event,))
        return self._row_to_doc(row, self.webhooks_collection_name)

    async def create_webhook_request(self, http_request: HTTPRequest):

        payload = http_request.model_dump(mode="json")

        self._execute(
            """
            INSERT INTO webhooks (id, event, method, url, headers, query_params, cookies, body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _generate_id(),
                payload.get("event"),
                payload.get("method"),
                payload.get("url"),
                _dump_json(payload.get("headers")),
                _dump_json(payload.get("query_params")),
                _dump_json(payload.get("cookies")),
                _dump_json(payload.get("body")),
            ),
        )

        return await self.get_webhook(payload.get("event"))

    async def modify_webhook(self, event: str, update_fields: dict):
        """
        Modifies an existing webhook by updating only the specified fields.

        Args:
            event: The event name of the webhook to modify
            update_fields: Dictionary containing only the fields to update

        Returns:
            The updated webhook document or None if not found
        """

        fields_to_update = {k: v for k, v in update_fields.items() if v is not None}

        if not fields_to_update:
            return await self.get_webhook(event)

        json_columns = {"headers", "query_params", "cookies", "body"}
        allowed_columns = {"method", "url"} | json_columns

        assignments = []
        params = []
        for key, value in fields_to_update.items():
            if key not in allowed_columns:
                continue
            assignments.append(f"{key} = ?")
            params.append(_dump_json(value) if key in json_columns else value)

        if not assignments:
            return await self.get_webhook(event)

        params.append(event)
        self._execute(
            f"UPDATE webhooks SET {', '.join(assignments)} WHERE event = ?",
            tuple(params),
        )

        return await self.get_webhook(event)

    async def delete_webhook(self, event: str):
        """
        Deletes a webhook by its event name.

        Args:
            event: The event name of the webhook to delete

        Returns:
            The deleted document or None if not found
        """
        deleted_document = await self.get_webhook(event)
        self._execute("DELETE FROM webhooks WHERE event = ?", (event,))

        return deleted_document
