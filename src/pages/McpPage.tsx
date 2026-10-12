import { Braces, Copy, FileInput, Plus, ScanSearch, Search, Server, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/motion/switch";
import { api, copyText } from "@/lib/api";
import type { McpServer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";

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
    origin: null,
    versions: [],
    createdAt: "",
    updatedAt: "",
  };
}

function kvToText(kv: Record<string, string>, sep: string): string {
  return Object.entries(kv)
    .map(([k, v]) => `${k}${sep}${v}`)
    .join("\n");
}
function textToKv(text: string, sep: string): Record<string, string> {
  const out: Record<string, string> = {};
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const i = line.indexOf(sep);
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + sep.length).trim();
    });
  return out;
}

export function McpPage() {
  const { t } = useTranslation();
  const mcp = useData((s) => s.mcp);
  const saveMcp = useData((s) => s.saveMcp);
  const deleteMcp = useData((s) => s.deleteMcp);

  const [query, setQuery] = useState("");
  const [transportFilter, setTransportFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importJsonName, setImportJsonName] = useState("");

  // editor draft
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mcp.filter((s) => {
      if (transportFilter !== "all" && s.transport !== transportFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.command.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [mcp, query, transportFilter]);

  const openNew = () => {
    const s = newServer();
    setEditing(s);
    setName("");
    setDescription("");
    setTransport("stdio");
    setCommand("");
    setArgsText("");
    setEnvText("");
    setUrl("");
    setHeadersText("");
    setTags([]);
    setEnabled(true);
    setEditorOpen(true);
  };

  const openEdit = (s: McpServer) => {
    setEditing(s);
    setName(s.name);
    setDescription(s.description);
    setTransport(s.transport);
    setCommand(s.command);
    setArgsText(s.args.join("\n"));
    setEnvText(kvToText(s.env, "="));
    setUrl(s.url);
    setHeadersText(kvToText(s.headers, ": "));
    setTags(s.tags);
    setEnabled(s.enabled);
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
      env: transport === "stdio" ? textToKv(envText, "=") : {},
      url: transport !== "stdio" ? url.trim() : "",
      headers: transport !== "stdio" ? textToKv(headersText, ": ") : {},
      tags,
      enabled,
    });
    toast.success(t("mcp.saved"));
    setEditorOpen(false);
  };

  const showJson = async () => {
    try {
      const cfg = await api.exportMcpConfig([]);
      setJsonText(JSON.stringify(cfg, null, 2));
      setJsonOpen(true);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggleEnabled = async (s: McpServer) => {
    await saveMcp({ ...s, enabled: !s.enabled });
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
      setImportJsonOpen(false);
      setImportJsonText("");
      setImportJsonName("");
    } catch (e) {
      toast.error(`${t("mcp.importJsonBad")}: ${String(e)}`);
    }
  };

  const singleJson = (s: McpServer) =>
    JSON.stringify(
      s.transport === "stdio"
        ? { mcpServers: { [s.name]: { command: s.command, args: s.args, env: s.env } } }
        : { mcpServers: { [s.name]: { type: s.transport, url: s.url, headers: s.headers } } },
      null,
      2,
    );

  return (
    <PageShell
      title={t("nav.mcp")}
      subtitle={t("mcp.subtitle")}
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
          <Button variant="secondary" onClick={() => void showJson()}>
            <Braces />
            {t("mcp.viewJson")}
          </Button>
          <Button variant="secondary" onClick={() => setImportJsonOpen(true)}>
            <FileInput />
            {t("mcp.importJson")}
          </Button>
          <Button variant="secondary" onClick={() => setScanOpen(true)}>
            <ScanSearch />
            {t("common.scan")}
          </Button>
          <Button onClick={openNew} variant="glow">
            <Plus />
            {t("mcp.newServer")}
          </Button>
        </>
      }
    >
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
              onDoubleClick={() => openEdit(s)}
              className={cn(
                "group flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                !s.enabled && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">{s.name}</h3>
                <Switch checked={s.enabled} onCheckedChange={() => void toggleEnabled(s)} />
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

      {/* editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("mcp.editTitle") : t("mcp.newTitle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
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

              {transport === "stdio" ? (
                <>
                  <Field label={t("mcp.command")}>
                    <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder={t("mcp.commandPlaceholder")} className="font-mono" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("mcp.args")} hint={t("mcp.argsPlaceholder").replace("&#10;", "\n")}>
                      <Textarea value={argsText} onChange={(e) => setArgsText(e.target.value)} placeholder={"-y\n@upstash/context7-mcp"} className="font-mono text-xs" />
                    </Field>
                    <Field label={t("mcp.env")}>
                      <Textarea value={envText} onChange={(e) => setEnvText(e.target.value)} placeholder={"API_KEY=xxx"} className="font-mono text-xs" />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field label={t("mcp.url")}>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("mcp.urlPlaceholder")} className="font-mono" />
                  </Field>
                  <Field label={t("mcp.headers")}>
                    <Textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} placeholder={"Authorization: Bearer xxx"} className="font-mono text-xs" />
                  </Field>
                </>
              )}

              <Field label={t("common.tags")}>
                <TagInput value={tags} onChange={setTags} />
              </Field>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2.5">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-xs text-ink-2">{t("mcp.enabledLabel")}</span>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* json preview */}
      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{t("mcp.jsonTitle")}</DialogTitle>
            <DialogDescription>{t("mcp.jsonHint")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <pre className="selectable overflow-x-auto rounded-lg border border-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed text-foreground">
              {jsonText}
            </pre>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => void copyText(jsonText).then((ok) => ok && toast.success(t("common.copied")))}>
              <Copy />
              {t("mcp.copyJson")}
            </Button>
            <Button onClick={() => setJsonOpen(false)}>
              <X />
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* json import */}
      <Dialog open={importJsonOpen} onOpenChange={setImportJsonOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{t("mcp.importJsonTitle")}</DialogTitle>
            <DialogDescription>{t("mcp.importJsonHint")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label={t("mcp.importJsonName")}>
              <Input value={importJsonName} onChange={(e) => setImportJsonName(e.target.value)} className="font-mono" />
            </Field>
            <Field label="JSON" className="flex flex-1 flex-col">
              <Textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={'{\n  "mcpServers": {\n    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }\n  }\n}'}
                className="min-h-48 flex-1 font-mono text-xs"
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setImportJsonOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleImportJson()} disabled={!importJsonText.trim()}>
              {t("mcp.importJson")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
