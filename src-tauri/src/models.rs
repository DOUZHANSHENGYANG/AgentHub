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
}

fn default_lang() -> String {
    "zh".into()
}
fn default_theme() -> String {
    "dark".into()
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
