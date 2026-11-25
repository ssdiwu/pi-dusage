# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 的基本格式。带 tag 的发布以 Git tag 为版本号；已发布版本由发布负责人负责维护英文 `CHANGELOG.md`，本文件是对应版本的中文镜像。两份日志只记录用户可感知事实，日常用中文记录，准备发布（release）时按版本同步到英文，并都随 npm 包发布。

新发布使用 `## [x.y.z] - YYYY-MM-DD` 格式的标题；条目可唯一对应 GitHub issue 时，在末尾附 `(#xx)`。历史条目保留原有标题格式。

## [Unreleased]

## [0.2.1] - 2026-11-25

### Added
- 新增版本化的 `pi-dusage/updated` 配额快照事件与 `pi-dusage/subscribe` / `pi-dusage/unsubscribe` 消费者协议。
- 新增会话启动时立即刷新、60 秒轮询、并发请求合并以及安全的 footer 文本回退。
- 接入 `pi-dfast/updated`：当前 Codex 模型进入 Fast Mode 时立即刷新并合并配额；重复快照不产生额外请求。
- 新增 `xai`（Grok / SuperGrok）OAuth 订阅用量查询：使用只读 `/user` → `/billing?format=credits` 路径，显示服务端指定的周（或 5 小时）窗口，不展示产品明细或账单金额。

### Changed

- 支持 Pi 1.6.0。
- `pi-dusage` 不接管自定义 footer；存在结构化消费者时清除原生 `dusage` 状态，没有消费者时继续提供回退文本。

### Fixed
- TUI overlay 渲染失败时回退到可读的纯文本配额结果；provider 错误详情不再直接暴露在展示文本中。
- 防止 overlay 刷新、i18n 监听器与会话关闭之间的异常和竞态；结构化配额 provider/window 标识不再依赖响应顺序。
- MiniMax 在有稳定记录标识时保留独立的总配额，避免重复的窗口标识。

## [0.2.0] - 2026-07-10

### Added
- `/dusage` 现在把 Codex 服务端返回的额外限额显示为独立卡片；名称跟随服务端返回的模型名。

### Changed
- MiniMax CN 现在只显示通用的 `general` 配额，不再把 `video` 等多模态类别当作单独的套餐配额展示。

## [0.1.0] - 2026-06-29

### Added
- `openai-codex` 的 `access` token 过期时，`/dusage` 不再只为了拿一个裸 401 而发请求；改为显示可操作的提示（引导用户在 Pi 中向 codex 发消息以触发自动续期）。扩展本身不刷新 token，避免与 Pi 自己的凭据管理冲突。

## [0.0.3] - 2026-06-20

### Fixed
- 单个 provider 请求超时或网络错误时，`/dusage` 不再让整条命令失败；在该 provider 内显示错误并继续展示其他 provider 的结果。
- 为请求超时与请求错误分别使用不同文案，避免 `This operation was aborted` 等底层错误直接暴露给用户。

### Changed
- 包名改为 `@diwu507/pi-dusage`，避免 npm 因名称过于相似而阻止发布无 scope 的包。
- 新增 `tsconfig.json`（TypeScript 配置），让 `npm run check` 成为可靠的发布前检查。

## [0.0.2] - 2026-06-19

### Added
- 接入 pi-di18n 国际化：通过 `pi-i18n/requestApi` 事件获取 `I18nApi`，为 `dusage` namespace 注册 `en` / `zh-CN` 文案；未安装 pi-di18n 时回退到基于 `LANG` / `LC_ALL` 的内置查找表。
- 使用 `/lang` 切换语言后，TUI overlay 自动重新渲染。

### Changed
- 统一窗口排序：三个 provider 都按重置时间升序排列（5h 等短窗口在前，周/月长窗口在后），不再依赖各 API 的响应顺序。
- 用量条颜色语义：进度条表示剩余配额——剩余越多越满越绿，快用完时变红；右侧仍显示剩余百分比。

## [0.0.1] - 2026-06-18

### Added
- 初始化 `pi-dusage` Pi `extension` 包。
- 新增 `/dusage` slash 命令。
- 新增 `openai-codex` 配额查询。
- 新增 `zai-coding-cn` 配额查询。
- 新增 `minimax-cn` 配额查询。
- 新增卡片式 TUI `overlay` 显示。
- 新增非 TUI 模式的纯文本输出。
- 新增最小项目文档：`README.md`、`doc/README.md`、`doc/术语表.md`、`AGENTS.md`。
