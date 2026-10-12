// Mirror of Rust models (serde camelCase)
export interface VersionEntry {
  v: number;
  savedAt: string;
  note: string;
  content: string;
}

export interface Origin {
  harness: string;
  file: string;
  importedAt: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  versions: VersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  transport: string; // stdio | http | sse
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
  tags: string[];
  enabled: boolean;
  origin: Origin | null;
  versions: VersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillMeta {
  name: string;
  dirName: string;
  description: string;
  tags: string[];
  versions: number;
  hasAssets: boolean;
  contentLen: number;
  origin: Origin | null;
  createdAt: string;
  updatedAt: string;
  version: string;
  status: "draft" | "active" | "deprecated" | "archived" | string;
  stale: boolean;
  hasToml: boolean;
}

export interface SkillDoc {
  meta: SkillMeta;
  frontmatter: Record<string, unknown>;
  body: string;
  versions: VersionEntry[];
}

export interface Settings {
  dataDir: string;
  language: string;
  theme: string;
  skillSourceDirs: string[];
}

export interface DataDirs {
  root: string;
  prompts: string;
  mcp: string;
  skills: string;
}

export interface SettingsInfo {
  settings: Settings;
  dataDirs: DataDirs;
}

export interface DetectedServer {
  name: string;
  transport: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
}

export interface DetectedSkill {
  name: string;
  path: string;
  description: string;
}

export interface HarnessReport {
  id: string;
  name: string;
  supportsMcp: boolean;
  supportsSkills: boolean;
  configPath: string;
  exists: boolean;
  mcpServers: DetectedServer[];
  skillsDirs: string[];
  skills: DetectedSkill[];
  notes: string[];
}

export interface ImportResult {
  imported: string[];
  skipped: string[];
  errors: string[];
}

export interface ApplyResult {
  applied: string[];
  warnings: string[];
  backups: string[];
  errors: string[];
}

export interface StorageStats {
  prompts: number;
  mcp: number;
  skills: number;
  totalBytes: number;
}

export interface SkillSavePayload {
  dirName: string;
  name: string;
  description: string;
  tags: string[];
  body: string;
  frontmatter: Record<string, unknown>;
  level?: string;
}

export interface ImportSelection {
  name: string;
  overwrite: boolean;
}

export interface PreImportResult {
  newItems: string[];
  conflicts: string[];
}
