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
pub fn set_harness_order(app: AppH, order: Vec<String>) -> Result<SettingsInfo, String> {
    let mut s = store::load_settings(&app);
    s.harness_order = order;
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

/// 从 ZIP 包导入技能（自动解压，支持内含一层根目录）
#[tauri::command]
pub async fn import_skill_zip(app: AppH, path: String, overwrite: bool) -> Result<SkillMeta, String> {
    let name = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        let path = path.clone();
        move || skills::import_skill_zip(&app, &path, overwrite)
    })
    .await
    .map_err(|e| format!("任务失败: {e}"))??;
    let meta = skills::read_skill(&app, &name)?;
    Ok(meta.meta)
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
pub fn clear_skill_versions(app: AppH, dir_name: String) -> Result<u32, String> {
    skills::clear_skill_versions(&app, &dir_name)
}

#[tauri::command]
pub fn release_skill_version(
    app: AppH,
    dir_name: String,
    level: String,
    note: String,
) -> Result<serde_json::Value, String> {
    let (version, snapshot) = skills::release_version(&app, &dir_name, &level, &note)?;
    Ok(serde_json::json!({ "version": version, "snapshot": snapshot }))
}

#[tauri::command]
pub fn ensure_skill_protocol(app: AppH, dir_name: String) -> Result<serde_json::Value, String> {
    let (created, version) = skills::ensure_protocol(&app, &dir_name)?;
    Ok(serde_json::json!({ "created": created, "version": version }))
}

#[tauri::command]
pub async fn scan_harnesses(app: AppH) -> Result<Vec<HarnessReport>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(harness::scan(&app)))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
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
pub fn read_harness_config(app: AppH, harness: String) -> Result<Value, String> {
    harness::read_config(&app, &harness)
}

#[tauri::command]
pub fn write_harness_config(app: AppH, harness: String, text: String) -> Result<Value, String> {
    harness::write_config(&app, &harness, &text)
}

#[tauri::command]
pub fn merge_harness_config(app: AppH, harness: String, text: String, json: String) -> Result<String, String> {
    harness::merge_mcp_json(&app, &harness, &text, &json)
}

#[tauri::command]
pub fn remove_from_harness(app: AppH, harness: String, kind: String, names: Vec<String>) -> Result<ApplyResult, String> {
    if kind != "mcp" {
        return Err("仅支持 MCP 条目移除".into());
    }
    Ok(harness::remove_mcp(&app, &harness, &names))
}

/// 技能目录树
#[tauri::command]
pub fn list_skill_files(app: AppH, dir_name: String) -> Result<crate::models::SkillFileNode, String> {
    skills::list_skill_files(&app, &dir_name)
}

/// 读取技能内的文件（实时阅读）
#[tauri::command]
pub fn read_skill_file(app: AppH, dir_name: String, rel_path: String) -> Result<crate::models::SkillFileContent, String> {
    skills::read_skill_file(&app, &dir_name, &rel_path)
}

/// 用系统默认程序打开技能内的某个文件（PDF / Word / 表格等无法内联预览的类型）。
/// 由后端拼绝对路径并做目录穿越校验，避免前端依赖本机路径分隔符。
#[tauri::command]
pub fn open_skill_file(app: AppH, dir_name: String, rel_path: String) -> Result<(), String> {
    let p = skills::resolve_skill_file(&app, &dir_name, &rel_path)?;
    tauri_plugin_opener::open_path(&p, None::<&str>).map_err(|e| e.to_string())
}

/// 用系统默认程序打开任意路径（用于打开导出目录等）
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {path}"));
    }
    tauri_plugin_opener::open_path(&p, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if p.exists() {
        tauri_plugin_opener::reveal_item_in_dir(&p).map_err(|e| e.to_string())
    } else if let Some(parent) = p.parent() {
        crate::store::silent_command("explorer")
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

/// 批量打包为规范 .skillpack，并在输出目录生成 index.json。
#[tauri::command]
pub async fn pack_skills_batch(
    app: AppH,
    dir_names: Vec<String>,
    out_dir: String,
) -> Result<crate::models::PackBatchReport, String> {
    tauri::async_runtime::spawn_blocking(move || skills::pack_many(&app, &dir_names, &out_dir))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

/// 打包前的规范性预检（不写盘），用于前端提前提示
#[tauri::command]
pub fn check_pack_ready(app: AppH, dir_name: String) -> Result<Vec<String>, String> {
    let dir = store::data_root(&app).join("skills").join(&dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    crate::skill_toml::check_pack_ready(&dir).map(|(_, _, w)| w)
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

/// 读取某技能的审查报告（含逐条发现 + 人工复审状态）。
#[tauri::command]
pub fn read_vet_report(app: AppH, dir_name: String) -> Result<Option<crate::models::VetReportRow>, String> {
    skills::read_vet_report(&app, &dir_name)
}

/// 人工复审：忽略 / 恢复单条发现。返回 (待复核数, 已忽略数)。
#[tauri::command]
pub fn review_vet_finding(
    app: AppH,
    dir_name: String,
    rule: String,
    file: String,
    line: usize,
    ignored: bool,
) -> Result<(u32, u32), String> {
    skills::review_finding(&app, &dir_name, &rule, &file, line, ignored)
}

/// 人工复审：忽略全部未忽略的发现。返回忽略条数。
#[tauri::command]
pub fn ignore_all_vet_findings(app: AppH, dir_name: String) -> Result<u32, String> {
    skills::ignore_all_findings(&app, &dir_name)
}

/// 人工复审：给出整体复核结论（approved / rejected / 空 = 清除）。
#[tauri::command]
pub fn set_vet_review(app: AppH, dir_name: String, verdict: String, note: String) -> Result<(), String> {
    skills::set_review_verdict(&app, &dir_name, &verdict, &note)
}

/// 一键为技能生成 SKILL.toml 并自动安全审查（批量）。
#[tauri::command]
pub async fn onboard_skills_batch(
    app: AppH,
    dir_names: Vec<String>,
    only_missing: bool,
    vet: bool,
) -> Result<crate::models::OnboardReport, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(skills::onboard_many(&app, &dir_names, only_missing, vet)))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

/// 为技能补一条初始版本快照（用于把历史技能纳入版本管理）。
/// 一次性修复历史遗留的 tags 畸形数据（如 '["自习"]'）。
#[tauri::command]
pub fn repair_skill_tags(app: AppH) -> Result<serde_json::Value, String> {
    let (fixed, detail) = skills::repair_tags(&app)?;
    Ok(serde_json::json!({ "fixed": fixed, "skills": detail }))
}

#[tauri::command]
pub fn seed_skill_version(app: AppH, dir_name: String, note: String) -> Result<bool, String> {
    skills::seed_version(&app, &dir_name, &note)
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
    // 明细落盘，供人工复审逐条处置
    let _ = skills::save_vet_report(&app, &dir_name, &report);
    Ok(serde_json::to_value(&report).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
pub async fn install_skillpack(app: AppH, path: String, overwrite: bool) -> Result<crate::install::InstallReport, String> {
    tauri::async_runtime::spawn_blocking(move || crate::install::install_skillpack(std::path::Path::new(&path), &crate::store::data_root(&app).join("skills"), overwrite))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

#[allow(dead_code)]
fn install_skillpack_blocking(app: AppH, path: String, overwrite: bool) -> Result<crate::install::InstallReport, String> {
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

// ---------------- 腾讯 SkillHub 市场（skillhub.cn） ----------------

/// 搜索 / 浏览市场。网络请求是阻塞的，放后台线程池避免冻结 UI。
#[tauri::command]
pub async fn skillhub_search(
    keyword: String,
    category: String,
    source: String,
    sort: String,
    page: u32,
    page_size: u32,
) -> Result<crate::skillhub::MarketPage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::skillhub::search(&keyword, &category, &source, &sort, page, page_size)
    })
    .await
    .map_err(|e| format!("任务失败: {e}"))?
}

#[tauri::command]
pub async fn skillhub_categories() -> Result<Vec<crate::skillhub::MarketCategory>, String> {
    tauri::async_runtime::spawn_blocking(crate::skillhub::categories)
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

/// 批量安装所选技能：逐个下载 ZIP → 复用 `import_skill_zip`（同一套 zip-slip / zip-bomb 防护）
#[tauri::command]
pub async fn skillhub_install(
    app: AppH,
    targets: Vec<crate::skillhub::InstallTarget>,
    overwrite: bool,
) -> Result<Vec<crate::skillhub::MarketInstallReport>, String> {
    tauri::async_runtime::spawn_blocking(move || crate::skillhub::install(&app, &targets, overwrite))
        .await
        .map_err(|e| format!("任务失败: {e}"))
}
#[tauri::command]
pub async fn git_fetch_skills(url: String) -> Result<serde_json::Value, String> {
    // git clone 是阻塞操作，放到后台线程池，避免冻结 UI
    tauri::async_runtime::spawn_blocking(move || git_fetch_skills_blocking(url))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

fn git_fetch_skills_blocking(url: String) -> Result<serde_json::Value, String> {
    let url = url.trim().to_string();
    if url.is_empty() || !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with("git@")) {
        return Err("请输入有效的 https:// 或 git@ 仓库地址".into());
    }
    let id = crate::models::new_id();
    let tmp = std::env::temp_dir().join(format!("agenthub-git-{id}"));
    let _ = std::fs::remove_dir_all(&tmp);
    let out = crate::store::silent_command("git")
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
pub async fn sync_push(app: AppH, message: String, authed: bool, provider: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::gitsync::push(&app, &message, authed, &provider))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}


#[tauri::command]
pub async fn sync_pull(app: AppH, authed: bool, provider: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::gitsync::pull(&app, authed, &provider))
        .await
        .map_err(|e| format!("任务失败: {e}"))?
}

// ---------------- 提示词变量 ----------------

/// 解析正文里的占位符：返回变量清单（已合并定义）、未使用定义、未闭合诊断。
/// `forEditor = true` 时会为正文里尚未定义的占位符补建默认定义。
#[tauri::command]
pub fn parse_prompt_vars(
    content: String,
    defined: Vec<crate::prompt_vars::PromptVariable>,
    for_editor: bool,
) -> crate::prompt_vars::Reconciled {
    if for_editor {
        crate::prompt_vars::reconcile_for_editor(&content, &defined)
    } else {
        crate::prompt_vars::reconcile(&content, &defined)
    }
}

/// 用给定值填充占位符。`missing` 非空时由界面决定是否拦截（后端不擅自阻断）。
#[tauri::command]
pub fn render_prompt_vars(
    content: String,
    defined: Vec<crate::prompt_vars::PromptVariable>,
    values: std::collections::BTreeMap<String, String>,
) -> crate::prompt_vars::Rendered {
    crate::prompt_vars::render(&content, &defined, &values)
}

/// 重命名变量：只改写占位符，不动正文其它同名文本。
#[tauri::command]
pub fn rename_prompt_var(content: String, from: String, to: String) -> String {
    crate::prompt_vars::rename_variable(&content, &from, &to)
}

/// 删除变量的所有占位符。
#[tauri::command]
pub fn remove_prompt_var(content: String, name: String) -> String {
    crate::prompt_vars::remove_variable(&content, &name)
}

/// 变量名校验：返回 None 表示合法，否则返回错误码（required / invalid / duplicate）。
#[tauri::command]
pub fn validate_prompt_var_name(
    name: String,
    defined: Vec<crate::prompt_vars::PromptVariable>,
    current: Option<String>,
) -> Option<String> {
    crate::prompt_vars::validate_name(&name, &defined, current.as_deref()).map(|s| s.to_string())
}

// ---------------- AI 工具版本管理 ----------------

#[tauri::command]
pub async fn tool_list() -> Result<crate::toolmgr::ToolList, String> {
    tauri::async_runtime::spawn_blocking(crate::toolmgr::list)
        .await
        .map_err(|e| format!("任务失败: {e}"))
}

#[tauri::command]
pub async fn tool_check_latest() -> Result<crate::toolmgr::ToolList, String> {
    // 逐个包查询 registry，属网络阻塞操作
    tauri::async_runtime::spawn_blocking(crate::toolmgr::check_latest)
        .await
        .map_err(|e| format!("任务失败: {e}"))
}

/// 批量更新所选工具（npm i -g）。`npm install` 可能耗时数分钟，必须在后台线程。
#[tauri::command]
pub async fn tool_update(ids: Vec<String>) -> Result<Vec<crate::toolmgr::UpdateOutcome>, String> {
    tauri::async_runtime::spawn_blocking(move || crate::toolmgr::update(&ids))
        .await
        .map_err(|e| format!("任务失败: {e}"))
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

#[tauri::command]
pub fn read_import_file(path: String) -> Result<std::collections::HashMap<String, String>, String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err("file not found".into());
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext != "json" && ext != "jsonc" {
        return Err("only .json files are supported".into());
    }
    let text = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
    let text = text.trim_start_matches('\u{feff}').to_string();
    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("config.json")
        .to_string();
    let mut m = std::collections::HashMap::new();
    m.insert("name".to_string(), name);
    m.insert("text".to_string(), text);
    Ok(m)
}

// ---------------- 配置版本库（Config Vault） ----------------

#[tauri::command]
pub fn vault_status(app: AppH) -> Result<Vec<crate::configvault::VaultStatus>, String> {
    Ok(crate::configvault::status(&app))
}

#[tauri::command]
pub fn vault_installed_count(app: AppH) -> Result<usize, String> {
    Ok(crate::configvault::installed_count(&app))
}

#[tauri::command]
pub fn vault_index(app: AppH) -> Result<crate::configvault::VaultIndex, String> {
    Ok(crate::configvault::index(&app))
}

#[tauri::command]
pub fn vault_set_watched(app: AppH, watched: Vec<String>) -> Result<crate::configvault::VaultIndex, String> {
    crate::configvault::set_watched(&app, watched)
}

#[tauri::command]
pub fn vault_set_daily(app: AppH, daily: bool) -> Result<crate::configvault::VaultIndex, String> {
    crate::configvault::set_daily(&app, daily)
}

#[tauri::command]
pub fn vault_snapshot(app: AppH, harnesses: Vec<String>, kind: String) -> Result<Vec<crate::configvault::ConfigVersion>, String> {
    crate::configvault::snapshot(&app, &harnesses, &kind)
}

#[tauri::command]
pub fn vault_maybe_daily(app: AppH) -> Result<usize, String> {
    crate::configvault::maybe_daily(&app)
}

#[tauri::command]
pub fn vault_read_version(app: AppH, harness: String, v: u32) -> Result<String, String> {
    crate::configvault::read_version(&app, &harness, v)
}

#[tauri::command]
pub fn vault_restore(app: AppH, harness: String, v: u32) -> Result<String, String> {
    crate::configvault::restore(&app, &harness, v)
}

#[tauri::command]
pub fn vault_clear(app: AppH, harnesses: Vec<String>) -> Result<(), String> {
    crate::configvault::clear(&app, &harnesses)
}
