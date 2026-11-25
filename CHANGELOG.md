# Changelog

This project follows the basic format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). For tagged releases, use the version from the Git tag. The tagged release is maintained by the release owner in this English `CHANGELOG.md`; daily user-perceivable changes are recorded in the Chinese `CHANGELOG-zh.md` in this repository. Both files contain user-perceivable facts only and ship in the npm package.

For new releases, use headings in the format `## [x.y.z] - YYYY-MM-DD`. When an entry can be linked unambiguously to a GitHub issue, append `(#xx)`. Historical entries keep their original heading format.

## [Unreleased]

## [0.2.1] - 2026-11-25

### Added
- Added a versioned `pi-dusage/updated` quota snapshot event and a `pi-dusage/subscribe` / `pi-dusage/unsubscribe` consumer protocol.
- Added immediate refresh at session start, 60-second polling, coalescing of concurrent requests, and a safe footer text fallback.
- Added `pi-dfast/updated` integration: when Fast Mode becomes active for the current Codex model, quota is refreshed immediately and coalesced; duplicate snapshots produce no extra requests.
- Added `xai` (Grok / SuperGrok) OAuth subscription usage queries: uses read-only `/user` → `/billing?format=credits` paths to display the server-specified week (or 5h) window, without product breakdowns or billing amounts.

### Changed

- Supports Pi 1.6.0.
- `pi-dusage` does not take over a custom footer; it clears the native `dusage` status when structured consumers exist and keeps providing fallback text when none do.

### Fixed
- Falls back to readable plain-text quota results when TUI overlay rendering fails; provider error details are no longer exposed directly in display text.
- Prevented exceptions and races between overlay refreshes, i18n listeners, and session shutdown; structured quota provider/window identifiers no longer depend on response order.
- MiniMax retains separate general quotas when there is a stable record identifier, avoiding duplicate window identifiers.

## [0.2.0] - 2026-07-10

### Added
- `/dusage` now shows extra limits returned by the Codex server as separate cards; the name follows the model name returned by the server.

### Changed
- MiniMax CN now shows only the general `general` quota and no longer presents multimodal categories such as `video` as separate plan quotas.

## [0.1.0] - 2026-06-29

### Added
- When the `openai-codex` `access` token expires, `/dusage` no longer sends a request just to get a bare 401; it instead shows an actionable hint (guiding the user to send a message via codex in Pi to trigger automatic renewal). The extension does not refresh the token itself, avoiding conflicts with Pi's own credential management.

## [0.0.3] - 2026-06-20

### Fixed
- When a single provider request times out or hits a network error, `/dusage` no longer fails the whole command; it shows the error within that provider and continues displaying the other providers' results.
- Added separate wording for request timeouts and request errors so low-level errors such as `This operation was aborted` are not exposed directly to users.

### Changed
- Changed the package name to `@diwu507/pi-dusage` to avoid npm blocking publication of a too-similar unscoped name.
- Added `tsconfig.json` (TypeScript configuration) so `npm run check` can serve as a reliable pre-release check.

## [0.0.2] - 2026-06-19

### Added
- Added pi-di18n internationalization: obtains `I18nApi` through the `pi-i18n/requestApi` event and registers `en` / `zh-CN` strings for the `dusage` namespace; when pi-di18n is not installed, falls back to a built-in lookup table based on `LANG` / `LC_ALL`.
- The TUI overlay re-renders automatically after changing language with `/lang`.

### Changed
- Unified window ordering: all three providers now sort by reset time ascending (short windows such as 5h first, long week/month windows last), instead of relying on each API's response order.
- Usage-bar color semantics: the bar now represents the remaining quota — the more that remains, the fuller and greener the bar, turning red as it runs out; the percentage still available remains shown on the right.

## [0.0.1] - 2026-06-18

### Added
- Initialized the `pi-dusage` Pi `extension` package.
- Added the `/dusage` slash command.
- Added quota queries for `openai-codex`.
- Added quota queries for `zai-coding-cn`.
- Added quota queries for `minimax-cn`.
- Added card-style TUI `overlay` display.
- Added plain-text output in non-TUI mode.
- Added minimal project documentation: `README.md`, `doc/README.md`, `doc/术语表.md`, `AGENTS.md`.
