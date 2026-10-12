import { Check, ChevronDown, Download, FolderInput, Loader2, RefreshCw, ScanSearch, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { HarnessReport, ImportSelection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";

function CheckItem({
  checked,
  onToggle,
  title,
  detail,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left outline-none transition-colors",
        checked
          ? "border-primary/40 bg-primary-soft"
          : "border-transparent hover:border-border hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
          checked ? "border-primary bg-primary text-white" : "border-border-strong bg-surface",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        {detail ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3" dir="ltr">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function HarnessCard({
  report,
  kind,
  selected,
  onToggle,
  onSelectAll,
  children,
}: {
  report: HarnessReport;
  kind: "mcp" | "skills";
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const items = kind === "mcp" ? report.mcpServers : report.skills;
  const count = items.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
          <span className="truncate text-sm font-semibold text-foreground">{report.name}</span>
          {count > 0 ? (
            <Badge variant="default">{kind === "mcp" ? t("harness.mcpCount", { count }) : t("harness.skillsCount", { count })}</Badge>
          ) : (
            <Badge variant="muted">{t("harness.notInstalled")}</Badge>
          )}
        </button>
        {count > 0 ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onSelectAll}>
            {t("harness.selectAll")}
          </Button>
        ) : null}
        {children}
      </div>
      {open ? (
        <div className="p-2">
          {count > 0 ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {items.map((item) => {
                const detail =
                  kind === "mcp"
                    ? (item as { transport?: string }).transport === "stdio"
                      ? `${(item as { command?: string }).command ?? ""} ${(item as { args?: string[] }).args?.join(" ") ?? ""}`.trim()
                      : (item as { url?: string }).url ?? ""
                    : (item as { description?: string }).description || (item as { path?: string }).path;
                return (
                  <CheckItem
                    key={item.name}
                    checked={selected.has(item.name)}
                    onToggle={() => onToggle(item.name)}
                    title={item.name}
                    detail={detail}
                  />
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-ink-3">
              {report.configPath ? (
                <span className="font-mono text-[11px]" dir="ltr">
                  {report.configPath}
                </span>
              ) : (
                "—"
              )}
            </div>
          )}
          {report.notes.map((n) => (
            <div key={n} className="px-3 py-1 text-[11px] text-warning">
              {n}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 冲突确认弹框：同名项目逐项选择保留中枢 / 用扫描源覆盖 */
function ConflictDialog({
  open,
  conflicts,
  choice,
  onChoice,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  conflicts: string[];
  choice: Record<string, boolean>;
  onChoice: (name: string, overwrite: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warning" />
            {t("harness.conflictTitle")}
          </DialogTitle>
          <DialogDescription>{t("harness.conflictHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {conflicts.map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{name}</span>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => onChoice(name, false)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium outline-none transition-colors",
                    !choice[name] ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
                  )}
                >
                  {t("harness.keepHub")}
                </button>
                <button
                  type="button"
                  onClick={() => onChoice(name, true)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium outline-none transition-colors",
                    choice[name] ? "bg-warning/15 text-warning" : "text-ink-3 hover:text-foreground",
                  )}
                >
                  {t("harness.useSource")}
                </button>
              </div>
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? t("common.saving") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HarnessDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "mcp" | "skills";
}) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<HarnessReport[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [tab, setTab] = useState<string>("collect");
  // collect tab: harnessId -> Set(name); apply tab: shared selected names
  const [collectSel, setCollectSel] = useState<Record<string, Set<string>>>({});
  const [applySel, setApplySel] = useState<Set<string>>(new Set());

  // conflict confirmation state
  const [pending, setPending] = useState<{ harnessId: string; newItems: string[]; conflicts: string[] } | null>(null);
  const [conflictChoice, setConflictChoice] = useState<Record<string, boolean>>({});

  const mcp = useData((s) => s.mcp);
  const skills = useData((s) => s.skills);
  const loadMcp = useData((s) => s.loadMcp);
  const loadSkills = useData((s) => s.loadSkills);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      setReports(await api.scanHarnesses());
    } catch (e) {
      toast.error(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTab("collect");
      setCollectSel({});
      setApplySel(new Set());
      setPending(null);
      void scan();
    }
  }, [open, scan]);

  const toggleCollect = (harnessId: string, name: string) => {
    setCollectSel((prev) => {
      const next = { ...prev };
      const set = new Set(next[harnessId] ?? []);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      next[harnessId] = set;
      return next;
    });
  };

  const selectAllCollect = (r: HarnessReport) => {
    const items = kind === "mcp" ? r.mcpServers : r.skills;
    setCollectSel((prev) => {
      const set = new Set(prev[r.id] ?? []);
      const allSelected = items.every((x) => set.has(x.name));
      if (allSelected) items.forEach((x) => set.delete(x.name));
      else items.forEach((x) => set.add(x.name));
      return { ...prev, [r.id]: set };
    });
  };

  const totalCollect = Object.values(collectSel).reduce((acc, s) => acc + s.size, 0);

  const runImport = useCallback(
    async (harnessId: string, selections: ImportSelection[]) => {
      setBusy(true);
      try {
        const res = await api.importFromHarness(harnessId, kind, selections);
        if (res.imported.length) {
          toast.success(
            t("harness.importDone", { imported: res.imported.length }) +
              (res.skipped.length ? t("harness.importSkipped", { count: res.skipped.length }) : ""),
          );
        }
        res.errors.forEach((e) => toast.error(e));
        setCollectSel((prev) => ({ ...prev, [harnessId]: new Set() }));
        if (kind === "mcp") void loadMcp();
        else void loadSkills();
      } catch (e) {
        toast.error(`${t("harness.importFailed")}: ${String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [kind, loadMcp, loadSkills, t],
  );

  // 收集：先预收集（归档信息）→ 异步通知结果 → 无冲突直接执行；有冲突弹框逐项确认
  const doCollect = async (report: HarnessReport) => {
    const names = [...(collectSel[report.id] ?? [])];
    if (!names.length) {
      toast.warning(t("harness.nothingSelected"));
      return;
    }
    setBusy(true);
    try {
      const pre = await api.preImport(report.id, kind, names);
      if (!pre.newItems.length && !pre.conflicts.length) {
        toast.info(t("harness.collectEmpty"));
        return;
      }
      toast.success(t("harness.preDone", { newCount: pre.newItems.length, conflictCount: pre.conflicts.length }));
      if (pre.conflicts.length) {
        setConflictChoice({});
        setPending({ harnessId: report.id, newItems: pre.newItems, conflicts: pre.conflicts });
      } else {
        await runImport(report.id, pre.newItems.map((n) => ({ name: n, overwrite: false })));
      }
    } catch (e) {
      toast.error(`${t("harness.importFailed")}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmConflicts = async () => {
    if (!pending) return;
    const selections: ImportSelection[] = [
      ...pending.newItems.map((n) => ({ name: n, overwrite: false })),
      ...pending.conflicts.map((n) => ({ name: n, overwrite: conflictChoice[n] ?? false })),
    ];
    const id = pending.harnessId;
    setPending(null);
    await runImport(id, selections);
  };

  const hubItems = (kind === "mcp" ? mcp.map((s) => s.name) : skills.map((s) => s.dirName)).filter(Boolean);

  const doApply = async (report: HarnessReport) => {
    const names = [...applySel];
    if (!names.length) {
      toast.warning(t("harness.nothingSelected"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.applyToHarness(report.id, kind, names);
      if (res.applied.length && res.warnings.length) toast.success(t("harness.applyWithWarn", { applied: res.applied.length, warn: res.warnings.length }));
      else if (res.applied.length) toast.success(t("harness.applyDone", { applied: res.applied.length }));
      res.warnings.forEach((w) => toast.warning(w));
      res.errors.forEach((e) => toast.error(e));
    } catch (e) {
      toast.error(`${t("harness.applyFailed")}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const visible = (reports ?? []).filter((r) => (kind === "mcp" ? r.supportsMcp || r.mcpServers.length : r.supportsSkills || r.skills.length));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent wide className="h-[86vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanSearch className="size-4 text-primary" />
              {t("harness.title")}
            </DialogTitle>
            <DialogDescription>{t("harness.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-5 pt-3">
            <Tabs value={tab} onValueChange={setTab} variant="segment">
              <TabsList>
                <TabsTrigger value="collect">{t("harness.collectTab")}</TabsTrigger>
                <TabsTrigger value="apply">{t("harness.applyTab")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <DialogBody>
            {reports === null ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-3">
                {scanning ? <Loader2 className="size-6 animate-spin" /> : null}
                <span className="text-xs">{t("harness.scanning")}</span>
              </div>
            ) : (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsContent value="collect">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-3">{t("harness.hintCollect")}</p>
                    <Button size="sm" variant="ghost" onClick={() => void scan()} disabled={scanning}>
                      <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
                      {t("common.rescan")}
                    </Button>
                  </div>
                  {visible.length === 0 ? (
                    <div className="py-16 text-center text-xs text-ink-3">{t("harness.noHarness")}</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {visible.map((r) => (
                        <HarnessCard
                          key={r.id}
                          report={r}
                          kind={kind}
                          selected={collectSel[r.id] ?? new Set()}
                          onToggle={(name) => toggleCollect(r.id, name)}
                          onSelectAll={() => selectAllCollect(r)}
                        >
                          <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[11px]" disabled={busy} onClick={() => void doCollect(r)}>
                            <FolderInput className="size-3.5" />
                            {t("common.collect")}
                          </Button>
                        </HarnessCard>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="apply">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-xs text-ink-3">{t("harness.hintApply")}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-ink-3">{t("harness.overwriteLabel")}</span>
                      <Switch checked={overwrite} onCheckedChange={setOverwrite} />
                    </div>
                  </div>
                  {hubItems.length === 0 ? (
                    <div className="py-16 text-center text-xs text-ink-3">{t("harness.noHubItems")}</div>
                  ) : (
                    <>
                      <div className="mb-4 flex flex-wrap gap-1.5">
                        {hubItems.map((name) => {
                          const checked = applySel.has(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() =>
                                setApplySel((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(name)) next.delete(name);
                                  else next.add(name);
                                  return next;
                                })
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                                checked
                                  ? "border-primary bg-primary text-white"
                                  : "border-border bg-surface text-ink-2 hover:border-primary/40 hover:text-primary",
                              )}
                            >
                              {checked ? <Check className="size-3" /> : null}
                              {name}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-3">
                        {visible.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">{r.name}</div>
                              <div className="truncate font-mono text-[11px] text-ink-3" dir="ltr">
                                {kind === "mcp" ? r.configPath : r.skillsDirs.join(" · ")}
                              </div>
                            </div>
                            <Button size="sm" disabled={busy || applySel.size === 0} onClick={() => void doApply(r)}>
                              <Download className="size-3.5" />
                              {t("common.apply")}
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{t("harness.backupNote")}</p>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogBody>

          <DialogFooter>
            <span className="mr-auto text-[11px] text-ink-3">
              {totalCollect > 0 ? `${t("common.selected")}: ${totalCollect}` : ""}
            </span>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 冲突确认弹框 */}
      <ConflictDialog
        open={!!pending}
        conflicts={pending?.conflicts ?? []}
        choice={conflictChoice}
        onChoice={(name, overwrite) => setConflictChoice((prev) => ({ ...prev, [name]: overwrite }))}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmConflicts()}
        busy={busy}
      />
    </>
  );
}
