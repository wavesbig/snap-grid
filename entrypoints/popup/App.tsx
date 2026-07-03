import { useState, useEffect, useCallback } from 'react';
import { Grid2x2, PanelTop, Film, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { getCaptureCount, getAllSessions, getCaptureBytes, clearAll, getStorageEstimate } from '@/lib/db';
import type { Session } from '@/lib/types';

type CaptureMode = 'grid' | 'subtitle';

function App() {
  const [mode, setMode] = useState<CaptureMode>('grid');
  const [count, setCount] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    browser.storage.local.get('captureMode').then((res) => {
      if (res.captureMode === 'subtitle' || res.captureMode === 'grid') {
        setMode(res.captureMode);
      }
    });
  }, []);

  const refreshAll = useCallback(() => {
    getAllSessions().then(setSessions).catch(() => {});
    getCaptureCount(selectedSession ?? undefined).then(setCount).catch(() => {});
    getCaptureBytes().then(setStorageUsed).catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    refreshAll();
    const handler = (msg: { type: string }) => {
      if (msg.type === 'CAPTURE_SUCCESS' || msg.type === 'CAPTURE_DELETED') refreshAll();
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [refreshAll]);

  const handleModeChange = (value: string) => {
    const m = value as CaptureMode;
    setMode(m);
    browser.storage.local.set({ captureMode: m });
  };

  const handleClearAll = () => {
    clearAll().then(() => refreshAll()).catch(() => {});
  };

  const openEditor = () => {
    const base = (browser.runtime.getURL as (p: string) => string)('/editor.html');
    const url = selectedSession ? base + '?session=' + encodeURIComponent(selectedSession) : base;
    browser.tabs.create({ url });
    window.close();
  };

  return (
    <div className="glass flex w-[360px] flex-col gap-4 rounded-2xl px-5 py-6 text-foreground">
      {/* brand header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Grid2x2 className="size-4 text-primary" strokeWidth={1} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">snap-grid</div>
            <div className="text-[11px] text-muted-foreground">视频截图拼接</div>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
          就绪
        </span>
      </div>

      {/* session status */}
      <Card className="glass-subtle gap-1.5 rounded-xl border-0 px-4 py-3.5 shadow-soft">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{count}</span>
          <span className="text-sm text-muted-foreground">张画面</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedSession ? '已选会话' : '全部画面'} · 前往 B站 按下快捷键开始
        </p>
      </Card>

      {/* session list */}
      {sessions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">会话列表</span>
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
            <button
              onClick={() => setSelectedSession(null)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                selectedSession === null
                  ? 'bg-primary/10 text-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className="text-xs font-medium">全部</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{sessions.length} 个视频</span>
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  selectedSession === s.id
                    ? 'bg-primary/10 text-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <span className="truncate text-xs font-medium">{s.title}</span>
                <span className="ml-2 shrink-0 text-[10px] tabular-nums text-muted-foreground">{s.captureCount} 张</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* primary action */}
      <Button size="lg" className="w-full shadow-soft transition-all duration-200 ease-spring hover:-translate-y-px hover:brightness-105 active:scale-[0.985]" onClick={openEditor}>
        <PanelTop className="size-4" strokeWidth={1} />
        打开编辑器
      </Button>

      {/* capture mode */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">截取模式</span>
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="w-full">
            <TabsTrigger value="grid" className="flex-1 transition-transform active:scale-[0.97]">
              <Grid2x2 className="size-3.5" strokeWidth={1} />
              拼图模式
            </TabsTrigger>
            <TabsTrigger value="subtitle" className="flex-1 transition-transform active:scale-[0.97]">
              <Film className="size-3.5" strokeWidth={1} />
              字幕模式
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* storage usage */}
      {storageUsed > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-muted-foreground">存储占用</span>
            <span className="text-[11px] tabular-nums text-foreground/80">
              {(storageUsed / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3" strokeWidth={1} />
            清空
          </button>
        </div>
      )}

      {/* footer shortcut */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground">快速截取</span>
        <KbdGroup>
          <Kbd>Alt</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
    </div>
  );
}

export default App;