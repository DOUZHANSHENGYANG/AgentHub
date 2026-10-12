# SKILL.toml — Skills 工程化扩展协议（SSEP v1.1）

> 状态：**正式规范**（本文档为协议唯一定义处）
> 参考实现：AgentHub（本仓库）
> 姊妹体系：dz-skill-manager / dz-skill-updater / dz-skill-vetter / dz-skill-finder

---

## 0. 一句话

技能目录新增一个 `SKILL.toml`，承载**版本、生命周期、来源与上游、依赖、宿主能力、审查、部署、分发**的全部扩展状态。宿主只认 `SKILL.md`，对此文件零感知。

## 1. 设计原则

| # | 原则 | 含义 |
|---|------|------|
| 1 | 单文件自包含 | 一个 SKILL.toml = 全部扩展状态，校验不依赖其他文件 |
| 2 | 宿主无感知 | 与 SKILL.md 并列；缺失时技能照常工作 |
| 3 | 渐进增强 | 文件缺失 = 最小态：`version=0.0.0`、`status=draft`、未审查 |
| 4 | hash 贯穿 | `content_hash`（技能文件树哈希）贯穿 vet/lifecycle/distribution，实现 STALE 自动判定 |
| 5 | 追加式历史 | `lifecycle.event` 只追加不修改；人读的 `changelog.md` 继续保留 |
| 6 | 写入权限分层 | 每个 section 有唯一合法写入者，工具写入留签名 |
| 7 | 本机状态可剥离 | `[deploy]` 为环境状态，打包时自动剥离 |

## 2. 分级结构（核心 + 可选模块）

```
SKILL.toml
├── §1 CORE（必须）──────── 协议存在的前提
│   [meta]      身份与版本（protocol/id/name/version/status）
│   [source]    来源 + 上游更新方式（含 [source.upstream] 子表）
│
├── §2 MODULES（全部可选）─── 按 section 存在性启用，互不依赖
│   [lineage]           父子 / 派生关系
│   [deps]              技能间使用依赖
│   [runtime]           运行时依赖 + 配置
│   [vet]               安全门禁
│   [eval]              质量评估
│   [lifecycle]         变更事件日志（推荐）
│
└── §3 ENV（本机状态，打包剥离）
    [deploy]
    [distribution]
```

### 协议档位（由 section 存在性自动判定）

| Profile | 包含 | 能力 |
|---|---|---|
| P0 minimal | CORE | 可分发、来源可追踪 |
| P1 tracked | + lifecycle | 版本史机器可读、STALE 可判定 |
| P2 governed | + vet (+eval) | 安装过门禁 |
| P3 engineered | + lineage / deps / runtime | 全工程化 |

## 3. 完整文件示例

```toml
# ============================================================
# SKILL.toml — Skills 工程化扩展协议 v1.1
# §1 CORE 必须存在；§2 各模块可选（出现才校验）；§3 打包剥离
# ============================================================

# ═══════════════ §1 CORE（必须） ═══════════════

[meta]                        # 身份（人建；version/status 仅工具改）
protocol = 1                  # 协议版本
id = "378f5585-07e7-43b8-a07a-9cb6aadbf658"   # 全局唯一，跨机器稳定
name = "ai-agents-in-depth"
version = "1.0.0"             # semver
status = "active"             # draft | active | deprecated | archived
authors = ["dz"]
summary = "《深入理解 AI Agent》全书知识库技能"

[source]                      # 来源与上游（含更新方式）——CORE 一部分
kind = "book-to-skill"        # git | url | local | book-to-skill | manual | skillpack
ref = "《深入理解 AI Agent》李博杰"
version = "v2.0 · 312页"
fetched_at = "2026-09-19"

  [source.upstream]           # 上游更新方式（可选子表；有则参与漂移检测）
  watch = true                # false = 不追踪
  mode = "git-scan"           # manual | git-scan | index | none
  remote = "git+https://…"
  last_check = ""
  remote_head = ""

# ═══════════════ §2 MODULES（全部可选） ═══════════════

[lineage]                     # ◇ 父子 / 派生（derive 写）
parent = ""                   # "name@version"
children = []

[deps]                        # ◇ 技能间使用依赖（人写）
# [[deps.item]]
# name = "book-to-skill"
# semver = ">=1.3"
# reason = "复用其 extract.py"

[runtime]                     # ◇ 运行时依赖与配置（人写）
requires_scripts = "optional" # none | optional | required
requires_network = "none"
min_protocol = 1
# config = "config.example.json"

[vet]                         # ◇ 安全门禁（dz-skill-vetter 写）
verdict = "INSTALL"           # INSTALL | REVIEW | REJECT
level = "LOW"                 # LOW | HIGH | EXTREME
critical = 0
high = 0
medium = 0
content_hash = "62419e51…"    # 审查时文件树哈希（STALE 判定主键）
checked_at = "2026-09-19T23:06:00"
checked_by = "dz-skill-vetter@1.2.0"

[eval]                        # ◇ 质量评估（dz-skill-creator 写）
last_run = ""
cases = 0
pass_rate = 0.0
tool = ""

[[lifecycle.event]]           # ◇ 变更事件（工具追加，append-only；推荐）
at = "2026-09-19T23:00:00"
action = "create"             # create|install|update|vet|deploy|deprecate|archive|import
level = ""                    # update 时记录 L1-L5 依据
note = ""
hash = "62419e51…"

# ═══════════════ §3 ENV（本机状态，打包剥离） ═══════════════

[deploy]                      # manager / AgentHub 写
# [[deploy.target]]
# host = "claude-code"
# mode = "junction"           # junction | copy
# path = "…"
# since = ""
# content_hash = ""           # 部署时哈希（对账）

[distribution]                # pack 工具写
pack_hash = ""
published_to = []
packed_at = ""
```

## 4. 写入权限矩阵

| Section | 唯一合法写入者 | 人手改 | 打包时 |
|---|---|---|---|
| `[meta]` | 人（version/status 仅工具） | ✅ | 保留 |
| `[source]` `[lineage]` `[deps]` `[runtime]` | finder / derive / 人 | ✅ | 保留 |
| `[vet]` `[eval]` `[upstream]` | vetter / creator / updater | ❌（`checked_by` 签名） | 保留 |
| `[lifecycle.event]` | 各工具追加 | ❌ append-only | 保留 |
| `[deploy]` | manager / AgentHub | ❌ | **剥离** |
| `[distribution]` | pack 工具 | ❌ | 保留 |

## 5. 生命周期状态机

```
create/import → [draft] ──vet INSTALL──▶ [active] ──L5──▶ [deprecated] → [archived]
                    │                        │ ▲
                vet REJECT → 阻断      hash 变更未复审│ │复审通过
                                            ▼┘
                                     active + STALE 警标
```

**STALE 规则（协议核心，无需新工具）**：
`[vet]` 存在时，校验 `H(tree) ≠ vet.content_hash` → 技能标记 **STALE**：可用，但一切部署/分发必须先过 vetter gate。
`H(tree)` = 对目录内全部文件（**排除** `SKILL.toml` 自身、`.hub.json`、`*.agenthub-*`）按相对路径排序后，`sha256(rel_path ⊥ 0x00 ⊥ sha256(content))`。

## 6. 版本规则（semver ↔ updater L1-L5）

| updater 级别 | version bump | 依赖方影响 |
|---|---|---|
| L1 微调 / L2 增补 | patch | 无感 |
| L3 结构 | minor | 建议跟进 |
| L4 语义 / L5 生命周期 | **major** | `detect --upstream` 提示需 L4 评估 |

`apply` 成功 = 工具 bump + 追加 `lifecycle.event`（level/note/hash）。

## 7. 分发

### 7.1 包格式 `.skillpack`

```text
<name>-<version>.skillpack/
├── SKILL.md
├── SKILL.toml        ← 已剥离 [deploy]
├── CHECKSUMS         ← 全文件 sha256
└── …支持文件
```

### 7.2 发布源 = git repo 的 `index.json`（无中心服务）

```jsonc
{
  "name": "book-to-skill",
  "versions": {
    "1.4.0": {
      "hash": "62419e51…",
      "ref": "git+https://…@v1.4.0",
      "vet": { "verdict": "INSTALL", "level": "LOW" }
    }
  }
}
```

### 7.3 安装流水线（8 步）

```
resolve(index) → fetch → verify CHECKSUMS → vetter gate(0/2/3)
→ requires vs 宿主能力 → deps 递归 → 落库 + deploy(junction)
→ 写 [deploy.target] + lifecycle.event(install)
```

## 8. 与既有体系映射

| skill.json 现字段 | SKILL.toml |
|---|---|
| `skill_id` / `source{}` | `[meta].id` / `[source]` |
| `ext.vet` | `[vet]` |
| `ext.upstream` | `[source.upstream]` |
| `ext.provenance` | `lifecycle.event`（三元组展开为事件） |
| `ext.lineage` | `[lineage]` |
| `registry.deployed_to` | `[deploy.target]`（registry 仍为本机权威） |

收敛策略：过渡期双写（SKILL.toml → skill.json 标准轨单向同步）；稳定后 skill.json 降为兼容产物。

## 9. 校验规则（validate）

1. `[meta].protocol=1`；`version` 合法 semver；`status` ∈ 枚举
2. `[vet]` 存在时：`content_hash` 为 64 位 hex；STALE 判定
3. `lifecycle.event` 时间戳单调递增
4. deprecated → 必须有 `superseded_by` 或明确 note
5. 权限矩阵：签名块（`checked_by` 非空）不可人改
6. `[deploy].target[].content_hash` 与库内不符 → 对账提示

## 10. 实施状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | CORE 生成/解析 + STALE 判定 + 事件追加（AgentHub 参考实现） | ✅ 本仓库 |
| P1 | updater/vetter 读写集成 | 计划 |
| P2 | pack/publish + index.json + 安装流水线 | 计划 |
| P3 | dz-* 全套接入 + GUI 下载页 | 计划 |
