# AgentHub

AI 提示词 / MCP / Skills 集中管理台 —— Windows 10/11 绿色桌面应用。

## 功能

- **提示词管理**：标签、版本历史（内容变更自动存档，最多 50 版）、一键复制、搜索过滤
- **MCP 管理**：标准 `mcpServers` 规范建模（stdio / http / sse），标准 JSON 导出、启用开关、来源标记
- **Skills 管理（核心）**：遵循 SKILL.md 标准规范（YAML frontmatter：name / description + Markdown 正文），标签存储于 `.hub.json` sidecar（不污染标准），Markdown 预览 / 编辑 / 版本回滚
- **本机统一收集（Hub）**：探测本机各 AI 工具的 MCP 与 Skills 配置，一键收集中枢；反向「应用」把中枢配置分发到各工具（写入前自动备份 `.agenthub-bak-*`）
  - 已支持：Claude Code（`~/.claude.json` + `~/.claude/skills`）、Claude Desktop、Cursor、Windsurf、Codex CLI（config.toml）、Gemini CLI、VS Code (Copilot MCP)、Cline、自定义扫描目录
- **自定义数据目录**：默认跟随 exe（`<exe>/data`，绿色便携），可随时更改；目录结构 `prompts/ · mcp/ · skills/`
- **自定义窗口标题栏**：无原生边框，拖拽区 / 最小化 / 最大化 / 关闭
- **明暗主题**：View Transitions 实现 —— 明→暗自点击点圆形辐射扩散，暗→明反向收拢为一点
- **中英文切换**：i18next，即时生效并持久化
- **启动无白闪**：窗口隐藏启动 + WebView 底色预置 + UI 就绪后 `show()`（Rust 侧 8s 兜底）

## 技术栈

Tauri 2 · React 19 · TypeScript · Tailwind CSS 4（token 化设计系统）· beUI（motion 动效组件）· GSAP（页面转场 / 列表 stagger）· Zustand · Radix primitives · Lucide 图标 · i18next

## 开发

```bash
npm install
npm run tauri dev     # 开发调试
npm run tauri build   # 产出安装包 + 绿色 exe（src-tauri/target/release/AgentHub.exe）
```

前端校验：`npm run build`（tsc + vite）；后端校验：`cd src-tauri && cargo check`

## 数据格式

- `prompts/<uuid>.json`：`{ id, title, description, content, tags[], versions[], createdAt, updatedAt }`
- `mcp/<uuid>.json`：`{ id, name, transport, command, args[], env{}, url, headers{}, tags[], enabled, origin, versions[] }`
- `skills/<name>/SKILL.md` + `skills/<name>/.hub.json`（tags / origin / 版本快照）

## 路线图（二期）

Skills 标准协议扩展：流水线审查 · 下载 · 更新的管理机制。
