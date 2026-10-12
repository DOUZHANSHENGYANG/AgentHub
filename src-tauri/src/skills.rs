use crate::models::*;
use crate::store::{self, AppH, es};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub enum FmValue {
    Str(String),
    List(Vec<String>),
    Raw(String),
}

impl FmValue {
    pub fn to_json(&self) -> Value {
        match self {
            FmValue::Str(s) => Value::String(s.clone()),
            FmValue::List(l) => Value::Array(l.iter().map(|x| Value::String(x.clone())).collect()),
            FmValue::Raw(r) => json!({ "raw": r.trim_end().to_string() }),
        }
    }
    pub fn from_json(v: &Value) -> Option<FmValue> {
        match v {
            Value::String(s) => Some(FmValue::Str(s.clone())),
            Value::Array(a) => Some(FmValue::List(
                a.iter().filter_map(|x| x.as_str().map(String::from)).collect(),
            )),
            Value::Object(o) => o.get("raw").and_then(|r| r.as_str()).map(|s| FmValue::Raw(s.to_string())),
            _ => None,
        }
    }
}

fn strip_quotes(s: &str) -> String {
    let t = s.trim();
    if t.len() >= 2
        && ((t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')))
    {
        t[1..t.len() - 1].to_string()
    } else {
        t.to_string()
    }
}

/// Split a SKILL.md document into (frontmatter map, body).
/// Supports simple `key: value`, `key:` + `- item` lists, and preserves nested blocks verbatim.
pub fn split_doc(doc: &str) -> (BTreeMap<String, FmValue>, String) {
    let mut map = BTreeMap::new();
    let norm = doc.replace("\r\n", "\n");
    let t = norm.trim_start_matches('\u{feff}');
    let trimmed = t.trim_start_matches('\n');
    if !trimmed.starts_with("---") {
        return (map, trimmed.to_string());
    }
    let after = &trimmed[3..];
    // find closing "---" line
    let mut off = 0usize;
    let mut close: Option<usize> = None;
    for line in after.split_inclusive('\n') {
        if line.trim_end() == "---" {
            close = Some(off);
            break;
        }
        off += line.len();
    }
    let (fm_text, body) = match close {
        Some(idx) => {
            let fm = &after[..idx];
            let rest = &after[idx..];
            let body = rest.splitn(2, '\n').nth(1).unwrap_or("");
            (fm, body)
        }
        None => ("", trimmed),
    };
    parse_fm(fm_text, &mut map);
    (map, body.to_string())
}

fn parse_fm(block: &str, map: &mut BTreeMap<String, FmValue>) {
    let mut lines = block.lines().peekable();
    while let Some(line) = lines.next() {
        if line.trim().is_empty() {
            continue;
        }
        let Some((k, v)) = line.split_once(':') else { continue };
        let key = k.trim().to_string();
        if key.is_empty() {
            continue;
        }
        let v = v.trim();
        if v.is_empty() {
            let mut list: Vec<String> = Vec::new();
            let mut raw = String::new();
            while let Some(next) = lines.peek() {
                let n = next.trim_end();
                if n.starts_with("- ") || n == "-" {
                    let item = n.trim_start_matches('-').trim().to_string();
                    list.push(strip_quotes(&item));
                    lines.next();
                } else if n.starts_with(' ') || n.starts_with('\t') {
                    raw.push_str(next);
                    raw.push('\n');
                    lines.next();
                } else {
                    break;
                }
            }
            if !list.is_empty() {
                map.insert(key, FmValue::List(list));
            } else if !raw.is_empty() {
                map.insert(key, FmValue::Raw(raw));
            } else {
                map.insert(key, FmValue::Str(String::new()));
            }
        } else {
            map.insert(key, FmValue::Str(strip_quotes(v)));
        }
    }
}

pub fn compose_doc(map: &BTreeMap<String, FmValue>, body: &str) -> String {
    if map.is_empty() {
        return body.to_string();
    }
    let mut out = String::from("---\n");
    for (k, v) in map {
        match v {
            FmValue::Str(s) => {
                out.push_str(k);
                out.push_str(": ");
                out.push_str(s);
                out.push('\n');
            }
            FmValue::List(l) => {
                out.push_str(k);
                out.push_str(":\n");
                for i in l {
                    out.push_str("- ");
                    out.push_str(i);
                    out.push('\n');
                }
            }
            FmValue::Raw(r) => {
                out.push_str(k);
                out.push_str(":\n");
                out.push_str(r);
                if !r.ends_with('\n') {
                    out.push('\n');
                }
            }
        }
    }
    out.push_str("---\n\n");
    out.push_str(body);
    out
}

pub fn fm_get_str(map: &BTreeMap<String, FmValue>, key: &str) -> String {
    match map.get(key) {
        Some(FmValue::Str(s)) => s.clone(),
        _ => String::new(),
    }
}

/// 解析 YAML flow 数组：["a", "b"] → ["a","b"]；非数组返回 None
fn parse_flow_list(s: &str) -> Option<Vec<String>> {
    let t = s.trim();
    if !(t.starts_with('[') && t.ends_with(']')) || t.len() < 2 {
        return None;
    }
    let inner = &t[1..t.len() - 1];
    Some(
        inner
            .split(',')
            .map(|x| x.trim().trim_matches('"').trim_matches('\'').to_string())
            .filter(|x| !x.is_empty())
            .collect(),
    )
}

/// 清洗单个 tag（历史坏数据自愈：["a"] 形式再解析）
fn clean_tag(t: &str) -> Vec<String> {
    let t = t.trim();
    if t.is_empty() {
        return Vec::new();
    }
    if let Some(list) = parse_flow_list(t) {
        return list;
    }
    let unquoted = t.trim_matches('"').trim_matches('\'').to_string();
    if unquoted.is_empty() { Vec::new() } else { vec![unquoted] }
}

pub fn fm_get_tags(map: &BTreeMap<String, FmValue>) -> Vec<String> {
    match map.get("tags") {
        Some(FmValue::List(l)) => l.iter().flat_map(|x| clean_tag(x)).collect(),
        Some(FmValue::Str(s)) if !s.is_empty() => {
            if let Some(list) = parse_flow_list(s) {
                list
            } else {
                s.split(',').flat_map(clean_tag).collect()
            }
        }
        _ => Vec::new(),
    }
}

fn skills_root(app: &AppH) -> std::path::PathBuf {
    store::data_root(app).join("skills")
}

fn hub_path(dir: &Path) -> std::path::PathBuf {
    dir.join(".hub.json")
}

pub fn meta_for_dir(dir: &Path) -> Result<SkillMeta, String> {
    let doc_path = dir.join("SKILL.md");
    let text = std::fs::read_to_string(&doc_path).map_err(es)?;
    let (fm, _) = split_doc(&text);
    let name = {
        let n = fm_get_str(&fm, "name");
        if n.is_empty() {
            dir.file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default()
        } else {
            n
        }
    };
    let description = fm_get_str(&fm, "description");
    let mut tags = Vec::new();
    let mut origin = None;
    let mut versions = 0u32;
    let hp = hub_path(dir);
    if let Ok(hub) = store::read_json::<SkillHub>(&hp) {
        tags = hub.tags;
        origin = hub.origin;
        versions = hub.versions.len() as u32;
    }
    if tags.is_empty() {
        tags = fm_get_tags(&fm);
    }
    let mut has_assets = false;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let n = e.file_name().to_string_lossy().into_owned();
            if n != "SKILL.md" && n != ".hub.json" {
                has_assets = true;
                break;
            }
        }
    }
    let (created_at, updated_at) = fs_times(&doc_path);
    // SSEP v1.1：读 SKILL.toml（渐进增强；缺失 = 最小态）
    let toml_doc = crate::skill_toml::load(dir);
    let has_toml = toml_doc.is_some();
    let version = toml_doc
        .as_ref()
        .and_then(|d| crate::skill_toml::get_str(d, "meta.version"))
        .unwrap_or_else(|| "0.0.0".into());
    let status = toml_doc
        .as_ref()
        .and_then(|d| crate::skill_toml::get_str(d, "meta.status"))
        .unwrap_or_else(|| "draft".into());
    let stale = crate::skill_toml::is_stale(dir);
    Ok(SkillMeta {
        name,
        dir_name: dir.file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default(),
        description,
        tags,
        versions,
        has_assets,
        content_len: text.len(),
        origin,
        created_at,
        updated_at,
        version,
        status,
        stale,
        has_toml,
    })
}

fn fs_times(path: &Path) -> (String, String) {
    let fmt = |t: std::io::Result<std::time::SystemTime>| -> String {
        t.map(|x| {
            let dt: chrono::DateTime<chrono::Local> = x.into();
            dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
        })
        .unwrap_or_default()
    };
    match std::fs::metadata(path) {
        Ok(m) => (fmt(m.created()), fmt(m.modified())),
        Err(_) => (String::new(), String::new()),
    }
}

pub fn list_skills(app: &AppH) -> Result<Vec<SkillMeta>, String> {
    let root = skills_root(app);
    std::fs::create_dir_all(&root).map_err(es)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(es)? {
        let entry = entry.map_err(es)?;
        let path = entry.path();
        if path.is_dir() && path.join("SKILL.md").exists() {
            if let Ok(meta) = meta_for_dir(&path) {
                out.push(meta);
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

pub fn read_skill(app: &AppH, dir_name: &str) -> Result<SkillDoc, String> {
    let dir = skills_root(app).join(dir_name);
    if !dir.is_dir() {
        return Err(format!("skill not found: {dir_name}"));
    }
    let text = std::fs::read_to_string(dir.join("SKILL.md")).map_err(es)?;
    let (fm, body) = split_doc(&text);
    let mut fm_json = BTreeMap::new();
    for (k, v) in &fm {
        fm_json.insert(k.clone(), v.to_json());
    }
    let versions = store::read_json::<SkillHub>(&hub_path(&dir))
        .map(|h| h.versions)
        .unwrap_or_default();
    Ok(SkillDoc {
        meta: meta_for_dir(&dir)?,
        frontmatter: fm_json,
        body,
        versions,
    })
}

pub fn save_skill(app: &AppH, payload: SkillSavePayload) -> Result<SkillMeta, String> {
    let root = skills_root(app);
    std::fs::create_dir_all(&root).map_err(es)?;

    let dir_name = if payload.dir_name.is_empty() {
        let mut slug = store::slugify(&payload.name);
        let mut i = 2;
        while root.join(&slug).exists() {
            slug = format!("{}-{i}", store::slugify(&payload.name));
            i += 1;
        }
        slug
    } else {
        payload.dir_name.clone()
    };
    let dir = root.join(&dir_name);
    std::fs::create_dir_all(&dir).map_err(es)?;

    // rebuild frontmatter map: keep existing entries, override name/description
    let mut fm: BTreeMap<String, FmValue> = BTreeMap::new();
    for (k, v) in &payload.frontmatter {
        if let Some(fv) = FmValue::from_json(v) {
            fm.insert(k.clone(), fv);
        }
    }
    fm.insert("name".into(), FmValue::Str(payload.name.clone()));
    fm.insert("description".into(), FmValue::Str(payload.description.clone()));

    let new_doc = compose_doc(&fm, &payload.body);
    let doc_path = dir.join("SKILL.md");
    let old_doc = std::fs::read_to_string(&doc_path).unwrap_or_default();

    // hub sidecar
    let mut hub: SkillHub = store::read_json(&hub_path(&dir)).unwrap_or_default();
    if old_doc != new_doc && !old_doc.is_empty() {
        store::push_version(&mut hub.versions, &old_doc);
    }
    hub.tags = payload.tags.clone();
    let hp = hub_path(&dir);
    let existing_origin = store::read_json::<SkillHub>(&hp).ok().and_then(|h| h.origin);
    hub.origin = existing_origin;
    store::write_json(&hp, &hub)?;

    std::fs::write(&doc_path, &new_doc).map_err(es)?;

    // SSEP v1.1：CORE 生成/同步 + 变更事件 + 版本 bump
    crate::skill_toml::ensure_core(&dir, &payload.name, "manual", "")?;
    let is_new = old_doc.is_empty();
    let changed = !is_new && old_doc != new_doc;
    if is_new {
        let _ = crate::skill_toml::append_event(&dir, "create", "", "由 AgentHub 创建", "");
    } else if changed {
        let level = payload.level.clone().unwrap_or_else(|| "L1".into());
        let cur = crate::skill_toml::load(&dir)
            .and_then(|d| crate::skill_toml::get_str(&d, "meta.version"))
            .unwrap_or_else(|| "0.0.0".into());
        let nv = match level.as_str() {
            "L3" => crate::skill_toml::bump_minor(&cur),
            "L4" | "L5" => crate::skill_toml::bump_major(&cur),
            _ => crate::skill_toml::bump_patch(&cur),
        };
        let _ = crate::skill_toml::set_version(&dir, &nv);
        if let Ok(h) = crate::skill_toml::tree_hash(&dir) {
            let _ = crate::skill_toml::append_event(&dir, "update", &level, "AgentHub 编辑保存", &h);
        }
    }
    meta_for_dir(&dir)
}

pub fn delete_skill(app: &AppH, dir_name: &str) -> Result<(), String> {
    let dir = skills_root(app).join(dir_name);
    if dir.is_dir() {
        std::fs::remove_dir_all(&dir).map_err(es)?;
    }
    Ok(())
}

/// Import a skill folder into hub storage using copy-then-replace (先复制后替换):
/// copy source → staging dir → swap with existing (old moved to backup) →
/// delete backup on success / auto-restore on failure. Keeps existing hub
/// metadata (origin + version history).
pub fn import_skill_dir(app: &AppH, src: &Path, overwrite: bool) -> Result<String, String> {
    let src_doc = src.join("SKILL.md");
    if !src_doc.exists() {
        return Err(format!("no SKILL.md in {}", src.display()));
    }
    let name = src
        .file_name()
        .map(|x| x.to_string_lossy().into_owned())
        .unwrap_or_default();
    if name.is_empty() || name.starts_with('.') {
        return Err("invalid skill folder".into());
    }
    let root = skills_root(app);
    std::fs::create_dir_all(&root).map_err(es)?;
    let dst = root.join(&name);
    if dst.exists() && !overwrite {
        return Err(format!("exists: {name}"));
    }
    let new_text = std::fs::read_to_string(&src_doc).unwrap_or_default();

    // 1) 先复制：copy source into a staging folder
    let ts = chrono::Local::now().format("%Y%m%d%H%M%S");
    let staging = root.join(format!("{name}.agenthub-staging-{ts}"));
    let _ = std::fs::remove_dir_all(&staging);
    store::copy_dir_recursive(src, &staging, false)?;

    // 2) 再替换：move existing to backup, then move staging into place
    let mut backup: Option<std::path::PathBuf> = None;
    if dst.exists() {
        let bak = root.join(format!("{name}.agenthub-bak-{ts}"));
        std::fs::rename(&dst, &bak).map_err(es)?;
        backup = Some(bak);
    }
    match std::fs::rename(&staging, &dst) {
        Ok(()) => {
            // merge hub metadata: keep origin + versions, take tags from the source frontmatter
            let mut hub: SkillHub = store::read_json(&dst.join(".hub.json")).unwrap_or_default();
            if let Some(bak) = &backup {
                if let Ok(old_hub) = store::read_json::<SkillHub>(&bak.join(".hub.json")) {
                    hub.versions = old_hub.versions;
                    hub.origin = old_hub.origin;
                }
                let old_doc = std::fs::read_to_string(bak.join("SKILL.md")).unwrap_or_default();
                if !old_doc.is_empty() && old_doc != new_text {
                    store::push_version(&mut hub.versions, &old_doc);
                }
            }
            let (fm, _) = split_doc(&new_text);
            hub.tags = fm_get_tags(&fm);
            store::write_json(&dst.join(".hub.json"), &hub)?;
            if let Some(bak) = backup {
                let _ = std::fs::remove_dir_all(&bak);
            }
            let _ = crate::skill_toml::ensure_core(&dst, &name, "local", &src.to_string_lossy());
            let _ = crate::skill_toml::append_event(&dst, "import", "", "复制导入（先复制后替换）", "");
            Ok(name)
        }
        Err(e) => {
            // restore original on failure
            if let Some(bak) = backup {
                let _ = std::fs::rename(&bak, &dst);
            }
            let _ = std::fs::remove_dir_all(&staging);
            Err(e.to_string())
        }
    }
}
