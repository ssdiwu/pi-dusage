# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-06-29

### Added
- `openai-codex` 的 `access` 令牌过期时，`/dusage` 不再发请求拿到冰冷的 401，改为直接显示可操作提示（引导在 Pi 中使用 codex 发一句话触发自动续期）。扩展不自行刷新令牌，避免与 Pi 主程序的凭据管理冲突。

## [0.0.3] - 2026-06-20

### Fixed
- `/dusage` 遇到单个 provider 请求超时或网络异常时，不再整条命令失败；改为在该 provider 内显示错误，并继续展示其余 provider 结果。
- 为请求超时与请求异常补充单独文案，避免向用户直接暴露 `This operation was aborted` 这类底层错误。

### Changed
- 包名调整为 `@diwu507/pi-dusage`，避开 npm 对近似未作用域包名的发布拦截。
- 补齐 `tsconfig.json`（TypeScript 配置），使 `npm run check` 可作为稳定的发布前校验命令使用。

## [0.0.2] - 2026-06-19

### Added
- 接入 pi-di18n 国际化：通过 `pi-i18n/requestApi` 事件获取 `I18nApi`，注册 `dusage` namespace 的 `en` / `zh-CN` 文案；未安装 pi-di18n 时按 `LANG` / `LC_ALL` 回退内置查表。
- `/lang` 切换语言后，TUI overlay 自动重渲染。

### Changed
- 统一窗口排序：三个 provider 均按重置时间升序（短窗口如 5h 在上、长窗口 week/month 在下），不再依赖各 API 返回顺序。
- 用量条颜色语义：进度条改为表示「剩余配额」——剩余越多填充越满且越绿，将耗尽时变红；右侧仍显示可使用量百分比。

## [0.0.1] - 2026-06-18

### Added
- 初始化 `pi-dusage` Pi `extension`（扩展）包。
- 新增 `/dusage` slash command（斜杠命令）。
- 接入 `openai-codex` 的 quota（配额）查询。
- 接入 `zai-coding-cn` 的 quota（配额）查询。
- 接入 `minimax-cn` 的 quota（配额）查询。
- 支持 TUI `overlay`（覆盖层）卡片式展示。
- 支持非 TUI 模式下的纯文本输出。
- 新增最小项目文档：`README.md`、`doc/README.md`、`doc/术语表.md`、`AGENTS.md`。
