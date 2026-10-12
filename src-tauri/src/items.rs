use crate::models::*;
use crate::store::{self, AppH, es};
use serde_json::{json, Map, Value};
use std::path::PathBuf;

fn prompts_dir(app: &AppH) -> PathBuf {
    store::data_root(app).join("prompts")
}
fn mcp_dir(app: &AppH) -> PathBuf {
    store::data_root(app).join("mcp")
}

// ---------------- Prompts ----------------

pub fn list_prompts(app: &AppH) -> Result<Vec<Prompt>, String> {
    let dir = prompts_dir(app);
    std::fs::create_dir_all(&dir).map_err(es)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(es)? {
        let entry = entry.map_err(es)?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(p) = store::read_json::<Prompt>(&path) {
                out.push(p);
            }
        }
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}

pub fn save_prompt(app: &AppH, mut p: Prompt) -> Result<Prompt, String> {
    let dir = prompts_dir(app);
    std::fs::create_dir_all(&dir).map_err(es)?;
    let now = now_iso();
    if p.id.is_empty() {
        p.id = new_id();
        p.created_at = now.clone();
        p.versions = Vec::new();
    }
    let path = dir.join(format!("{}.json", p.id));
    if path.exists() {
        if let Ok(old) = store::read_json::<Prompt>(&path) {
            if old.content != p.content {
                store::push_version(&mut p.versions, &old.content);
            }
        }
    } else {
        p.created_at = now.clone();
    }
    p.updated_at = now;
    store::write_json(&path, &p)?;
    Ok(p)
}

pub fn delete_prompt(app: &AppH, id: &str) -> Result<(), String> {
    let path = prompts_dir(app).join(format!("{id}.json"));
    if path.exists() {
        std::fs::remove_file(&path).map_err(es)?;
    }
    Ok(())
}

// ---------------- MCP servers ----------------

pub fn list_mcp(app: &AppH) -> Result<Vec<McpServer>, String> {
    let dir = mcp_dir(app);
    std::fs::create_dir_all(&dir).map_err(es)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(es)? {
        let entry = entry.map_err(es)?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(p) = store::read_json::<McpServer>(&path) {
                out.push(p);
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

pub fn save_mcp(app: &AppH, mut s: McpServer) -> Result<McpServer, String> {
    let dir = mcp_dir(app);
    std::fs::create_dir_all(&dir).map_err(es)?;
    let now = now_iso();
    if s.id.is_empty() {
        s.id = new_id();
        s.created_at = now.clone();
        s.versions = Vec::new();
    }
    let path = dir.join(format!("{}.json", s.id));
    if path.exists() {
        if let Ok(old) = store::read_json::<McpServer>(&path) {
            let snapshot = |x: &McpServer| {
                serde_json::json!({
                    "command": x.command, "args": x.args, "env": x.env,
                    "url": x.url, "headers": x.headers, "transport": x.transport
                })
            };
            if snapshot(&old) != snapshot(&s) {
                store::push_version(&mut s.versions, &serde_json::to_string(&snapshot(&old)).unwrap_or_default());
            }
        }
    } else {
        s.created_at = now.clone();
    }
    s.updated_at = now;
    store::write_json(&path, &s)?;
    Ok(s)
}

pub fn delete_mcp(app: &AppH, id: &str) -> Result<(), String> {
    let path = mcp_dir(app).join(format!("{id}.json"));
    if path.exists() {
        std::fs::remove_file(&path).map_err(es)?;
    }
    Ok(())
}

/// Standard `mcpServers` JSON config export.
pub fn export_config(servers: &[McpServer]) -> Value {
    let mut map = Map::new();
    for s in servers.iter().filter(|s| s.enabled && !s.name.is_empty()) {
        let entry = if s.transport == "stdio" {
            json!({
                "command": s.command,
                "args": s.args,
                "env": s.env,
            })
        } else {
            json!({
                "type": s.transport,
                "url": s.url,
                "headers": s.headers,
            })
        };
        map.insert(s.name.clone(), entry);
    }
    json!({ "mcpServers": map })
}
