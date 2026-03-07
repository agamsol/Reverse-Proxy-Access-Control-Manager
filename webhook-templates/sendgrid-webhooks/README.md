# SendGrid Webhooks

These webhook templates send email notifications via the [SendGrid](https://sendgrid.com) (Twilio) API.

## Setup

1. Create a free account at [sendgrid.com](https://sendgrid.com) (100 emails/day on the free tier).
2. Verify a **Sender Identity** (single sender or domain authentication) under **Settings > Sender Authentication**.
3. Generate an API key under **Settings > API Keys** with **Mail Send** permission.
4. Replace `<SENDGRID_API_KEY>` with your API key and `<SENDER_EMAIL>` with your verified sender address in each template.

## Templates

| Template | Event | Recipient | Description |
| --- | --- | --- | --- |
| `pending.new.json` | `pending.new` | Admin (`{{owner_email}}`) | Notifies the admin of a new access request |
| `pending.accepted.json` | `pending.accepted` | Requester (`{{email}}`) | Notifies the requester that access was granted |
| `pending.denied.json` | `pending.denied` | Requester (`{{email}}`) | Notifies the requester that access was denied |
| `connection.revoked.json` | `connection.revoked` | Requester (`{{email}}`) | Notifies the requester that access was revoked |

## Usage

Register each template via the private API's `POST /webhook/add-webhook` endpoint using the JSON file contents as the request body. See the [Webhook Management](../../proxy-listener/BACKEND.md#webhook-management) section for details.
