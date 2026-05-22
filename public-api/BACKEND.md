# Public API - Backend Documentation

Base URL: `http://localhost:8000`

## Middleware

- **ProxyHeadersMiddleware** — Trusted hosts: `["*"]`
- **Process Time Header** — Every response includes an `X-Process-Time` header with the request duration in seconds.

## Authentication

None. All endpoints are public.

---

## Health

### `GET /status`

Get service status.

**Auth:** None

**Response** `StatusResponseModel`:


| Field         | Type               | Description                              |
| ------------- | ------------------ | ---------------------------------------- |
| `version`     | `str`              | Service version (max 10 chars)           |
| `filesystem`  | `"nt"` \| `"posix"` | OS type                                  |
| `maintenance` | `bool`             | Whether the service is under maintenance |


---

## Services

### `GET /services`

Get a list of all services that exist in the database (for guests to choose what to request).

**Auth:** None

**Response** `list[ServiceResponseModel]`

`ServiceResponseModel`:


| Field              | Type                 | Required | Default     | Constraints   | Description                     |
| ------------------ | -------------------- | -------- | ----------- | ------------- | ------------------------------- |
| `name`             | `str`                | Yes      | —           | max 200 chars | Service name                    |
| `description`      | `str` \| `null`       | No       | `null`      | max 200 chars | Service description             |
| `internal_address` | `IPvAnyAddress`      | No       | `127.0.0.1` | —             | Internal address of the service |
| `port`             | `int`                | No       | `80`        | —             | Port number                     |
| `protocol`         | `"http"` \| `"https"` | No       | `"http"`    | —             | Protocol                        |


---

## Access requests

### `POST /request-access`

Submit a request for access to one or more services. For each requested service whose name exists in the database, the API creates a pending connection record and may trigger configured webhooks.

**Auth:** None

**Request Body** `AccessRequest` (JSON):


| Field             | Type                          | Required | Constraints   | Description                                      |
| ----------------- | ----------------------------- | -------- | ------------- | ------------------------------------------------ |
| `services`        | `list[ServiceItem]` \| `null` | No       | —             | Services to request; if missing or none valid, request fails |
| `contact_methods` | `ContactMethodsRequestModel`  | Yes      | —             | Requester contact details                        |
| `note`            | `str` \| `null`               | No       | max 200 chars | Optional note for administrators               |
| `location`        | `LocationRequestModel`        | Yes      | —             | Requester location                             |


`ContactMethodsRequestModel` (each field is required on the object but may be `null`):


| Field          | Type                    | Description        |
| -------------- | ----------------------- | ------------------ |
| `name`         | `str` \| `null`         | Requester name     |
| `email`        | `EmailStr` \| `null`    | Email address      |
| `phone_number` | `str` \| `null`         | Phone number       |


`ServiceItem`:


| Field    | Type           | Description                                      |
| -------- | -------------- | ------------------------------------------------ |
| `name`   | `str`          | Name of the service to request access to         |
| `expiry` | `int` \| `null` | Requested access duration in minutes (optional) |


`LocationRequestModel`:


| Field | Type             | Constraints | Description |
| ----- | ---------------- | ----------- | ----------- |
| `lat` | `float` \| `null` | -90 to 90   | Latitude    |
| `lon` | `float` \| `null` | -180 to 180 | Longitude   |


**Response** `RequestAccessResponseModel` (HTTP `201 Created`):


| Field                | Type                | Constraints   | Description                                      |
| -------------------- | ------------------- | ------------- | ------------------------------------------------ |
| `ip_address`         | `IPvAnyAddress`     | —             | Client IP used for the request                   |
| `services_requested` | `list[ServiceItem]` | —             | Subset of requested services that were accepted  |
| `message`            | `str`               | max 200 chars | Confirmation message                           |


**Errors:**

- `400 Bad Request` — No requested service names matched services in the database (`"No valid services were requested."`).
- `403 Forbidden` — The client IP may not submit a pending request for one or more requested services. The `detail` object always includes `code`, `services` (affected catalog names), and `message`:

    **`connection_ignored`** — An administrator denied a prior request with “also block this IP” for that service (MongoDB `ignored_collection`). The block is removed when an administrator un-ignores the address from the private admin UI.

    ```json
    {
      "code": "connection_ignored",
      "services": ["service-a"],
      "message": "This network address was blocked from submitting access requests for the following service(s). An administrator must remove the block before you can request access again."
    }
    ```

    **`connection_revoked`** — Access was **revoked** for that IP + service (`revoked_connections`). The block is removed when an administrator grants access again (accept pending or admin grant).

    ```json
    {
      "code": "connection_revoked",
      "services": ["service-a", "service-b"],
      "message": "Access for your network address to the following service(s) was revoked by an administrator. You cannot submit a new access request until access is granted again."
    }
    ```

    If both conditions apply to different services in the same request, **`connection_ignored` is returned first** (only the ignored subset appears in `services`).

- `409 Conflict` — The client already has a **pending** request and/or an **active allowed** connection for one or more of the requested services. No new pending rows are created. The `detail` object includes:

    **`request_access_conflict`** — Lists affected catalog names in `already_pending` and/or `already_allowed` (each may be an empty array; at least one list is non-empty).

    ```json
    {
      "code": "request_access_conflict",
      "already_pending": ["service-a"],
      "already_allowed": ["service-b"],
      "message": "One or more selected services cannot accept a new request from this address (a request is already pending or access is already active)."
    }
    ```

- `422 Unprocessable Entity` — One or more contact fields that are `visible` and `required` in `data/contact-fields.json` are missing or empty. The `detail` payload is:

    ```json
    {
      "message": "Required contact fields are missing.",
      "missing_fields": ["email", "phone_number"]
    }
    ```

**Side Effects:**

- For each valid service in `services`, creates a pending connection (MongoDB) and may invoke the `pending.new` webhook if configured.
- **`403` pre-checks:** requests are rejected when the client IP + service matches an **ignored** row (`ignored_collection`, from “deny and block IP”) or a **revoked** row (`revoked_connections`, from revoking an allowed connection). IP matching treats `127.0.0.1` and `::ffff:127.0.0.1` as the same client where applicable.
- When an administrator **revokes** an allowed connection, the server records that **IP + service** pair in MongoDB (`revoked_connections`). While that record exists, `POST /request-access` returns **403** with `code: connection_revoked` for that pair. The block is removed when access is granted again (pending accept or admin grant).

---

## Config

### `GET /config/contact-fields`

Get the per-field `visible` and `required` settings for the name, email, and phone inputs on the access-request form. The values come from `data/contact-fields.json` at service start-up: `visible: false` hides a field; when `visible: true`, `required: true` shows a `*` in the UI and is enforced; `visible: true` and `required: false` means the field is shown as optional. The same rules are applied server-side on `POST /request-access` (only fields that are both visible and required are validated for non-empty input).

**Auth:** None

**Response** `ContactFieldsConfigResponseModel` (HTTP `200 OK`):

For each of `name`, `email`, and `phone_number`, the value is a `ContactFieldFlagsModel` object:

| Field      | Type   | Description |
| ---------- | ------ | ----------- |
| `visible`  | `bool` | If `true`, the field is shown; if `false`, it is not rendered and the client should send `null` for that property. |
| `required` | `bool` | If `true` and `visible` is `true`, the value is mandatory; if `visible` is `false`, `required` is ignored. |


**Example file / response shape:**

```json
{
  "name": { "visible": true, "required": true },
  "email": { "visible": true, "required": false },
  "phone_number": { "visible": false, "required": false }
}
```

**Notes:**

- The file is read once at service start-up; changes to `data/contact-fields.json` require a restart to take effect.
- **Legacy format:** a bare boolean for a field (e.g. `"name": true`) is still accepted and means `{ "visible": true, "required": <bool> }`.
- For each missing field, the default is `{ "visible": true, "required": false }`. An absent or malformed file uses that default for all three fields.

---

## Endpoint Summary


| Auth | Method | Path                     | Description                                   |
| ---- | ------ | ------------------------ | --------------------------------------------- |
| No   | `GET`  | `/status`                | Service health status                         |
| No   | `GET`  | `/services`              | List all services                             |
| No   | `POST` | `/request-access`        | Submit a guest access request                 |
| No   | `GET`  | `/config/contact-fields` | Required/optional flags for contact fields    |


**Total: 4 endpoints** (all public)
