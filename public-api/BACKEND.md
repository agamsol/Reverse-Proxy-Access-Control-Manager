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
| `name`             | `str`                | Yes      | —           | max 200 chars | Public hostname / nginx `server_name` (e.g. `cdn.example.com`). Used by the guest portal and `GET /check-access` to match `?redirect=` URLs. |
| `description`      | `str` \| `null`       | No       | `null`      | max 200 chars | Service description             |
| `internal_address` | `IPvAnyAddress`      | No       | `127.0.0.1` | —             | Upstream backend address (not used for redirect matching) |
| `port`             | `int`                | No       | `80`        | —             | Port number                     |
| `protocol`         | `"http"` \| `"https"` | No       | `"http"`    | —             | Protocol                        |
| `category`         | `str` \| `null`       | No       | `null`      | max 200 chars | Optional UI grouping label on the access-request form |


---

## Access check

### `GET /check-access`

Check whether the **client IP** (from the incoming request, honoring proxy headers) has active access to the service implied by a redirect URL. Used by the guest portal “Check access” flow when the user arrives with `?redirect=https://…`.

**Auth:** None

**Query parameters:**

| Param      | Type  | Required | Description |
| ---------- | ----- | -------- | ----------- |
| `redirect` | `str` | Yes      | Absolute `http` or `https` URL of the protected resource (same value as the guest portal `?redirect=` query parameter). |

**Service resolution:**

- The redirect URL’s hostname is compared **only** to each catalog service’s `name` (case-insensitive, protocol/port/path stripped from the name if present).
- `internal_address` is **not** used for matching (many services may share the same upstream IP).
- If no catalog row matches, the response is HTTP `404` with `service_name: null`.

**Response** `CheckAccessResponseModel`:

| Field          | Type                | Constraints   | Description |
| -------------- | ------------------- | ------------- | ----------- |
| `ip_address`   | `IPvAnyAddress`     | —             | Client IP used for the lookup |
| `redirect`     | `str`               | —             | Echo of the normalized redirect URL |
| `service_name` | `str` \| `null`     | —             | Matched catalog `name`, or `null` when no service matches |
| `has_access`   | `bool`              | —             | `true` when a non-expired row exists in `allowed_connections` for this IP + service |
| `pending`      | `bool`              | default `false` | `true` when a pending request exists for this IP + service (only evaluated when `has_access` is `false`) |
| `message`      | `str`               | max 300 chars | Human-readable result |

**HTTP status on the response body** (body is always `CheckAccessResponseModel` JSON):

| Status | Condition |
| ------ | --------- |
| `200 OK` | `has_access` is `true` |
| `403 Forbidden` | Service matched but `has_access` is `false` (includes pending and not-yet-granted cases; see `pending`) |
| `404 Not Found` | No catalog service matches the redirect hostname |

**Errors:**

- `400 Bad Request` — Missing/empty `redirect`, non-`http`/`https` scheme, or invalid URL (`detail` is a string message).

**Example — access granted:**

```http
GET /check-access?redirect=https%3A%2F%2Fcdn.example.com%2F
```

```json
{
  "ip_address": "203.0.113.10",
  "redirect": "https://cdn.example.com/",
  "service_name": "cdn.example.com",
  "has_access": true,
  "pending": false,
  "message": "Your network address has access to this service."
}
```

**Example — pending approval:**

```json
{
  "ip_address": "203.0.113.10",
  "redirect": "https://cdn.example.com/",
  "service_name": "cdn.example.com",
  "has_access": false,
  "pending": true,
  "message": "A request from your network address is pending administrator approval."
}
```

**Example — unknown destination:**

```json
{
  "ip_address": "203.0.113.10",
  "redirect": "https://unknown.example.com/",
  "service_name": null,
  "has_access": false,
  "pending": false,
  "message": "No matching service was found for this destination."
}
```

**Notes:**

- IP matching treats `127.0.0.1` and `::ffff:127.0.0.1` as the same client where applicable (same as `POST /request-access`).
- Only the **matched** service is checked; a pending request for another service does not affect this result.
- `has_access` is `true` only when a row exists in `allowed_connections` for this IP + service and `ExpireAt` is `null` or still in the future. Administrators can change contact metadata and `ExpireAt` via `PATCH /connection/edit/{id}` on the **private API** (IP and service are fixed on that endpoint); the next `GET /check-access` call reflects the updated expiry.

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

    **`connection_ignored`** — An administrator denied a prior request with “also block this IP” for that service (the `ignored_collection` table in SQLite). The block is removed when an administrator un-ignores the address from the private admin UI.

    ```json
    {
      "code": "connection_ignored",
      "services": ["service-a"],
      "message": "This network address was blocked from submitting access requests for the following service(s). An administrator must remove the block before you can request access again."
    }
    ```

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

- For each valid service in `services`, creates a pending connection (persisted in SQLite) and may invoke the `pending.new` webhook if configured.
- **`403` pre-check:** requests are rejected when the client IP + service matches an **ignored** row (`ignored_collection`, from “deny and block IP”). IP matching treats `127.0.0.1` and `::ffff:127.0.0.1` as the same client where applicable.
- **Contact fields:** required-field validation uses the current contents of `data/contact-fields.json` (same source as `GET /config/contact-fields`).
- Revoking an allowed connection (`DELETE /connection/revoke/{id}` on the private API) removes active access only; it does **not** block future access requests. To block new requests from an IP, an administrator must deny a pending request with “also block this IP” (`ignored_collection`).
- Updating an allowed connection (`PATCH /connection/edit/{id}` on the private API) changes stored contact fields and `ExpireAt` only; it does not change IP or service, does not create or remove pending rows, and does not trigger webhooks. After expiry is shortened or cleared, `GET /check-access` may return `has_access: false` even though the row still exists until the proxy allow list is refreshed.

---

## Config

### `GET /config/contact-fields`

Get the per-field `visible` and `required` settings for the name, email, and phone inputs on the access-request form. Values are read from `data/contact-fields.json` on each request. Administrators update this file via the private API (`PUT /config/update-contact-fields`); changes apply immediately without restarting the public API.

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

- `visible: false` hides a field from the form; when `visible: true`, `required: true` shows a `*` in the UI and is enforced on `POST /request-access`.
- The file is re-read on each `GET /config/contact-fields` and each `POST /request-access` validation. Updates made through the private admin API take effect immediately.
- **Legacy format:** a bare boolean for a field (e.g. `"name": true`) is still accepted and means `{ "visible": true, "required": <bool> }`.
- For each missing field, the default is `{ "visible": true, "required": false }`. An absent or malformed file uses that default for all three fields.

---

## Endpoint Summary


| Auth | Method | Path                     | Description                                   |
| ---- | ------ | ------------------------ | --------------------------------------------- |
| No   | `GET`  | `/status`                | Service health status                         |
| No   | `GET`  | `/services`              | List all services                             |
| No   | `GET`  | `/check-access`          | Check client IP access for a redirect URL     |
| No   | `POST` | `/request-access`        | Submit a guest access request                 |
| No   | `GET`  | `/config/contact-fields` | Required/optional flags for contact fields    |


**Total: 5 endpoints** (all public)
