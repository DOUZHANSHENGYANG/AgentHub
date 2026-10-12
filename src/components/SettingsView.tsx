import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, CloudUpload, Cog, FolderOpen, FolderPlus, GitBranch, Globe2, HardDrive, Info, Languages, LogOut, Minus, Moon, Palette, Square, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast, Toaster } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SettingsBody() {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const info = useSettings((s) => s.info);
  const refresh = useSettings((s) => s.refresh);
  const setDataDir = useSettings((s) => s.setDataDir);
  const loadAll = useData((s) => s.loadAll);

  const [stats, setStats] = useState<{ prompts: number; mcp: number; skills: number; totalBytes: number } | null>(null);

  useEffect(() => {
    if (info) void api.storageStats().then(setStats).catch(() => undefined);
  }, [info]);

  const changeDir = async () => {
    const picked = await open({ directory: true, multiple: false, title: t("settings.dataDir") });
    if (typeof picked !== "string" || !picked) return;
    await setDataDir(picked);
    await loadAll();
    await refresh();
    toast.success(t("settings.dirChanged"));
  };

  const addSkillDir = async () => {
    const picked = await open({ directory: true, multiple: false, title: t("settings.addDir") });
    if (typeof picked !== "string" || !picked) return;
    await api.addSkillSourceDir(picked);
    await refresh();
  };

  const removeSkillDir = async (path: string) => {
    await api.removeSkillSourceDir(path);
    await refresh();
  };

  // Git 同步 + 授权
  const [sync, setSync] = useState<{ initialized: boolean; hasRemote: boolean; remoteUrl: string; branch: string; dirtyFiles: string[]; lastCommit: string; ahead: number } | null>(null);
  const [auth, setAuth] = useState<{ github: boolean; gitee: boolean; login: string; repoUrl: string } | null>(null);
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [patProvider, setPatProvider] = useState<"github" | "gitee">("github");
  const [patInput, setPatInput] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [remoteInput, setRemoteInput] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const loadSync = () => {
    void api.syncStatus().then(setSync).catch(() => setSync(null));
    void api.authStatus().then(setAuth).catch(() => setAuth(null));
  };
  useEffect(loadSync, []);

  // GitHub Device Flow：发起授权 → 打开浏览器 → 轮询
  const startGithubAuth = async () => {
    setAuthBusy(true);
    try {
      const session = await api.authGithubStart();
      setDeviceCode({ userCode: session.userCode, verificationUri: session.verificationUri });
      void invoke("plugin:opener|open_url", { url: session.verificationUri }).catch(() => undefined);
      const interval = (session.interval ?? 5) * 1000;
      const timer = window.setInterval(async () => {
        try {
          const r = await api.authGithubPoll(session.userCode);
          if (r.ok) {
            window.clearInterval(timer);
            setDeviceCode(null);
            toast.success(t("sync.authDone", { login: r.login }));
            // 自动建私有仓库
            try {
              const url = await api.authCreateRepo("github");
              toast.success(t("sync.repoCreated", { url }));
            } catch (e) {
              toast.warning(String(e));
            }
            loadSync();
          } else if (r.error === "expired_token" || r.error === "denied") {
            window.clearInterval(timer);
            setDeviceCode(null);
            toast.error(t("sync.authFailed"));
          }
          // authorization_pending / slow_down → 继续轮询
        } catch {
          /* 网络抖动继续 */
        }
      }, interval);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const savePat = async () => {
    setAuthBusy(true);
    try {
      const r = await api.authSavePat(patProvider, patInput);
      toast.success(t("sync.authDone", { login: r.login }));
      setPatInput("");
      setShowPat(false);
      try {
        const url = await api.authCreateRepo(patProvider);
        toast.success(t("sync.repoCreated", { url }));
      } catch (e) {
        toast.warning(String(e));
      }
      loadSync();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const doLogout = async () => {
    await api.authLogout();
    toast.success(t("sync.loggedOut"));
    loadSync();
  };

  const saveRemote = async () => {
    if (!remoteInput.trim()) return;
    setSyncBusy(true);
    try {
      await api.syncSetRemote(remoteInput.trim());
      toast.success(t("sync.saved"));
      setRemoteInput("");
      loadSync();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doPush = async () => {
    setSyncBusy(true);
    try {
      toast.success(await api.syncPush("", true, "github"));
      loadSync();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doPull = async () => {
    setSyncBusy(true);
    try {
      toast.success(await api.syncPull(true, "github"));
      await loadAll();
      await refresh();
      loadSync();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const dirs = info?.dataDirs;

  return (
    <div className="flex flex-col gap-5">
      <Section icon={<Palette className="size-4 text-primary" />} title={t("settings.appearance")}>
        <div>
          <div className="mb-2 text-xs font-medium text-ink-2">{t("settings.theme")}</div>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map((th) => (
              <button
                key={th}
                type="button"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  void setTheme(th, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left outline-none transition-all",
                  theme === th ? "border-primary shadow-[0_0_0_3px_var(--ah-primary-soft)]" : "border-border hover:border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg border",
                    th === "light" ? "border-[#e3e6ed] bg-[#f4f5f8] text-[#171a22]" : "border-[#232838] bg-[#0a0c11] text-[#e7e9f0]",
                  )}
                >
                  {th === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {th === "light" ? t("settings.themeLight") : t("settings.themeDark")}
                  </span>
                  <span className="block text-[11px] text-ink-3">{t("settings.themeHint")}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-ink-2">{t("settings.language")}</div>
          <div className="flex gap-2">
            {(["zh", "en"] as const).map((lang) => (
              <Button key={lang} variant={language === lang ? "default" : "secondary"} size="sm" onClick={() => void setLanguage(lang)}>
                <Globe2 />
                {lang === "zh" ? "简体中文" : "English"}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={<HardDrive className="size-4 text-primary" />} title={t("settings.storage")}>
        <div>
          <div className="mb-2 text-xs font-medium text-ink-2">{t("settings.dataDir")}</div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" dir="ltr">
              {dirs?.root ?? "…"}
            </code>
            <Button size="sm" variant="secondary" onClick={() => void changeDir()}>
              {t("settings.changeDir")}
            </Button>
            <Button size="iconSm" variant="ghost" title={t("settings.openDir")} onClick={() => dirs && void api.revealPath(dirs.root)}>
              <FolderOpen />
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{t("settings.dataDirHint")}</p>
        </div>

        {stats ? (
          <div>
            <div className="mb-2 text-xs font-medium text-ink-2">{t("settings.stats")}</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: t("settings.statPrompts"), value: stats.prompts },
                { label: t("settings.statMcp"), value: stats.mcp },
                { label: t("settings.statSkills"), value: stats.skills },
                { label: t("settings.statSize"), value: fmtBytes(stats.totalBytes) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-bg-subtle px-3 py-2.5 text-center">
                  <div className="text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
                  <div className="text-[11px] text-ink-3">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">{t("settings.skillDirs")}</span>
            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => void addSkillDir()}>
              <FolderPlus />
              {t("settings.addDir")}
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            {(info?.settings.skillSourceDirs ?? []).map((d) => (
              <div key={d} className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-2" dir="ltr">
                  {d}
                </code>
                <button
                  type="button"
                  className="rounded p-1 text-ink-3 outline-none hover:bg-surface-2 hover:text-danger"
                  onClick={() => void removeSkillDir(d)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {(info?.settings.skillSourceDirs ?? []).length === 0 ? (
              <p className="text-[11px] text-ink-3">{t("settings.skillDirsHint")}</p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section icon={<CloudUpload className="size-4 text-primary" />} title={t("sync.title")}>
        <p className="text-xs leading-relaxed text-ink-3">{t("sync.desc")}</p>

        {/* 授权状态 */}
        <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2.5">
          {auth?.github || auth?.gitee ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{t("sync.authorized")}</Badge>
              <span className="text-xs text-foreground">{auth?.login}</span>
              {auth?.repoUrl ? (
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-3" dir="ltr">
                  {auth.repoUrl}
                </code>
              ) : null}
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => void doLogout()}>
                <LogOut className="size-3" />
                {t("sync.logout")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-2">{t("sync.notAuthorized")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void startGithubAuth()} disabled={authBusy || !!deviceCode}>
                  <GitBranch />
                  {t("sync.authGithub")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowPat((v) => !v)}>
                  {t("sync.usePat")}
                </Button>
              </div>
              {deviceCode ? (
                <div className="rounded-lg border border-primary/40 bg-primary-soft px-3 py-2.5">
                  <p className="text-xs text-ink-2">{t("sync.deviceStep1")}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="rounded-md bg-surface px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-primary">
                      {deviceCode.userCode}
                    </code>
                    <span className="text-[11px] text-ink-3">{t("sync.deviceStep2")}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-3">{t("sync.deviceWaiting")}</p>
                </div>
              ) : null}
              {showPat ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
                  <div className="flex gap-2">
                    {(["github", "gitee"] as const).map((p) => (
                      <Button key={p} size="sm" variant={patProvider === p ? "default" : "secondary"} className="h-7 text-[11px]" onClick={() => setPatProvider(p)}>
                        {p === "github" ? "GitHub" : "Gitee"}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder={t("sync.patPh")}
                      type="password"
                      className="h-8 flex-1 font-mono text-xs"
                    />
                    <Button size="sm" onClick={() => void savePat()} disabled={authBusy || !patInput.trim()}>
                      {t("sync.patSave")}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-3">{t("sync.patHint")}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 同步操作（授权后可用） */}
        {auth?.github || auth?.gitee ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void doPush()} disabled={syncBusy}>
                <CloudUpload />
                {t("sync.pushAuto")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void doPull()} disabled={syncBusy}>
                {t("sync.pull")}
              </Button>
            </div>

            {/* 高级：手动绑定仓库 */}
            <details>
              <summary className="cursor-pointer text-[11px] font-medium text-ink-3 outline-none hover:text-ink-2">{t("sync.manualBind")}</summary>
              <div className="mt-2">
                <div className="mb-2 text-xs font-medium text-ink-2">{t("sync.remote")}</div>
                <div className="flex items-center gap-2">
                  <Input
                    value={remoteInput}
                    onChange={(e) => setRemoteInput(e.target.value)}
                    placeholder={sync?.hasRemote ? sync.remoteUrl : "https://github.com/you/agenthub-data.git"}
                    className="h-8 flex-1 font-mono text-xs"
                  />
                  <Button size="sm" variant="secondary" onClick={() => void saveRemote()} disabled={syncBusy || !remoteInput.trim()}>
                    {t("sync.bind")}
                  </Button>
                </div>
              </div>
            </details>

            {sync?.initialized ? (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <GitBranch className="size-3" />
                {sync.branch} · {t("sync.lastCommit")}: {sync.lastCommit || "—"}
                {sync.ahead > 0 ? <Badge variant="warning">{t("sync.ahead", { n: sync.ahead })}</Badge> : null}
              </p>
            ) : null}
            <p className="text-[11px] leading-relaxed text-ink-3">{t("sync.hint")}</p>
          </>
        ) : null}
      </Section>

      <Section icon={<Info className="size-4 text-primary" />} title={t("settings.about")}>
        <p className="text-xs leading-relaxed text-ink-2">{t("settings.aboutDesc")}</p>
        <div className="flex flex-wrap gap-1.5">
          {["Tauri 2", "React 19", "TypeScript", "Tailwind CSS 4", "beUI", "GSAP", "Zustand", "Lucide"].map((s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-2.5">
          <div className="text-[11px] font-semibold text-ink-2">{t("settings.roadmap")}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{t("settings.roadmapText")}</div>
        </div>
        <div className="text-[11px] text-ink-3">{t("settings.version")}: 0.1.0</div>
      </Section>
    </div>
  );
}

/**
 * 应用内独立的设置界面：切换后整个应用变为设置页（不显示主界面侧边栏），
 * 左上角「返回」回到进入前的主界面。
 */
export function SettingsView() {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.theme);
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const goBack = useUi((s) => s.goBack);
  const win = getCurrentWindow();

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header
        data-tauri-drag-region
        className="flex h-11 shrink-0 select-none items-center border-b border-border bg-surface pl-3.5"
      >
        <button
          type="button"
          onClick={goBack}
          className="mr-1 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          <span className="text-xs font-medium">{t("common.back")}</span>
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Cog className="size-4 shrink-0 text-primary" />
        <span data-tauri-drag-region className="ml-2 text-[13px] font-semibold text-foreground">
          {t("nav.settings")}
        </span>
        <div data-tauri-drag-region className="h-full flex-1" />
        <button
          type="button"
          title="中文 / English"
          onClick={() => void setLanguage(language === "zh" ? "en" : "zh")}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Languages className="size-4" />
          <span className="text-[11px] font-medium uppercase">{language === "zh" ? "中" : "EN"}</span>
        </button>
        <ThemeToggle className="mr-1" />
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => void win.minimize()}
          className="grid h-11 w-11 place-items-center text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          onClick={() => void win.toggleMaximize()}
          className="grid h-11 w-11 place-items-center text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Square className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void win.close()}
          className="grid h-11 w-11 place-items-center text-ink-2 outline-none transition-colors hover:bg-danger hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs leading-relaxed text-ink-3">{t("settings.subtitle")}</p>
          <SettingsBody />
        </div>
      </div>

      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          classNames: {
            toast: "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-lg !text-xs",
            description: "!text-ink-3",
          },
        }}
      />
    </div>
  );
}
