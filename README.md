<div align="center">

# snap-grid

在 B站 等视频平台快速截取画面，一键拼接成拼图、长图或字幕合集。

浏览器扩展 · WXT + React 19 + TypeScript

</div>

---

## 功能特性

- **快捷键截帧** — 在 B站视频页面按 `Alt+S`（macOS `Option+S`）即可截取当前画面，无需暂停。
- **三种拼接模式**
  - **拼图模式** — 多张截图按栅格排列，可调列数、间距、圆角。
  - **长图模式** — 按顺序垂直拼接，保持各自宽高比。
  - **字幕模式** — 第一张为完整画面，后续自动截取底部字幕区域拼接。
- **可视化编辑器** — 拖拽排序、实时预览、参数调节（间距、圆角、背景色、字幕范围）。
- **背景色控制** — 支持白底、透明、浅灰三种背景，圆角效果清晰可见。
- **一键导出** — 导出为 PNG，透明背景保留 alpha 通道。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Alt+S` / `Option+S` | 截取当前视频画面 |

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（`corepack enable`）

### 开发

```bash
pnpm install        # 安装依赖（自动生成 .wxt 类型）
pnpm dev            # 启动开发模式（Chrome，含 HMR）
pnpm dev:firefox    # Firefox 开发模式
```

WXT 会自动打开一个带有扩展的测试浏览器。

### 构建

```bash
pnpm build            # 生产构建到 .output/（Chrome）
pnpm build:firefox    # 生产构建（Firefox）
pnpm zip              # 打包为商店 .zip（Chrome）
```

### 类型检查

```bash
pnpm compile         # tsc --noEmit
```

## 使用方式

1. 安装扩展后，打开任意 B站 视频页面。
2. 点击工具栏图标，选择截取模式（拼图 / 字幕）。
3. 播放视频，按 `Alt+S` 截取画面 — popup 中的计数会实时更新。
4. 截取完毕后点击「打开编辑器」。
5. 在编辑器中拖拽排序、调整参数，实时预览拼接效果。
6. 点击「导出图片」保存 PNG。

## 项目结构

```
entrypoints/
  background.ts          Service Worker，监听快捷键命令
  content.ts             Content Script，注入 B站页面，截取视频帧
  popup/                 工具栏弹窗：模式切换、计数、编辑器入口
  editor/                拼接编辑器：拖拽排序、参数调节、实时预览
lib/
  capture.ts             视频帧截取（canvas 绘制 + 缩略图生成）
  stitch.ts              拼接布局算法 + Canvas 渲染（含圆角裁剪）
  db.ts                  IndexedDB 封装（captures / sessions）
  messaging.ts           Background ↔ Content 消息类型
  types.ts               公共类型定义
  utils.ts               通用工具函数
components/ui/           shadcn/ui 组件（Button、Card、Tabs、Kbd）
assets/styles/           全局样式与设计 token
```

## 技术栈

| 领域 | 技术 |
| --- | --- |
| 扩展框架 | [WXT](https://wxt.dev) 0.20 |
| UI | React 19 + [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS 4 |
| 拖拽 | @dnd-kit |
| 图标 | lucide-react |
| 存储 | IndexedDB |
| 类型检查 | TypeScript 5.9 |

## 许可证

MIT