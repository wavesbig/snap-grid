import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button as UiButton } from "@/components/ui/button";
import {
  getSessionCaptures,
  deleteCapture as deleteCaptureFromDB,
  getAllSessions,
  clearSession as clearSessionFromDB,
  clearAll,
  getCaptureBytes,
} from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import type { Capture, Session } from "@/lib/types";
import type { StitchOptions } from "@/lib/stitch";
import { computeLayout, renderToCanvas, canvasToBlob } from "@/lib/stitch";

type StitchMode = "grid" | "vertical" | "subtitle";

// ----- reusable slider -----

function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
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
          className="control-surface flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-3" strokeWidth={1} />
        </button>
        <span className="w-6 text-center text-xs font-medium tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="control-surface flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: capture.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-[20px] p-2.5 ring-1 transition-shadow ${
        isDragging
          ? "soft-subtle-core ring-primary/30"
          : "soft-subtle-core ring-transparent hover:ring-black/8"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none py-1 pl-0.5 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" strokeWidth={1} />
      </button>
      <span className="soft-tag flex size-6 shrink-0 items-center justify-center rounded-full px-0 text-muted-foreground">
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
        className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/8 hover:text-destructive"
      >
        <Trash2 className="size-3.5" strokeWidth={1} />
      </button>
    </div>
  );
}

// ----- main app -----

function App() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [mode, setMode] = useState<StitchMode>("grid");
  const [gap, setGap] = useState(12);
  const [columns, setColumns] = useState(2);
  const [bandRatio, setBandRatio] = useState(0.3);
  const [radius, setRadius] = useState(0);
  const [bgColor, setBgColor] = useState("transparent");
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">(
    "png",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const EDITOR_PREFS_KEY = "editorPrefs";
  const [exporting, setExporting] = useState(false);
  const [previewSize, setPreviewSize] = useState(1);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [clearing, setClearing] = useState(false);

  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("session") ?? "default";
  });

  const refresh = useCallback(() => {
    getSessionCaptures(sessionId)
      .then(setCaptures)
      .catch(() => {});
    getAllSessions()
      .then(setSessions)
      .catch(() => {});
    getCaptureBytes()
      .then(setStorageUsed)
      .catch(() => {});
  }, [sessionId]);

  const switchSession = (newSessionId: string) => {
    if (newSessionId === sessionId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("session", newSessionId);
    window.history.replaceState({}, "", url.toString());
    setSessionId(newSessionId);
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  // load persisted editor prefs on mount
  useEffect(() => {
    browser.storage.local
      .get(EDITOR_PREFS_KEY)
      .then((res) => {
        const prefs = res[EDITOR_PREFS_KEY] as
          | {
              mode?: StitchMode;
              gap?: number;
              columns?: number;
              bandRatio?: number;
              radius?: number;
              bgColor?: string;
              exportFormat?: "png" | "jpeg" | "webp";
              previewSize?: number;
            }
          | undefined;
        if (!prefs) return;
        if (prefs.mode) setMode(prefs.mode);
        if (typeof prefs.gap === "number") setGap(prefs.gap);
        if (typeof prefs.columns === "number") setColumns(prefs.columns);
        if (typeof prefs.bandRatio === "number") setBandRatio(prefs.bandRatio);
        if (typeof prefs.radius === "number") setRadius(prefs.radius);
        if (prefs.bgColor) setBgColor(prefs.bgColor);
        if (prefs.exportFormat) setExportFormat(prefs.exportFormat);
        if (typeof prefs.previewSize === "number")
          setPreviewSize(prefs.previewSize);
      })
      .catch(() => {});
  }, []);

  // when mode changes, reset gap to sensible defaults
  const handleModeChange = (newMode: string) => {
    setMode(newMode as StitchMode);
    setGap(newMode === "subtitle" ? 0 : 12);
  };

  // persist editor prefs whenever they change
  useEffect(() => {
    browser.storage.local
      .set({
        [EDITOR_PREFS_KEY]: {
          mode,
          gap,
          columns,
          bandRatio,
          radius,
          bgColor,
          previewSize,
          exportFormat,
        },
      })
      .catch(() => {});
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
    browser.runtime
      .sendMessage({ type: "CAPTURE_DELETED", captureId: id })
      .catch(() => {});
    getCaptureBytes()
      .then(setStorageUsed)
      .catch(() => {});
  };

  const handleClearCurrentSession = async () => {
    setClearing(true);
    try {
      await clearSessionFromDB(sessionId);
      await browser.runtime
        .sendMessage({ type: "CAPTURE_DELETED" })
        .catch(() => {});
      if (sessionId !== "default") {
        switchSession("default");
      } else {
        refresh();
      }
    } catch {
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAll();
      await browser.runtime
        .sendMessage({ type: "CAPTURE_DELETED" })
        .catch(() => {});
      if (sessionId !== "default") {
        switchSession("default");
      } else {
        refresh();
      }
    } catch {
    } finally {
      setClearing(false);
    }
  };

  const layout = useMemo(() => {
    if (captures.length === 0) return null;
    const opts: StitchOptions = {
      mode,
      gap,
      columns: mode === "grid" ? columns : undefined,
      bandRatio: mode === "subtitle" ? bandRatio : undefined,
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
        .then((canvas) => setPreviewUrl(canvas.toDataURL("image/png")))
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
      const canvas = await renderToCanvas(layout, mode, bgColor, {
        radius,
        bandRatio,
      });
      const mimeMap = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
      } as const;
      const blob = await canvasToBlob(canvas, mimeMap[exportFormat], 0.92);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snap-grid-${mode}-${Date.now()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const modeConfig = [
    { value: "grid" as const, label: "拼图", icon: Grid2x2 },
    { value: "vertical" as const, label: "长图", icon: Rows3 },
    { value: "subtitle" as const, label: "字幕", icon: Captions },
  ];

  const chipButtonClass = (active: boolean) =>
    `flex-1 rounded-full px-2.5 py-2 text-[11px] transition-colors ${
      active
        ? "border border-primary/16 bg-primary text-primary-foreground"
        : "control-surface text-muted-foreground hover:text-foreground"
    }`;

  const currentSessionLabel =
    sessions.find((s) => s.id === sessionId)?.title ??
    (sessionId === "default" ? "默认会话" : "当前会话");

  return (
    <div className="glass-canvas flex h-[100dvh] flex-col p-4 text-foreground">
      {/* top bar */}
      <div className="soft-shell rounded-[32px] p-1.5">
        <div className="soft-core flex items-center justify-between rounded-[26px] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_30px_-20px_rgba(24,86,255,0.8)]">
              <Grid2x2 className="size-4" strokeWidth={1.1} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight">
                snap-grid 编辑器
              </span>
              <span className="text-[11px] text-muted-foreground">
                整理截图并导出拼接图
              </span>
            </div>
            {captures.length > 0 && (
              <span className="soft-tag rounded-full px-3 py-1 text-muted-foreground">
                {captures.length} 张
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <UiButton
                  variant="outline"
                  size="sm"
                  className="control-surface h-10 w-[252px] justify-between rounded-full border-0 px-4 text-xs font-medium shadow-none"
                >
                  <span className="truncate">
                    {sessions.find((s) => s.id === sessionId)?.title
                      ? `${sessions.find((s) => s.id === sessionId)?.title} (${sessions.find((s) => s.id === sessionId)?.captureCount} 张)`
                      : "默认会话"}
                  </span>
                  <ChevronsUpDown
                    className="size-3.5 shrink-0 opacity-50"
                    strokeWidth={1.5}
                  />
                </UiButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[240px] rounded-2xl"
              >
                <DropdownMenuItem
                  onClick={() => switchSession("default")}
                  className="flex items-center justify-between text-xs"
                >
                  默认会话
                  {sessionId === "default" && (
                    <Check className="size-3.5 text-primary" strokeWidth={2} />
                  )}
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
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {s.captureCount} 张
                      </span>
                      {sessionId === s.id && (
                        <Check
                          className="size-3.5 text-primary"
                          strokeWidth={2}
                        />
                      )}
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
            <Button
              size="sm"
              className="soft-primary-button h-10 rounded-full px-2 text-primary-foreground shadow-none"
              onClick={exportImage}
              disabled={!layout || exporting}
            >
              <span className="pl-3 text-xs font-medium">
                {exporting ? "导出中..." : "导出图片"}
              </span>
              <span className="soft-button-orb ml-auto flex size-7 items-center justify-center rounded-full">
                <Download className="size-3.5" strokeWidth={1.1} />
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* three-column workspace */}
      <div className="mt-4 flex flex-1 gap-4 overflow-hidden">
        {/* left: capture list */}
        <div className="soft-shell flex w-72 rounded-[28px] p-1.5">
          <div className="soft-core flex w-full flex-col rounded-[22px]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                画面列表
              </span>
              {captures.length > 1 && (
                <span className="text-[11px] text-muted-foreground/70">
                  拖动排序
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {captures.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <ImageOff
                    className="size-8 text-muted-foreground/50"
                    strokeWidth={1}
                  />
                  <p className="text-xs text-muted-foreground">还没有画面</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    前往 B站 按 Alt+S 截取
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={captures.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {captures.map((cap, i) => (
                        <SortableCapture
                          key={cap.id}
                          capture={cap}
                          index={i}
                          onDelete={deleteCapture}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* center: preview */}
        <div className="soft-shell flex flex-1 rounded-[32px] p-1.5">
          <div className="soft-core flex w-full flex-col overflow-hidden rounded-[26px]">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/6">
              <Tabs value={mode} onValueChange={handleModeChange}>
                <TabsList className="preview-toolbar rounded-full p-1">
                  {modeConfig.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="gap-1.5 rounded-full px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Icon className="size-3.5" strokeWidth={1} />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {previewUrl && (
                <div className="preview-toolbar flex items-center gap-1 rounded-full p-1">
                  <button
                    onClick={() =>
                      setPreviewSize((s) => Math.max(0.25, s - 0.25))
                    }
                    className="control-surface flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Minus className="size-3.5" strokeWidth={1} />
                  </button>
                  <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(previewSize * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewSize((s) => Math.min(3, s + 0.25))}
                    className="control-surface flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="size-3.5" strokeWidth={1} />
                  </button>
                </div>
              )}
            </div>
            <div className="workspace-stage-inner flex flex-1 overflow-auto p-4">
              {previewUrl ? (
                <div className="preview-canvas flex min-h-full w-full items-center justify-center rounded-[28px] p-6">
                  <img
                    src={previewUrl}
                    alt="拼接预览"
                    style={{ transform: `scale(${previewSize})` }}
                    className="max-h-full max-w-full rounded-[22px] border border-black/5 shadow-[0_24px_50px_-32px_rgba(15,23,42,0.3)] transition-transform duration-200 ease-spring dark:border-white/8 dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
                  />
                </div>
              ) : (
                <div className="preview-canvas flex min-h-full w-full flex-col items-center justify-center gap-3 rounded-[28px] p-6 text-center">
                  <div className="flex size-16 items-center justify-center rounded-[22px] bg-primary text-primary-foreground shadow-[0_20px_34px_-24px_rgba(24,86,255,0.85)]">
                    <Grid2x2 className="size-8" strokeWidth={1} />
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-white/58">
                    {captures.length === 0
                      ? "截取画面后这里会显示拼接预览"
                      : "正在生成预览..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* right: params panel */}
        <div className="soft-shell flex w-72 rounded-[28px] p-1.5">
          <div className="soft-core flex w-full flex-col overflow-y-auto rounded-[22px]">
            <div className="px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                参数设置
              </span>
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
                  {(
                    [
                      ["#ffffff", "白"],
                      ["transparent", "透明"],
                      ["#f3f4f6", "浅灰"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setBgColor(val)}
                      className={chipButtonClass(bgColor === val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* export format */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">
                  导出格式
                </label>
                <div className="flex gap-1.5">
                  {(["png", "jpeg", "webp"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={chipButtonClass(exportFormat === fmt)}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* grid: columns */}
              {mode === "grid" && captures.length > 0 && (
                <>
                  <div className="soft-divider h-px" />
                  <ParamStepper
                    label="栅格列数"
                    value={columns}
                    min={1}
                    max={Math.max(1, captures.length)}
                    onChange={setColumns}
                  />
                  <div className="soft-subtle-core flex flex-col gap-1.5 rounded-[20px] p-3">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      排列
                    </span>
                    <span className="text-xs text-foreground/80">
                      {Math.min(columns, captures.length)} 列 x{" "}
                      {Math.ceil(captures.length / columns)} 行
                    </span>
                  </div>
                </>
              )}

              {/* subtitle: bandRatio */}
              {mode === "subtitle" && (
                <>
                  <div className="soft-divider h-px" />
                  <ParamSlider
                    label="字幕截取范围"
                    value={Math.round(bandRatio * 100)}
                    min={10}
                    max={50}
                    step={5}
                    unit="%"
                    onChange={(v) => setBandRatio(v / 100)}
                  />
                  <div className="soft-subtle-core flex flex-col gap-1.5 rounded-[20px] p-3">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      说明
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      第一张为完整画面，后续截取底部{" "}
                      {Math.round(bandRatio * 100)}% 字幕区域拼接
                    </span>
                  </div>
                </>
              )}

              {/* vertical: description */}
              {mode === "vertical" && (
                <>
                  <div className="soft-divider h-px" />
                  <div className="soft-subtle-core flex flex-col gap-1.5 rounded-[20px] p-3">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      说明
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      按顺序垂直拼接所有画面，保持各自宽高比
                    </span>
                  </div>
                </>
              )}

              {/* output size */}
              {layout && (
                <div className="soft-subtle-core flex flex-col gap-1.5 rounded-[20px] p-3">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    输出尺寸
                  </span>
                  <span className="text-xs tabular-nums text-foreground/80">
                    {layout.width} x {layout.height}
                  </span>
                </div>
              )}

              <div className="soft-divider h-px" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground">
                      存储管理
                    </span>
                    <span className="text-[10px] text-destructive/80">
                      危险操作，不可撤销
                    </span>
                  </div>
                  <span className="text-[11px] tabular-nums text-foreground/80">
                    {formatBytes(storageUsed)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={captures.length === 0 || clearing}
                        className="h-10 w-full justify-between rounded-full border-destructive/24 bg-destructive/7 px-3 text-[11px] font-medium text-destructive shadow-none hover:bg-destructive/12 hover:text-destructive"
                      >
                        <span className="flex items-center gap-2">
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                          清空当前会话
                        </span>
                        <span className="text-[10px] text-destructive/70">
                          {captures.length} 张
                        </span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm" className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>清空当前会话？</AlertDialogTitle>
                        <AlertDialogDescription>
                          会删除“{currentSessionLabel}
                          ”中的所有截图，此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearCurrentSession}
                          variant="destructive"
                          className="rounded-full"
                        >
                          确认清空
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={storageUsed === 0 || clearing}
                        className="h-10 w-full justify-between rounded-full px-3 text-[11px] font-medium shadow-none"
                      >
                        <span className="flex items-center gap-2">
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                          清空全部存储
                        </span>
                        <span className="text-[10px] text-white/75">高风险</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm" className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>清空全部存储？</AlertDialogTitle>
                        <AlertDialogDescription>
                          会删除所有会话和截图数据，此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearAll}
                          variant="destructive"
                          className="rounded-full"
                        >
                          确认清空
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
