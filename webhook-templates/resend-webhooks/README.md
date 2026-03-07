# Resend Webhooks

These webhook templates send email notifications via the [Resend](https://resend.com) API.

## Setup

1. Create a free account at [resend.com](https://resend.com) (100 emails/day on the free tier).
2. Add and verify your sending domain under **Domains**.
3. Generate an API key under **API Keys**.
4. Replace `<RESEND_API_KEY>` with your API key and `<SENDER_EMAIL>` with your verified sender address in each template.

## Templates

| Template | Event | Recipient | Description |
| --- | --- | --- | --- |
| `pending.new.json` | `pending.new` | Admin (`{{owner_email}}`) | Notifies the admin of a new access request |
| `pending.accepted.json` | `pending.accepted` | Requester (`{{email}}`) | Notifies the requester that access was granted |
| `pending.denied.json` | `pending.denied` | Requester (`{{email}}`) | Notifies the requester that access was denied |
| `connection.revoked.json` | `connection.revoked` | Requester (`{{email}}`) | Notifies the requester that access was revoked |

## Usage

Register each template via the private API's `POST /webhook/add-webhook` endpoint using the JSON file contents as the request body. See the [Webhook Management](../../proxy-listener/BACKEND.md#webhook-management) section for details.
