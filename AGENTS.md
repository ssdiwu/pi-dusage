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

## TUI 边界防护

- `/dusage` 的 quota 查询、格式化和命令返回不能依赖 overlay 渲染成功；TUI 只是展示层。
- overlay、状态提示和错误提示路径必须防御 Pi 主程序 TUI 抛错（典型症状：`Spacer is not defined`）。
- TUI 渲染失败时必须降级为纯文本结果或可读错误信息，不能吞掉 provider 查询结果，也不能输出明文 token / key。
- 涉及 overlay、刷新、错误提示或 pi-di18n 文案联动的改动，必须验证非 TUI 纯文本路径仍可用。

## 验证

改动后至少执行：

```bash
PI_SKIP_VERSION_CHECK=1 pi --no-extensions --extension ./index.ts --no-session -p "/dusage"
```

## 发版流程

发布 npm 版本前必须走同一条链路：

1. 同步版本号：`package.json` + `package-lock.json`（如存在 lock 版本字段）。
2. 更新 `CHANGELOG.md`，把本次用户可见变更落到新版本段。
3. 确认 `package.json` 版本、`CHANGELOG.md` 版本段、`git tag v<x.y.z>` 三者一致。
4. 运行验证：`npm run check` + 上面的 Pi 非 TUI 命令；涉及 overlay 时再做真实 TUI smoke test。
5. 提交单一主题 commit，再 `git tag v<x.y.z>`。
6. 发布：`npm publish`；发布后 `git push && git push --tags`。

## Git 规范

- 每次 commit 只做一件事。
- 提交标题默认中文，格式：`分类：动作 + 对象`。
- 提交前检查变更范围，避免混入无关改动。
- 禁止 `git push --force` 到 `main`。
