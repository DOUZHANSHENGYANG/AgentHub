import { Copy, FileText, History, LayoutGrid, Plus, Rows3, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { matchTags, TagFilter, type TagMode } from "@/components/TagFilter";
import { PageShell } from "@/components/PageShell";
import { TagInput } from "@/components/TagInput";
import { Markdown } from "@/components/Markdown";
import { VersionList } from "@/components/VersionList";
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
import { copyText } from "@/lib/api";
import type { Prompt } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useData } from "@/stores/data";

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function PromptsPage() {
  const { t } = useTranslation();
  const prompts = useData((s) => s.prompts);
  const savePrompt = useData((s) => s.savePrompt);
  const deletePrompt = useData((s) => s.deletePrompt);

  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [tagMode, setTagMode] = useState<TagMode>("or");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<Prompt | null>(null);

  // editor draft
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => p.tags.forEach((tg) => set.add(tg)));
    return [...set].sort();
  }, [prompts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (!matchTags(p.tags, activeTags, tagMode)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((tg) => tg.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, activeTags, tagMode]);

  const [view, setView] = useState<"grid" | "preview">("grid");
  const [paneMode, setPaneMode] = useState<"preview" | "edit">("preview");
  const [editContent, setEditContent] = useState("");
  const [tagsEditing, setTagsEditing] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = filtered.find((p) => p.id === activeId) ?? filtered[0] ?? null;

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setContent("");
    setTags([]);
    setEditorOpen(true);
  };

  useEffect(() => {
    setTagsEditing(false);
  }, [activeId]);

  const openEdit = (p: Prompt) => {
    setEditing(p);
    setTitle(p.title);
    setDescription(p.description);
    setContent(p.content);
    setTags(p.tags);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    await savePrompt({
      id: editing?.id ?? "",
      title: title.trim(),
      description: description.trim(),
      content,
      tags,
      versions: editing?.versions ?? [],
      createdAt: editing?.createdAt ?? "",
      updatedAt: editing?.updatedAt ?? "",
    });
    toast.success(t("prompts.saved"));
    setEditorOpen(false);
  };

  return (
    <PageShell
      title={t("nav.prompts")}
      actions={
        <>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              title={t("prompts.viewGrid")}
              onClick={() => setView("grid")}
              className={cn(
                "grid size-7 place-items-center rounded-md outline-none transition-colors",
                view === "grid" ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              title={t("prompts.viewPreview")}
              onClick={() => setView("preview")}
              className={cn(
                "grid size-7 place-items-center rounded-md outline-none transition-colors",
                view === "preview" ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
              )}
            >
              <Rows3 className="size-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("prompts.searchPlaceholder")}
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button onClick={openNew}>
            <Plus />
            {t("prompts.newPrompt")}
          </Button>
        </>
      }
    >
      {allTags.length > 0 ? (
        <TagFilter
          allTags={allTags}
          selected={activeTags}
          onChange={setActiveTags}
          mode={tagMode}
          onModeChange={setTagMode}
          searchable
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("common.empty")}
          hint={t("prompts.emptyHint")}
          action={
            <Button onClick={openNew} variant="secondary">
              <Plus />
              {t("prompts.newPrompt")}
            </Button>
          }
        />
      ) : view === "preview" ? (
        <div className="flex h-[calc(100vh-190px)] min-h-96 gap-4">
          <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left outline-none transition-colors",
                    active?.id === p.id ? "bg-primary-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span className={cn("truncate text-[13px] font-medium", active?.id === p.id ? "text-primary" : "text-foreground")}>
                    {p.title}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-ink-3">
                    {p.tags.slice(0, 2).map((tg) => (
                      <span key={tg} className="rounded bg-surface-2 px-1">
                        {tg}
                      </span>
                    ))}
                    <span className="ml-auto">{fmt(p.updatedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-5">
            {active ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-base font-semibold text-foreground">{active.title}</h2>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* 预览 / 编辑 切换 */}
                    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPaneMode("preview");
                          setEditContent(active.content);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                        )}
                      >
                        {t("prompts.tabPreview")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditContent(active.content);
                          setPaneMode("edit");
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                          paneMode === "edit" ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-foreground",
                        )}
                      >
                        {t("prompts.tabEdit")}
                      </button>
                    </div>
                    {paneMode === "preview" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void copyText(active.content).then((ok) => ok && toast.success(t("common.copied")))}
                      >
                        <Copy />
                        {t("common.copy")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={editContent === active.content}
                        onClick={() =>
                          void savePrompt({ ...active, content: editContent }).then(() => {
                            toast.success(t("prompts.saved"));
                            setPaneMode("preview");
                          })
                        }
                      >
                        {t("common.save")}
                      </Button>
                    )}
                  </div>
                </div>
                {active.description ? <p className="mt-1 text-xs text-ink-2">{active.description}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {tagsEditing ? (
                    <>
                      <TagInput value={draftTags} onChange={setDraftTags} className="min-h-7 max-w-md flex-1" />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={() =>
                          void savePrompt({ ...active, tags: draftTags }).then(() => {
                            toast.success(t("prompts.saved"));
                            setTagsEditing(false);
                          })
                        }
                      >
                        {t("common.save")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setTagsEditing(false)}>
                        {t("common.cancel")}
                      </Button>
                    </>
                  ) : active.tags.length ? (
                    <>
                      {active.tags.map((tg) => (
                        <Badge key={tg} variant="default">
                          {tg}
                        </Badge>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setDraftTags(active.tags);
                          setTagsEditing(true);
                        }}
                        className="ml-1 text-[11px] text-ink-3 outline-none hover:text-primary"
                      >
                        {t("common.edit")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTags([]);
                        setTagsEditing(true);
                      }}
                      className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-ink-3 outline-none hover:border-primary/40 hover:text-primary"
                    >
                      {t("prompts.tagsEmpty")}
                    </button>
                  )}
                </div>
                <div className="mt-4 min-h-0 flex-1 border-t border-border pt-4">
                  {paneMode === "preview" ? (
                    <Markdown source={active.content} />
                  ) : (
                    <div className="grid h-[58vh] grid-cols-2 gap-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="h-full w-full resize-none rounded-lg border border-input bg-surface p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_0_0_3px_var(--ah-primary-soft)]"
                        spellCheck={false}
                      />
                      <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-bg-subtle p-3">
                        <Markdown source={editContent} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              data-anim
              onClick={() => openEdit(p)}
              className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.title}</h3>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="iconSm"
                    variant="ghost"
                    title={t("prompts.copyContent")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyText(p.content).then((ok) => ok && toast.success(t("common.copied")));
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    title={t("common.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(p);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {p.description ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-2">{p.description}</p>
              ) : (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-3">{p.content.slice(0, 120)}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1">
                {p.tags.map((tg) => (
                  <Badge key={tg} variant="default">
                    {tg}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-ink-3">
                <span>{t("common.updatedAt")} {fmt(p.updatedAt)}</span>
                {p.versions.length > 0 ? (
                  <span className="ml-auto inline-flex items-center gap-1">
                    <History className="size-3" />v{p.versions.length + 1}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{editing ? t("prompts.editTitle") : t("prompts.newTitle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
              <Field label={t("prompts.fieldTitle")}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("prompts.titlePlaceholder")} autoFocus />
              </Field>
              <Field label={t("prompts.fieldDescription")}>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("prompts.descriptionPlaceholder")} />
              </Field>
              <Field label={t("common.tags")} hint={t("common.tagPlaceholder")}>
                <TagInput value={tags} onChange={setTags} />
              </Field>
              <Field label={t("prompts.fieldContent")} className="flex min-h-0 flex-1 flex-col">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("prompts.contentPlaceholder")}
                  className="min-h-56 flex-1 font-mono text-[13px]"
                />
              </Field>
              {editing ? <VersionList versions={editing.versions} onRestore={(c) => { setContent(c); toast.info(t("prompts.versionRestored")); }} /> : null}
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!title.trim() || !content.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={t("prompts.deleteConfirmTitle")}
        message={t("prompts.deleteConfirmMsg", { title: deleting?.title ?? "" })}
        danger
        onConfirm={() => {
          if (deleting) void deletePrompt(deleting.id).then(() => toast.success(t("prompts.deleted")));
        }}
      />
    </PageShell>
  );
}
