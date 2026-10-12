import { invoke } from "@tauri-apps/api/core";
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
} from "./types";

export const api = {
  getSettings: () => invoke<SettingsInfo>("get_settings"),
  setDataDir: (path: string) => invoke<SettingsInfo>("set_data_dir", { path }),
  setPrefs: (language?: string, theme?: string) =>
    invoke<SettingsInfo>("set_prefs", { language, theme }),
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
  importSkillFolder: (path: string, overwrite: boolean) =>
    invoke<SkillMeta>("import_skill_folder", { path, overwrite }),
  skillExtension: (dirName: string) =>
    invoke<{ doc: Record<string, unknown> | null; stale: boolean; treeHash: string; violations: { rule: string; severity: string; message: string }[]; hasToml: boolean }>("skill_extension", { dirName }),
  setSkillStatus: (dirName: string, status: string, supersededBy: string) =>
    invoke<SkillMeta>("set_skill_status", { dirName, status, supersededBy }),
  packSkill: (dirName: string, outDir: string) =>
    invoke<string>("pack_skill", { dirName, outDir }),
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

  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  storageStats: () => invoke<StorageStats>("storage_stats"),
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
