# Android SMS API Webhooks

These webhook templates are designed for use with [Android SMS API](https://github.com/agamsol/Android-SMS-API) — a lightweight HTTP API wrapper around ADB that turns an Android phone into a programmable SMS server.

The templates send notifications as text messages via the `POST /adb/send-text-message` endpoint.

## Templates

| Template | Event | Recipient | Description |
| --- | --- | --- | --- |
| `pending.new.json` | `pending.new` | Admin (`{{owner_phone_number}}`) | Notifies the admin of a new access request |
| `pending.accepted.json` | `pending.accepted` | Requester (`{{phone_number}}`) | Notifies the requester that access was granted |
| `pending.denied.json` | `pending.denied` | Requester (`{{phone_number}}`) | Notifies the requester that access was denied |
| `connection.revoked.json` | `connection.revoked` | Requester (`{{phone_number}}`) | Notifies the requester that access was revoked |

## Usage

Register each template via the private API's `POST /webhook/add-webhook` endpoint using the JSON file contents as the request body. See the [Webhook Management](../../proxy-listener/BACKEND.md#webhook-management) section for details.
