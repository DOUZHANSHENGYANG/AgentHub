mod commands;
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
mod vet;

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
            commands::skill_extension,
            commands::set_skill_status,
            commands::pack_skill,
            commands::vet_skill,
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
            commands::scan_harnesses,
            commands::import_from_harness,
            commands::apply_to_harness,
            commands::reveal_path,
            commands::storage_stats,
        ])
        .setup(|app| {
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
