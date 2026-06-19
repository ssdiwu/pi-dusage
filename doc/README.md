# pi-dusage 文档入口

## 阅读地图

- `README.md`：功能边界、命令行为、数据来源、安装与验证。
- `doc/术语表.md`：项目术语。
- `index.ts`：Pi 扩展入口与 3 个 provider 的 quota 查询实现。

## 当前范围

第一版只解决一个问题：

> 在 Pi 里通过 `/dusage` 查看 `openai-codex`、`zai-coding-cn`、`minimax-cn` 的额度信息。

当前 TUI 形态已升级为 overlay（覆盖层）进度条卡片；文案通过 pi-di18n 接入多语言（内置 en/zh-CN，未安装时按环境变量回退）。后续是否接入更多 provider，再以现有数据通路为前提推进。
