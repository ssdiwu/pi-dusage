# Changelog

All notable changes to this project will be documented in this file.

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
