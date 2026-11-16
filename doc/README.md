# pi-dusage 文档入口

本文件只做导航，不承载机制正文。现行机制规格以根 `README.md` 为唯一正文。

## 阅读地图

| 位置 | 回答什么 | 性质 |
|---|---|---|
| [../README.md](../README.md) | 功能边界、`/dusage` 命令行为、数据来源与接口、输出原则、结构化 quota 事件、Fast Mode 适配、国际化、安装与验证命令 | 现行正文（唯一） |
| [术语表.md](./术语表.md) | 项目术语定义 | 现行正文（唯一） |
| [references/](./references/) | 来源、验证记录、历史阶段快照；只追溯，不作现行权威 | 证据区 |
| [../AGENTS.md](../AGENTS.md) | 代理规范：provider 边界、TUI 失败恢复、验证与 Git 约束 | 规范 |
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

- 机制、provider 字段、公开快照、命令、隐私或安装行为变化 → 只更新根 `README.md`。
- 术语变化 → 只更新 `doc/术语表.md`。
- 验证记录、来源与历史阶段 → 追加到 `doc/references/`，不改写已归档记录。
- 用户可感知变化 → `CHANGELOG.md`。
- 文档结构调整 → 更新本入口的导航，不新写第二份机制正文。
