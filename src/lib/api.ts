import { invoke } from "@tauri-apps/api/core";
import type { SkillFileNode } from "@/lib/types";
import type {
  ApplyResult,
  HarnessReport,
  ImportResult,
  ImportSelection,
  PreImportResult,
  McpServer,
  Prompt,
  SettingsInfo,
  SkillDoc,
  SkillMeta,
  SkillSavePayload,
  StorageStats,
  PromptVariable,
  PromptVarReconciled,
  PromptVarRendered,
  ToolList,
  ToolUpdateOutcome,
  VaultIndex,
  VaultStatus,
  VaultVersion,
  MarketCategory,
  MarketInstallReport,
  MarketInstallTarget,
  MarketPage,
} from "./types";

export const api = {
  getSettings: () => invoke<SettingsInfo>("get_settings"),
  setDataDir: (path: string) => invoke<SettingsInfo>("set_data_dir", { path }),
  setPrefs: (language?: string, theme?: string) =>
    invoke<SettingsInfo>("set_prefs", { language, theme }),
  setHarnessOrder: (order: string[]) => invoke<SettingsInfo>("set_harness_order", { order }),
  addSkillSourceDir: (path: string) => invoke<SettingsInfo>("add_skill_source_dir", { path }),
  removeSkillSourceDir: (path: string) => invoke<SettingsInfo>("remove_skill_source_dir", { path }),

  listPrompts: () => invoke<Prompt[]>("list_prompts"),
  savePrompt: (prompt: Prompt) => invoke<Prompt>("save_prompt", { prompt }),
  deletePrompt: (id: string) => invoke<void>("delete_prompt", { id }),

  listMcp: () => invoke<McpServer[]>("list_mcp"),
  saveMcp: (server: McpServer) => invoke<McpServer>("save_mcp", { server }),
  deleteMcp: (id: string) => invoke<void>("delete_mcp", { id }),
  exportMcpConfig: (ids: string[]) => invoke<unknown>("export_mcp_config", { ids }),

  listSkills: () => invoke<SkillMeta[]>("list_skills"),
  readSkill: (dirName: string) => invoke<SkillDoc>("read_skill", { dirName }),
  saveSkill: (payload: SkillSavePayload) => invoke<SkillMeta>("save_skill", { payload }),
  deleteSkill: (dirName: string) => invoke<void>("delete_skill", { dirName }),
  clearSkillVersions: (dirName: string) => invoke<number>("clear_skill_versions", { dirName }),
  ensureSkillProtocol: (dirName: string) => invoke<{ created: boolean; version: string }>("ensure_skill_protocol", { dirName }),
  releaseSkillVersion: (dirName: string, level: string, note: string) =>
    invoke<{ version: string; snapshot: number }>("release_skill_version", { dirName, level, note }),
  importSkillFolder: (path: string, overwrite: boolean) =>
    invoke<SkillMeta>("import_skill_folder", { path, overwrite }),
  importSkillZip: (path: string, overwrite: boolean) =>
    invoke<SkillMeta>("import_skill_zip", { path, overwrite }),
  skillExtension: (dirName: string) =>
    invoke<{ doc: Record<string, unknown> | null; stale: boolean; treeHash: string; violations: { rule: string; severity: string; message: string }[]; hasToml: boolean }>("skill_extension", { dirName }),
  setSkillStatus: (dirName: string, status: string, supersededBy: string) =>
    invoke<SkillMeta>("set_skill_status", { dirName, status, supersededBy }),
  packSkill: (dirName: string, outDir: string) =>
    invoke<string>("pack_skill", { dirName, outDir }),
  onboardSkillsBatch: (dirNames: string[], onlyMissing: boolean, vet: boolean) =>
    invoke<{
      total: number;
      succeeded: number;
      failed: number;
      created: number;
      rejected: number;
      review: number;
      install: number;
      outcomes: {
        dirName: string;
        ok: boolean;
        createdToml: boolean;
        version: string;
        verdict: string;
        level: string;
        critical: number;
        high: number;
        medium: number;
        error: string;
      }[];
    }>("onboard_skills_batch", { dirNames, onlyMissing, vet }),
  seedSkillVersion: (dirName: string, note: string) => invoke<boolean>("seed_skill_version", { dirName, note }),
  packSkillsBatch: (dirNames: string[], outDir: string) =>
    invoke<{
      outDir: string;
      total: number;
      succeeded: number;
      failed: number;
      warned: number;
      indexPath: string;
      outcomes: {
        dirName: string;
        name: string;
        version: string;
        ok: boolean;
        path: string;
        warnings: string[];
        error: string;
      }[];
    }>("pack_skills_batch", { dirNames, outDir }),
  checkPackReady: (dirName: string) => invoke<string[]>("check_pack_ready", { dirName }),
  readVetReport: (dirName: string) => invoke<import("@/lib/types").VetReportRow | null>("read_vet_report", { dirName }),
  reviewVetFinding: (dirName: string, rule: string, file: string, line: number, ignored: boolean) =>
    invoke<[number, number]>("review_vet_finding", { dirName, rule, file, line, ignored }),
  ignoreAllVetFindings: (dirName: string) => invoke<number>("ignore_all_vet_findings", { dirName }),
  setVetReview: (dirName: string, verdict: string, note: string) =>
    invoke<void>("set_vet_review", { dirName, verdict, note }),
  vetSkill: (dirName: string) =>
    invoke<{ verdict: string; level: string; critical: number; high: number; medium: number; findings: { rule: string; severity: string; file: string; line: number; excerpt: string }[]; contentHash: string; checkedAt: string; checkedBy: string }>("vet_skill", { dirName }),
  installSkillPack: (path: string, overwrite: boolean) =>
    invoke<{ name: string; version: string; verdict: string; warnings: string[]; path: string }>("install_skillpack", { path, overwrite }),
  parseSkillIndex: (path: string) =>
    invoke<{ base: string; entries: { name: string; version: string; hash: string; ref: string }[] }>("parse_skill_index", { path }),
  installFromIndex: (path: string, name: string, version: string, overwrite: boolean) =>
    invoke<{ name: string; version: string; verdict: string; warnings: string[]; path: string }>("install_from_index", { path, name, version, overwrite }),
  authStatus: () =>
    invoke<{ github: boolean; gitee: boolean; login: string; repoUrl: string }>("auth_status"),
  authGithubStart: () =>
    invoke<{ userCode: string; verificationUri: string; expiresIn: number; interval: number }>("auth_github_start"),
  authGithubPoll: (deviceCode: string) =>
    invoke<{ ok: boolean; login: string; provider: string; error: string }>("auth_github_poll", { deviceCode }),
  authSavePat: (provider: string, pat: string) =>
    invoke<{ ok: boolean; login: string }>("auth_save_pat", { provider, pat }),
  authLogout: () => invoke<void>("auth_logout"),
  authCreateRepo: (provider: string) => invoke<string>("auth_create_repo", { provider }),
  syncStatus: () =>
    invoke<{ initialized: boolean; hasRemote: boolean; remoteUrl: string; branch: string; dirtyFiles: string[]; lastCommit: string; ahead: number }>("sync_status"),
  syncSetRemote: (url: string) => invoke<void>("sync_set_remote", { url }),
  syncPush: (message: string, authed: boolean, provider: string) => invoke<string>("sync_push", { message, authed, provider }),
  syncPull: (authed: boolean, provider: string) => invoke<string>("sync_pull", { authed, provider }),
  gitFetchSkills: (url: string) =>
    invoke<{ tempDir: string; skills: { path: string; name: string; description: string }[] }>("git_fetch_skills", { url }),
  cleanupGitTemp: (path: string) => invoke<void>("cleanup_git_temp", { path }),
  // ---------------- 腾讯 SkillHub 市场 ----------------
  skillhubSearch: (p: { keyword: string; category: string; source: string; sort: string; page: number; pageSize: number }) =>
    invoke<MarketPage>("skillhub_search", {
      keyword: p.keyword,
      category: p.category,
      source: p.source,
      sort: p.sort,
      page: p.page,
      pageSize: p.pageSize,
    }),
  skillhubCategories: () => invoke<MarketCategory[]>("skillhub_categories"),
  skillhubInstall: (targets: MarketInstallTarget[], overwrite: boolean) =>
    invoke<MarketInstallReport[]>("skillhub_install", { targets, overwrite }),
  checkUpstream: (dirName: string) =>
    invoke<{ watched: boolean; mode: string; remote: string; remoteHead: string; lastHead: string; changed: boolean; note: string; checkedAt: string }>("check_upstream", { dirName }),
  updateSkillExt: (
    dirName: string,
    payload: {
      deps?: { name: string; semver: string; reason: string }[];
      runtime?: { requiresScripts: string; requiresNetwork: string; minProtocol: number; config: string };
      upstream?: { watch: boolean; mode: string; remote: string };
    },
  ) =>
    invoke<SkillMeta>("update_skill_ext", { dirName, ...payload }),

  scanHarnesses: () => invoke<HarnessReport[]>("scan_harnesses"),
  preImport: (harness: string, kind: string, names: string[]) =>
    invoke<PreImportResult>("pre_import", { harness, kind, names }),
  importFromHarness: (harness: string, kind: string, selections: ImportSelection[]) =>
    invoke<ImportResult>("import_from_harness", { harness, kind, selections }),
  applyToHarness: (harness: string, kind: string, names: string[]) =>
    invoke<ApplyResult>("apply_to_harness", { harness, kind, names }),
  removeFromHarness: (harness: string, kind: string, names: string[]) =>
    invoke<ApplyResult>("remove_from_harness", { harness, kind, names }),
  readHarnessConfig: (harness: string) =>
    invoke<{ path: string; text: string; exists: boolean; format: string }>("read_harness_config", { harness }),
  writeHarnessConfig: (harness: string, text: string) =>
    invoke<{ path: string; backup: string | null }>("write_harness_config", { harness, text }),
  mergeHarnessConfig: (harness: string, text: string, json: string) =>
    invoke<string>("merge_harness_config", { harness, text, json }),
  readImportFile: (path: string) => invoke<{ name: string; text: string }>("read_import_file", { path }),

  // 配置版本库
  vaultStatus: () => invoke<VaultStatus[]>("vault_status"),
  vaultIndex: () => invoke<VaultIndex>("vault_index"),
  vaultInstalledCount: () => invoke<number>("vault_installed_count"),
  vaultSetWatched: (watched: string[]) => invoke<VaultIndex>("vault_set_watched", { watched }),
  vaultSetDaily: (daily: boolean) => invoke<VaultIndex>("vault_set_daily", { daily }),
  vaultSnapshot: (harnesses: string[], kind: string) => invoke<VaultVersion[]>("vault_snapshot", { harnesses, kind }),
  vaultMaybeDaily: () => invoke<number>("vault_maybe_daily"),
  vaultReadVersion: (harness: string, v: number) => invoke<string>("vault_read_version", { harness, v }),
  vaultRestore: (harness: string, v: number) => invoke<string>("vault_restore", { harness, v }),
  vaultClear: (harnesses: string[]) => invoke<void>("vault_clear", { harnesses }),

  listSkillFiles: (dirName: string) =>
    invoke<{
      path: string;
      name: string;
      isDir: boolean;
      size: number;
      ext: string;
      kind: string;
      children: SkillFileNode[];
    }>("list_skill_files", { dirName }),
  readSkillFile: (dirName: string, relPath: string) =>
    invoke<{
      path: string;
      name: string;
      ext: string;
      kind: string;
      size: number;
      text: string;
      dataBase64: string;
      truncated: boolean;
      note: string;
    }>("read_skill_file", { dirName, relPath }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  openSkillFile: (dirName: string, relPath: string) => invoke<void>("open_skill_file", { dirName, relPath }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  storageStats: () => invoke<StorageStats>("storage_stats"),

  // ── 提示词变量 ──
  parsePromptVars: (content: string, defined: PromptVariable[], forEditor: boolean) =>
    invoke<PromptVarReconciled>("parse_prompt_vars", { content, defined, forEditor }),
  renderPromptVars: (content: string, defined: PromptVariable[], values: Record<string, string>) =>
    invoke<PromptVarRendered>("render_prompt_vars", { content, defined, values }),
  renamePromptVar: (content: string, from: string, to: string) =>
    invoke<string>("rename_prompt_var", { content, from, to }),
  removePromptVar: (content: string, name: string) => invoke<string>("remove_prompt_var", { content, name }),
  validatePromptVarName: (name: string, defined: PromptVariable[], current?: string) =>
    invoke<string | null>("validate_prompt_var_name", { name, defined, current: current ?? null }),

  // ── AI 工具版本管理 ──
  toolList: () => invoke<ToolList>("tool_list"),
  toolCheckLatest: () => invoke<ToolList>("tool_check_latest"),
  toolUpdate: (ids: string[]) => invoke<ToolUpdateOutcome[]>("tool_update", { ids }),
};

export async function copyText(text: string): Promise<boolean> {
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
