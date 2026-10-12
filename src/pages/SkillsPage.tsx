import { ArrowRight, FolderOpen, GitCompare, Package, Paperclip, Plus, ScanSearch, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { HarnessDialog } from "@/components/HarnessDialog";
import { Markdown } from "@/components/Markdown";
import { PageShell } from "@/components/PageShell";
import { TagInput } from "@/components/TagInput";
import { VersionList } from "@/components/VersionList";
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
import { api } from "@/lib/api";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { GetSkillsDialog } from "@/components/GetSkillsDialog";
import type { SkillDoc, SkillMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";
import { useSettings } from "@/stores/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";

// SSEP 规则 → 人话（i18n key 后缀）
const VET_RULE_KEY: Record<string, string> = {
  "R01-destructive": "vetRuleR01",
  "R02-exec-download": "vetRuleR02",
  "R03-dynamic-exec": "vetRuleR03",
  "R04-system-write": "vetRuleR04",
  "R05-secrets": "vetRuleR05",
  "R06-obfuscation": "vetRuleR06",
  "R07-env-harvest": "vetRuleR07",
  "R08-cred-files": "vetRuleR08",
  "SSEP-STALE": "vetRuleStale",
};

const LIFECYCLE_ZH_KEY: Record<string, string> = {
  create: "logCreate",
  import: "logImport",
  update: "logUpdate",
  vet: "logVet",
  install: "logInstall",
  pack: "logPack",
  deploy: "logDeploy",
  deprecate: "logDeprecate",
  archive: "logArchive",
};

function semverSatisfies(have: string, req: string): boolean {
  const req2 = req.trim();
  if (!req2) return true;
  let op = "=";
  let rest = req2;
  if (req2.startsWith(">=")) { op = ">="; rest = req2.slice(2); }
  else if (req2.startsWith(">")) { op = ">"; rest = req2.slice(1); }
  else if (req2.startsWith("==")) { op = "="; rest = req2.slice(2); }
  else if (req2.startsWith("=")) { op = "="; rest = req2.slice(1); }
  const parse = (v: string) => {
    const arr = v.split(".").map((x) => parseInt(x, 10) || 0);
    while (arr.length < 3) arr.push(0);
    return arr;
  };
  const h = parse(have);
  const r = parse(rest);
  if (op === ">=") return h[0] > r[0] || (h[0] === r[0] && (h[1] > r[1] || (h[1] === r[1] && h[2] >= r[2])));
  if (op === ">") return h[0] > r[0] || (h[0] === r[0] && (h[1] > r[1] || (h[1] === r[1] && h[2] > r[2])));
  return h[0] === r[0] && h[1] === r[1] && h[2] === r[2];
}

const STARTER = "## 用途\n\n描述这个技能做什么、什么时候使用。\n\n## 用法\n\n1. 第一步\n2. 第二步\n";

export function SkillsPage() {
  const { t } = useTranslation();
  const skills = useData((s) => s.skills);
  const deleteSkill = useData((s) => s.deleteSkill);
  const saveSkill = useData((s) => s.saveSkill);
  const loadSkills = useData((s) => s.loadSkills);
  const dataDirs = useSettings((s) => s.info?.dataDirs);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [deleting, setDeleting] = useState<SkillMeta | null>(null);
  const [proto, setProto] = useState<Awaited<ReturnType<typeof api.skillExtension>> | null>(null);
  const [protoLoading, setProtoLoading] = useState(false);
  const [editLevel, setEditLevel] = useState("L1");
  const [extSaving, setExtSaving] = useState(false);
  const [extDeps, setExtDeps] = useState<{ name: string; semver: string; reason: string }[]>([]);
  const [extRuntime, setExtRuntime] = useState({ requires_scripts: "none", requires_network: "none", min_protocol: 1, config: "" });
  const [extUpstream, setExtUpstream] = useState({ watch: false, mode: "manual", remote: "" });

  const loadProto = async (dirName: string) => {
    setProtoLoading(true);
    try {
      setProto(await api.skillExtension(dirName));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setProtoLoading(false);
    }
  };

  useEffect(() => {
    const doc = (proto?.doc ?? null) as
      | {
          deps?: { item?: { name?: string; semver?: string; reason?: string }[] };
          runtime?: { requires_scripts?: string; requires_network?: string; min_protocol?: number; config?: string };
          source?: { upstream?: { watch?: boolean; mode?: string; remote?: string } };
        }
      | null;
    if (doc) {
      setExtDeps(
        (doc.deps?.item ?? []).map((d) => ({
          name: d.name ?? "",
          semver: d.semver ?? ">=1.0",
          reason: d.reason ?? "",
        })),
      );
      setExtRuntime({
        requires_scripts: doc.runtime?.requires_scripts ?? "none",
        requires_network: doc.runtime?.requires_network ?? "none",
        min_protocol: doc.runtime?.min_protocol ?? 1,
        config: doc.runtime?.config ?? "",
      });
      setExtUpstream({
        watch: !!doc.source?.upstream?.watch,
        mode: doc.source?.upstream?.mode ?? "manual",
        remote: doc.source?.upstream?.remote ?? "",
      });
    }
  }, [proto]);

  const saveExt = async () => {
    if (!detail) return;
    setExtSaving(true);
    try {
      await api.updateSkillExt(detail.meta.dirName, {
        deps: extDeps.filter((d) => d.name.trim()),
        runtime: {
          requiresScripts: extRuntime.requires_scripts,
          requiresNetwork: extRuntime.requires_network,
          minProtocol: extRuntime.min_protocol,
          config: extRuntime.config,
        },
        upstream: extUpstream,
      });
      toast.success(t("skills.saved"));
      await loadProto(detail.meta.dirName);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExtSaving(false);
    }
  };

  const handleTab = (v: string) => {
    setTab(v);
    if (v === "proto" && detail) void loadProto(detail.meta.dirName);
  };

  const applyStatus = async (status: string) => {
    if (!detail) return;
    try {
      await api.setSkillStatus(detail.meta.dirName, status, "");
      toast.success(t("skills.protoStatusDone", { status }));
      await loadSkills();
      void loadProto(detail.meta.dirName);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePack = async () => {
    if (!detail) return;
    const picked = await openDialog({ directory: true, multiple: false, title: t("skills.protoPack") });
    if (typeof picked !== "string" || !picked) return;
    try {
      const p = await api.packSkill(detail.meta.dirName, picked);
      toast.success(t("skills.protoPacked", { path: p }));
      void loadProto(detail.meta.dirName);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // new skill dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newBody, setNewBody] = useState(STARTER);

  // detail dialog
  const [detail, setDetail] = useState<SkillDoc | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState("preview");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editBody, setEditBody] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => s.tags.forEach((tg) => set.add(tg)));
    return [...set].sort();
  }, [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (activeTag && !s.tags.includes(activeTag)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [skills, query, activeTag]);

  const openDetail = async (meta: SkillMeta) => {
    setDetailLoading(true);
    setDetail({
      meta,
      frontmatter: {},
      body: "",
      versions: [],
    });
    setTab("preview");
    setProto(null);
    try {
      const doc = await api.readSkill(meta.dirName);
      setDetail(doc);
      setEditName(doc.meta.name);
      setEditDesc(doc.meta.description);
      setEditTags(doc.meta.tags);
      setEditBody(doc.body);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleNew = async () => {
    if (!newName.trim()) return;
    try {
      await saveSkill({
        dirName: "",
        name: newName.trim(),
        description: newDesc.trim(),
        tags: newTags,
        body: newBody,
        frontmatter: {},
      });
      toast.success(t("skills.saved"));
      setNewOpen(false);
      setNewName("");
      setNewDesc("");
      setNewTags([]);
      setNewBody(STARTER);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleEditSave = async () => {
    if (!detail) return;
    try {
      await saveSkill({
        dirName: detail.meta.dirName,
        name: editName.trim(),
        description: editDesc.trim(),
        tags: editTags,
        body: editBody,
        frontmatter: detail.frontmatter,
        level: editLevel,
      });
      toast.success(t("skills.saved"));
      const meta = skills.find((s) => s.dirName === detail.meta.dirName);
      if (meta) void openDetail(meta);
      else setDetail(null);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const composedPreview = (doc: SkillDoc) => {
    const fm = Object.entries(doc.frontmatter)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
    return fm ? `---\n${fm}\n---\n\n${doc.body}` : doc.body;
  };

  return (
    <PageShell
      title={t("nav.skills")}
      subtitle={t("skills.subtitle")}
      actions={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("skills.searchPlaceholder")} className="h-9 w-52 pl-8" />
          </div>
          <GetSkillsDialog onDone={() => void loadSkills()} />
          <Button variant="secondary" onClick={() => setScanOpen(true)}>
            <ScanSearch />
            {t("common.scan")}
          </Button>
          <Button
            variant="glow"
            onClick={() => {
              setNewName("");
              setNewDesc("");
              setNewTags([]);
              setNewBody(STARTER);
              setNewOpen(true);
            }}
          >
            <Plus />
            {t("skills.newSkill")}
          </Button>
        </>
      }
    >
      {allTags.length > 0 ? (
        <div data-anim className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              !activeTag ? "border-primary bg-primary text-white" : "border-border text-ink-2 hover:border-primary/40",
            )}
          >
            {t("common.all")}
          </button>
          {allTags.map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => setActiveTag(activeTag === tg ? null : tg)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeTag === tg
                  ? "border-primary bg-primary text-white"
                  : "border-border text-ink-2 hover:border-primary/40 hover:text-primary",
              )}
            >
              {tg}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("common.empty")}
          hint={t("skills.emptyHint")}
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
              key={s.dirName}
              data-anim
              onClick={() => void openDetail(s)}
              className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">{s.name}</h3>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    title={t("common.reveal")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dataDirs) void api.revealPath(`${dataDirs.skills}\\${s.dirName}`);
                    }}
                  >
                    <FolderOpen />
                  </Button>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    title={t("common.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(s);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {s.description ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-2">{s.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-1">
                {s.tags.map((tg) => (
                  <Badge key={tg} variant="default">
                    {tg}
                  </Badge>
                ))}
                {s.hasAssets ? (
                  <Badge variant="info" title={t("skills.hasAssets")}>
                    <Paperclip />
                  </Badge>
                ) : null}
                {s.hasToml && s.version !== "0.0.0" ? <Badge variant="info">v{s.version}</Badge> : null}
                {s.hasToml && s.status !== "active" ? <Badge variant="warning">{s.status}</Badge> : null}
                {s.stale ? <Badge variant="danger">STALE</Badge> : null}
                {s.versions > 0 ? <Badge variant="muted">v{s.versions + 1}</Badge> : null}
                {s.origin ? (
                  <Badge variant="muted" title={s.origin.file}>
                    {s.origin.harness}
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* new skill */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{t("skills.newSkill")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleNew();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("skills.fieldName")}>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("skills.namePlaceholder")}
                    autoFocus
                    className="font-mono"
                  />
                </Field>
                <Field label={t("common.description")}>
                  <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="min-h-16 resize-y" />
                </Field>
              </div>
              <Field label={t("common.tags")} hint={t("common.tagPlaceholder")}>
                <TagInput value={newTags} onChange={setNewTags} />
              </Field>
              <Field label={t("skills.fieldBody")} className="flex min-h-0 flex-1 flex-col">
                <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} className="min-h-52 flex-1 font-mono text-[13px]" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setNewOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!newName.trim()}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* detail */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent wide className="h-[86vh]">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-mono">
                  <Sparkles className="size-4 text-primary" />
                  {detail.meta.name}
                </DialogTitle>
                <DialogDescription className="font-mono" dir="ltr">
                  {t("skills.dirName")}: {detail.meta.dirName} · {detail.meta.contentLen} chars
                </DialogDescription>
              </DialogHeader>

              <div className="border-b border-border px-5 pt-3">
                <Tabs value={tab} onValueChange={handleTab} variant="segment">
                  <TabsList>
                    <TabsTrigger value="preview">{t("skills.tabPreview")}</TabsTrigger>
                    <TabsTrigger value="edit">{t("skills.tabEdit")}</TabsTrigger>
                    <TabsTrigger value="versions">{t("skills.tabVersions")}</TabsTrigger>
                    <TabsTrigger value="proto">{t("skills.protoTab")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <DialogBody>
                {detailLoading ? (
                  <div className="grid h-full place-items-center text-xs text-ink-3">{t("common.loading")}</div>
                ) : (
                  <Tabs value={tab} onValueChange={handleTab}>
                    <TabsContent value="preview">
                      <Markdown source={composedPreview(detail)} />
                    </TabsContent>

                    <TabsContent value="edit">
                      <form
                        id="skill-edit-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleEditSave();
                        }}
                        className="flex flex-col gap-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label={t("skills.fieldName")}>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="font-mono" />
                          </Field>
                          <Field label={t("common.description")}>
                            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="min-h-16 resize-y" />
                          </Field>
                        </div>
                        <Field label={t("common.tags")}>
                          <TagInput value={editTags} onChange={setEditTags} />
                        </Field>
                        <Field label={t("skills.saveLevel")} hint={t("skills.saveLevelHint")}>
                          <Select value={editLevel} onValueChange={setEditLevel}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="L1">L1 · {t("skills.levelL1")}</SelectItem>
                              <SelectItem value="L2">L2 · {t("skills.levelL2")}</SelectItem>
                              <SelectItem value="L3">L3 · {t("skills.levelL3")}</SelectItem>
                              <SelectItem value="L4">L4 · {t("skills.levelL4")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label={t("skills.fieldBody")} className="flex min-h-0 flex-1 flex-col">
                          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-64 flex-1 font-mono text-[13px]" />
                        </Field>
                      </form>
                    </TabsContent>

                    <TabsContent value="versions">
                      <VersionList
                        versions={detail.versions}
                        onRestore={(content) => {
                          // 版本快照是整份 SKILL.md；去掉 frontmatter 后填回正文
                          const body = content.replace(/^---\n[\s\S]*?\n---\n\n?/, "");
                          setEditBody(body);
                          setTab("edit");
                          toast.info(t("skills.versionRestored"));
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="proto">
                      {protoLoading || !proto ? (
                        <div className="grid place-items-center py-16 text-xs text-ink-3">{t("common.loading")}</div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {!proto.hasToml ? (
                            <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-3">
                              {t("skills.protoNoToml")}
                            </div>
                          ) : null}

                          {/* ── 档案摘要 ── */}
                          {(() => {
                            const meta = (proto.doc as { meta?: { version?: string; status?: string; summary?: string } } | null)?.meta;
                            if (!meta) return null;
                            const st = meta.status ?? "draft";
                            const stKey = st === "active" ? "skills.stateActive" : st === "deprecated" ? "skills.stateDeprecated" : st === "archived" ? "skills.stateArchived" : "skills.stateDraft";
                            return (
                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs leading-relaxed text-ink-3">{t("skills.protoIntro")}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Badge variant="info" title={t("skills.verExplain")}>
                                    v{meta.version ?? "0.0.0"}
                                  </Badge>
                                  <Badge variant={st === "active" ? "success" : "warning"}>{t(stKey)}</Badge>
                                  {proto.stale ? (
                                    <Badge variant="danger" title={t("skills.vetRuleStale")}>{t("skills.staleWarn")}</Badge>
                                  ) : proto.hasToml ? (
                                    <Badge variant="muted">{t("skills.freshOk")}</Badge>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}

                          {/* ── 来源与更新 ── */}
                          {proto.doc ? (
                            <div className="rounded-xl border border-border bg-card p-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-foreground">{t("skills.srcTitle")}</h3>
                                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => detail && void api.checkUpstream(detail.meta.dirName).then((r) => { if (r.changed) toast.warning(t("skills.upstreamChanged")); else toast.info(r.note); }).catch((e) => toast.error(String(e)))}>
                                  <GitCompare className="size-3.5" />
                                  {t("skills.upCheck")}
                                </Button>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Field label={t("skills.srcKind")}>
                                  <Input
                                    value={extUpstream.watch ? t("skills.srcWatched") : t("skills.srcManual")}
                                    readOnly
                                    className="h-8 bg-bg-subtle"
                                  />
                                </Field>
                                <Field label={t("skills.upRemote")} hint={t("skills.upHint")}>
                                  <Input
                                    value={extUpstream.remote}
                                    onChange={(e) => setExtUpstream((u) => ({ ...u, remote: e.target.value }))}
                                    placeholder="https://github.com/…"
                                    className="h-8 font-mono text-xs"
                                  />
                                </Field>
                              </div>
                              <div className="mt-1 flex items-center gap-2 rounded-lg bg-bg-subtle px-3 py-2">
                                <Switch checked={extUpstream.watch} onCheckedChange={(v) => setExtUpstream((u) => ({ ...u, watch: v }))} />
                                <span className="text-xs text-ink-2">{t("skills.upWatch")}</span>
                              </div>
                            </div>
                          ) : null}

                          {/* ── 依赖关系（可视化） ── */}
                          <div className="rounded-xl border border-border bg-card p-4">
                            <h3 className="text-sm font-semibold text-foreground">{t("skills.depsTitle")}</h3>
                            <p className="mt-0.5 text-[11px] text-ink-3">{t("skills.depsHint")}</p>
                            <div className="mt-3">
                              {(() => {
                                const deps = (proto.doc as { deps?: { item?: { name?: string; semver?: string; reason?: string }[] } } | null)?.deps?.item ?? [];
                                if (!deps.length) {
                                  return <p className="rounded-lg bg-bg-subtle px-3 py-2.5 text-xs text-ink-2">{t("skills.depsNone")}</p>;
                                }
                                return (
                                  <div className="flex flex-col gap-2">
                                    {deps.map((d, i) => {
                                      const name = d.name ?? "";
                                      const installed = skills.find((x) => x.dirName === name || x.name === name);
                                      const have = installed?.version ?? "";
                                      const sat = installed ? semverSatisfies(have, d.semver ?? "") : false;
                                      return (
                                        <div key={i} className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-lg border border-primary/40 bg-primary-soft px-2.5 py-1.5 font-mono text-xs font-medium text-primary">
                                            {detail?.meta.name}
                                          </span>
                                          <span className="flex items-center gap-1 text-[11px] text-ink-3">
                                            {t("skills.depNeed")}
                                            <ArrowRight className="size-3" />
                                          </span>
                                          <span
                                            className={cn(
                                              "rounded-lg border px-2.5 py-1.5 font-mono text-xs",
                                              installed
                                                ? sat
                                                  ? "border-success/40 bg-success/10 text-success"
                                                  : "border-warning/40 bg-warning/10 text-warning"
                                                : "border-danger/40 bg-danger/10 text-danger",
                                            )}
                                          >
                                            {name} {d.semver ? <span className="opacity-70">{d.semver}</span> : null}
                                          </span>
                                          {installed ? (
                                            sat ? (
                                              <Badge variant="success">{t("skills.depInstalled")} · {t("skills.depVersionOk")}</Badge>
                                            ) : (
                                              <Badge variant="warning">{t("skills.depVersionBad")}（{t("skills.depHave")} v{have}）</Badge>
                                            )
                                          ) : (
                                            <Badge variant="danger">{t("skills.depMissing")}</Badge>
                                          )}
                                          {d.reason ? <span className="w-full text-[11px] text-ink-3">↳ {d.reason}</span> : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* 依赖编辑（折叠在“修改”里） */}
                            <details className="mt-3">
                              <summary className="cursor-pointer text-[11px] font-medium text-ink-3 outline-none hover:text-ink-2">{t("skills.depsEdit")}</summary>
                              <div className="mt-2 flex flex-col gap-1.5">
                                {extDeps.map((d, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <Input
                                      value={d.name}
                                      onChange={(e) => setExtDeps((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                                      placeholder={t("skills.depName")}
                                      className="h-7 flex-1 font-mono text-xs"
                                    />
                                    <Input
                                      value={d.semver}
                                      onChange={(e) => setExtDeps((arr) => arr.map((x, j) => (j === i ? { ...x, semver: e.target.value } : x)))}
                                      placeholder="≥1.0"
                                      className="h-7 w-24 font-mono text-xs"
                                    />
                                    <Button size="iconSm" variant="ghost" onClick={() => setExtDeps((arr) => arr.filter((_, j) => j !== i))}>
                                      <Trash2 />
                                    </Button>
                                  </div>
                                ))}
                                <Button size="sm" variant="ghost" className="h-7 w-fit px-2 text-[11px]" onClick={() => setExtDeps((d) => [...d, { name: "", semver: ">=1.0", reason: "" }])}>
                                  <Plus className="!size-3" />
                                  {t("common.new")}
                                </Button>
                                <Button size="sm" variant="secondary" className="h-7 w-fit px-3 text-[11px]" onClick={() => void saveExt()} disabled={extSaving}>
                                  {extSaving ? t("common.saving") : t("common.save")}
                                </Button>
                              </div>
                            </details>
                          </div>

                          {/* ── 在哪里能运行 ── */}
                          {proto.doc ? (
                            <div className="rounded-xl border border-border bg-card p-4">
                              <h3 className="text-sm font-semibold text-foreground">{t("skills.rtTitle")}</h3>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Field label={t("skills.rtScripts")} hint={t("skills.rtScriptsHint")}>
                                  <Select value={extRuntime.requires_scripts} onValueChange={(v) => setExtRuntime((r) => ({ ...r, requires_scripts: v }))}>
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">{t("skills.rtOptNone")}</SelectItem>
                                      <SelectItem value="optional">{t("skills.rtOptOptional")}</SelectItem>
                                      <SelectItem value="required">{t("skills.rtOptRequired")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field label={t("skills.rtNetwork")}>
                                  <Select value={extRuntime.requires_network} onValueChange={(v) => setExtRuntime((r) => ({ ...r, requires_network: v }))}>
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">{t("skills.rtOptNone")}</SelectItem>
                                      <SelectItem value="optional">{t("skills.rtOptOptional")}</SelectItem>
                                      <SelectItem value="required">{t("skills.rtOptRequired")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </div>
                              <Button size="sm" variant="secondary" className="mt-1 h-7 w-fit px-3 text-[11px]" onClick={() => void saveExt()} disabled={extSaving}>
                                {extSaving ? t("common.saving") : t("common.save")}
                              </Button>
                            </div>
                          ) : null}

                          {/* ── 安全检查 ── */}
                          <div className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-foreground">{t("skills.vetTitle")}</h3>
                              <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => detail && void api.vetSkill(detail.meta.dirName).then((r) => { toast.success(t("skills.protoVetDone", { verdict: r.verdict })); void loadProto(detail.meta.dirName); }).catch((e) => toast.error(String(e)))}>
                                <ShieldCheck className="size-3.5" />
                                {t("skills.vetRerun")}
                              </Button>
                            </div>
                            {(() => {
                              const vet = (proto.doc as { vet?: { verdict?: string; critical?: number; high?: number; medium?: number } } | null)?.vet;
                              if (!vet) {
                                return <p className="mt-3 rounded-lg bg-bg-subtle px-3 py-2.5 text-xs text-ink-2">{t("skills.vetNever")}</p>;
                              }
                              const bad = (vet.critical ?? 0) + (vet.high ?? 0);
                              return (
                                <>
                                  <p className={cn("mt-3 rounded-lg px-3 py-2.5 text-xs", bad > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                                    {vet.verdict === "REJECT"
                                      ? t("skills.vetReject")
                                      : bad > 0
                                        ? t("skills.vetReview", { n: bad })
                                        : t("skills.vetPass")}
                                  </p>
                                  {proto.violations.length ? (
                                    <div className="mt-2 flex flex-col gap-1">
                                      {proto.violations.map((v) => (
                                        <div
                                          key={v.rule + v.message}
                                          className={cn(
                                            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                                            v.severity === "error"
                                              ? "border-danger/30 bg-danger/8 text-danger"
                                              : v.severity === "warning"
                                                ? "border-warning/30 bg-warning/8 text-warning"
                                                : "border-border bg-bg-subtle text-ink-3",
                                          )}
                                        >
                                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                                          <span className="min-w-0">
                                            {VET_RULE_KEY[v.rule] ? t(`skills.${VET_RULE_KEY[v.rule]}`) : v.message}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>

                          {/* ── 状态与操作 ── */}
                          <div className="rounded-xl border border-border bg-card p-4">
                            <h3 className="text-sm font-semibold text-foreground">{t("skills.actTitle")}</h3>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button size="sm" onClick={() => void applyStatus("active")}>{t("skills.actEnable")}</Button>
                              <Button size="sm" variant="secondary" onClick={() => void applyStatus("draft")}>{t("skills.actDraft")}</Button>
                              <Button size="sm" variant="destructive" onClick={() => void applyStatus("deprecated")}>{t("skills.actDisable")}</Button>
                              <Button size="sm" variant="secondary" onClick={() => void handlePack()}>
                                <Package className="size-3.5" />
                                {t("skills.protoPack")}
                              </Button>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{t("skills.actHint")}</p>
                          </div>

                          {/* ── 变更记录 ── */}
                          <div className="rounded-xl border border-border bg-card p-4">
                            <h3 className="text-sm font-semibold text-foreground">{t("skills.logTitle")}</h3>
                            <div className="mt-3 flex flex-col gap-1">
                              {(() => {
                                const events = (proto.doc as { lifecycle?: { event?: { at?: string; action?: string; level?: string; note?: string }[] } } | null)?.lifecycle?.event ?? [];
                                if (!events.length) return <p className="text-[11px] text-ink-3">{t("skills.logEmpty")}</p>;
                                return [...events].reverse().slice(0, 20).map((ev, i) => {
                                  const zhKey = LIFECYCLE_ZH_KEY[ev.action ?? ""];
                                  return (
                                    <div key={i} className="flex items-center gap-2 rounded-md bg-bg-subtle px-2.5 py-1.5 text-[11px]">
                                      <Badge variant={ev.action === "update" ? "info" : ev.action === "create" || ev.action === "import" ? "success" : "muted"}>
                                        {zhKey ? t(`skills.${zhKey}`) : ev.action}
                                      </Badge>
                                      {ev.level ? <code className="font-mono text-[10px] text-primary">{ev.level}</code> : null}
                                      <span className="min-w-0 flex-1 truncate text-ink-2">{ev.note}</span>
                                      <span className="shrink-0 text-ink-3">{ev.at}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </DialogBody>

              <DialogFooter>
                {tab === "edit" ? (
                  <Button type="submit" form="skill-edit-form" disabled={!editName.trim()}>
                    {t("common.save")}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setDetail(null)}>
                  {t("common.close")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <HarnessDialog open={scanOpen} onOpenChange={setScanOpen} kind="skills" />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={t("skills.deleteConfirmTitle")}
        message={t("skills.deleteConfirmMsg", { name: deleting?.name ?? "" })}
        danger
        onConfirm={() => {
          if (deleting) void deleteSkill(deleting.dirName).then(() => toast.success(t("skills.deleted")));
        }}
      />

   </PageShell>
  );
}
