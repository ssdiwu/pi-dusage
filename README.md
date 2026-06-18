# pi-dusage

`pi-dusage` 是一个最小的 Pi `extension`（扩展）包，用来查看订阅 / 套餐 provider（提供方）的 quota（配额）使用情况。

## 第一版范围

当前只接入 3 个已验证路径：

- `openai-codex`
- `zai-coding-cn`
- `minimax-cn`

不包含：

- `volcengine-ark-coding`
- footer（页脚）常驻显示
- 自定义登录流程
- 服务状态页告警

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
- `zai-coding-cn` 和 `minimax-cn` 保留 provider 原始字段语义，不强行假设所有窗口都等价于“5h + 周”

## 安装

把本仓库路径加入 `~/.pi/agent/settings.json` 的 `packages`：

```json
"../../Documents/Codes/Githubs/pi-dusage"
```

然后在 Pi 中执行：

```text
/reload
```

## 开发验证

```bash
cd /Users/diwu/Documents/Codes/Githubs/pi-dusage
PI_SKIP_VERSION_CHECK=1 pi --no-extensions --extension ./index.ts --no-session -p "/dusage"
```
