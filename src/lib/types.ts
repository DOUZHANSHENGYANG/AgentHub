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

/** 提示词变量类型：渲染时只影响控件与空值判定 */
export type PromptVarType = "text" | "textarea" | "select" | "number" | "boolean";

/** 一个变量的定义（正文里以 {{name}} 引用） */
export interface PromptVariable {
  name: string;
  type: PromptVarType;
  defaultValue: string;
  options: string[];
  required: boolean;
  placeholder: string;
  description: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  /** 变量定义。旧数据没有该字段时为 undefined，按空数组处理 */
  variables?: PromptVariable[];
  versions: VersionEntry[];
  createdAt: string;
  updatedAt: string;
}

/** 正文解析对账结果 */
export interface PromptVarReconciled {
  /** 正文中出现的变量（已合并定义） */
  active: PromptVariable[];
  /** 只在定义里、正文已不引用 */
  unused: PromptVariable[];
}

/** 渲染结果 */
export interface PromptVarRendered {
  content: string;
  /** 必填但未给值的变量名 */
  missing: string[];
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
  targets: string[];
  targetsInitialized: boolean;
  origin: Origin | null;
  versions: VersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface VetFindingRow {
  rule: string;
  severity: string;
  file: string;
  line: number;
  excerpt: string;
  /** 人工复审：已忽略该条 */
  ignored: boolean;
  ignoredAt: string;
}

export interface VetReportRow {
  verdict: string;
  level: string;
  critical: number;
  high: number;
  medium: number;
  contentHash: string;
  checkedAt: string;
  checkedBy: string;
  findings: VetFindingRow[];
  /** 人工复核结论："" | approved | rejected */
  review: string;
  reviewedAt: string;
  reviewNote: string;
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
  vetVerdict: string;
  vetCritical: number;
  vetHigh: number;
  vetMedium: number;
  vetCheckedAt: string;
  vetPending: number;
  vetIgnored: number;
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
  harnessOrder: string[];
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

export interface VaultVersion {
  v: number;
  savedAt: string;
  hash: string;
  size: number;
  kind: string; // manual | daily | auto | pre-restore
}

export interface VaultEntry {
  harness: string;
  name: string;
  path: string;
  versions: VaultVersion[];
}

export interface VaultIndex {
  watched: string[];
  daily: boolean;
  lastDaily: string;
  entries: VaultEntry[];
}

export interface VaultStatus {
  harness: string;
  name: string;
  path: string;
  exists: boolean;
  watched: boolean;
  versionCount: number;
  lastSavedAt: string;
  upToDate: boolean;
  currentHash: string;
}

/** 技能目录树节点 */
export interface SkillFileNode {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  ext: string;
  /** dir | markdown | text | code | image | pdf | word | sheet | archive | other */
  kind: string;
  children: SkillFileNode[];
}

/** 技能内文件内容（实时阅读） */
export interface SkillFileContent {
  path: string;
  name: string;
  ext: string;
  kind: string;
  size: number;
  text: string;
  dataBase64: string;
  truncated: boolean;
  note: string;
}

// ---------------- 腾讯 SkillHub 市场 ----------------

/** 市场里的一个技能 */
export interface MarketSkill {
  slug: string;
  namespace: string;
  /** 完整坐标，如 `@ake/dev-god` */
  coordinate: string;
  name: string;
  description: string;
  version: string;
  category: string;
  /** enterprise | community | clawhub */
  source: string;
  downloads: number;
  stars: number;
  iconUrl: string;
  verified: boolean;
  publisher: string;
}

export interface MarketPage {
  total: number;
  page: number;
  pageSize: number;
  skills: MarketSkill[];
}

export interface MarketCategory {
  key: string;
  name: string;
  nameEn: string;
}

/** 要安装的市场技能 */
export interface MarketInstallTarget {
  slug: string;
  namespace: string;
  version: string;
  name: string;
}

export interface MarketInstallReport {
  slug: string;
  name: string;
  version: string;
  dirName: string;
  ok: boolean;
  error: string;
}

// ---------------- AI 工具版本管理 ----------------

/** 一个 AI 工具的版本状态 */
export interface ToolVersion {
  id: string;
  name: string;
  /** npm 包名 */
  pkg: string;
  installed: boolean;
  current: string;
  /** registry 最新版（未检查时为空） */
  latest: string;
  hasUpdate: boolean;
  /** 装了但命令跑不起来 */
  broken: boolean;
  runnableNote: string;
}

export interface ToolList {
  tools: ToolVersion[];
  npmAvailable: boolean;
  npmNote: string;
}

/** 单个工具的更新结果 */
export interface ToolUpdateOutcome {
  id: string;
  name: string;
  ok: boolean;
  from: string;
  to: string;
  message: string;
}

/** 导入前的技能预览（尚未进中枢） */
export interface ImportPreview {
  name: string;
  description: string;
  /** SKILL.md 正文（已剥离 frontmatter） */
  body: string;
  /** frontmatter 原文 */
  frontmatter: string;
  files: { path: string; size: number }[];
  /** 中枢里已有同名技能 */
  existsInHub: boolean;
}
