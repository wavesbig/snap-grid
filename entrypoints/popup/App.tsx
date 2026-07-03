import { useState, useEffect, useCallback } from 'react';
import { Grid2x2, PanelTop, Film } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { getCaptureCount } from '@/lib/db';

type CaptureMode = 'grid' | 'subtitle';

function App() {
  const [mode, setMode] = useState<CaptureMode>('grid');
  const [count, setCount] = useState(0);

  useEffect(() => {
    browser.storage.local.get('captureMode').then((res) => {
      if (res.captureMode === 'subtitle' || res.captureMode === 'grid') {
        setMode(res.captureMode);
      }
    });
  }, []);

  const refreshCount = useCallback(() => {
    getCaptureCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const handler = (msg: { type: string }) => {
      if (msg.type === 'CAPTURE_SUCCESS') refreshCount();
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [refreshCount]);

  const handleModeChange = (value: string) => {
    const m = value as CaptureMode;
    setMode(m);
    browser.storage.local.set({ captureMode: m });
  };

  const openEditor = () => {
    const url = (browser.runtime.getURL as (p: string) => string)('/editor.html');
    browser.tabs.create({ url });
    window.close();
  };

  return (
    <div className="flex w-[360px] flex-col gap-4 bg-background px-5 py-6 text-foreground">
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
      <Card className="gap-1.5 border-0 bg-card px-4 py-3.5 shadow-soft">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{count}</span>
          <span className="text-sm text-muted-foreground">张画面</span>
        </div>
        <p className="text-xs text-muted-foreground">
          当前会话 · 前往 B站 按下快捷键开始
        </p>
      </Card>

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