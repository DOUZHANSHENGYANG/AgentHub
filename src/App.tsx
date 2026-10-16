import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { SettingsView } from "@/components/SettingsView";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { ToolManagerPage } from "@/pages/ToolManagerPage";
import { McpPage } from "@/pages/McpPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { SkillsPage } from "@/pages/SkillsPage";
import { api } from "@/lib/api";
import { useData } from "@/stores/data";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";

const toasterOptions = {
  classNames: {
    toast: "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-lg !text-xs",
    description: "!text-ink-3",
  },
};

export default function App() {
  const ready = useSettings((s) => s.ready);
  const theme = useSettings((s) => s.theme);
  const boot = useSettings((s) => s.boot);
  const page = useUi((s) => s.page);
  const loadAll = useData((s) => s.loadAll);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (ready) {
      void loadAll();
      // 每日自动备份：当天首次启动时触发（幂等）
      void api.vaultMaybeDaily().catch(() => undefined);
      // first visible frame = fully rendered UI (no white flash)
      requestAnimationFrame(() => void getCurrentWindow().show());
    }
  }, [ready, loadAll]);

  if (!ready) return null;

  const toaster = <Toaster position="bottom-right" theme={theme} toastOptions={toasterOptions} />;

  // 应用内独立的设置界面：不显示主界面侧边栏，左上角「返回」回主界面
  if (page === "settings") {
    return (
      <>
        <SettingsView />
        {toaster}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main key={page} className="flex min-w-0 flex-1 flex-col">
          {page === "prompts" ? <PromptsPage /> : null}
          {page === "mcp" ? <McpPage /> : null}
          {page === "skills" ? <SkillsPage /> : null}
          {page === "vault" ? <ToolManagerPage /> : null}
        </main>
      </div>
      {toaster}
    </div>
  );
}
