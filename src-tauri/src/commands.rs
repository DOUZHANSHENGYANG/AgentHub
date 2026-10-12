use crate::harness::{self, ApplyResult, HarnessReport, ImportResult, ImportSelection, PreImportResult};
use crate::items;
use crate::models::*;
use crate::skills;
use crate::store::{self, AppH};
use serde_json::Value;

#[tauri::command]
pub fn get_settings(app: AppH) -> Result<SettingsInfo, String> {
    Ok(store::settings_info(&app))
}

#[tauri::command]
pub fn set_data_dir(app: AppH, path: String) -> Result<SettingsInfo, String> {
    let mut s = store::load_settings(&app);
    s.data_dir = path.trim().to_string();
    store::save_settings(&app, &s)?;
    store::ensure_layout(&store::data_root(&app))?;
    Ok(store::settings_info(&app))
}

#[tauri::command]
pub fn set_prefs(app: AppH, language: Option<String>, theme: Option<String>) -> Result<SettingsInfo, String> {
    let mut s = store::load_settings(&app);
    if let Some(l) = language {
        s.language = l;
    }
    if let Some(t) = theme {
        s.theme = t;
    }
    store::save_settings(&app, &s)?;
    Ok(store::settings_info(&app))
}

#[tauri::command]
pub fn add_skill_source_dir(app: AppH, path: String) -> Result<SettingsInfo, String> {
    let mut s = store::load_settings(&app);
    if !s.skill_source_dirs.contains(&path) {
        s.skill_source_dirs.push(path);
        store::save_settings(&app, &s)?;
    }
    Ok(store::settings_info(&app))
}

#[tauri::command]
pub fn remove_skill_source_dir(app: AppH, path: String) -> Result<SettingsInfo, String> {
    let mut s = store::load_settings(&app);
    s.skill_source_dirs.retain(|x| x != &path);
    store::save_settings(&app, &s)?;
    Ok(store::settings_info(&app))
}

#[tauri::command]
pub fn list_prompts(app: AppH) -> Result<Vec<Prompt>, String> {
    items::list_prompts(&app)
}

#[tauri::command]
pub fn save_prompt(app: AppH, prompt: Prompt) -> Result<Prompt, String> {
    items::save_prompt(&app, prompt)
}

#[tauri::command]
pub fn delete_prompt(app: AppH, id: String) -> Result<(), String> {
    items::delete_prompt(&app, &id)
}

#[tauri::command]
pub fn list_mcp(app: AppH) -> Result<Vec<McpServer>, String> {
    items::list_mcp(&app)
}

#[tauri::command]
pub fn save_mcp(app: AppH, server: McpServer) -> Result<McpServer, String> {
    items::save_mcp(&app, server)
}

#[tauri::command]
pub fn delete_mcp(app: AppH, id: String) -> Result<(), String> {
    items::delete_mcp(&app, &id)
}

#[tauri::command]
pub fn export_mcp_config(app: AppH, ids: Vec<String>) -> Result<Value, String> {
    let all = items::list_mcp(&app)?;
    let selected: Vec<McpServer> = if ids.is_empty() {
        all
    } else {
        all.into_iter().filter(|s| ids.contains(&s.id)).collect()
    };
    Ok(items::export_config(&selected))
}

#[tauri::command]
pub fn list_skills(app: AppH) -> Result<Vec<SkillMeta>, String> {
    skills::list_skills(&app)
}

#[tauri::command]
pub fn read_skill(app: AppH, dir_name: String) -> Result<SkillDoc, String> {
    skills::read_skill(&app, &dir_name)
}

#[tauri::command]
pub fn save_skill(app: AppH, payload: SkillSavePayload) -> Result<SkillMeta, String> {
    skills::save_skill(&app, payload)
}

#[tauri::command]
pub fn import_skill_folder(app: AppH, path: String, overwrite: bool) -> Result<SkillMeta, String> {
    let src = std::path::PathBuf::from(&path);
    if !src.is_dir() {
        return Err("所选路径不是文件夹".into());
    }
    let name = skills::import_skill_dir(&app, &src, overwrite)?;
    let meta = skills::read_skill(&app, &name)?;
    Ok(meta.meta)
}

#[tauri::command]
pub fn delete_skill(app: AppH, dir_name: String) -> Result<(), String> {
    skills::delete_skill(&app, &dir_name)
}

#[tauri::command]
pub fn scan_harnesses(app: AppH) -> Result<Vec<HarnessReport>, String> {
    Ok(harness::scan(&app))
}
#[tauri::command]
pub fn import_from_harness(
    app: AppH,
    harness: String,
    kind: String,
    selections: Vec<ImportSelection>,
) -> Result<ImportResult, String> {
    Ok(harness::import(&app, &harness, &kind, &selections))
}

#[tauri::command]
pub fn pre_import(app: AppH, harness: String, kind: String, names: Vec<String>) -> Result<PreImportResult, String> {
    Ok(harness::pre_import(&app, &harness, &kind, &names))
}

#[tauri::command]
pub fn apply_to_harness(app: AppH, harness: String, kind: String, names: Vec<String>) -> Result<ApplyResult, String> {
    Ok(harness::apply(&app, &harness, &kind, &names))
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if p.exists() {
        tauri_plugin_opener::reveal_item_in_dir(&p).map_err(|e| e.to_string())
    } else if let Some(parent) = p.parent() {
        std::process::Command::new("explorer")
            .arg(parent)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    } else {
        Err("路径不存在".into())
    }
}

#[tauri::command]
pub fn storage_stats(app: AppH) -> Result<StorageStats, String> {
    let root = store::data_root(&app);
    let count_json = |dir: std::path::PathBuf| -> usize {
        std::fs::read_dir(dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
                    .count()
            })
            .unwrap_or(0)
    };
    let count_dirs = |dir: std::path::PathBuf| -> usize {
        std::fs::read_dir(dir)
            .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).count())
            .unwrap_or(0)
    };
    Ok(StorageStats {
        prompts: count_json(root.join("prompts")),
        mcp: count_json(root.join("mcp")),
        skills: count_dirs(root.join("skills")),
        total_bytes: store::dir_size(&root),
    })
}

#[tauri::command]
pub fn skill_extension(app: AppH, dir_name: String) -> Result<serde_json::Value, String> {
    use crate::skill_toml;
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    let doc = skill_toml::load(&dir).map(|v| serde_json::to_value(&v).unwrap_or(serde_json::Value::Null));
    let violations = skill_toml::validate(&dir)?;
    let tree_hash = skill_toml::tree_hash(&dir).unwrap_or_default();
    Ok(serde_json::json!({
        "doc": doc,
        "stale": skill_toml::is_stale(&dir),
        "treeHash": tree_hash,
        "violations": violations,
        "hasToml": doc.is_some(),
    }))
}

#[tauri::command]
pub fn set_skill_status(app: AppH, dir_name: String, status: String, superseded_by: String) -> Result<SkillMeta, String> {
    use crate::skill_toml;
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    skill_toml::set_status(&dir, &status, &superseded_by)?;
    skills::read_skill(&app, &dir_name).map(|d| d.meta)
}

#[tauri::command]
pub fn pack_skill(app: AppH, dir_name: String, out_dir: String) -> Result<String, String> {
    use crate::skill_toml;
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    let out = std::path::PathBuf::from(&out_dir);
    if !out.is_dir() {
        return Err("输出目录不存在".into());
    }
    skill_toml::pack(&dir, &out).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn vet_skill(app: AppH, dir_name: String) -> Result<serde_json::Value, String> {
    use crate::{skill_toml, vet};
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    let report = vet::run(&dir)?;
    skill_toml::load(&dir)  // 仅当已接入协议时写回 [vet]
        .ok_or("该技能尚未接入 SKILL.toml 协议：请先在编辑中保存一次")?;
    vet::write_vet(&dir, &report)?;
    Ok(serde_json::to_value(&report).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
pub fn install_skillpack(app: AppH, path: String, overwrite: bool) -> Result<crate::install::InstallReport, String> {
    let pack = std::path::PathBuf::from(&path);
    if !pack.is_dir() {
        return Err("所选路径不是文件夹".into());
    }
    let hub = store::data_root(&app).join("skills");
    crate::install::install_skillpack(&pack, &hub, overwrite)
}

#[tauri::command]
pub fn parse_skill_index(path: String) -> Result<crate::registry::ResolvedIndex, String> {
    crate::registry::parse_index(std::path::Path::new(&path))
}

#[tauri::command]
pub fn install_from_index(
    app: AppH,
    path: String,
    name: String,
    version: String,
    overwrite: bool,
) -> Result<crate::install::InstallReport, String> {
    let hub = store::data_root(&app).join("skills");
    crate::registry::install_from_index(std::path::Path::new(&path), &name, &version, &hub, overwrite)
}

#[tauri::command]
pub fn check_upstream(app: AppH, dir_name: String) -> Result<crate::upstream::UpstreamReport, String> {
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    crate::upstream::check(&dir)
}

#[tauri::command]
pub fn update_skill_ext(
    app: AppH,
    dir_name: String,
    deps: Option<Vec<crate::skill_toml::DepItem>>,
    runtime: Option<crate::skill_toml::RuntimeCfg>,
    upstream: Option<crate::skill_toml::UpstreamCfg>,
) -> Result<SkillMeta, String> {
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    crate::skill_toml::update_ext(&dir, deps, runtime, upstream)?;
    skills::read_skill(&app, &dir_name).map(|d| d.meta)
}

#[tauri::command]
pub fn git_fetch_skills(url: String) -> Result<serde_json::Value, String> {
    use std::process::Command;
    let url = url.trim().to_string();
    if url.is_empty() || !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with("git@")) {
        return Err("请输入有效的 https:// 或 git@ 仓库地址".into());
    }
    let id = crate::models::new_id();
    let tmp = std::env::temp_dir().join(format!("agenthub-git-{id}"));
    let _ = std::fs::remove_dir_all(&tmp);
    let out = Command::new("git")
        .args(["clone", "--depth", "1", &url])
        .arg(&tmp)
        .output();
    let Ok(out) = out else {
        return Err("git 不可用（未安装或不在 PATH）".into());
    };
    if !out.status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err(format!(
            "clone 失败: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    // 自动发现技能目录（含 SKILL.md；跳过 .git；限制深度与数量）
    fn walk(dir: &std::path::Path, base: &std::path::Path, depth: u32, out: &mut Vec<serde_json::Value>) {
        if depth > 5 || out.len() >= 200 {
            return;
        }
        for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name == ".git" || name.starts_with('.') {
                continue;
            }
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            if p.join("SKILL.md").exists() {
                let text = std::fs::read_to_string(p.join("SKILL.md")).unwrap_or_default();
                let (fm, _) = crate::skills::split_doc(&text);
                let skill_name = {
                    let n = crate::skills::fm_get_str(&fm, "name");
                    if n.is_empty() {
                        p.file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default()
                    } else {
                        n
                    }
                };
                out.push(serde_json::json!({
                    "path": p.to_string_lossy(),
                    "name": skill_name,
                    "description": crate::skills::fm_get_str(&fm, "description"),
                }));
            } else {
                walk(&p, &base.join(&name), depth + 1, out);
            }
        }
    }
    let mut skills: Vec<serde_json::Value> = Vec::new();
    walk(&tmp, std::path::Path::new(""), 0, &mut skills);
    Ok(serde_json::json!({
        "tempDir": tmp.to_string_lossy(),
        "skills": skills,
    }))
}

#[tauri::command]
pub fn cleanup_git_temp(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    let allowed = std::env::temp_dir();
    let is_temp = p.starts_with(&allowed)
        && p.file_name()
            .map(|n| n.to_string_lossy().starts_with("agenthub-git-"))
            .unwrap_or(false);
    if !is_temp {
        return Err("路径不在允许的临时目录内".into());
    }
    if p.exists() {
        std::fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn sync_status(app: AppH) -> Result<crate::gitsync::SyncStatus, String> {
    crate::gitsync::status(&app)
}

#[tauri::command]
pub fn sync_set_remote(app: AppH, url: String) -> Result<(), String> {
    crate::gitsync::set_remote(&app, &url)
}

#[tauri::command]
pub fn sync_push(app: AppH, message: String, authed: bool, provider: String) -> Result<String, String> {
    crate::gitsync::push(&app, &message, authed, &provider)
}

#[tauri::command]
pub fn sync_pull(app: AppH, authed: bool, provider: String) -> Result<String, String> {
    crate::gitsync::pull(&app, authed, &provider)
}

#[tauri::command]
pub fn auth_status(app: AppH) -> Result<serde_json::Value, String> {
    crate::auth::has_auth(&app)
}

#[tauri::command]
pub fn auth_github_start() -> Result<crate::auth::DeviceCodeSession, String> {
    crate::auth::github_start()
}

#[tauri::command]
pub fn auth_github_poll(app: AppH, device_code: String) -> Result<crate::auth::AuthResult, String> {
    crate::auth::github_poll(&app, &device_code)
}

#[tauri::command]
pub fn auth_save_pat(app: AppH, provider: String, pat: String) -> Result<crate::auth::AuthResult, String> {
    crate::auth::save_pat(&app, &provider, &pat)
}

#[tauri::command]
pub fn auth_logout(app: AppH) -> Result<(), String> {
    crate::auth::logout(&app)
}

#[tauri::command]
pub fn auth_create_repo(app: AppH, provider: String) -> Result<String, String> {
    crate::auth::create_backup_repo(&app, &provider)
}
