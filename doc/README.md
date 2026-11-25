# pi-dusage 文档入口

本文件只做导航，不承载机制正文。英文 `README.md` 与中文 `README-zh.md` 是同一机制规格的两版；现行机制以根 README 两版为唯一正文。

> English contributor navigation. 中文正文保留在下方，两版语义一致。
>
> | Where to start | What it answers |
> |---|---|
> | [../README.md](../README.md) | English project entry: scope, command, providers, quota events, Fast Mode, i18n, install, development, contributing |
> | [../README-zh.md](../README-zh.md) | 中文完整版，与英文版语义一致 |
> | [../AGENTS.md](../AGENTS.md) | Agent rules: provider boundaries, bilingual README + changelog rules, verification, Git constraints |
> | [术语表.md](./术语表.md) | Project terms |
> | [references/](./references/) | Sources, verification records and historical snapshots — not current authority |
> | [../CHANGELOG.md](../CHANGELOG.md) | User-perceivable changes per released version |
>
> Behavior changes update the root README versions, then the code and tests; both README versions must stay semantically in sync. User-perceivable changes are logged daily in the Chinese `CHANGELOG-zh.md` and, per released version, mirrored in the English `CHANGELOG.md`; both changelogs and both READMEs ship in the npm package.

## 中文导航

| 位置 | 回答什么 | 性质 |
|---|---|---|
| [../README.md](../README.md) 与 [../README-zh.md](../README-zh.md) | 功能边界、`/dusage` 命令行为、数据来源与接口、输出原则、结构化 quota 事件、Fast Mode 适配、国际化、安装与验证命令 | 现行正文（英文默认版 + 中文完整版，语义一致） |
| [术语表.md](./术语表.md) | 项目术语定义 | 现行正文（唯一） |
| [references/](./references/) | 来源、验证记录、历史阶段快照；只追溯，不作现行权威 | 证据区 |
| [../AGENTS.md](../AGENTS.md) | 代理规范：provider 边界、双语 README 与变更日志规则、TUI 失败恢复、验证与 Git 约束 | 规范 |
| [../README.md](../README.md#contributing) | 英文贡献入口；中文见 [README-zh.md](../README-zh.md#贡献) | 公开贡献说明 |
| [../CHANGELOG.md](../CHANGELOG.md) | 用户可感知版本变化 | 历史 |

## 当前状态

- 根 `PLAN.md`：无。本仓库不维护执行计划正文，当前进展以 `CHANGELOG.md` 与根 `README.md` 为准。
- 本机原始现场（截图、抓包、原始日志）放仓库根 `.artifacts/`，已被 Git 忽略；引用它不表示文件随仓库分发。

## 决策存放位置

本仓库没有 `doc/决策档案/`，也不新增 ADR。难逆转决定目前记在根 `README.md` 的对应正文条目里：

| 决定 | 所在正文 |
|---|---|
| 不用自定义 Footer，由 `pi-dstatus` 接管视觉展示 | [README.md 输出原则 / 结构化 quota 事件](../README.md) |
| 进度条表示「剩余配额」而非已用量 | [README.md 输出原则](../README.md) |
| 不把 `productUsage`、`video` 等分类当独立配额 | [README.md 输出原则](../README.md) |
| Codex `additional_rate_limits` 按服务端返回名称成卡，不硬编码模型版本 | [README.md 输出原则](../README.md) |
| `xai` 走非公开 CLI proxy billing 路径，只校验 `userId`，拒绝重定向并限制响应体 | [README.md 数据来源 `xai`](../README.md) |

是否把它们独立刻碑为 ADR，需要单独定夺；在定夺前不移动、不改写措辞。

## 维护规则

- 机制、provider 字段、公开快照、命令、隐私或安装行为变化 → 同步根 `README.md` 与 `README-zh.md`；两版必须语义一致，内部文件无需全译。
- 术语变化 → 只更新 `doc/术语表.md`。
- 验证记录、来源与历史阶段 → 追加到 `doc/references/`，不改写已归档记录。
- 用户可感知变化 → 日常写入本仓中文 `CHANGELOG-zh.md`，准备发布时按版本同步更新英文 `CHANGELOG.md`；两份都随 npm 包发布。
- 文档结构调整 → 更新本入口的导航，不新写第二份机制正文。
