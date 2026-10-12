import { Check, FolderInput, GitCompare, Package, ScanSearch } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/motion/switch";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "folder" | "pack" | "git";
interface Discovered {
  path: string;
  name: string;
  description: string;
}

/** 内置市场源（知名 skills 合集仓库）；用户也可输入任意 git URL */
const PRESETS: { name: string; url: string }[] = [
  { name: "Anthropic 官方 Skills", url: "https://github.com/anthropics/skills" },
  { name: "Superpowers（社区精选）", url: "https://github.com/obra/superpowers" },
];

export function GetSkillsDialog({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  // git
  const [gitUrl, setGitUrl] = useState("");
  const [discovered, setDiscovered] = useState<Discovered[] | null>(null);
  const [gitSel, setGitSel] = useState<Set<string>>(new Set());
  const [gitTemp, setGitTemp] = useState("");

  const reset = () => {
    setMode(null);
    setBusy(false);
    setGitUrl("");
    setDiscovered(null);
    setGitSel(new Set());
    setGitTemp("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const importFolders = async () => {
    const picked = await openFileDialog({ directory: true, multiple: true, title: t("skills.folderPick") });
    if (!picked) return;
    const paths = (Array.isArray(picked) ? picked : [picked]).filter(Boolean) as string[];
    if (!paths.length) return;
    setBusy(true);
    let okCount = 0;
    let skipped = 0;
    try {
      for (const p of paths) {
        try {
          const meta = await api.importSkillFolder(p, overwrite);
          okCount += 1;
          toast.success(t("skills.imported", { name: meta.name }));
        } catch (e) {
          const msg = String(e);
          if (msg.includes("exists:")) {
            skipped += 1;
            toast.warning(t("skills.skippedExists", { name: p.split(/[\\/]/).pop() }));
          } else {
            toast.error(`${p.split(/[\\/]/).pop()}: ${msg}`);
          }
        }
      }
      toast.info(t("skills.getDone", { ok: okCount, total: paths.length }));
      onDone();
      if (okCount > 0) close();
    } finally {
      setBusy(false);
    }
  };

  const installPack = async () => {
    const picked = await openFileDialog({ directory: true, multiple: false, title: t("skills.packPick") });
    if (typeof picked !== "string" || !picked) return;
    setBusy(true);
    try {
      const r = await api.installSkillPack(picked, overwrite);
      toast.success(t("skills.installDone", { name: r.name, version: r.version }));
      r.warnings.forEach((w) => toast.warning(w));
      onDone();
      close();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const discover = async (url?: string) => {
    const target = (url ?? gitUrl).trim();
    if (!target) {
      toast.warning(t("skills.gitUrlPh"));
      return;
    }
    setGitUrl(target);
    setBusy(true);
    try {
      const r = await api.gitFetchSkills(target);
      setDiscovered(r.skills);
      setGitTemp(r.tempDir);
      if (!r.skills.length) toast.info(t("skills.gitNoSkills"));
      setGitSel(new Set(r.skills.map((s) => s.path)));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const installDiscovered = async () => {
    const picks = discovered?.filter((d) => gitSel.has(d.path)) ?? [];
    if (!picks.length) {
      toast.warning(t("harness.nothingSelected"));
      return;
    }
    setBusy(true);
    let okCount = 0;
    let skipped = 0;
    try {
      for (const d of picks) {
        try {
          const meta = await api.importSkillFolder(d.path, overwrite);
          okCount += 1;
          toast.success(t("skills.imported", { name: meta.name }));
        } catch (e) {
          const msg = String(e);
          if (msg.includes("exists:")) {
            skipped += 1;
            toast.warning(t("skills.skippedExists", { name: d.name }));
          } else {
            toast.error(`${d.name}: ${msg}`);
          }
        }
      }
      toast.info(t("skills.getDone", { ok: okCount, total: picks.length }));
      onDone();
      if (gitTemp) void api.cleanupGitTemp(gitTemp).catch(() => undefined);
      close();
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: Mode; icon: typeof FolderInput; title: string; hint: string }[] = [
    { id: "folder", icon: FolderInput, title: t("skills.modeFolder"), hint: t("skills.modeFolderHint") },
    { id: "pack", icon: Package, title: t("skills.modePack"), hint: t("skills.modePackHint") },
    { id: "git", icon: GitCompare, title: t("skills.modeGit"), hint: t("skills.modeGitHint") },
  ];

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FolderInput />
        {t("skills.getSkills")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            if (gitTemp) void api.cleanupGitTemp(gitTemp).catch(() => undefined);
            close();
          }
        }}
      >
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{t("skills.getTitle")}</DialogTitle>
            <DialogDescription>{t("skills.getHint")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {/* 覆盖开关 */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2">
              <Switch checked={overwrite} onCheckedChange={setOverwrite} />
              <span className="text-xs text-ink-2">{t("skills.overwriteSwitch")}</span>
            </div>

            {/* 方式选择 */}
            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map(({ id, icon: Icon, title, hint }) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => setMode(id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 text-left outline-none transition-all",
                    mode === id
                      ? "border-primary shadow-[0_0_0_3px_var(--ah-primary-soft)]"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <Icon className={cn("size-4", mode === id ? "text-primary" : "text-ink-3")} />
                  <span className="text-[13px] font-medium text-foreground">{title}</span>
                  <span className="text-[11px] leading-relaxed text-ink-3">{hint}</span>
                </button>
              ))}
            </div>

            {/* folder */}
            {mode === "folder" ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs leading-relaxed text-ink-2">{t("skills.folderStepHint")}</p>
                <Button className="mt-3 w-full" onClick={() => void importFolders()} disabled={busy}>
                  {busy ? t("common.saving") : t("skills.folderPickBtn")}
                </Button>
              </div>
            ) : null}

            {/* pack */}
            {mode === "pack" ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs leading-relaxed text-ink-2">{t("skills.packStepHint")}</p>
                <Button className="mt-3 w-full" onClick={() => void installPack()} disabled={busy}>
                  {busy ? t("common.saving") : t("skills.packPickBtn")}
                </Button>
              </div>
            ) : null}

            {/* git */}
            {mode === "git" ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-ink-3">{t("skills.gitPreset")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        disabled={busy}
                        onClick={() => void discover(preset.url)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                          gitUrl === preset.url
                            ? "border-primary bg-primary text-white"
                            : "border-border text-ink-2 hover:border-primary/40 hover:text-primary",
                        )}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder={t("skills.gitUrlPh")}
                    className="h-8 font-mono text-xs"
                  />
                  <Button size="sm" onClick={() => void discover()} disabled={busy || !gitUrl.trim()}>
                    <ScanSearch className="size-3.5" />
                    {t("skills.discover")}
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-ink-3">{t("skills.gitHint")}</p>

                {discovered ? (
                  discovered.length ? (
                    <>
                      <div className="text-[11px] font-medium text-ink-3">{t("skills.discoveredHint")}</div>
                      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                        {discovered.map((d) => {
                          const checked = gitSel.has(d.path);
                          return (
                            <button
                              key={d.path}
                              type="button"
                              onClick={() =>
                                setGitSel((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(d.path)) next.delete(d.path);
                                  else next.add(d.path);
                                  return next;
                                })
                              }
                              className={cn(
                                "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left outline-none transition-colors",
                                checked ? "border-primary/40 bg-primary-soft" : "border-transparent hover:bg-surface-2",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                                  checked ? "border-primary bg-primary text-white" : "border-border-strong",
                                )}
                              >
                                {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-mono text-xs font-medium text-foreground">{d.name}</span>
                                {d.description ? (
                                  <span className="mt-0.5 block truncate text-[11px] text-ink-3">{d.description}</span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <Button onClick={() => void installDiscovered()} disabled={busy || gitSel.size === 0}>
                        {busy ? t("common.saving") : t("skills.installSel")}
                      </Button>
                    </>
                  ) : (
                    <p className="rounded-lg bg-bg-subtle px-3 py-2.5 text-xs text-ink-2">{t("skills.gitNoSkills")}</p>
                  )
                ) : null}
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={close} disabled={busy}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

