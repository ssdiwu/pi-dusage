# pi-dusage — Agent 规范

## 文件职责与阅读顺序

- 本文件只记录额度查询扩展长期安全、协议和验证边界，不固定当前 provider 数量或版本状态。
- 修改前读取 `README.md`（英文默认版）、`README-zh.md`（完整中文版）、`doc/README.md`、`doc/术语表.md`、`package.json`、当前 provider 实现和测试；支持列表与公开快照以代码和 README 为准。
- 机制规格的唯一正文是根 `README.md`，术语的唯一正文是 `doc/术语表.md`；`doc/README.md` 只做导航，`doc/references/` 只放来源、验证与历史记录，不作现行权威。

## Provider 与凭据边界

- 只读取 Pi 已有凭据和 provider 配置，不新增登录流程、不改写用户 auth 文件、不输出 token、Key 或完整账户标识。
- 每个 provider 的 endpoint、字段、重置时间和错误语义分别建模；远端响应视为不可信输入，缺字段或格式变化安全降级。
- 额度查询使用最小、只读、低成本路径；不得把推理请求伪装成零消耗查询，真实消耗前需明确授权。
- provider 支持集由当前注册实现与测试承担，不在本文件复制易变清单；新增 provider 必须有脱敏 fixture、失败路径和离线行为。
- 结构化额度快照、原生 status 与 `/dusage` 展示共享同一事实模型，不建立 TUI/非 TUI 双轨计算。

## TUI 与失败恢复

- 查询、格式化、快照和命令结果不依赖 overlay 渲染成功；TUI 异常时降级纯文本并保留可读错误。
- 渲染错误不能吞掉 provider 结果，也不能泄露凭据；非 TUI 路径始终可用。
- 调试先用固定响应建立 provider 级失败测试；连续两次同类失败且范围未缩小时停止 endpoint 猜测并重读实际协议证据。
- 不解析其他扩展私有状态；跨扩展消费只使用版本化公开事件或状态协议。

## 验证

```bash
npm run check
```

- Provider、鉴权或格式变化还需在脱敏 fixture 上覆盖成功、限流、缺字段和错误响应。
- 入口或展示变化需从当前仓库加载扩展，分别验证非 TUI 文本与真实 TUI；真实 provider 请求只使用授权配置和最小查询。
- 汇报时区分类型/测试、离线 fixture、真实 provider 与 TUI 状态。

## 双语文档与变更日志

- `README.md` 是英文默认版，`README-zh.md` 是完整中文版；两版顶部互链，命令、provider 边界、公开快照、安装与贡献入口必须语义一致。
- provider、字段、公开快照、命令、隐私或安装行为变化时，同一提交内同步两版 README。
- 两份变更日志都在本 GitHub 仓库维护：`CHANGELOG.md` 是英文发布记录，`CHANGELOG-zh.md` 是中文日常记录；两份只写用户可感知事实，不写验证日志、内部过程或纯文档整理。
- 日常用中文把已完成的用户可感知变化写入 `CHANGELOG-zh.md`；准备发布（release）时按版本把同一版本的用户可感知条目同步进英文 `CHANGELOG.md`，两份都保留该版本记录，并核对版本、日期与 issue 链接。
- `README.md` 是英文默认版（npm 默认展示），`README-zh.md` 是同包附带的中文版；两份 README 与两份 changelog 都随 npm 包发布。发布前用 `npm pack --dry-run --ignore-scripts --json` 核对清单包含 `README.md`、`README-zh.md`、`CHANGELOG.md`、`CHANGELOG-zh.md`。
- `doc/`、`AGENTS.md` 等内部文件无需全译，保留中文历史文档即可。

## 文档与 Git

- provider、字段、公开快照、命令、隐私或安装行为变化 → 同步 `README.md` 与 `README-zh.md`；术语变化只更新 `doc/术语表.md`。
- 验证记录、来源与历史阶段追加到 `doc/references/`，不覆盖旧记录；本机原始现场放仓库根 `.artifacts/`（已被 Git 忽略）。
- 难逆转决定目前记在根 `README.md` 对应条目；本仓库无 `doc/决策档案/`，在另行定夺前不新造 ADR，也不移动现有措辞。
- 两份变更日志只记录用户可感知变化，不写验证日志、内部推翻项或纯文档整理。
- 未经用户明确要求，不执行 commit、push、tag、npm publish 或修改用户凭据。
