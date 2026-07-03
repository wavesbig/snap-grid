import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Grid2x2,
  Rows3,
  Captions,
  Download,
  Trash2,
  GripVertical,
  ImageOff,
  Minus,
  Plus,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button as UiButton } from '@/components/ui/button';
import { getSessionCaptures, deleteCapture as deleteCaptureFromDB, getAllSessions, clearSession as clearSessionFromDB } from '@/lib/db';
import type { Capture, Session } from '@/lib/types';
import type { StitchOptions } from '@/lib/stitch';
import { computeLayout, renderToCanvas, canvasToBlob } from '@/lib/stitch';

type StitchMode = 'grid' | 'vertical' | 'subtitle';

// ----- reusable slider -----

function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  );
}

// ----- stepper -----

function ParamStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-3" strokeWidth={1} />
        </button>
        <span className="w-6 text-center text-xs font-medium tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-30"
        >
          <Plus className="size-3" strokeWidth={1} />
        </button>
      </div>
    </div>
  );
}

// ----- sortable capture item -----

function SortableCapture({
  capture,
  index,
  onDelete,
}: {
  capture: Capture;
  index: number;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: capture.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl glass-subtle p-2 ring-1 transition-shadow ${
        isDragging ? 'shadow-soft ring-primary/40' : 'ring-border hover:ring-foreground/20'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none py-1 pl-0.5 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" strokeWidth={1} />
      </button>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
        <img src={capture.thumb} alt="" className="size-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[11px] font-medium">
          {capture.videoTime.toFixed(1)}s
        </span>
        <span className="text-[10px] text-muted-foreground">
          {capture.width}x{capture.height}
        </span>
      </div>
      <button
        onClick={() => onDelete(capture.id)}
        className="p-1 text-muted-foreground/40 transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3.5" strokeWidth={1} />
      </button>
    </div>
  );
}

// ----- main app -----

function App() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [mode, setMode] = useState<StitchMode>('grid');
  const [gap, setGap] = useState(12);
  const [columns, setColumns] = useState(2);
  const [bandRatio, setBandRatio] = useState(0.3);
  const [radius, setRadius] = useState(0);
  const [bgColor, setBgColor] = useState('transparent');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const EDITOR_PREFS_KEY = 'editorPrefs';
  const [exporting, setExporting] = useState(false);
  const [previewSize, setPreviewSize] = useState(1);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);

  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') ?? 'default';
  });

  const refresh = useCallback(() => {
    getSessionCaptures(sessionId).then(setCaptures).catch(() => {});
    getAllSessions().then(setSessions).catch(() => {});
  }, [sessionId]);

  const switchSession = (newSessionId: string) => {
    if (newSessionId === sessionId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('session', newSessionId);
    window.history.replaceState({}, '', url.toString());
    setSessionId(newSessionId);
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  // load persisted editor prefs on mount
  useEffect(() => {
    browser.storage.local.get(EDITOR_PREFS_KEY).then((res) => {
      const prefs = res[EDITOR_PREFS_KEY] as {
        mode?: StitchMode;
        gap?: number;
        columns?: number;
        bandRatio?: number;
        radius?: number;
        bgColor?: string;
        exportFormat?: 'png' | 'jpeg' | 'webp';
        previewSize?: number;
      } | undefined;
      if (!prefs) return;
      if (prefs.mode) setMode(prefs.mode);
      if (typeof prefs.gap === 'number') setGap(prefs.gap);
      if (typeof prefs.columns === 'number') setColumns(prefs.columns);
      if (typeof prefs.bandRatio === 'number') setBandRatio(prefs.bandRatio);
      if (typeof prefs.radius === 'number') setRadius(prefs.radius);
      if (prefs.bgColor) setBgColor(prefs.bgColor);
      if (prefs.exportFormat) setExportFormat(prefs.exportFormat);
      if (typeof prefs.previewSize === 'number') setPreviewSize(prefs.previewSize);
    }).catch(() => {});
  }, []);

  // when mode changes, reset gap to sensible defaults
  const handleModeChange = (newMode: string) => {
    setMode(newMode as StitchMode);
    setGap(newMode === 'subtitle' ? 0 : 12);
  };

  // persist editor prefs whenever they change
  useEffect(() => {
    browser.storage.local.set({
      [EDITOR_PREFS_KEY]: { mode, gap, columns, bandRatio, radius, bgColor, previewSize, exportFormat },
    }).catch(() => {});
  }, [mode, gap, columns, bandRatio, radius, bgColor, previewSize]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCaptures((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const deleteCapture = async (id: string) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    await deleteCaptureFromDB(id).catch(() => {});
    browser.runtime.sendMessage({ type: 'CAPTURE_DELETED', captureId: id }).catch(() => {});
  };

  const layout = useMemo(() => {
    if (captures.length === 0) return null;
    const opts: StitchOptions = {
      mode,
      gap,
      columns: mode === 'grid' ? columns : undefined,
      bandRatio: mode === 'subtitle' ? bandRatio : undefined,
    };
    return computeLayout(captures, opts);
  }, [captures, mode, gap, columns, bandRatio]);

  // debounced preview render
  useEffect(() => {
    if (renderTimer.current) clearTimeout(renderTimer.current);
    if (!layout) {
      setPreviewUrl(null);
      return;
    }
    renderTimer.current = setTimeout(() => {
      renderToCanvas(layout, mode, bgColor, {
        radius,
        bandRatio,
      })
        .then((canvas) => setPreviewUrl(canvas.toDataURL('image/png')))
        .catch(() => setPreviewUrl(null));
    }, 100);
    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current);
    };
  }, [layout, mode, bgColor, radius, bandRatio]);

  const exportImage = async () => {
    if (!layout) return;
    setExporting(true);
    try {
      const canvas = await renderToCanvas(layout, mode, bgColor, { radius, bandRatio });
      const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const;
      const blob = await canvasToBlob(canvas, mimeMap[exportFormat], 0.92);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snap-grid-${mode}-${Date.now()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const modeConfig = [
    { value: 'grid' as const, label: '拼图', icon: Grid2x2 },
    { value: 'vertical' as const, label: '长图', icon: Rows3 },
    { value: 'subtitle' as const, label: '字幕', icon: Captions },
  ];

  return (
    <div className="glass-canvas flex h-[100dvh] flex-col text-foreground">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Grid2x2 className="size-4 text-primary" strokeWidth={1} />
          </div>
          <span className="text-base font-semibold tracking-tight">snap-grid 编辑器</span>
          {captures.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {captures.length} 张
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <UiButton variant="outline" size="sm" className="w-[220px] justify-between text-xs font-medium">
                <span className="truncate">
                  {sessions.find((s) => s.id === sessionId)?.title
                    ? `${sessions.find((s) => s.id === sessionId)?.title} (${sessions.find((s) => s.id === sessionId)?.captureCount} 张)`
                    : '默认会话'}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" strokeWidth={1.5} />
              </UiButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuItem
                onClick={() => switchSession('default')}
                className="flex items-center justify-between text-xs"
              >
                默认会话
                {sessionId === 'default' && <Check className="size-3.5 text-primary" strokeWidth={2} />}
              </DropdownMenuItem>
              {sessions.length > 0 && <DropdownMenuSeparator />}
              {sessions.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">{s.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{s.captureCount} 张</span>
                    {sessionId === s.id && <Check className="size-3.5 text-primary" strokeWidth={2} />}
                  </span>
                </DropdownMenuItem>
              ))}
              {sessions.length === 0 && (
                <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                  还没有会话
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={exportImage} disabled={!layout || exporting}>
          <Download className="size-3.5" strokeWidth={1} />
          {exporting ? '导出中...' : '导出图片'}
          </Button>
        </div>
      </div>

      {/* three-column workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* left: capture list */}
        <div className="flex w-72 flex-col border-r border-border">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">画面列表</span>
            {captures.length > 1 && (
              <span className="text-[11px] text-muted-foreground/70">拖动排序</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {captures.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <ImageOff className="size-8 text-muted-foreground/50" strokeWidth={1} />
                <p className="text-xs text-muted-foreground">还没有画面</p>
                <p className="text-[11px] text-muted-foreground/70">
                  前往 B站 按 Alt+S 截取
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={captures.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {captures.map((cap, i) => (
                      <SortableCapture key={cap.id} capture={cap} index={i} onDelete={deleteCapture} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* center: preview */}
        <div className="flex flex-1 flex-col overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between px-4 py-2.5">
            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList>
                {modeConfig.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-1.5 px-3">
                    <Icon className="size-3.5" strokeWidth={1} />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {previewUrl && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewSize((s) => Math.max(0.25, s - 0.25))}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Minus className="size-3.5" strokeWidth={1} />
                </button>
                <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(previewSize * 100)}%
                </span>
                <button
                  onClick={() => setPreviewSize((s) => Math.min(3, s + 0.25))}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" strokeWidth={1} />
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="拼接预览"
                style={{ transform: `scale(${previewSize})` }}
                className="max-h-full max-w-full shadow-soft ring-1 ring-border transition-transform duration-200 ease-spring"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                  <Grid2x2 className="size-8 text-muted-foreground/50" strokeWidth={1} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {captures.length === 0 ? '截取画面后这里会显示拼接预览' : '正在生成预览...'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* right: params panel */}
        <div className="flex w-72 flex-col overflow-y-auto border-l border-border">
          <div className="px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">参数设置</span>
          </div>
          <div className="flex flex-col gap-5 px-4 pb-6">
            {/* common: gap */}
            <ParamSlider
              label="图片间距"
              value={gap}
              min={0}
              max={32}
              step={2}
              unit="px"
              onChange={setGap}
            />

            {/* common: radius */}
            <ParamSlider
              label="圆角"
              value={radius}
              min={0}
              max={24}
             step={2}
             unit="px"
             onChange={setRadius}
           />

            {/* common: background */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">背景</label>
              <div className="flex gap-1.5">
                {([['#ffffff','白'],['transparent','透明'],['#f3f4f6','浅灰']] as const).map(([val,label]) => (
                  <button
                    key={val}
                    onClick={() => setBgColor(val)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                      bgColor === val
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* export format */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">导出格式</label>
              <div className="flex gap-1.5">
                {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] uppercase transition-colors ${
                      exportFormat === fmt
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* grid: columns */}
            {mode === 'grid' && captures.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <ParamStepper
                  label="栅格列数"
                  value={columns}
                  min={1}
                  max={Math.max(1, captures.length)}
                  onChange={setColumns}
                />
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                  <span className="text-[11px] font-medium text-muted-foreground">排列</span>
                  <span className="text-xs text-foreground/80">
                    {Math.min(columns, captures.length)} 列 x {Math.ceil(captures.length / columns)} 行
                  </span>
                </div>
              </>
            )}

            {/* subtitle: bandRatio */}
            {mode === 'subtitle' && (
              <>
                <div className="h-px bg-border" />
                <ParamSlider
                  label="字幕截取范围"
                  value={Math.round(bandRatio * 100)}
                  min={10}
                  max={50}
                  step={5}
                  unit="%"
                  onChange={(v) => setBandRatio(v / 100)}
                />
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                  <span className="text-[11px] font-medium text-muted-foreground">说明</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    第一张为完整画面，后续截取底部 {Math.round(bandRatio * 100)}% 字幕区域拼接
                  </span>
                </div>
              </>
            )}

            {/* vertical: description */}
            {mode === 'vertical' && (
              <>
                <div className="h-px bg-border" />
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                  <span className="text-[11px] font-medium text-muted-foreground">说明</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    按顺序垂直拼接所有画面，保持各自宽高比
                  </span>
                </div>
              </>
            )}

            {/* output size */}
            {layout && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                <span className="text-[11px] font-medium text-muted-foreground">输出尺寸</span>
                <span className="text-xs tabular-nums text-foreground/80">
                  {layout.width} x {layout.height}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
