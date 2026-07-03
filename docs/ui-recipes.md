# UI Recipes

本文件记录当前项目中几种已经验证过的界面拼装方式。

目标：

- 让 AI 能直接复用已有结构
- 避免每次“参考某某风格”都从零重想
- 把抽象风格描述转成页面级 recipe

## 1. Popup 外壳

适用场景：

- 浏览器工具栏 popup
- 需要弱化宿主边框存在感

推荐结构：

```tsx
<div className="glass-canvas popup-canvas w-[372px] p-4 text-foreground">
  <div className="soft-shell rounded-[32px] p-1.5">
    <div className="soft-core rounded-[26px] p-4">
      {/* content */}
    </div>
  </div>
</div>
```

说明：

- `popup-canvas` 只用于 popup 外层，不用于 editor
- 最外层负责淡化浏览器宿主外框，不负责表达重点
- 主要视觉重量放在 `soft-core`

不要这样做：

- 给 popup 最外层增加高对比渐变
- 把高光或蓝色光斑顶到边缘
- 再额外给根节点加一圈明显 border

## 2. Popup 状态卡

适用场景：

- 计数卡
- 概览卡
- 轻说明区域

推荐结构：

```tsx
<div className="soft-shell rounded-[28px] p-1.5">
  <Card className="soft-subtle-core gap-2 rounded-[22px] border-0 px-4 py-4 shadow-none">
    {/* content */}
  </Card>
</div>
```

说明：

- 状态卡允许双层壳，但页面内数量不要过多
- 如果 popup 出现“描边套娃”感，优先从这里开始减少一层包裹

## 3. Popup 会话列表项

适用场景：

- 会话切换
- 筛选项
- 轻量级列表选择

推荐结构：

```tsx
<button
  className={
    active
      ? 'soft-primary-button text-primary-foreground'
      : 'control-surface text-muted-foreground'
  }
>
  ...
</button>
```

说明：

- 激活态直接使用蓝色主按钮语义
- 未激活态使用 `control-surface`
- 未激活项不能过浅，否则会像背景

## 4. 主操作按钮

适用场景：

- popup 主 CTA
- editor 中的主要导出动作

推荐结构：

```tsx
<Button className="soft-primary-button ...">
  <span>主操作</span>
  <span className="soft-button-orb ...">
    <Icon />
  </span>
</Button>
```

说明：

- 主按钮可以承担品牌蓝色
- `soft-button-orb` 用于增加按钮内部层次
- 一个区域内只保留一个真正的主 CTA

## 5. 编辑器工作台

适用场景：

- editor 主界面
- 有明显内容区和参数区的工具型页面

推荐思路：

- 外部使用较轻的背景层
- 左右参数区使用面板层
- 中间预览区使用画布层
- 交互控件单独提升到控件层

推荐分层：

```tsx
<div className="glass-canvas ...">
  <header className="soft-shell ...">
    <div className="soft-core ...">{/* toolbar */}</div>
  </header>

  <aside className="soft-shell ...">
    <div className="soft-core ...">{/* left panel */}</div>
  </aside>

  <main className="workspace-stage ...">
    <div className="preview-toolbar ...">{/* top controls */}</div>
    <div className="preview-canvas ...">{/* preview */}</div>
  </main>

  <aside className="soft-shell ...">
    <div className="soft-core ...">{/* right panel */}</div>
  </aside>
</div>
```

## 6. 预览区

适用场景：

- editor 中间预览画布

当前约束：

- 使用浅色预览区，不使用深色舞台
- 预览区是画布，不是展示秀场
- 不要再加不必要的浅蓝氛围层

推荐组合：

```tsx
<div className="workspace-stage ...">
  <div className="preview-toolbar ...">{/* controls */}</div>
  <div className="preview-canvas ...">{/* preview image */}</div>
</div>
```

不要这样做：

- 中间区域做成深色舞台
- 再加一层额外的蓝色头部氛围
- 为了“高级感”把工具条和预览区做成多层套壳

## 7. 宿主外框淡化

适用场景：

- 浏览器 popup 最外层存在宿主边框或阴影

事实：

- 这层外框通常不是页面 CSS 能直接控制的
- 项目能控制的是 popup 页面边缘观感

推荐做法：

- 给 popup 根层添加单独的 `popup-canvas`
- 让边缘背景更平、更接近宿主浅灰白
- 控制最外层留白，不要过宽
- 避免边缘高对比高光、重阴影、彩色氛围

不推荐：

- 试图通过业务层 border 去“覆盖”宿主边框
- 在 popup 最外层加更多边框试图修饰

## 8. 新页面接入方式

如果未来增加新的扩展页面，优先按下面步骤接入：

1. 先判断它更像 popup 还是 editor
2. 复用已有背景层和面板层类名
3. 交互件优先使用 `control-surface` 或 `soft-primary-button`
4. 只有当现有语义类不够时，才在 `globals.css` 新增 utility
5. 新 utility 要按语义命名，避免直接写视觉词

## 9. 命名建议

新增 utility 时，优先按用途命名：

- `*-canvas`：外层背景
- `*-stage`：工作区或展示区
- `*-core`：主内容面
- `*-subtle-*`：次级信息面
- `*-surface`：控件表面

避免：

- `blue-card`
- `fancy-panel`
- `glass-thing`
- `new-button-style`
