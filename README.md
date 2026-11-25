# pi-dusage

English | [中文](./README-zh.md)

A minimal Pi `extension` (扩展) package for viewing the quota (配额) usage of subscription / plan providers (提供方).

This document is the only body of truth for the mechanism of this extension. The document map is in [`doc/README.md`](./doc/README.md), and the terms are in [`doc/术语表.md`](./doc/术语表.md).

## First-version scope

Four verified paths are currently covered:

- `openai-codex`
- `zai-coding-cn`
- `minimax-cn`
- `xai` (Grok / SuperGrok OAuth)

Not included:

- `volcengine-ark-coding`
- A custom Footer (页脚) component (it does not call `ctx.ui.setFooter()`)
- A custom login flow
- Service-status page alerts

`pi-dusage` keeps Pi's native footer fallback text via `setStatus("dusage", ...)`; once `pi-dstatus` is installed, the subscriber clears that fallback and owns the visual presentation.

## Command

One slash command (斜杠命令) is registered:

```text
/dusage
```

Behavior:

- In TUI (terminal interactive UI) mode, results are shown in an overlay (覆盖层) panel whose style is close to the traditional usage card, with:
  - `r` to refresh
  - `Esc` to exit
- In non-TUI modes such as `pi -p`, plain text is printed for quick verification.

## Data sources

### `openai-codex`
- Credentials: `~/.pi/agent/auth.json` → `openai-codex`
- Endpoint: `https://chatgpt.com/backend-api/wham/usage`

### `zai-coding-cn`
- Credentials: `~/.pi/agent/auth.json` → `zai-coding-cn`
- Endpoint: `https://bigmodel.cn/api/monitor/usage/quota/limit`

### `minimax-cn`
- Credentials: `~/.pi/agent/auth.json` → `minimax-cn`
- Endpoint: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains`

### `xai`
- Credentials: `~/.pi/agent/auth.json` → `xai`; only Pi-managed OAuth subscription credentials are accepted, and API-key billing is not mixed into the subscription weekly pool.
- Endpoint: a read-only call to `https://cli-chat-proxy.grok.com/v1/user` validates `userId` in memory only, then `/billing?format=credits` is called.
- Scope: only the server's explicit `week` is displayed; a `5h` window is also displayed when the current period explicitly marks it. `productUsage`, prepaid and pay-as-you-go billing are not shown.
- Boundary: this proxy billing path is not a public, stable API; redirects are refused, timeouts and response-body limits are applied, and field changes degrade safely to an in-card error.

## Output principles

- Plain-text tokens (令牌) and keys (密钥) are never displayed.
- Only understandable windows, percentages and reset times are displayed.
- For `openai-codex`, the independent quota cards returned by the server in `additional_rate_limits` are displayed in addition to the general quota; card titles use the names returned by the API and never hardcode a model version.
- For `zai-coding-cn`, the provider's original field semantics are preserved instead of assuming every window equals "5h + week".
- For `minimax-cn`, only the server's `general` category 5-hour and weekly windows are shown; multimodal categories such as `video` are not misrepresented as separate plan quotas.
- For `xai`, only the verified `week` (or an explicit server `5h`) window of the OAuth subscription pool is shown; product splits such as GrokBuild and GrokChat are not misrepresented as separate quotas.
- Window ordering is unified by ascending reset time, so short windows (such as 5h) come first and long windows (week / month) last, independent of each provider API's response order.
- Usage-bar semantics: the bar represents the *remaining* quota — the more that remains, the fuller and greener it is, and it turns red as it runs out; the percentage still available is still shown on the right.
- When a single provider times out or fails, the error is shown only inside that provider's card and does not interrupt the other providers' results.

## Structured quota events

`pi-dusage` provides a structured snapshot to other extensions through the Pi event bus:

- `pi-dusage/subscribe` / `pi-dusage/unsubscribe`: the payload is `{ version: 1, consumerId: string }`; consumers are managed idempotently by a stable `consumerId`.
- `pi-dusage/updated`: publishes a `DUsageSnapshot` with the version, fetch time, provider, window remaining percentage and safe error information; it contains no token, key or credential object.
- Queries start immediately at session start and refresh every 60 seconds; refreshing continues even when there are no subscribers.
- The `dusage` status is cleared when the first consumer subscribes, and the most recent available quota is restored after the last consumer unsubscribes. If everything failed after an earlier success, the status is marked stale; if it never succeeded, the status is hidden.
- A single provider failure does not block publishing a complete snapshot; concurrent refreshes reuse the in-flight request.

`pi-dusage` does not call `ctx.ui.setFooter()`; `pi-dstatus` can therefore own the footer presentation exclusively.

## Fast Mode integration

With `pi-dfast` installed, `pi-dusage` consumes the public `pi-dfast/updated` snapshot. When Fast Mode (快速模式) first becomes active for the current `openai-codex` model, or the active model changes, an immediate merged quota refresh is triggered; duplicate snapshots produce no extra request.

This integration only shortens the wait for the Fast quota (快速配额) state to appear in the usage snapshot: `pi-dusage` does not read `pi-dfast` private configuration and does not control Fast Mode.

## Internationalization

All visible copy goes through the pi-di18n `pi-i18n/requestApi` event, with built-in `en` and `zh-CN` string sets:

- With pi-di18n installed: a `dusage` namespace bundle is registered and the copy follows the language chosen by `/lang`; after a locale switch the overlay re-renders automatically.
- Without pi-di18n: it falls back to a built-in lookup table, choosing `zh-CN` or `en` from the `LANG` / `LC_ALL` environment variables, without throwing.

## Installation

### Via npm (recommended)

```bash
pi install npm:@diwu507/pi-dusage
```

After installation, run this in Pi:

```text
/reload
```

You can also add the package name directly to the `packages` list in `~/.pi/agent/settings.json`:

```json
"npm:@diwu507/pi-dusage"
```

### Local development install

Add this repository's path to the `packages` list in `~/.pi/agent/settings.json`:

```json
"/Users/diwu/Workspace/Codes/Githubs/pi-extensions/pi-dusage"
```

Then run this in Pi:

```text
/reload
```

## Development

```bash
git clone https://github.com/ssdiwu/pi-dusage.git
cd pi-dusage
npm install
npm run check          # tsc -p tsconfig.json && npm test
```

Load the checkout directly instead of installing it:

```bash
pi --no-session -p "/dusage"
```

## Verification

Offline verification uses `npm run check`; the evidence ledger and the uncovered items are in [`doc/references/验证证据台账.md`](./doc/references/验证证据台账.md).

For a real provider query, the repository must first be added to the `packages` list of `~/.pi/agent/settings.json` as described under "Local development install" (a local path reads the source `index.ts` directly, so changes take effect without reinstalling):

```bash
PI_SKIP_VERSION_CHECK=1 pi --no-session -p "/dusage"
```

## Contributing

- Read [`AGENTS.md`](AGENTS.md) first, then [`doc/README.md`](doc/README.md) and [`doc/术语表.md`](doc/术语表.md).
- Behavior changes update this README first, then the code and tests, then both README versions (`README.md` in English and `README-zh.md` in Chinese) — the two versions must stay semantically in sync.
- Provider, field, public snapshot, command, privacy or install behavior changes must land with matching behavior tests, including success, rate-limit, missing-field and error responses on redacted fixtures.
- User-perceivable changes go to the changelog: daily Chinese entries are kept in [`CHANGELOG-zh.md`](CHANGELOG-zh.md) in this repository, and each released version mirrors the same user-perceivable facts into the English [`CHANGELOG.md`](CHANGELOG.md); both changelogs and both READMEs ship in the npm package.
- One commit does one thing and follows Conventional Commits (约定式提交). Do not commit, push, tag, publish or modify the user's credentials without explicit authorization.

## Documentation

- [`doc/README.md`](./doc/README.md): document map and where each decision lives.
- [`doc/术语表.md`](./doc/术语表.md): project terms.
- [`doc/references/`](./doc/references/): sources, verification records and historical snapshots — not current authority.
