# Private API - Backend Documentation

Base URL: `http://localhost:8001`

## Middleware

- **ProxyHeadersMiddleware** — Trusted hosts: `["*"]`
- **Process Time Header** — Every response includes an `X-Process-Time` header with the request duration in seconds.

## Authentication

All endpoints except `GET /status` and `POST /auth/token` require a Bearer token via OAuth2. Token URL: `/auth/token`.

---

## Health

### `GET /status`

Get service status.

**Auth:** None

**Response** `StatusResponseModel`:

| Field | Type | Description |
|---|---|---|
| `version` | `str` | Service version (max 10 chars) |
| `filesystem` | `"nt"` \| `"posix"` | OS type |
| `maintenance` | `bool` | Whether the service is under maintenance |

---

## Authentication

### `POST /auth/token`

Login to obtain a JWT token.

**Auth:** None

**Request** `application/x-www-form-urlencoded`:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `username` | `str` | Yes | 3–20 chars | Administrator username |
| `password` | `str` | Yes | max 199 chars | Administrator password |
| `remember_me` | `bool` | No (default `false`) | — | `false` = 24h expiry, `true` = 60 day expiry |

**Response** `LoginResponseModel`:

| Field | Type | Description |
|---|---|---|
| `access_token` | `str` | JWT token |
| `token_type` | `str` | Always `"bearer"` |

**Errors:**
- `401 Unauthorized` — Incorrect username or password.

---

### `GET /auth/me`

Get the currently authenticated user's information.

**Auth:** Bearer token

**Response** `AuthenticatedUserResponseModel`:

| Field | Type | Description |
|---|---|---|
| `payload` | `TokenPayloadModel` | Decoded token payload |
| `message` | `str` | Confirmation message (max 50 chars) |

`TokenPayloadModel`:

| Field | Type | Description |
|---|---|---|
| `username` | `str` | 3–20 chars |
| `exp` | `int` | Expiration as UNIX timestamp (10-digit) |

---

## Service Management

All endpoints in this section require a Bearer token.

### `GET /service/get-service-list`

Get all available services.

**Response** `list[ServiceResponseModel]`

`ServiceResponseModel`:

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `name` | `str` | Yes | — | max 200 chars | **Public hostname** / nginx `server_name` (e.g. `cdn.example.com`). Also used as the proxy allow-list filename stem and as the guest portal redirect key: the public API matches `?redirect=` URLs to services by this field only (see `GET /check-access` on the public API). |
| `description` | `str` \| `null` | No | `null` | max 200 chars | Service description |
| `internal_address` | `IPvAnyAddress` | No | `127.0.0.1` | — | Upstream backend address the reverse proxy forwards to (not used for guest redirect matching) |
| `port` | `int` | No | `80` | — | Upstream port |
| `protocol` | `"http"` \| `"https"` | No | `"http"` | — | Upstream protocol |
| `category` | `str` \| `null` | No | `null` | max 200 chars | Optional label for grouping services in the public access-request UI |

**Guest portal integration:** When a user is redirected to the public API with `?redirect=https://<hostname>/…`, the hostname must equal a service `name` in this catalog for access checks and service picker pre-selection to work. `internal_address` may be shared across services (e.g. `127.0.0.1`) and must not duplicate another service’s public hostname.

---

### `POST /service/create`

Create a new service.

**Request Body** `ServiceResponseModel` (JSON):

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `name` | `str` | Yes | — | max 200 chars; should be the public FQDN (`server_name`) |
| `description` | `str` \| `null` | No | `null` | max 200 chars |
| `internal_address` | `IPvAnyAddress` | No | `127.0.0.1` | — |
| `port` | `int` | No | `80` | — |
| `protocol` | `"http"` \| `"https"` | No | `"http"` | — |
| `category` | `str` \| `null` | No | `null` | max 200 chars |

**Response:** `ServiceResponseModel`

**Errors:**
- `409 Conflict` — Service name already exists.

---

### `PATCH /service/edit/{service_name}`

Edit an existing service's information.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `service_name` | `str` | max 200 chars |

**Request Body** `ServiceEditRequestModel` (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `str` \| `null` | No | New service name |
| `description` | `str` \| `null` | No | max 200 chars |
| `internal_address` | `IPvAnyAddress` \| `null` | No | New internal address |
| `port` | `int` \| `null` | No | New port |
| `protocol` | `"http"` \| `"https"` \| `null` | No | New protocol |

**Response:** `ServiceResponseModel`

**Errors:**
- `404 Not Found` — Service does not exist.

---

### `DELETE /service/delete/{service_name}`

Delete a service.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `service_name` | `str` | max 200 chars |

**Response:**

| Field | Type | Description |
|---|---|---|
| `service` | `str` | Name of the deleted service |
| `message` | `str` | Confirmation message |

**Errors:**
- `404 Not Found` — Service does not exist.

---

## Pending Connections Management

All endpoints in this section require a Bearer token.

### `GET /pending/get-pending-connections`

List all pending connection requests.

**Response** `list[PendingConnectionDatabaseModel]`

`PendingConnectionDatabaseModel`:

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | `MongoID` \| `null` | No | 24-char hex ObjectId |
| `contact_methods` | `ContactMethodsModel` | Yes | Requester's contact info |
| `ip_address` | `IPvAnyAddress` | Yes | Requester's IP address |
| `service` | `ServiceItem` \| `null` | No | Requested service |
| `location` | `LocationRequestModel` | Yes | Requester's geolocation |
| `notes` | `str` \| `null` | No | Note from the requester (max 200 chars) |

`ContactMethodsModel`:

| Field | Type | Description |
|---|---|---|
| `name` | `str` \| `null` | Name (max 32 chars) |
| `email` | `Dict[EmailStr, bool]` \| `null` | Email address with verification status |
| `phone_number` | `Dict[str \| null, bool]` \| `null` | Phone number with verification status |

`ServiceItem`:

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Name of the service to request access to |
| `expiry` | `int` \| `null` | Requested access duration in minutes |

`LocationRequestModel`:

| Field | Type | Constraints | Description |
|---|---|---|---|
| `lat` | `float` \| `null` | -90 to 90 | Latitude |
| `lon` | `float` \| `null` | -180 to 180 | Longitude |

---

### `POST /pending/accept/{id}`

Accept a pending connection request and grant access.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `id` | `MongoID` | 24-char hex string |

**Request Body (optional JSON)** `AcceptPendingConnectionRequestModel`:

Omit the body, send an empty object `{}`, or send `{ "explicit": false }` for **legacy** behavior: the allowed row is built only from the pending document (same as older clients). The admin UI sends `explicit: true` with edited fields.

| Field | Type | Required | Description |
|---|---|---|---|
| `explicit` | `bool` | No | Default `false`. When `true`, the other fields below are applied (admin overrides). |
| `service_name` | `str` | Yes when `explicit` | Must match an existing catalog service `name` (max 200 chars, trimmed). |
| `contact_name` | `str` \| `null` | No | Stored on the grant (max 32 chars). |
| `contact_email` | `EmailStr` \| `null` | No | Stored as `{ email: false }` when set. |
| `contact_phone` | `str` \| `null` | No | Stored as `{ phone: false }` when non-empty. |
| `expiry_mode` | `"inherit"` \| `"none"` \| `"at"` | No | Default `"inherit"`. Ignored unless `explicit` is `true`. |
| `expire_at` | `datetime` \| `null` | When `expiry_mode` is `"at"` | Absolute expiry instant (ISO-8601 in JSON). Must be in the future. Ignored for `inherit` / `none`. |

**`expiry_mode` (when `explicit` is `true`):**

- **`inherit`** — `ExpireAt` is computed from the pending row’s `service.expiry` minutes from **approval time** (same as legacy). If the request had no duration, access does not expire.
- **`none`** — `ExpireAt` is `null` (no expiry), regardless of what the requester asked for.
- **`at`** — `ExpireAt` is exactly `expire_at` (admin-chosen wall time).

**Errors:**

- `404 Not Found` — Pending id not found, or `explicit` is `true` and `service_name` is not in the catalog.
- `409 Conflict` — An **active** allowed row already exists for the same IP and chosen `service_name`.
- `422 Unprocessable Entity` — Validation errors (e.g. `expire_at` in the past when `expiry_mode` is `at`).

**Response** `AllowedConnectionModel`:

| Field | Type | Description |
|---|---|---|
| `_id` | `MongoID` \| `null` | Document ID |
| `ip_address` | `IPvAnyAddress` | Allowed IP address |
| `contact_methods` | `ContactMethodsModel` | Contact info |
| `service_name` | `str` | Service granted access to |
| `ExpireAt` | `datetime` \| `null` | When access expires |

**Side Effects:**
- Triggers `pending.accepted` webhook event.

---

### `DELETE /pending/deny/{id}`

Deny a pending connection request, optionally ignoring the IP to prevent future requests.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `id` | `MongoID` | 24-char hex string |

**Request Body** `DenyConnectionRequestModel` (JSON):

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `ignore_connection` | `bool` | No | `false` | Block this IP from sending future requests |

**Response** `DeniedSuccessResponseModel`:

| Field | Type | Description |
|---|---|---|
| `message` | `str` | Confirmation message (max 100 chars) |
| `ip_address` | `IPvAnyAddress` | The denied IP address |
| `service_name` | `str` | Applicable service |
| `ignore` | `bool` | Whether the IP was added to the ignore list |

**Side Effects:**
- Triggers `pending.denied` webhook event.
- If `ignore_connection` is `true`, adds the IP to MongoDB `ignored_collection`. While that row exists, `POST /request-access` on the public API returns **403** with `code: connection_ignored` for that IP + service pair.

---

## Connections Management

All endpoints in this section require a Bearer token.

### `GET /connection/get-connection-list`

List all currently allowed connections.

**Response** `list[AllowedConnectionModel]`:

| Field | Type | Description |
|---|---|---|
| `_id` | `MongoID` \| `null` | Document ID |
| `ip_address` | `IPvAnyAddress` | Allowed IP address |
| `contact_methods` | `ContactMethodsModel` | Contact info |
| `service_name` | `str` | Service with access |
| `ExpireAt` | `datetime` \| `null` | When access expires |

---

### `POST /connection/create-allowed`

Create an allowed connection **without** a prior pending request (admin grant). Stored documents match the shape produced when accepting a pending request.

**Auth:** Bearer token (same as all other private routes after login — **administrator JWT only** in this deployment).

**Request Body** `AdminCreateAllowedConnectionRequestModel` (JSON):

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `ip_address` | `IPvAnyAddress` | Yes | — | Client IP to allow through the proxy for this service |
| `service_name` | `str` | Yes | 1–200 chars, trimmed | Must match an existing service `name` in the catalog |
| `contact_name` | `str` \| `null` | No | max 32 chars | Stored on the grant; if omitted or blank, defaults to `"(admin grant)"` |
| `contact_email` | `EmailStr` \| `null` | No | — | Stored as a single-entry map `{ email: false }` like pending flows |
| `contact_phone` | `str` \| `null` | No | max 64 chars | Stored as a single-entry map `{ phone: false }` when non-empty |
| `expiry_minutes` | `int` \| `null` | No | 1–525600 when set | Minutes from **now** until `ExpireAt`; omit or `null` for **no expiry** (ignored if `expire_at` is set) |
| `expire_at` | `datetime` \| `null` | No | Must be **in the future** when set | Absolute UTC expiry; when set, **overrides** `expiry_minutes` |

**Response:** `AllowedConnectionModel` (HTTP **201 Created**)

**Errors:**
- `404 Not Found` — No service with the given `service_name`.
- `409 Conflict` — An **active** allowed row already exists for the same `ip_address` + `service_name` (no expiry or expiry still in the future).
- `422 Unprocessable Entity` — Validation errors (e.g. `expire_at` in the past, or both `expire_at` and invalid `expiry_minutes`).

**Side effects:** None (no webhook; unlike `POST /pending/accept/{id}`).

---

### `PATCH /connection/edit/{id}`

Update contact details and expiry on an existing allowed connection. **`ip_address` and `service_name` are not changed** (the admin UI treats them as read-only).

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `id` | `MongoID` | 24-char hex string |

**Request Body** `AdminUpdateAllowedConnectionRequestModel` (JSON):

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `contact_name` | `str` \| `null` | No | max 32 chars | Replaces stored name; blank or omitted becomes `null` |
| `contact_email` | `EmailStr` \| `null` | No | — | Stored as a single-entry map `{ email: false }` when set; `null` clears email |
| `contact_phone` | `str` \| `null` | No | max 64 chars | Stored as a single-entry map `{ phone: false }` when non-empty; `null` clears phone |
| `expiry_minutes` | `int` \| `null` | No | 1–525600 when set | Minutes from **now** until `ExpireAt`; omit or `null` for **no expiry** (ignored if `expire_at` is set) |
| `expire_at` | `datetime` \| `null` | No | Must be **in the future** when set | Absolute UTC expiry; when set, **overrides** `expiry_minutes` |

When both `expiry_minutes` and `expire_at` are omitted or `null`, access **does not expire** (`ExpireAt` is set to `null`).

**Response:** `AllowedConnectionModel` (HTTP **200 OK**)

**Errors:**
- `404 Not Found` — No allowed connection with the given `id`.
- `422 Unprocessable Entity` — Validation errors (e.g. `expire_at` in the past, or invalid `expiry_minutes`).

**Side effects:** None (no webhook). The proxy listener picks up the new `ExpireAt` on its next allow-list refresh; until then, `GET /check-access` on the public API also reflects the updated expiry on the next lookup.

---

### `DELETE /connection/revoke/{id}`

Revoke access for a specific allowed connection.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `id` | `MongoID` | 24-char hex string |

**Response:** `AllowedConnectionModel`

**Side Effects:**
- Removes the document from `allowed_connections` (active proxy access ends when the proxy listener refreshes its allow list).
- Does **not** add the IP to `ignored_collection`; the client may submit a new access request immediately unless separately blocked.
- Triggers `connection.revoked` webhook event.

---

### `GET /connection/ignored/get-ignored-list`

List all ignored (blocked) IP addresses.

**Response** `list[DeniedConnectionModel]`:

| Field | Type | Description |
|---|---|---|
| `_id` | `MongoID` \| `null` | Document ID |
| `contact_methods` | `ContactMethodsModel` | Contact info |
| `ip_address` | `IPvAnyAddress` | Ignored IP address |
| `service_name` | `str` | Applicable service |

---

### `POST /connection/ignored/remove/{id}`

Remove an IP address from the ignored list, allowing it to send requests again.

**Path Parameters:**

| Param | Type | Constraints |
|---|---|---|
| `id` | `MongoID` | 24-char hex string |

**Response:** `DeniedConnectionModel`

---

## Webhook Management

All endpoints in this section require a Bearer token.

Webhooks allow sending HTTP requests when specific events occur. Webhook bodies support Jinja2 template rendering with event context data.

**Available Events:**
- `pending.new` — A new connection request was submitted.
- `pending.accepted` — A pending connection was accepted.
- `pending.denied` — A pending connection was denied.
- `connection.revoked` — An allowed connection was revoked.

### `GET /webhook/get-webhook-list`

List all configured webhooks.

**Response** `list[HTTPRequest]`

`HTTPRequest`:

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | `"pending.new"` \| `"pending.accepted"` \| `"pending.denied"` \| `"connection.revoked"` | Yes | Trigger event |
| `method` | `"GET"` \| `"HEAD"` \| `"POST"` \| `"PUT"` \| `"DELETE"` | Yes | HTTP method |
| `url` | `str` | Yes | Request URL |
| `headers` | `Dict[str, Any]` \| `null` | No | Request headers |
| `query_params` | `Dict[str, Any]` \| `null` | No | Query parameters |
| `cookies` | `Dict[str, Any]` \| `null` | No | Cookies |
| `body` | `Dict[str, Any]` \| `null` | No | Request body |

---

### `POST /webhook/add-webhook`

Create a webhook for a specific event. Each event can only have one webhook.

**Request Body** `HTTPRequest` (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | event literal | Yes | Trigger event |
| `method` | HTTP method literal | Yes | HTTP method to use |
| `url` | `str` | Yes | URL to send the request to |
| `headers` | `Dict[str, Any]` \| `null` | No | Custom headers |
| `query_params` | `Dict[str, Any]` \| `null` | No | Query parameters |
| `cookies` | `Dict[str, Any]` \| `null` | No | Cookies |
| `body` | `Dict[str, Any]` \| `null` | No | Request body |

**Response** `CreateWebhookResponseModel`:

All fields from `HTTPRequest` plus:

| Field | Type | Description |
|---|---|---|
| `message` | `str` | `"The webhook has been successfully created!"` |

**Errors:**
- `409 Conflict` — A webhook already exists for this event.

---

### `DELETE /webhook/remove-webhook`

Remove a webhook for a specific event.

**Request Body** `DeleteWebhookRequestModel` (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | event literal | Yes | Event to remove the webhook for |

**Response** `DeleteWebhookResponseModel`:

| Field | Type | Description |
|---|---|---|
| `event` | event literal | The event that was removed |
| `message` | `str` | `"The webhook has been successfully deleted!"` |

**Errors:**
- `404 Not Found` — No webhook exists for this event.

---

### `PATCH /webhook/modify-webhook`

Modify an existing webhook's details. Only provided fields are updated.

**Request Body** `ModifyWebhookRequestModel` (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | event literal | Yes | Event identifier (cannot be changed) |
| `method` | HTTP method literal \| `null` | No | New HTTP method |
| `url` | `str` \| `null` | No | New URL |
| `headers` | `Dict[str, Any]` \| `null` | No | New headers |
| `query_params` | `Dict[str, Any]` \| `null` | No | New query parameters |
| `cookies` | `Dict[str, Any]` \| `null` | No | New cookies |
| `body` | `Dict[str, Any]` \| `null` | No | New request body |

**Response** `ModifyWebhookResponseModel`:

All fields from `HTTPRequest` plus:

| Field | Type | Description |
|---|---|---|
| `message` | `str` | `"The webhook has been successfully modified!"` |

**Errors:**
- `404 Not Found` — No webhook exists for this event.

---

## Configuration

All endpoints in this section require a Bearer token.

Settings are stored in `data/contact-fields.json` on disk. Updates via the private API take effect immediately on the public API (each guest request re-reads the file).

### `GET /config/get-contact-fields`

Get the current guest access form contact field settings.

**Response** `ContactFieldsConfigResponseModel`:

| Field | Type | Description |
|---|---|---|
| `name` | `ContactFieldFlagsModel` | Name field settings |
| `email` | `ContactFieldFlagsModel` | Email field settings |
| `phone_number` | `ContactFieldFlagsModel` | Phone field settings |

`ContactFieldFlagsModel`:

| Field | Type | Description |
|---|---|---|
| `visible` | `bool` | If `true`, the field is shown on the public access form |
| `required` | `bool` | If `true` and `visible` is `true`, the field is mandatory on `POST /request-access` |

---

### `PUT /config/update-contact-fields`

Replace the contact field settings written to `data/contact-fields.json`.

**Request Body** `ContactFieldsConfigResponseModel` (JSON):

Same shape as the GET response. If `visible` is `false`, `required` is stored as `false` regardless of the submitted value.

**Response:** `ContactFieldsConfigResponseModel`

**Errors:**
- `422 Unprocessable Entity` — Validation errors (e.g. `required: true` with `visible: false`).

---

## Endpoint Summary

| Auth | Method | Path | Description |
|---|---|---|---|
| No | `GET` | `/status` | Service health status |
| No | `POST` | `/auth/token` | Login for JWT token |
| Yes | `GET` | `/auth/me` | Current authenticated user |
| Yes | `GET` | `/service/get-service-list` | List all services |
| Yes | `POST` | `/service/create` | Create a service |
| Yes | `PATCH` | `/service/edit/{service_name}` | Edit a service |
| Yes | `DELETE` | `/service/delete/{service_name}` | Delete a service |
| Yes | `GET` | `/pending/get-pending-connections` | List pending requests |
| Yes | `POST` | `/pending/accept/{id}` | Accept a pending request (optional JSON overrides) |
| Yes | `DELETE` | `/pending/deny/{id}` | Deny a pending request |
| Yes | `GET` | `/connection/get-connection-list` | List allowed connections |
| Yes | `POST` | `/connection/create-allowed` | Admin grant without a pending request |
| Yes | `PATCH` | `/connection/edit/{id}` | Update allowed connection contact and expiry |
| Yes | `DELETE` | `/connection/revoke/{id}` | Revoke an allowed connection |
| Yes | `GET` | `/connection/ignored/get-ignored-list` | List ignored IPs |
| Yes | `POST` | `/connection/ignored/remove/{id}` | Unignore an IP address |
| Yes | `GET` | `/webhook/get-webhook-list` | List all webhooks |
| Yes | `POST` | `/webhook/add-webhook` | Create a webhook |
| Yes | `DELETE` | `/webhook/remove-webhook` | Remove a webhook |
| Yes | `PATCH` | `/webhook/modify-webhook` | Modify a webhook |
| Yes | `GET` | `/config/get-contact-fields` | Get guest contact field settings |
| Yes | `PUT` | `/config/update-contact-fields` | Update guest contact field settings |

**Total: 22 endpoints** (2 public, 20 protected by Bearer token)
