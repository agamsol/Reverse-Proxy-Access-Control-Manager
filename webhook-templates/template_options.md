# Webhook Template Variables

This document lists the variables available for use in webhook templates. These variables are replaced with dynamic values when a webhook event is triggered.

## Global Variables
These variables are available in **all** webhook events.

| Variable | Description |
| :--- | :--- |
| `{{owner_name}}` | Name of the system owner (configured in `OWNER_NAME` in the `.env` file). |
| `{{owner_email}}` | Email of the system owner (configured in `OWNER_EMAIL` in the `.env` file). |
| `{{owner_phone_number}}` | Phone number of the system owner (configured in `OWNER_PHONE_NUMBER` in the `.env` file). |
| `{{name}}` | The contact name associated with the request or connection. |
| `{{email}}` | The contact email associated with the request or connection. |
| `{{phone_number}}` | The contact phone number associated with the request or connection. |
| `{{date}}` | Current UTC date (Format: `YYYY-MM-DD`). |
| `{{time}}` | Current UTC time (Format: `HH:MM`). |
| `{{time_seconds}}` | Current UTC time with seconds (Format: `HH:MM:SS`). |
| `{{nl}}` or `{{newline}}` | A newline character. |

---

## Event-Specific Variables
These variables are available only for the specific events listed below.

### 1. `pending.new`
Triggered when a new access request is received.

| Variable | Description |
| :--- | :--- |
| `{{ip_address}}` | The remote IP address requesting access. |
| `{{service}}` | The name of the service being requested. |
| `{{note}}` | The note provided in the access request (defaults to "Not provided" if empty). |

### 2. `pending.accepted`
Triggered when an access request is approved.

| Variable | Description |
| :--- | :--- |
| `{{service}}` | The name of the service access was granted for. |
| `{{expiry_date}}` | The expiration date of the access (Format: `YYYY-MM-DD`). |
| `{{expiry_time}}` | The expiration time of the access (Format: `HH:MM`). |
| `{{expiry_time_seconds}}` | The expiration time with seconds (Format: `HH:MM:SS`). |

### 3. `pending.denied`
Triggered when an access request is denied.

| Variable | Description |
| :--- | :--- |
| `{{service}}` | The name of the service access was denied for. |

### 4. `connection.revoked`
Triggered when an existing connection is revoked.

| Variable | Description |
| :--- | :--- |
| `{{service}}` | The name of the service access was revoked for. |
| `{{expiry_date}}` | The original expiration date of the connection (Format: `YYYY-MM-DD`). |
| `{{expiry_time}}` | The original expiration time of the connection (Format: `HH:MM`). |
| `{{expiry_time_seconds}}` | The original expiration time with seconds (Format: `HH:MM:SS`). |
