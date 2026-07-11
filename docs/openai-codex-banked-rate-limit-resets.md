# OpenAI Codex Banked Rate-Limit Resets

> This document was generated with the [Pi](https://pi.dev/) coding agent.

OpenAI Codex allows eligible users to save a rate-limit reset and redeem it later. OpenAI calls this a **banked rate-limit reset**, usually shortened to **banked reset** or **reset**. Internal APIs and source code instead use **rate-limit reset credit** and `RateLimitResetCredit`.

A reset is not money, an OpenAI API credit, or a transferable benefit. User-facing interfaces should therefore say `reset`, while code may retain the API's `credit` terminology.

## How resets work

A banked reset restores eligible Codex subscription rate-limit windows when redeemed. It is separate from the normal five-hour and weekly windows shown in Codex usage data.

Resets are promotional benefits, not recurring subscription allowances. Confirmed grants have included the June 2026 launch grant and referral promotions. OpenAI may offer different rewards in the future, with eligibility determined dynamically by plan, region, workspace, account state, prior Codex use, and promotion-specific limits. The offer shown in the product is authoritative.

Banked resets usually expire 30 days after they are granted unless an offer states otherwise. The API's `available_count` is the number already granted and currently available; it does not represent how many more resets a user may earn.

## Integration surfaces

The feature has two integration surfaces:

- **Codex App Server JSON-RPC** is the documented, supported integration boundary
- **ChatGPT WHAM REST** is used by the official open-source Codex client and covered by its contract tests, but it is not a public REST API with a compatibility guarantee

The REST interface is convenient for a Pi extension because Pi already stores and refreshes the required ChatGPT OAuth credentials. It should nevertheless be isolated behind a small adapter so endpoint or schema changes do not spread through the feature.

## WHAM REST endpoints

The confirmed production base URL is:

```text
https://chatgpt.com/backend-api
```

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/wham/usage` | Read rate-limit windows and the available-reset summary |
| `GET` | `/wham/rate-limit-reset-credits` | Read individual reset details |
| `POST` | `/wham/rate-limit-reset-credits/consume` | Redeem one reset |

The official client also supports paths under `<codex-backend-base>/api/codex/...`, but OpenAI has not documented a public production host for that form. In particular, do not assume that `https://api.openai.com/api/codex/...` is valid.

## Authentication

These endpoints require ChatGPT subscription OAuth, not a normal OpenAI API key:

```http
Authorization: Bearer <access_token>
ChatGPT-Account-ID: <account_id>
```

A Pi extension should ask Pi's model registry to resolve the credential so expired OAuth tokens are refreshed. It should not read or parse `~/.pi/agent/auth.json` directly. Tokens and complete request headers must never be logged or included in model context.

## Reading usage and the reset summary

Request:

```http
GET /backend-api/wham/usage HTTP/1.1
Host: chatgpt.com
Authorization: Bearer <access_token>
ChatGPT-Account-ID: <account_id>
Accept: application/json
```

Relevant response fields:

```json
{
  "plan_type": "plus",
  "rate_limit": {
    "primary_window": {
      "used_percent": 27,
      "limit_window_seconds": 18000,
      "reset_after_seconds": 13140,
      "reset_at": 1782770922
    },
    "secondary_window": {
      "used_percent": 4,
      "limit_window_seconds": 604800,
      "reset_after_seconds": 566340,
      "reset_at": 1783357722
    }
  },
  "rate_limit_reset_credits": {
    "available_count": 2
  }
}
```

`primary_window` is normally the five-hour window and `secondary_window` the weekly window. `reset_at` is a Unix timestamp; `reset_after_seconds` is the corresponding relative duration observed in live responses. Read the reset count defensively:

```ts
const available = response.rate_limit_reset_credits?.available_count ?? 0;
```

This endpoint provides only a summary. Use the details endpoint to show expiration times or select a particular reset.

## Reading reset details

Request:

```http
GET /backend-api/wham/rate-limit-reset-credits HTTP/1.1
Host: chatgpt.com
Authorization: Bearer <access_token>
ChatGPT-Account-ID: <account_id>
Accept: application/json
```

Response:

```json
{
  "credits": [
    {
      "id": "RateLimitResetCredit_...",
      "reset_type": "codex_rate_limits",
      "status": "available",
      "granted_at": "2026-06-17T00:00:00Z",
      "expires_at": "2026-07-17T00:00:00Z",
      "title": "Full reset (Weekly + 5 hr)",
      "description": "Ready to redeem"
    }
  ],
  "available_count": 2
}
```

The official Codex client consumes these fields:

- `id`
- `reset_type`
- `status`
- `granted_at`
- `expires_at`
- `title`
- `description`
- `available_count`

The backend may return additional fields, but the official client deliberately ignores them. A live response contained `total_earned_count: 0` alongside four available credits, so `total_earned_count` must not be used as an earned or available balance. Nullable fields such as `redeem_started_at` and `redeemed_at` were also present but are unnecessary when listing available resets.

Treat `available_count` as authoritative. The backend may limit the number of entries in `credits`, so `credits.length` is not a reliable substitute. Only entries whose status is `available` should be offered for redemption.

## Consuming a reset

Redeeming a reset is irreversible. The UI should show the selected reset, its expiration time, and the current rate-limit windows, then require explicit confirmation with a safe default of cancel.

Request:

```http
POST /backend-api/wham/rate-limit-reset-credits/consume HTTP/1.1
Host: chatgpt.com
Authorization: Bearer <access_token>
ChatGPT-Account-ID: <account_id>
Accept: application/json
Content-Type: application/json

{
  "redeem_request_id": "55cbe0c1-71ab-4c52-b855-80746f73ff52",
  "credit_id": "RateLimitResetCredit_..."
}
```

- `redeem_request_id` is a required idempotency key; a UUID is appropriate (UUIDv7 is suitable and is already available from `@earendil-works/pi-agent-core`)
- `credit_id` is optional; when omitted, the server chooses a reset
- Retries of the same logical redemption must reuse the original `redeem_request_id`

Successful response:

```json
{
  "code": "reset",
  "credit": {
    "id": "RateLimitResetCredit_...",
    "reset_type": "codex_rate_limits",
    "status": "redeemed",
    "redeemed_at": "2026-07-10T12:30:00Z"
  },
  "windows_reset": 2
}
```

The REST response uses one of four snake-case result codes:

| Code | Meaning |
| --- | --- |
| `reset` | The reset was redeemed and eligible windows were reset |
| `nothing_to_reset` | No rate-limit window was currently eligible |
| `no_credit` | No banked reset was available |
| `already_redeemed` | This idempotent request had already completed; treat it as success |

After `reset` or `already_redeemed`, refresh usage rather than deriving the new count or window state from stale client data. Reset details can be fetched again the next time the selection panel opens.

## Error handling and compatibility

The REST API can change independently of pi-spark. An adapter should handle:

- Missing or newly added fields
- `401` for missing or expired authorization
- `403` for an ineligible account, workspace, region, or endpoint
- Non-JSON responses, including proxy or Cloudflare HTML
- Request cancellation and timeouts
- Ambiguous network failures during redemption

Do not include response bodies in user-facing errors unless they have been validated and sanitized. If the details endpoint fails, `/wham/usage` can still provide `available_count` for a degraded summary.

## pi-spark behavior

When `/wham/usage` reports one or more available resets, the credits status appends a summary after the normal windows:

```text
Codex 5h 42% 7d 7% (4 resets available)
```

The suffix is omitted when no reset is available. `/codex-reset` opens an interactive panel that loads current usage and reset details, lists available resets by title, grant time, and expiration time, and sorts the earliest expiration first. Selecting a reset opens a separate confirmation prompt before any POST request is made.

Each confirmed redemption uses a new UUIDv7 idempotency key and makes one consume request without automatic retries. Successful and idempotently completed redemptions refresh the credits status.

## Public App Server equivalent

The documented Codex App Server exposes equivalent operations over JSON-RPC.

Read limits and resets:

```json
{ "method": "account/rateLimits/read", "id": 1 }
```

The response includes camel-case `rateLimitResetCredits`, `availableCount`, and individual credits.

Consume a reset:

```json
{
  "method": "account/rateLimitResetCredit/consume",
  "id": 2,
  "params": {
    "idempotencyKey": "55cbe0c1-71ab-4c52-b855-80746f73ff52",
    "creditId": "RateLimitResetCredit_..."
  }
}
```

The App Server is the safer boundary for long-lived external integrations. Direct WHAM access is simpler inside pi-spark today, but should remain replaceable.

## References

- [Codex App Server](https://developers.openai.com/codex/app-server)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Codex Referral Promotions](https://help.openai.com/en/articles/20001271-codex-referral-promotions)
- [Codex pricing and invitations](https://developers.openai.com/codex/pricing)
- [Official REST implementation](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets.rs)
- [Official REST contract tests](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets_tests.rs)
- [Official backend response types](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/types.rs)
- [App Server reset processing](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/account_processor/rate_limit_resets.rs)
