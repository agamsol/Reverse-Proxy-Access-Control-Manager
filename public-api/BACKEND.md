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
- `422 Unprocessable Entity` — One or more contact fields that are `visible` and `required` in `data/contact-fields.json` are missing or empty. The `detail` payload is:

    ```json
    {
      "message": "Required contact fields are missing.",
      "missing_fields": ["email", "phone_number"]
    }
    ```

**Side Effects:**

- For each valid service in `services`, creates a pending connection (MongoDB) and may invoke the `pending.new` webhook if configured.

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
