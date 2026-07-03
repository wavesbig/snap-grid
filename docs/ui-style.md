# UI Style Guide

本文件用于沉淀 `snap-grid` 当前项目的 UI 风格，供人类协作和 AI 代理共同参考。

目标不是定义一个大而全的设计系统，而是提供一套可执行的边界、术语和判断标准，减少后续样式迭代跑偏的概率。

## 1. 适用范围

- 适用于 `entrypoints/popup/App.tsx`
- 适用于 `entrypoints/editor/App.tsx`
- 适用于 `entrypoints/content.ts` 中的扩展内提示样式
- 适用于 `assets/styles/globals.css` 中的全局 token 和 utility
- 不适用于 `components/ui/*`

## 2. 当前风格读法

把当前界面理解为一套偏产品化的冷灰软质界面：

- 基底是冷灰白，不是纯白，也不是暖米白
- 蓝色是唯一主强调色，用于主操作、激活态和品牌识别
- 材质层强调柔和层次，不强调明显描边
- 可读性和可操作性优先于炫技质感
- popup 的边缘观感需要克制，避免把浏览器宿主外框衬出来

## 3. 核心原则

### 3.1 单一强调色

- 全局只保留一个主强调色，即当前蓝色 `primary`
- 不引入第二个品牌色来抢主层级
- 成功、警告、危险色只用于语义状态，不参与品牌表达

### 3.2 弱边框，强层次

- 优先通过底色、明暗、阴影和留白建立层次
- 不靠一圈套一圈的边框来制造质感
- 边框只用于辅助分面，不用于主视觉表达

### 3.3 交互件要比背景更实

- 可点击按钮、列表项、切换器的视觉重量必须高于背景面板
- 未激活控件可以收敛，但不能“像背景”
- 激活态必须一眼能看出状态变化

### 3.4 popup 外缘要低存在感

- popup 外缘不能有明显光斑、重阴影或强反差
- 浏览器宿主外框不可控，只能通过弱化页面边缘来淡化其存在感
- 最外层背景要平，不要把视觉重点放在边缘

## 4. 固定边界

### 4.1 不修改 shadcn/ui 基座

以下目录视为共享基座，不因当前项目风格而直接修改：

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/kbd.tsx`
- `components/ui/select.tsx`
- `components/ui/tabs.tsx`

如果需要风格化，优先采用以下方式：

- 在业务页面叠加 `className`
- 在 `globals.css` 中添加语义 utility
- 在业务层增加包装容器

### 4.2 风格入口

允许承载风格的主要入口如下：

- `assets/styles/globals.css`
- `entrypoints/popup/App.tsx`
- `entrypoints/editor/App.tsx`
- `entrypoints/content.ts`

## 5. 语义层级

当前项目推荐用“背景层 -> 面板层 -> 控件层”的思路理解样式。

### 5.1 背景层

用途：

- 承接整页气氛
- 不承载交互焦点
- 尽量低存在感

当前类：

- `glass-canvas`
- `popup-canvas`

要求：

- 背景可以有轻微层次
- popup 的背景比 editor 更平
- 不能使用抢眼光斑顶到页面边缘

### 5.2 面板层

用途：

- 容纳内容组块
- 建立主次分区
- 提供柔和包裹感

当前类：

- `soft-shell`
- `soft-core`
- `soft-subtle-core`
- `surface-card`
- `surface-muted`

要求：

- 面板之间要能区分，但不依赖重边框
- 同一页面不要过多重复双层壳结构
- 如果出现“描边套娃”感，优先减少包裹层数

### 5.3 控件层

用途：

- 表达点击、切换、输入和状态
- 比普通面板更明确

当前类：

- `control-surface`
- `soft-primary-button`
- `soft-button-orb`
- `soft-tag`

要求：

- 控件应比背景更实
- 主按钮允许更强蓝色和阴影
- 次级按钮保持克制，但必须看得出可操作

## 6. 视觉术语约定

给 AI 使用时，优先使用以下项目内术语，不用抽象形容词反复描述：

- `popup-canvas`：popup 最外层背景，用于淡化宿主外框
- `soft-shell`：柔和外包裹层
- `soft-core`：主卡内容层
- `soft-subtle-core`：次级信息卡
- `control-surface`：普通交互件表面
- `soft-primary-button`：主 CTA
- `soft-tag`：弱状态标签

## 7. Do / Don't

### Do

- 用业务层包装实现风格
- 用语义类命名，而不是散落魔法值
- 先确认哪个层级在表达内容，哪个层级在表达交互
- 遇到 popup 外框问题，优先减弱边缘背景反差
- 每次改风格后跑 `pnpm compile`

### Don't

- 不要修改 `components/ui/*` 来适配局部页面风格
- 不要引入第二套主强调色
- 不要堆叠过多双层边框
- 不要把最外层背景做得比内容还抢眼
- 不要为了“高级感”牺牲可读性

## 8. AI 修改流程

当 AI 被要求修改 UI 时，按以下顺序判断：

1. 先确认是改业务层，还是误触共享基座
2. 先判断问题属于背景层、面板层还是控件层
3. 如果是 popup 边缘问题，只调 `popup-canvas` 或外层留白
4. 如果是组件层级问题，优先改页面包裹结构和业务 `className`
5. 修改后执行 `pnpm compile`

## 9. 未来扩展建议

后续如果项目继续增加页面或组件，推荐补充：

- 一个标准截图页示例
- 一个标准空状态示例
- 一个标准主按钮和次按钮对照示例
- 视觉回归截图基线
