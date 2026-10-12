import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { VersionEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function VersionList({
  versions,
  onRestore,
  className,
}: {
  versions: VersionEntry[];
  onRestore: (content: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!versions.length) return null;
  const list = [...versions].reverse();

  return (
    <div className={cn("rounded-lg border border-border bg-surface", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-ink-2 outline-none hover:bg-surface-2"
      >
        <span>
          {t("common.versions")} · {versions.length}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-1 border-t border-border p-2">
          {list.map((v) => (
            <div key={v.v} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
              <span className="shrink-0 rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary">
                v{v.v}
              </span>
              <span className="truncate text-[11px] text-ink-3">{v.content.slice(0, 60).replace(/\s+/g, " ")}</span>
              <span className="ml-auto shrink-0 text-[10px] text-ink-3">{fmt(v.savedAt)}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 shrink-0 px-2 text-[11px]"
                onClick={() => onRestore(v.content)}
              >
                {t("common.restore")}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
