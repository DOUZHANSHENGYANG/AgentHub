use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub fn now_iso() -> String {
    chrono::Local::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    pub v: u32,
    pub saved_at: String,
    #[serde(default)]
    pub note: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Origin {
    pub harness: String,
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// 变量定义（正文里 {{name}} 的元数据）。旧文件没有这个字段 → 空数组，
    /// 正文无占位符时行为与之前完全一致。
    #[serde(default)]
    pub variables: Vec<crate::prompt_vars::PromptVariable>,
    #[serde(default)]
    pub versions: Vec<VersionEntry>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_transport")]
    pub transport: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub targets: Vec<String>,
    /// 是否已完成 targets 的初始回填（一次性迁移标志，防止用户移除后被重新加回）
    #[serde(default)]
    pub targets_initialized: bool,
    #[serde(default)]
    pub origin: Option<Origin>,
    #[serde(default)]
    pub versions: Vec<VersionEntry>,
    pub created_at: String,
    pub updated_at: String,
}

fn default_transport() -> String {
    "stdio".into()
}
fn default_version() -> String {
    "0.0.0".into()
}
fn default_status() -> String {
    "draft".into()
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMeta {
    pub name: String,
    pub dir_name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub versions: u32,
    #[serde(default)]
    pub has_assets: bool,
    #[serde(default)]
    pub content_len: usize,
    #[serde(default)]
    pub origin: Option<Origin>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default = "default_status")]
    pub status: String,
    /// 安全审查结论（来自 [vet]；空 = 从未审查）
    #[serde(default)]
    pub vet_verdict: String,
    #[serde(default)]
    pub vet_critical: u32,
    #[serde(default)]
    pub vet_high: u32,
    #[serde(default)]
    pub vet_medium: u32,
    #[serde(default)]
    pub vet_checked_at: String,
    /// 待人工复审的问题条数（已减去被忽略的）
    #[serde(default)]
    pub vet_pending: u32,
    /// 被人工忽略的问题条数
    #[serde(default)]
    pub vet_ignored: u32,
    #[serde(default)]
    pub stale: bool,
    #[serde(default)]
    pub has_toml: bool,
}

/// Skill document: metadata + parsed frontmatter + body (markdown after frontmatter)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDoc {
    pub meta: SkillMeta,
    pub frontmatter: BTreeMap<String, serde_json::Value>,
    pub body: String,
    #[serde(default)]
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub data_dir: String,
    #[serde(default = "default_lang")]
    pub language: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub skill_source_dirs: Vec<String>,
    /// 用户自定义的 harness 展示顺序（存 harness id）
    #[serde(default)]
    pub harness_order: Vec<String>,
}

fn default_lang() -> String {
    "zh".into()
}
fn default_theme() -> String {
    "dark".into()
}

/// 一条安全审查发现（持久化到 .hub.json，供「人工复审」界面逐条处置）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VetFindingRow {
    #[serde(default)]
    pub rule: String,
    #[serde(default)]
    pub severity: String,
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub line: usize,
    #[serde(default)]
    pub excerpt: String,
    /// 人工复审：已忽略该条
    #[serde(default)]
    pub ignored: bool,
    #[serde(default)]
    pub ignored_at: String,
}

/// 最近一次安全审查的完整快照（含逐条发现与人工复审痕迹）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VetReportRow {
    #[serde(default)]
    pub verdict: String,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub critical: u32,
    #[serde(default)]
    pub high: u32,
    #[serde(default)]
    pub medium: u32,
    #[serde(default)]
    pub content_hash: String,
    #[serde(default)]
    pub checked_at: String,
    #[serde(default)]
    pub checked_by: String,
    #[serde(default)]
    pub findings: Vec<VetFindingRow>,
    /// 人工复核结论："" | approved | rejected（覆盖机器 verdict 的展示）
    #[serde(default)]
    pub review: String,
    #[serde(default)]
    pub reviewed_at: String,
    #[serde(default)]
    pub review_note: String,
}

/// .hub.json sidecar next to SKILL.md (hub metadata, does not pollute the standard)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SkillHub {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub origin: Option<Origin>,
    #[serde(default)]
    pub versions: Vec<VersionEntry>,
    /// 最近一次审查的发现明细 + 人工复审状态（AgentHub 私有，不写入 SKILL.toml）
    #[serde(default)]
    pub vet_report: Option<VetReportRow>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSavePayload {
    #[serde(default)]
    pub dir_name: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub frontmatter: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirs {
    pub root: String,
    pub prompts: String,
    pub mcp: String,
    pub skills: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInfo {
    pub settings: Settings,
    pub data_dirs: DataDirs,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub prompts: usize,
    pub mcp: usize,
    pub skills: usize,
    pub total_bytes: u64,
}

/// 批量接入协议 / 审查 的单技能结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardOutcome {
    pub dir_name: String,
    pub ok: bool,
    pub created_toml: bool,
    pub version: String,
    pub verdict: String,
    pub level: String,
    pub critical: u32,
    pub high: u32,
    pub medium: u32,
    pub error: String,
}

/// 批量接入协议 / 审查 的汇总
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardReport {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub created: usize,
    pub rejected: usize,
    pub review: usize,
    pub install: usize,
    pub outcomes: Vec<OnboardOutcome>,
}

/// 单个技能的打包结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackOutcome {
    pub dir_name: String,
    pub name: String,
    pub version: String,
    pub ok: bool,
    /// 产物目录路径（成功时）
    pub path: String,
    /// 规范性警告（不阻断，但违反 SSEP 分发约定）
    pub warnings: Vec<String>,
    pub error: String,
}

/// 批量打包汇总
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackBatchReport {
    pub out_dir: String,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub warned: usize,
    /// 生成的仓库索引路径（out_dir/index.json）
    pub index_path: String,
    pub outcomes: Vec<PackOutcome>,
}

/// 技能目录树节点
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFileNode {
    /// 相对技能根目录的路径（用 / 分隔）
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    /// 扩展名（小写，不含点）
    pub ext: String,
    /// 预览类别：markdown | text | code | image | pdf | word | other
    pub kind: String,
    #[serde(default)]
    pub children: Vec<SkillFileNode>,
}

/// 文本类文件的读取结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFileContent {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub kind: String,
    pub size: u64,
    /// 文本内容（kind 为文本类时）
    pub text: String,
    /// 二进制内容的 base64（kind 为 image/pdf 时，供前端内联展示）
    pub data_base64: String,
    /// 是否因过大而截断
    pub truncated: bool,
    /// 不可预览时的说明
    pub note: String,
}
