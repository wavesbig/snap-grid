import { useState, useEffect, useCallback, useRef } from "react";
import { Grid2x2, PanelTop, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  getCaptureCount,
  getAllSessions,
  getCaptureBytes,
  clearAll,
  getStorageEstimate,
} from "@/lib/db";
import {
  formatBytes,
  getCaptureShortcutLabel,
  getCaptureShortcutParts,
  urlToSessionId,
} from "@/lib/utils";
import type { Session } from "@/lib/types";

function App() {
  const [count, setCount] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [currentPageSessionId, setCurrentPageSessionId] = useState<string | null>(
    null,
  );
  const shouldAutoSelectCurrentSession = useRef(true);
  const isFollowingCurrentPage =
    !!currentPageSessionId && selectedSession === currentPageSessionId;
  const selectedSessionTitle =
    sessions.find((session) => session.id === selectedSession)?.title ?? null;
  const shortcutLabel = getCaptureShortcutLabel();
  const [shortcutModifier, shortcutKey] = getCaptureShortcutParts();

  const refreshAll = useCallback(() => {
    getAllSessions()
      .then(setSessions)
      .catch(() => {});
    getCaptureCount(selectedSession ?? undefined)
      .then(setCount)
      .catch(() => {});
    getCaptureBytes()
      .then(setStorageUsed)
      .catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    refreshAll();
    const handler = (msg: { type: string }) => {
      if (msg.type === "CAPTURE_SUCCESS" || msg.type === "CAPTURE_DELETED")
        refreshAll();
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [refreshAll]);

  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
          setCurrentPageSessionId(null);
          return;
        }
        setCurrentPageSessionId(urlToSessionId(tab.url));
      })
      .catch(() => setCurrentPageSessionId(null));
  }, []);

  useEffect(() => {
    if (!shouldAutoSelectCurrentSession.current || !currentPageSessionId) return;
    if (!sessions.some((session) => session.id === currentPageSessionId)) return;
    setSelectedSession(currentPageSessionId);
  }, [currentPageSessionId, sessions]);

  const handleClearAll = () => {
    clearAll()
      .then(() => refreshAll())
      .catch(() => {});
  };

  const openEditor = () => {
    const base = (browser.runtime.getURL as (p: string) => string)(
      "/editor.html",
    );
    const sessionToOpen =
      selectedSession ??
      (currentPageSessionId &&
      sessions.some((session) => session.id === currentPageSessionId)
        ? currentPageSessionId
        : null);
    const url = sessionToOpen
      ? base + "?session=" + encodeURIComponent(sessionToOpen)
      : base;
    browser.tabs.create({ url });
    window.close();
  };

  return (
    <div className="glass-canvas popup-canvas w-[372px] p-4 text-foreground">
      <div className="soft-shell rounded-[32px] p-1.5">
        <div className="soft-core flex flex-col gap-4 rounded-[26px] p-4">
          {/* brand header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_30px_-20px_rgba(24,86,255,0.8)]">
                <Grid2x2 className="size-4" strokeWidth={1.2} />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">
                  snap-grid
                </div>
                <div className="text-[11px] text-muted-foreground">
                  视频截图拼接
                </div>
              </div>
            </div>
            <span className="soft-tag rounded-full px-3 py-1 text-muted-foreground">
              就绪
            </span>
          </div>

          {/* session status */}
          <div className="soft-shell rounded-[28px] p-1.5">
            <Card className="soft-subtle-core gap-2 rounded-[22px] border-0 px-4 py-4 shadow-none">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight">
                    {count}
                  </span>
                  <span className="text-sm text-muted-foreground">张画面</span>
                </div>
                <span className="soft-tag rounded-full px-3 py-1 text-muted-foreground dark:bg-black/10">
                  {selectedSession
                    ? isFollowingCurrentPage
                      ? "当前页面"
                      : "已选会话"
                    : "全部会话"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {selectedSession
                  ? isFollowingCurrentPage
                    ? "已自动定位到当前页面对应的视频会话，打开编辑器会直接进入该会话。"
                    : `当前查看“${selectedSessionTitle ?? "所选会话"}”，打开编辑器会进入这个会话。`
                  : `当前查看全部会话，前往 B 站页面按 ${shortcutLabel} 可继续截取当前画面。`}
              </p>
            </Card>
          </div>

          {/* session list */}
          {sessions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  会话列表
                </span>
                <span className="text-[10px] text-muted-foreground">
                  按视频分组
                </span>
              </div>
              <div className="flex max-h-[152px] flex-col gap-1.5 overflow-y-auto">
                <button
                  onClick={() => {
                    shouldAutoSelectCurrentSession.current = false;
                    setSelectedSession(null);
                  }}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors ${
                    selectedSession === null
                      ? "soft-primary-button text-primary-foreground"
                      : "control-surface text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-medium">全部</span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      selectedSession === null
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {sessions.length} 个视频
                  </span>
                </button>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      shouldAutoSelectCurrentSession.current = false;
                      setSelectedSession(s.id);
                    }}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      selectedSession === s.id
                        ? "soft-primary-button text-primary-foreground"
                        : "control-surface text-muted-foreground"
                    }`}
                  >
                    <span className="truncate text-xs font-medium">
                      {s.title}
                    </span>
                    <span
                      className={`ml-2 shrink-0 text-[10px] tabular-nums ${
                        selectedSession === s.id
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {s.captureCount} 张
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* primary action */}
          <Button
            size="lg"
            className="soft-primary-button h-12 w-full rounded-full px-2 text-primary-foreground shadow-none transition-all duration-200 ease-spring"
            onClick={openEditor}
          >
            <span className="pl-3 text-sm font-medium">打开编辑器</span>
            <span className="soft-button-orb ml-auto flex size-8 items-center justify-center rounded-full">
              <PanelTop className="size-4" strokeWidth={1.1} />
            </span>
          </Button>

          {/* storage usage */}
          {storageUsed > 0 && (
            <div className="soft-shell rounded-[24px] p-1.5">
              <div className="soft-subtle-core flex items-center justify-between rounded-[18px] px-3 py-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    存储占用
                  </span>
                  <span className="text-[11px] tabular-nums text-foreground/80">
                    {formatBytes(storageUsed)}
                  </span>
                </div>
                <button
                  onClick={handleClearAll}
                  className="control-surface flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3" strokeWidth={1} />
                  清空
                </button>
              </div>
            </div>
          )}

          {/* footer shortcut */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">快速截取</span>
            <KbdGroup>
              <Kbd className="border-border bg-white text-foreground dark:bg-transparent">
                {shortcutModifier}
              </Kbd>
              <Kbd className="border-border bg-white text-foreground dark:bg-transparent">
                {shortcutKey}
              </Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
