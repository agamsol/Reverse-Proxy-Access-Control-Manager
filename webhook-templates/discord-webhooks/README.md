# Discord Webhooks

These webhook templates send notifications to a Discord channel via a [Discord Webhook](https://discord.com/developers/docs/resources/webhook) using rich embeds.

Replace `<DISCORD_WEBHOOK_URL>` in each template with your actual Discord webhook URL.

Only the `pending.new` event is included here — it's the only event relevant to the admin. The remaining events (`pending.accepted`, `pending.denied`, `connection.revoked`) are used to notify the person who made the request, not the admin.

## Templates

| Template | Event | Recipient | Description |
| --- | --- | --- | --- |
| `pending.new.json` | `pending.new` | Admin (Discord channel) | Notifies the admin of a new access request |

## Usage

Register the template via the private API's `POST /webhook/add-webhook` endpoint using the JSON file contents as the request body. See the [Webhook Management](../../proxy-listener/BACKEND.md#webhook-management) section for details.
