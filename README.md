# pi-dusage

`pi-dusage` 是一个最小的 Pi `extension`（扩展）包，用来查看订阅 / 套餐 provider（提供方）的 quota（配额）使用情况。

## 第一版范围

当前只接入 3 个已验证路径：

- `openai-codex`
- `zai-coding-cn`
- `minimax-cn`

不包含：

- `volcengine-ark-coding`
- 自定义 Footer（页脚）组件（不调用 `ctx.ui.setFooter()`）
- 自定义登录流程
- 服务状态页告警

`pi-dusage` 会保留 Pi 原生 Footer 的 `setStatus("dusage", ...)` 文本回退；安装 `pi-dstatus` 后，由订阅者清除该回退并负责视觉展示。

## 命令

只注册一个 slash command（斜杠命令）：

```text
/dusage
```

行为：

- 在 TUI（终端交互界面）模式下，使用 overlay（覆盖层）面板显示结果，样式接近传统 usage 卡片，并提供：
  - `r` 刷新
  - `Esc` 退出
- 在 `pi -p` 等非 TUI 模式下输出纯文本，便于快速验证。

## 数据来源

### `openai-codex`
- 认证：`~/.pi/agent/auth.json` → `openai-codex`
- 接口：`https://chatgpt.com/backend-api/wham/usage`

### `zai-coding-cn`
- 认证：`~/.pi/agent/auth.json` → `zai-coding-cn`
- 接口：`https://bigmodel.cn/api/monitor/usage/quota/limit`

### `minimax-cn`
- 认证：`~/.pi/agent/auth.json` → `minimax-cn`
- 接口：`https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains`

## 输出原则

- 不显示明文 token（令牌）或 key（密钥）
- 只显示可理解的窗口、百分比、重置时间
- `openai-codex` 除通用额度外，也展示服务端 `additional_rate_limits` 返回的独立额度卡片；卡片标题使用 API 返回的名称，不硬编码模型版本
- `zai-coding-cn` 保留 provider 原始字段语义，不强行假设所有窗口都等价于“5h + 周”
- `minimax-cn` 只展示服务端 `general` 类别的 5 小时与周窗口；不将 `video` 等多模态分类误导为独立套餐额度
- 窗口排序：统一按重置时间升序，短窗口（如 5h）在上、长窗口（week / month）在下，不依赖各 provider API 的返回顺序
- 用量条语义：进度条表示「剩余配额」——剩余越多填充越满且越绿，将耗尽时变红；右侧仍显示可使用量百分比
- 单个 provider 请求超时或失败时，只在该 provider 卡片内显示错误，不中断其余 provider 的结果展示

## 结构化 quota 事件

`pi-dusage` 通过 Pi 事件总线提供给其他扩展消费的结构化快照：

- `pi-dusage/subscribe` / `pi-dusage/unsubscribe`：载荷为 `{ version: 1, consumerId: string }`，消费者按稳定 `consumerId` 幂等管理。
- `pi-dusage/updated`：发布 `DUsageSnapshot`，包含版本、抓取时间、provider、窗口剩余百分比和安全错误信息；不包含 token、key 或认证对象。
- 会话启动立即查询并开始 60 秒刷新；无订阅者时仍持续刷新。
- 首个消费者订阅时清除 `dusage` status，最后一个消费者取消后恢复最近可用额度；全部失败且曾成功时标记为 stale，从未成功则隐藏 status。
- 单个 provider 失败不会阻断完整快照发布；并发刷新会复用进行中的请求。

`pi-dusage` 不调用 `ctx.ui.setFooter()`；`pi-dstatus` 可据此独占 Footer 视觉展示。

## Fast Mode 适配

安装 `pi-dfast` 后，`pi-dusage` 会消费公开的 `pi-dfast/updated` 快照。当当前会话的 Fast Mode（快速模式）首次变为对当前 `openai-codex` 模型活动，或活动模型发生变化时，立即合并触发一次 quota 刷新；重复快照不会产生额外请求。

这条适配只缩短 Fast quota（快速配额）状态进入用量快照的等待时间：`pi-dusage` 不读取 `pi-dfast` 私有配置，也不控制 Fast Mode。

## 国际化

所有可见文案通过 pi-di18n 的 `pi-i18n/requestApi` 事件接入多语言，内置 `en` 与 `zh-CN` 两套文案：

- 已安装 pi-di18n：注册 `dusage` namespace bundle，文案跟随 `/lang` 选择的语言；locale 切换后 overlay 自动重渲染。
- 未安装 pi-di18n：回退到内置查表，按 `LANG` / `LC_ALL` 环境变量选择 `zh-CN` 或 `en`，不抛错。

## 安装

### 通过 npm 安装（推荐）

```bash
pi install npm:@diwu507/pi-dusage
```

安装后在 Pi 中执行：

```text
/reload
```

也可以直接把包名加入 `~/.pi/agent/settings.json` 的 `packages`：

```json
"npm:@diwu507/pi-dusage"
```

### 本地开发安装

把本仓库路径加入 `~/.pi/agent/settings.json` 的 `packages`：

```json
"/Users/diwu/Workspace/Codes/Githubs/pi-dusage"
```

然后在 Pi 中执行：

```text
/reload
```

## 开发验证

需先将本仓库按「本地开发安装」加入 `~/.pi/agent/settings.json` 的 `packages`（本地路径直接读源码 `index.ts`，改完即时生效，无需重新安装）：

```bash
PI_SKIP_VERSION_CHECK=1 pi --no-session -p "/dusage"
```
