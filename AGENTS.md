# AGENTS.md — pi-dusage

## 先读

1. `README.md`：功能范围、已支持 provider（提供方）、命令行为、安装与验证。
2. `doc/README.md`：文档入口。
3. `doc/术语表.md`：项目术语。
4. `index.ts`：唯一扩展入口与实现。

## 项目结构

```text
pi-dusage/
├── AGENTS.md
├── README.md
├── doc/
│   ├── README.md
│   └── 术语表.md
├── index.ts
└── package.json
```

## 代码边界

- 第一版只支持 3 个 provider：`openai-codex`、`zai-coding-cn`、`minimax-cn`。
- 只做 slash command（斜杠命令）`/dusage`，不做 footer（页脚）常驻展示。
- TUI 模式使用自绘 overlay（覆盖层）展示进度条样式；非 TUI 模式保持纯文本输出。
- 只读取本机已有 `auth.json`，不新增登录流程，不改用户凭据。
- 只显示额度信息，不显示服务状态页告警。
- 不输出明文密钥。

## 验证

改动后至少执行：

```bash
PI_SKIP_VERSION_CHECK=1 pi --no-extensions --extension ./index.ts --no-session -p "/dusage"
```
