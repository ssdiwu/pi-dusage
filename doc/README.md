# pi-dusage 文档入口

## 阅读地图

- `README.md`：功能边界、命令行为、数据来源、安装与验证。
- `doc/术语表.md`：项目术语。
- `index.ts`：Pi 扩展入口与 3 个 provider 的 quota 查询实现。

## 当前范围

第一版只解决一个问题：

> 在 Pi 里通过 `/dusage` 查看 `openai-codex`、`zai-coding-cn`、`minimax-cn` 的额度信息。

当前 TUI 形态已升级为 overlay（覆盖层）进度条卡片；`openai-codex` 的通用与额外限额分别成卡，`minimax-cn` 只展示通用 `general` 窗口。文案通过 pi-di18n 接入多语言（内置 en/zh-CN，未安装时按环境变量回退）。后续是否接入更多 provider，再以现有数据通路为前提推进。

## 结构化 quota 协议

`index.ts` 还通过 Pi 事件总线发布 `pi-dusage/updated`，供 `pi-dstatus` 等扩展消费 `DUsageSnapshot`。订阅事件为 `pi-dusage/subscribe` 与 `pi-dusage/unsubscribe`，载荷使用 `version: 1` 和稳定 `consumerId`。

`pi-dusage` 在 `session_start` 立即查询并持续每 60 秒刷新，无消费者时也不停止；订阅会触发一次并发合并后的立即刷新。它只使用 `ctx.ui.setStatus("dusage", ...)` 提供原生 Footer 文本回退，不调用 `ctx.ui.setFooter()`。
