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


| Field         | Type               | Description                              |
| ------------- | ------------------ | ---------------------------------------- |
| `version`     | `str`              | Service version (max 10 chars)           |
| `filesystem`  | `"nt"` | `"posix"` | OS type                                  |
| `maintenance` | `bool`             | Whether the service is under maintenance |


---

## Authentication

### `POST /auth/token`

Login to obtain a JWT token.

**Auth:** None

**Request** `application/x-www-form-urlencoded`:


| Field         | Type   | Required             | Constraints   | Description                                  |
| ------------- | ------ | -------------------- | ------------- | -------------------------------------------- |
| `username`    | `str`  | Yes                  | 3–20 chars    | Administrator username                       |
| `password`    | `str`  | Yes                  | max 199 chars | Administrator password                       |
| `remember_me` | `bool` | No (default `false`) | —             | `false` = 24h expiry, `true` = 60 day expiry |


**Response** `LoginResponseModel`:


| Field          | Type  | Description       |
| -------------- | ----- | ----------------- |
| `access_token` | `str` | JWT token         |
| `token_type`   | `str` | Always `"bearer"` |


**Errors:**

- `401 Unauthorized` — Incorrect username or password.

---

### `GET /auth/me`

Get the currently authenticated user's information.

**Auth:** Bearer token

**Response** `AuthenticatedUserResponseModel`:


| Field     | Type                | Description                         |
| --------- | ------------------- | ----------------------------------- |
| `payload` | `TokenPayloadModel` | Decoded token payload               |
| `message` | `str`               | Confirmation message (max 50 chars) |


`TokenPayloadModel`:


| Field      | Type  | Description                             |
| ---------- | ----- | --------------------------------------- |
| `username` | `str` | 3–20 chars                              |
| `exp`      | `int` | Expiration as UNIX timestamp (10-digit) |


---

## Service Management

All endpoints in this section require a Bearer token.

### `GET /service/get-service-list`

Get all available services.

**Response** `list[ServiceResponseModel]`

`ServiceResponseModel`:


| Field              | Type                 | Required | Default     | Constraints   | Description                     |
| ------------------ | -------------------- | -------- | ----------- | ------------- | ------------------------------- |
| `name`             | `str`                | Yes      | —           | max 200 chars | Service name                    |
| `description`      | `str` | `null`       | No       | `null`      | max 200 chars | Service description             |
| `internal_address` | `IPvAnyAddress`      | No       | `127.0.0.1` | —             | Internal address of the service |
| `port`             | `int`                | No       | `80`        | —             | Port number                     |
| `protocol`         | `"http"` | `"https"` | No       | `"http"`    | —             | Protocol                        |


---

### `POST /service/create`

Create a new service.

**Request Body** `ServiceResponseModel` (JSON):


| Field              | Type                 | Required | Default     | Constraints   |
| ------------------ | -------------------- | -------- | ----------- | ------------- |
| `name`             | `str`                | Yes      | —           | max 200 chars |
| `description`      | `str` | `null`       | No       | `null`      | max 200 chars |
| `internal_address` | `IPvAnyAddress`      | No       | `127.0.0.1` | —             |
| `port`             | `int`                | No       | `80`        | —             |
| `protocol`         | `"http"` | `"https"` | No       | `"http"`    | —             |


**Response:** `ServiceResponseModel`

**Errors:**

- `409 Conflict` — Service name already exists.

---

### `PATCH /service/edit/{service_name}`

Edit an existing service's information.

**Path Parameters:**


| Param          | Type  | Constraints   |
| -------------- | ----- | ------------- |
| `service_name` | `str` | max 200 chars |


**Request Body** `ServiceEditRequestModel` (JSON):


| Field              | Type                          | Required | Description          |
| ------------------ | ----------------------------- | -------- | -------------------- |
| `name`             | `str` | `null`                | No       | New service name     |
| `description`      | `str` | `null`                | No       | max 200 chars        |
| `internal_address` | `IPvAnyAddress` | `null`      | No       | New internal address |
| `port`             | `int` | `null`                | No       | New port             |
| `protocol`         | `"http"` | `"https"` | `null` | No       | New protocol         |


**Response:** `ServiceResponseModel`

**Errors:**

- `404 Not Found` — Service does not exist.

---

### `DELETE /service/delete/{service_name}`

Delete a service.

**Path Parameters:**


| Param          | Type  | Constraints   |
| -------------- | ----- | ------------- |
| `service_name` | `str` | max 200 chars |


**Response:**


| Field     | Type  | Description                 |
| --------- | ----- | --------------------------- |
| `service` | `str` | Name of the deleted service |
| `message` | `str` | Confirmation message        |


**Errors:**

- `404 Not Found` — Service does not exist.

---

## Pending Connections Management

All endpoints in this section require a Bearer token.

### `GET /pending/get-pending-connections`

List all pending connection requests.

**Response** `list[PendingConnectionDatabaseModel]`

`PendingConnectionDatabaseModel`:


| Field             | Type                   | Required | Description                             |
| ----------------- | ---------------------- | -------- | --------------------------------------- |
| `_id`             | `MongoID` | `null`     | No       | 24-char hex ObjectId                    |
| `contact_methods` | `ContactMethodsModel`  | Yes      | Requester's contact info                |
| `ip_address`      | `IPvAnyAddress`        | Yes      | Requester's IP address                  |
| `service`         | `ServiceItem` | `null` | No       | Requested service                       |
| `location`        | `LocationRequestModel` | Yes      | Requester's geolocation                 |
| `notes`           | `str` | `null`         | No       | Note from the requester (max 200 chars) |


`ContactMethodsModel`:


| Field          | Type                              | Description                            |
| -------------- | --------------------------------- | -------------------------------------- |
| `name`         | `str` | `null`                    | Name (max 32 chars)                    |
| `email`        | `Dict[EmailStr, bool]` | `null`   | Email address with verification status |
| `phone_number` | `Dict[str | null, bool]` | `null` | Phone number with verification status  |


`ServiceItem`:


| Field    | Type           | Description                              |
| -------- | -------------- | ---------------------------------------- |
| `name`   | `str`          | Name of the service to request access to |
| `expiry` | `int` | `null` | Requested access duration in minutes     |


`LocationRequestModel`:


| Field | Type             | Constraints | Description |
| ----- | ---------------- | ----------- | ----------- |
| `lat` | `float` | `null` | -90 to 90   | Latitude    |
| `lon` | `float` | `null` | -180 to 180 | Longitude   |


---

### `POST /pending/accept/{id}`

Accept a pending connection request and grant access.

**Path Parameters:**


| Param | Type      | Constraints        |
| ----- | --------- | ------------------ |
| `id`  | `MongoID` | 24-char hex string |


**Response** `AllowedConnectionModel`:


| Field             | Type                  | Description               |
| ----------------- | --------------------- | ------------------------- |
| `_id`             | `MongoID` | `null`    | Document ID               |
| `ip_address`      | `IPvAnyAddress`       | Allowed IP address        |
| `contact_methods` | `ContactMethodsModel` | Contact info              |
| `service_name`    | `str`                 | Service granted access to |
| `ExpireAt`        | `datetime` | `null`   | When access expires       |


**Side Effects:**

- Triggers `pending.accepted` webhook event.

---

### `DELETE /pending/deny/{id}`

Deny a pending connection request, optionally ignoring the IP to prevent future requests.

**Path Parameters:**


| Param | Type      | Constraints        |
| ----- | --------- | ------------------ |
| `id`  | `MongoID` | 24-char hex string |


**Request Body** `DenyConnectionRequestModel` (JSON):


| Field               | Type   | Required | Default | Description                                |
| ------------------- | ------ | -------- | ------- | ------------------------------------------ |
| `ignore_connection` | `bool` | No       | `false` | Block this IP from sending future requests |


**Response** `DeniedSuccessResponseModel`:


| Field          | Type            | Description                                 |
| -------------- | --------------- | ------------------------------------------- |
| `message`      | `str`           | Confirmation message (max 100 chars)        |
| `ip_address`   | `IPvAnyAddress` | The denied IP address                       |
| `service_name` | `str`           | Applicable service                          |
| `ignore`       | `bool`          | Whether the IP was added to the ignore list |


**Side Effects:**

- Triggers `pending.denied` webhook event.
- If `ignore_connection` is `true`, adds the IP to the ignored connections list.

---

## Connections Management

All endpoints in this section require a Bearer token.

### `GET /connection/get-connection-list`

List all currently allowed connections.

**Response** `list[AllowedConnectionModel]`:


| Field             | Type                  | Description         |
| ----------------- | --------------------- | ------------------- |
| `_id`             | `MongoID` | `null`    | Document ID         |
| `ip_address`      | `IPvAnyAddress`       | Allowed IP address  |
| `contact_methods` | `ContactMethodsModel` | Contact info        |
| `service_name`    | `str`                 | Service with access |
| `ExpireAt`        | `datetime` | `null`   | When access expires |


---

### `DELETE /connection/revoke/{id}`

Revoke access for a specific allowed connection.

**Path Parameters:**


| Param | Type      | Constraints        |
| ----- | --------- | ------------------ |
| `id`  | `MongoID` | 24-char hex string |


**Response:** `AllowedConnectionModel`

**Side Effects:**

- Triggers `connection.revoked` webhook event.

---

### `GET /connection/ignored/get-ignored-list`

List all ignored (blocked) IP addresses.

**Response** `list[DeniedConnectionModel]`:


| Field             | Type                  | Description        |
| ----------------- | --------------------- | ------------------ |
| `_id`             | `MongoID` | `null`    | Document ID        |
| `contact_methods` | `ContactMethodsModel` | Contact info       |
| `ip_address`      | `IPvAnyAddress`       | Ignored IP address |
| `service_name`    | `str`                 | Applicable service |


---

### `POST /connection/ignored/remove/{id}`

Remove an IP address from the ignored list, allowing it to send requests again.

**Path Parameters:**


| Param | Type      | Constraints        |
| ----- | --------- | ------------------ |
| `id`  | `MongoID` | 24-char hex string |


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


| Field          | Type                                                                                 | Required | Description      |
| -------------- | ------------------------------------------------------------------------------------ | -------- | ---------------- |
| `event`        | `"pending.new"` | `"pending.accepted"` | `"pending.denied"` | `"connection.revoked"` | Yes      | Trigger event    |
| `method`       | `"GET"` | `"HEAD"` | `"POST"` | `"PUT"` | `"DELETE"`                                 | Yes      | HTTP method      |
| `url`          | `str`                                                                                | Yes      | Request URL      |
| `headers`      | `Dict[str, Any]` | `null`                                                            | No       | Request headers  |
| `query_params` | `Dict[str, Any]` | `null`                                                            | No       | Query parameters |
| `cookies`      | `Dict[str, Any]` | `null`                                                            | No       | Cookies          |
| `body`         | `Dict[str, Any]` | `null`                                                            | No       | Request body     |


---

### `POST /webhook/add-webhook`

Create a webhook for a specific event. Each event can only have one webhook.

**Request Body** `HTTPRequest` (JSON):


| Field          | Type                      | Required | Description                |
| -------------- | ------------------------- | -------- | -------------------------- |
| `event`        | event literal             | Yes      | Trigger event              |
| `method`       | HTTP method literal       | Yes      | HTTP method to use         |
| `url`          | `str`                     | Yes      | URL to send the request to |
| `headers`      | `Dict[str, Any]` | `null` | No       | Custom headers             |
| `query_params` | `Dict[str, Any]` | `null` | No       | Query parameters           |
| `cookies`      | `Dict[str, Any]` | `null` | No       | Cookies                    |
| `body`         | `Dict[str, Any]` | `null` | No       | Request body               |


**Response** `CreateWebhookResponseModel`:

All fields from `HTTPRequest` plus:


| Field     | Type  | Description                                    |
| --------- | ----- | ---------------------------------------------- |
| `message` | `str` | `"The webhook has been successfully created!"` |


**Errors:**

- `409 Conflict` — A webhook already exists for this event.

---

### `DELETE /webhook/remove-webhook`

Remove a webhook for a specific event.

**Request Body** `DeleteWebhookRequestModel` (JSON):


| Field   | Type          | Required | Description                     |
| ------- | ------------- | -------- | ------------------------------- |
| `event` | event literal | Yes      | Event to remove the webhook for |


**Response** `DeleteWebhookResponseModel`:


| Field     | Type          | Description                                    |
| --------- | ------------- | ---------------------------------------------- |
| `event`   | event literal | The event that was removed                     |
| `message` | `str`         | `"The webhook has been successfully deleted!"` |


**Errors:**

- `404 Not Found` — No webhook exists for this event.

---

### `PATCH /webhook/modify-webhook`

Modify an existing webhook's details. Only provided fields are updated.

**Request Body** `ModifyWebhookRequestModel` (JSON):


| Field          | Type                         | Required | Description                          |
| -------------- | ---------------------------- | -------- | ------------------------------------ |
| `event`        | event literal                | Yes      | Event identifier (cannot be changed) |
| `method`       | HTTP method literal | `null` | No       | New HTTP method                      |
| `url`          | `str` | `null`               | No       | New URL                              |
| `headers`      | `Dict[str, Any]` | `null`    | No       | New headers                          |
| `query_params` | `Dict[str, Any]` | `null`    | No       | New query parameters                 |
| `cookies`      | `Dict[str, Any]` | `null`    | No       | New cookies                          |
| `body`         | `Dict[str, Any]` | `null`    | No       | New request body                     |


**Response** `ModifyWebhookResponseModel`:

All fields from `HTTPRequest` plus:


| Field     | Type  | Description                                     |
| --------- | ----- | ----------------------------------------------- |
| `message` | `str` | `"The webhook has been successfully modified!"` |


**Errors:**

- `404 Not Found` — No webhook exists for this event.

---

## Endpoint Summary


| Auth | Method   | Path                                   | Description                  |
| ---- | -------- | -------------------------------------- | ---------------------------- |
| No   | `GET`    | `/status`                              | Service health status        |
| No   | `POST`   | `/auth/token`                          | Login for JWT token          |
| Yes  | `GET`    | `/auth/me`                             | Current authenticated user   |
| Yes  | `GET`    | `/service/get-service-list`            | List all services            |
| Yes  | `POST`   | `/service/create`                      | Create a service             |
| Yes  | `PATCH`  | `/service/edit/{service_name}`         | Edit a service               |
| Yes  | `DELETE` | `/service/delete/{service_name}`       | Delete a service             |
| Yes  | `GET`    | `/pending/get-pending-connections`     | List pending requests        |
| Yes  | `POST`   | `/pending/accept/{id}`                 | Accept a pending request     |
| Yes  | `DELETE` | `/pending/deny/{id}`                   | Deny a pending request       |
| Yes  | `GET`    | `/connection/get-connection-list`      | List allowed connections     |
| Yes  | `DELETE` | `/connection/revoke/{id}`              | Revoke an allowed connection |
| Yes  | `GET`    | `/connection/ignored/get-ignored-list` | List ignored IPs             |
| Yes  | `POST`   | `/connection/ignored/remove/{id}`      | Unignore an IP address       |
| Yes  | `GET`    | `/webhook/get-webhook-list`            | List all webhooks            |
| Yes  | `POST`   | `/webhook/add-webhook`                 | Create a webhook             |
| Yes  | `DELETE` | `/webhook/remove-webhook`              | Remove a webhook             |
| Yes  | `PATCH`  | `/webhook/modify-webhook`              | Modify a webhook             |


**Total: 18 endpoints** (2 public, 16 protected by Bearer token)