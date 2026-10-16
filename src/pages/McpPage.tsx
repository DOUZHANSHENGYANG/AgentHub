import { Check, Copy, FolderOpen, ListChecks, Plus, ScanSearch, Search, Server, Trash2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { matchTags, TagFilter, type TagMode } from "@/components/TagFilter";
import { HarnessConfigDialog } from "@/components/HarnessConfigDialog";
import { KeyValueEditor, recordFromRows, rowsFromRecord, type KvRow } from "@/components/KeyValueEditor";
import { EmptyState } from "@/components/EmptyState";
import { HarnessDialog } from "@/components/HarnessDialog";
import { PageShell } from "@/components/PageShell";
import { TagInput } from "@/components/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, copyText } from "@/lib/api";
import { sortByOrder } from "@/lib/harnessOrder";
import type { HarnessReport, McpServer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";
import { useSettings } from "@/stores/settings";

/** 稳定的空数组引用：给 zustand selector 做兜底 */
const EMPTY_ORDER: string[] = [];

function newServer(): McpServer {
  return {
    id: "",
    name: "",
    description: "",
    transport: "stdio",
    command: "",
    args: [],
    env: {},
    url: "",
    headers: {},
    tags: [],
    enabled: true,
    targets: [],
    targetsInitialized: true,
    origin: null,
    versions: [],
    createdAt: "",
    updatedAt: "",
  };
}

export function McpPage() {
  const { t } = useTranslation();
  const mcp = useData((s) => s.mcp);
  const saveMcp = useData((s) => s.saveMcp);
  const deleteMcp = useData((s) => s.deleteMcp);
  const loadMcp = useData((s) => s.loadMcp);

  const [query, setQuery] = useState("");
  const [transportFilter, setTransportFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const [importJsonText, setImportJsonText] = useState("");
  const [importJsonName, setImportJsonName] = useState("");
  const [newMode, setNewMode] = useState<"manual" | "json">("manual");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSel, setBatchSel] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<HarnessReport[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [tagMode, setTagMode] = useState<TagMode>("or");
  // 同 HarnessDialog：兜底数组必须是稳定引用，否则 selector 每次返回新数组
  // → zustand 的 Object.is 比较永远不等 → info 未加载时无限重渲染
  const harnessOrder = useSettings((s) => s.info?.settings.harnessOrder ?? EMPTY_ORDER);

  // editor draft
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envRows, setEnvRows] = useState<KvRow[]>([]);
  const [url, setUrl] = useState("");
  const [headerRows, setHeaderRows] = useState<KvRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    mcp.forEach((s) => s.tags.forEach((tg) => set.add(tg)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [mcp]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = mcp.filter((s) => {
      if (transportFilter !== "all" && s.transport !== transportFilter) return false;
      if (!matchTags(s.tags, activeTags, tagMode)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((tg) => tg.toLowerCase().includes(q))
      );
    });
    if (!harnessOrder.length) return list;
    const rank = (s: McpServer) => {
      const hid = (s.targets ?? [])[0] ?? s.origin?.harness ?? "";
      const i = harnessOrder.indexOf(hid);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return list.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map(({ x }) => x);
  }, [mcp, query, transportFilter, harnessOrder, activeTags, tagMode]);

  const openNew = () => {
    setNewMode("manual");
    setImportJsonText("");
    setImportJsonName("");
    const s = newServer();
    setEditing(s);
    setName("");
    setDescription("");
    setTransport("stdio");
    setCommand("");
    setArgsText("");
    setEnvRows([]);
    setUrl("");
    setHeaderRows([]);
    setTags([]);
    setEditorOpen(true);
  };

  const openEdit = (s: McpServer) => {
    setEditing(s);
    setName(s.name);
    setDescription(s.description);
    setTransport(s.transport);
    setCommand(s.command);
    setArgsText(s.args.join("\n"));
    setEnvRows(rowsFromRecord(s.env));
    setUrl(s.url);
    setHeaderRows(rowsFromRecord(s.headers));
    setTags(s.tags);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!editing) return;
    await saveMcp({
      ...editing,
      name: name.trim(),
      description: description.trim(),
      transport,
      command: transport === "stdio" ? command.trim() : "",
      args: transport === "stdio" ? argsText.split("\n").map((x) => x.trim()).filter(Boolean) : [],
      env: transport === "stdio" ? recordFromRows(envRows) : {},
      url: transport !== "stdio" ? url.trim() : "",
      headers: transport !== "stdio" ? recordFromRows(headerRows) : {},
      tags,
    });
    toast.success(t("mcp.saved"));
    setEditorOpen(false);
  };



  const doScan = () => {
    setScanning(true);
    api
      .scanHarnesses()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setScanning(false));
  };

  const ensureScan = () => {
    if (reports) return;
    doScan();
  };

  /** 按用户自定义顺序排列 harness 列表 */
  const ordered = (list: HarnessReport[] | null) => sortByOrder(list, harnessOrder);

  useEffect(() => {
    if (editorOpen) ensureScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen]);

  const harnessName = (hid: string) => reports?.find((r) => r.id === hid)?.name ?? hid;

  const openMcpFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
      if (typeof file !== "string") return;
      const r = await api.readImportFile(file);
      setImportJsonText(r.text);
      if (!importJsonName.trim()) setImportJsonName(r.name.replace(/\.json$/i, ""));
      toast.success(t("mcp.fileLoaded", { name: r.name }));
    } catch (e) {
      toast.error(`${t("mcp.fileReadFail")}: ${String(e)}`);
    }
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText) as Record<string, unknown>;
      let entries: [string, Record<string, unknown>][] = [];
      if (parsed && typeof parsed === "object" && parsed.mcpServers && typeof parsed.mcpServers === "object") {
        entries = Object.entries(parsed.mcpServers as Record<string, Record<string, unknown>>);
      } else if (parsed && typeof parsed === "object" && ("command" in parsed || "url" in parsed)) {
        const n = importJsonName.trim() || "imported-mcp";
        entries = [[n, parsed]];
      }
      if (!entries.length) {
        toast.error(t("mcp.importJsonBad"));
        return;
      }
      let ok = 0;
      for (const [n, cfg] of entries) {
        const s = newServer();
        s.name = n;
        s.enabled = true;
        if (typeof cfg.command === "string") {
          s.transport = "stdio";
          s.command = cfg.command;
          s.args = Array.isArray(cfg.args) ? (cfg.args as unknown[]).map(String) : [];
          s.env =
            cfg.env && typeof cfg.env === "object"
              ? Object.fromEntries(Object.entries(cfg.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
              : {};
        } else if (typeof cfg.url === "string") {
          s.transport = typeof cfg.type === "string" ? cfg.type : "http";
          s.url = cfg.url;
          s.headers =
            cfg.headers && typeof cfg.headers === "object"
              ? Object.fromEntries(Object.entries(cfg.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
              : {};
        } else {
          continue;
        }
        await saveMcp(s);
        ok += 1;
      }
      toast.success(t("mcp.importJsonDone", { count: ok }));
      setImportJsonText("");
      setImportJsonName("");
    } catch (e) {
      toast.error(`${t("mcp.importJsonBad")}: ${String(e)}`);
    }
  };

  const singleJson = (s: McpServer) => JSON.stringify(exportServers([s]), null, 2);

  function exportServers(list: McpServer[]) {
    const map: Record<string, unknown> = {};
    list.forEach((s) => {
      map[s.name] =
        s.transport === "stdio"
          ? { command: s.command, args: s.args, env: s.env }
          : { type: s.transport, url: s.url, headers: s.headers };
    });
    return { mcpServers: map };
  }

  return (
    <PageShell
      title={t("nav.mcp")}
      actions={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("mcp.searchPlaceholder")} className="h-9 w-52 pl-8" />
          </div>
          <Select value={transportFilter} onValueChange={setTransportFilter}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="stdio">stdio</SelectItem>
              <SelectItem value="http">http</SelectItem>
              <SelectItem value="sse">sse</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              ensureScan();
              setCfgOpen(true);
            }}
          >
            <Wrench />
            {t("mcp.harnessCfg")}
          </Button>
          <Button variant="secondary" onClick={() => setScanOpen(true)}>
            <ScanSearch />
            {t("common.scan")}
          </Button>
          <Button onClick={openNew}>
            <Plus />
            {t("mcp.newServer")}
          </Button>
        </>
      }
    >
      {allTags.length > 0 ? (
        <TagFilter allTags={allTags} selected={activeTags} onChange={setActiveTags} mode={tagMode} onModeChange={setTagMode} searchable />
      ) : null}

      {filtered.length > 0 ? (
        <div data-anim className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={batchMode ? "default" : "secondary"}
            className="h-8"
            onClick={() => {
              setBatchMode((v) => !v);
              setBatchSel(new Set());
            }}
          >
            <ListChecks />
            {batchMode ? t("mcp.batchExit") : t("mcp.batchEnter")}
          </Button>
          {batchMode ? (
            <>
              <span className="text-[11px] text-ink-3">{t("mcp.batchHint")}</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  disabled={batchSel.size === 0}
                  onClick={() => {
                    const list = filtered.filter((x) => batchSel.has(x.id));
                    void copyText(JSON.stringify(exportServers(list), null, 2)).then((ok) =>
                      ok ? toast.success(t("mcp.batchCopied", { n: batchSel.size })) : toast.error(t("common.copy")),
                    );
                  }}
                >
                  <Copy />
                  {t("mcp.batchCopyJson")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() =>
                    setBatchSel((prev) =>
                      filtered.length > 0 && prev.size === filtered.length
                        ? new Set()
                        : new Set(filtered.map((x) => x.id)),
                    )
                  }
                >
                  {filtered.length > 0 && batchSel.size === filtered.length ? t("mcp.unselectAll") : t("harness.selectAll")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => setBatchDeleteOpen(true)}
                  disabled={batchSel.size === 0}
                >
                  <Trash2 className="size-3.5" />
                  {t("mcp.batchDelete")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t("common.empty")}
          hint={t("mcp.emptyHint")}
          action={
            <Button onClick={() => setScanOpen(true)} variant="secondary">
              <ScanSearch />
              {t("common.scan")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              data-anim
              onClick={() => {
                if (!batchMode) return;
                setBatchSel((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                });
              }}
              onDoubleClick={() => openEdit(s)}
              className={cn(
                "group flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                !s.enabled && "opacity-60",
                batchMode && "cursor-pointer",
                batchMode && batchSel.has(s.id) && "border-primary shadow-[0_0_0_3px_var(--ah-primary-soft)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">{s.name}</h3>
                {batchMode ? (
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded border",
                      batchSel.has(s.id) ? "border-primary bg-primary text-white" : "border-border-strong",
                    )}
                  >
                    {batchSel.has(s.id) ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                ) : (s.targets ?? []).length ? (
                  <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    {t("mcp.applyCount", { n: (s.targets ?? []).length })}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                    {t("mcp.poolOnly")}
                  </span>
                )}
              </div>
              {s.description ? <p className="mt-1 line-clamp-1 text-xs text-ink-2">{s.description}</p> : null}
              <div className="mt-2 truncate rounded-md bg-bg-subtle px-2 py-1.5 font-mono text-[11px] text-ink-2" dir="ltr">
                {s.transport === "stdio" ? `${s.command} ${s.args.join(" ")}`.trim() : s.url || "—"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <Badge variant={s.transport === "stdio" ? "info" : "warning"}>{s.transport}</Badge>
                {s.tags.map((tg) => (
                  <Badge key={tg} variant="default">
                    {tg}
                  </Badge>
                ))}
                {s.origin ? (
                  <Badge variant="muted" title={s.origin.file}>
                    {t("mcp.origin")}: {s.origin.harness}
                  </Badge>
                ) : null}
                {(s.targets ?? []).map((hid) => (
                  <Badge key={hid} variant="info">
                    {harnessName(hid)}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-end gap-0.5 pt-3">
                <Button
                  size="iconSm"
                  variant="ghost"
                  title={t("mcp.copyJson")}
                  onClick={() => void copyText(singleJson(s)).then((ok) => ok && toast.success(t("common.copied")))}
                >
                  <Copy />
                </Button>
                <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]" onClick={() => openEdit(s)}>
                  {t("common.edit")}
                </Button>
                <Button size="iconSm" variant="ghost" title={t("common.delete")} onClick={() => setDeleting(s)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* editor / new（统一入口：Tab 切换 手动填写 / 导入 JSON） */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("mcp.editTitle") : t("mcp.newTitle")}</DialogTitle>
            {!editing?.id ? (
              <div className="mt-2 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setNewMode("manual")}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-medium outline-none transition-colors",
                    newMode === "manual" ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
                  )}
                >
                  {t("mcp.tabManual")}
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode("json")}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-medium outline-none transition-colors",
                    newMode === "json" ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
                  )}
                >
                  {t("mcp.tabJson")}
                </button>
              </div>
            ) : null}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
              {newMode === "json" && !editing?.id ? (
                <>
                  <p className="rounded-lg bg-bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                    {t("mcp.jsonExplain")}
                  </p>
                  <Field label={t("mcp.importJsonName")}>
                    <Input value={importJsonName} onChange={(e) => setImportJsonName(e.target.value)} className="font-mono" />
                  </Field>
                  <div>
                    <Button type="button" variant="secondary" className="h-8 gap-1.5 text-xs" onClick={() => void openMcpFile()}>
                      <FolderOpen className="size-3.5" />
                      {t("mcp.openFile")}
                    </Button>
                  </div>
                  <Field label="JSON" className="flex min-h-0 flex-1 flex-col">
                    <Textarea
                      value={importJsonText}
                      onChange={(e) => setImportJsonText(e.target.value)}
                      placeholder={'{\n  "mcpServers": {\n    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }\n  }\n}'}
                      className="min-h-52 flex-1 font-mono text-xs"
                    />
                  </Field>
                </>
              ) : (
              <>
              {/* 基本信息 */}
              <div className="rounded-xl border border-border bg-bg-subtle/60 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {t("mcp.sectionBasic")}
                </div>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("common.name")}>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("mcp.namePlaceholder")} autoFocus className="font-mono" />
                    </Field>
                    <Field label={t("mcp.transport")}>
                      <Select value={transport} onValueChange={setTransport}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stdio">{t("mcp.transportStdio")}</SelectItem>
                          <SelectItem value="http">{t("mcp.transportHttp")}</SelectItem>
                          <SelectItem value="sse">{t("mcp.transportSse")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label={t("common.description")}>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                  <Field label={t("common.tags")}>
                    <TagInput value={tags} onChange={setTags} />
                  </Field>
                </div>
              </div>

              {/* 连接配置 */}
              <div className="rounded-xl border border-border bg-bg-subtle/60 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {t("mcp.sectionConn")}
                </div>
                {transport === "stdio" ? (
                  <div className="flex flex-col gap-4">
                    <Field label={t("mcp.command")}>
                      <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder={t("mcp.commandPlaceholder")} className="font-mono" />
                    </Field>
                    <Field label={t("mcp.args")} hint={t("mcp.argsPlaceholder").replace("&#10;", "\n")}>
                      <Textarea value={argsText} onChange={(e) => setArgsText(e.target.value)} placeholder={"-y\n@upstash/context7-mcp"} className="font-mono text-xs" />
                    </Field>
                    <Field label={t("mcp.env")} hint={t("mcp.envHint")}>
                      <KeyValueEditor rows={envRows} onChange={setEnvRows} keyPlaceholder={"API_KEY"} valuePlaceholder={"xxx"} />
                    </Field>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <Field label={t("mcp.url")}>
                      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("mcp.urlPlaceholder")} className="font-mono" />
                    </Field>
                    <Field label={t("mcp.headers")} hint={t("mcp.headersHint")}>
                      <KeyValueEditor rows={headerRows} onChange={setHeaderRows} keyPlaceholder={"Authorization"} valuePlaceholder={"Bearer xxx"} />
                    </Field>
                  </div>
                )}
              </div>

              </>
              )}
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                {t("common.cancel")}
              </Button>
              {newMode === "json" && !editing?.id ? (
                <Button
                  type="button"
                  disabled={!importJsonText.trim()}
                  onClick={() => void handleImportJson().then(() => setEditorOpen(false))}
                >
                  {t("mcp.importJsonGo")}
                </Button>
              ) : (
                <Button type="submit" disabled={!name.trim()}>
                  {t("common.save")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title={t("mcp.batchDeleteTitle")}
        message={t("mcp.batchDeleteMsg", { n: batchSel.size })}
        danger
        onConfirm={() => {
          const list = filtered.filter((x) => batchSel.has(x.id));
          void (async () => {
            for (const s0 of list) await deleteMcp(s0.id);
            toast.success(t("mcp.batchDeleted", { n: list.length }));
            setBatchSel(new Set());
          })();
        }}
      />

      <HarnessConfigDialog
        open={cfgOpen}
        onOpenChange={setCfgOpen}
        reports={ordered(reports)}
        scanning={scanning}
        onRescan={doScan}
        pool={mcp}
        onChanged={() => void loadMcp()}
      />

      <HarnessDialog open={scanOpen} onOpenChange={setScanOpen} kind="mcp" />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={t("mcp.deleteConfirmTitle")}
        message={t("mcp.deleteConfirmMsg", { name: deleting?.name ?? "" })}
        danger
        onConfirm={() => {
          if (deleting) void deleteMcp(deleting.id).then(() => toast.success(t("mcp.deleted")));
        }}
      />
    </PageShell>
  );
}
