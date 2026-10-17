mod commands;
mod configvault;
mod harness;
mod items;
mod models;
mod skills;
mod store;
mod auth;
mod gitsync;
mod install;
mod registry;
mod upstream;
mod skill_toml;
mod skillhub;
mod vet;
mod toolmgr;
mod prompt_vars;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::set_data_dir,
            commands::set_prefs,
            commands::set_harness_order,
            commands::add_skill_source_dir,
            commands::remove_skill_source_dir,
            commands::list_prompts,
            commands::save_prompt,
            commands::delete_prompt,
            commands::list_mcp,
            commands::save_mcp,
            commands::delete_mcp,
            commands::export_mcp_config,
            commands::list_skills,
            commands::read_skill,
            commands::save_skill,
            commands::import_skill_folder,
            commands::import_skill_zip,
            commands::skill_extension,
            commands::set_skill_status,
            commands::pack_skill,
commands::check_pack_ready,
commands::pack_skills_batch,
            commands::vet_skill,
commands::set_vet_review,
commands::ignore_all_vet_findings,
commands::review_vet_finding,
commands::read_vet_report,
commands::seed_skill_version,
            commands::repair_skill_tags,
commands::read_skill_file,
commands::list_skill_files,
commands::onboard_skills_batch,
            commands::install_skillpack,
            commands::parse_skill_index,
            commands::install_from_index,
            commands::check_upstream,
            commands::update_skill_ext,
            commands::sync_status,
            commands::sync_set_remote,
            commands::sync_push,
            commands::sync_pull,
            commands::auth_status,
            commands::auth_github_start,
            commands::auth_github_poll,
            commands::auth_save_pat,
            commands::auth_logout,
            commands::auth_create_repo,
            commands::git_fetch_skills,
            commands::cleanup_git_temp,
            commands::pre_import,
            commands::delete_skill,
            commands::clear_skill_versions,
            commands::skillhub_search,
            commands::skillhub_categories,
            commands::skillhub_install,
            commands::ensure_skill_protocol,
            commands::release_skill_version,
            commands::scan_harnesses,
            commands::import_from_harness,
            commands::apply_to_harness,
            commands::remove_from_harness,
            commands::read_harness_config,
            commands::vault_status,
            commands::vault_index,
            commands::vault_installed_count,
            commands::vault_set_watched,
            commands::vault_set_daily,
            commands::vault_snapshot,
            commands::vault_maybe_daily,
            commands::vault_read_version,
            commands::vault_restore,
            commands::vault_clear,
            commands::write_harness_config,
            commands::merge_harness_config,
            commands::preview_skill_dir,
            commands::read_import_file,
            commands::reveal_path,
            commands::open_path,
            commands::open_skill_file,
            commands::parse_prompt_vars,
            commands::render_prompt_vars,
            commands::rename_prompt_var,
            commands::remove_prompt_var,
            commands::validate_prompt_var_name,
            commands::tool_list,
            commands::tool_check_latest,
            commands::tool_update,
            commands::storage_stats,
        ])
        .setup(|app| {
            // 清理历史遗留的 DOS 纪元时间戳（ZIP 无日期时的 1980-01-01）。
            // 放后台线程，不阻塞窗口；幂等 —— 没有哨兵时不产生任何写入。
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let root = store::data_root(&handle).join("skills");
                    let n = store::normalize_epoch_times(&root);
                    if n > 0 {
                        eprintln!("[agenthub] 已把 {n} 个文件的 DOS 纪元时间戳改写为可信时间");
                    }
                });
            }
            // Fallback: force-show window after 8s in case the frontend never calls show()
            if let Some(win) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(8));
                    let _ = win.show();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
