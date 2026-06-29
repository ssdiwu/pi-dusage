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

改动后至少执行（需先将本仓库作为本地 package 加入 `~/.pi/agent/settings.json`，本地路径直接读源码，改完即时生效）：

```bash
PI_SKIP_VERSION_CHECK=1 pi --no-session -p "/dusage"
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

## 文档沉淀出口

三个沉淀出口按边界分工，不混用：

- **`doc/术语表.md`** — 回答"这个词指什么"，收项目特有概念；定义"是什么"，不沾实现细节。惰性创建，术语敲定时当场写。
- **`doc/决策档案/`** — 回答"为什么这么定"，只收"难逆转 + 无上下文会困惑 + 有真实权衡"的决策（刻碑，记了就不删）。一条一文件，顺序编号 `0001-中文标题.md`（项目术语沿用术语表规范叫法）；维护 `README.md` 索引（编号 + 标题 + 一句话主旨），新增 / 更新 ADR 时同步。
- **`doc/经验笔记.md`** — 回答"这事儿怎么做"，收可改的做法与避坑经验（活页）。门槛：解决一个坑时，如果换一个无上下文的 agent 来会重走一遍，就值得记。格式：现象 + 做法 + 证据。重复发生时在原条目追加证据，不新建条目。

## 代码工程纪律

> 以下纪律适用于代码项目，由 `507-setup` 写入。源自全局 `~/.pi/agent/AGENTS.md` 的代码专属条款。

- **删除测试判断模块价值**：判断一个模块/抽象是否值得存在，想象删掉它——复杂度消失说明它只是透传（删）；复杂度在多个调用处重新出现，说明它在真正减负（留）。
- **接缝纪律**：只在真有变化的地方引入接口/抽象层。只有一个实现（adapter）的是"假设接缝"，两个以上不同实现才是真接缝；别为单一用法提前抽接口。
- **函数粒度**：函数控制在 100 行以内；超出则考虑拆分。
- **测试看行为**：测试优先通过公共接口验证行为，不测内部实现；mock 只放在系统边界。
- **先建反馈环再调 bug**：调 bug 先造一个快速、确定性、agent 能跑的 pass/fail（成败）信号（失败测试/curl/CLI 重放/headless 等）；没有反馈环就别盯着代码空猜，列已试方法后求助用户。信号是 90% 的调试，其余是机械操作。
- **插桩打 tag**：所有临时 debug 日志打唯一前缀 tag（如 `[DEBUG-a4f2]`），清理时一个 grep 全删；未打 tag 的临时日志会残留。
