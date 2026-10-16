use crate::models::*;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{Manager, Wry};

pub type AppH = tauri::AppHandle<Wry>;

/// 构造一个「不弹控制台黑框」的命令（Windows 下 git 等子进程默认会闪出黑框）
pub fn silent_command(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

pub fn es(e: std::io::Error) -> String {
    e.to_string()
}

pub fn config_dir(app: &AppH) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".agenthub"))
}

pub fn settings_path(app: &AppH) -> PathBuf {
    config_dir(app).join("settings.json")
}

pub fn load_settings(app: &AppH) -> Settings {
    let path = settings_path(app);
    if let Ok(text) = std::fs::read_to_string(&path) {
        if let Ok(s) = serde_json::from_str::<Settings>(&text) {
            return s;
        }
    }
    Settings::default()
}

pub fn save_settings(app: &AppH, s: &Settings) -> Result<(), String> {
    let path = settings_path(app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(es)?;
    }
    write_json(&path, s)
}

/// Resolve data root: explicit setting → <exe_dir>/data (green/portable) → app_data fallback.
pub fn data_root(app: &AppH) -> PathBuf {
    let s = load_settings(app);
    if !s.data_dir.trim().is_empty() {
        return PathBuf::from(s.data_dir.trim());
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let d = dir.join("data");
            if std::fs::create_dir_all(&d).is_ok() {
                return d;
            }
        }
    }
    app.path()
        .app_data_dir()
        .map(|p| p.join("data"))
        .unwrap_or_else(|_| std::env::temp_dir().join("agenthub-data"))
}

pub fn ensure_layout(root: &Path) -> Result<(), String> {
    for sub in ["prompts", "mcp", "skills"] {
        std::fs::create_dir_all(root.join(sub)).map_err(es)?;
    }
    Ok(())
}

pub fn dirs_info(app: &AppH) -> DataDirs {
    let root = data_root(app);
    DataDirs {
        root: root.to_string_lossy().into_owned(),
        prompts: root.join("prompts").to_string_lossy().into_owned(),
        mcp: root.join("mcp").to_string_lossy().into_owned(),
        skills: root.join("skills").to_string_lossy().into_owned(),
    }
}

pub fn settings_info(app: &AppH) -> SettingsInfo {
    SettingsInfo {
        settings: load_settings(app),
        data_dirs: dirs_info(app),
    }
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let text = std::fs::read_to_string(path).map_err(es)?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {}", path.display(), e))
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(es)?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(es)
}

pub fn push_version(versions: &mut Vec<VersionEntry>, old_content: &str) {
    if old_content.is_empty() {
        return;
    }
    let v = versions.iter().map(|x| x.v).max().unwrap_or(0) + 1;
    versions.push(VersionEntry {
        v,
        saved_at: now_iso(),
        note: String::new(),
        content: old_content.to_string(),
    });
    let len = versions.len();
    if len > 50 {
        versions.drain(0..len - 50);
    }
}

pub fn backup_file(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".into());
    let target = path.with_file_name(format!("{name}.agenthub-bak-{ts}"));
    std::fs::copy(path, &target).map_err(es)?;
    Ok(Some(target))
}

pub fn slugify(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch == ' ' || ch == '.' {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        format!("skill-{}", chrono::Local::now().format("%Y%m%d%H%M%S"))
    } else {
        trimmed
    }
}

pub fn copy_dir_recursive(src: &Path, dst: &Path, skip_dotfiles: bool) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(es)?;
    for entry in std::fs::read_dir(src).map_err(es)? {
        let entry = entry.map_err(es)?;
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if skip_dotfiles && file_name.starts_with('.') {
            continue;
        }
        let from = entry.path();
        let to = dst.join(&file_name);
        if from.is_dir() {
            copy_dir_recursive(&from, &to, skip_dotfiles)?;
        } else {
            std::fs::copy(&from, &to).map_err(es)?;
        }
    }
    Ok(())
}

pub fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(meta) = e.metadata() {
                total += meta.len();
            }
        }
    }
    total
}
