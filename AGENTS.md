# Repository Guidelines

This repository is a browser extension built with [WXT](https://wxt.dev) (v0.20) and React 19, written in TypeScript and managed with pnpm. It currently targets Chrome and Firefox.

## Project Structure & Module Organization

- `entrypoints/` — WXT entrypoints, one per extension surface.
  - `background.ts` — service worker (`defineBackground`).
  - `content.ts` — content script (`defineContentScript`), scoped via `matches`.
  - `popup/` — toolbar popup: `index.html` shell, `main.tsx` mount, `App.tsx` root component, plus `App.css`/`style.css`.
- `public/` — static assets copied verbatim (e.g. `icon/`, `wxt.svg`). Reference as `/wxt.svg`.
- `assets/` — assets imported through the bundler (e.g. `@/assets/react.svg`).
- `wxt.config.ts` — WXT configuration (modules, manifest options).
- `tsconfig.json` — extends the generated `.wxt/tsconfig.json`; sets `jsx: react-jsx`.

> `defineBackground`, `defineContentScript`, and `browser` are WXT auto-imports — no explicit import needed.

## Build, Test, and Development Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies; runs `wxt prepare` (regenerates `.wxt/` types) via `postinstall`. |
| `pnpm dev` | Start dev mode with HMR for Chrome. |
| `pnpm dev:firefox` | Dev mode for Firefox. |
| `pnpm build` | Production build to `.output/` (Chrome). |
| `pnpm build:firefox` | Production build (Firefox). |
| `pnpm zip` | Package a store-ready `.zip` (Chrome). |
| `pnpm compile` | Type-check with `tsc --noEmit` — run before committing. |

## Coding Style & Naming Conventions

- TypeScript only; 2-space indentation, single quotes, trailing commas, semicolons.
- React components are PascalCase (`App.tsx`); other files are kebab-case by convention.
- WXT entrypoint filenames (e.g. `background.ts`, `popup/index.html`) are conventional — keep them so WXT auto-registers them.
- No ESLint/Prettier is configured; keep edits consistent with existing files and confirm with `pnpm compile`.

## UI Component Library — shadcn/ui First

This project uses [shadcn/ui](https://ui.shadcn.com) as its component library. All UI components live in `components/ui/`.

**Rule: always prefer shadcn/ui components over hand-rolled markup.** Before writing any custom UI element (dropdowns, dialogs, popovers, tabs, buttons, etc.), check whether a shadcn component exists for it.

- Add new components via: `pnpm dlx shadcn@latest add <component>` (e.g. `select`, `dialog`, `popover`).
- Available components in this project: `button`, `card`, `kbd`, `tabs`, `select`.
- If a needed component is missing, add it through the CLI — do not hand-write an equivalent.
- Compose shadcn components rather than reinventing them. Use built-in variants (`variant="outline"`, `size="sm"`) before adding custom styles.
- Use semantic design tokens (`bg-primary`, `text-muted-foreground`, `bg-card`) — never raw color values.
- Conditional classNames use the `cn()` helper from `@/lib/utils`.

**The only exception:** business-specific components that have no shadcn equivalent (e.g. the sortable capture list, the canvas preview area). These belong in the consuming file or a dedicated `components/` subfolder, not in `components/ui/`.

## UI Style Workflow

The project keeps visual style in business layers and global tokens, not in the `shadcn/ui` base components.

- Read `DESIGN.md` before making non-trivial visual changes.
- Read `docs/ui-recipes.md` before redesigning `popup`, `editor`, or other extension surfaces.
- Treat `components/ui/*` as shared base primitives. Do not restyle them to satisfy a page-specific direction.
- Prefer extending style through:
  - `assets/styles/globals.css`
  - `entrypoints/popup/App.tsx`
  - `entrypoints/editor/App.tsx`
  - `entrypoints/content.ts`
- Keep blue as the single primary accent unless the user explicitly requests a palette change.
- Prefer soft layer separation over heavy borders. If a screen starts to look like "border nesting", remove wrappers before adding more styling.
- Popup shell changes need extra caution: the browser-hosted popup frame is not fully controllable, so reduce edge contrast instead of trying to decorate the host border.
- When introducing a new utility class, use semantic names like `*-canvas`, `*-core`, or `*-surface` rather than visual-only names.

## Testing Guidelines

No test framework is currently configured. If you add tests, prefer Vitest (WXT/Vite-native) and document the runner and commands here before writing specs.

## Commit & Pull Request Guidelines

The repository has no recorded Git history yet. Until a convention is adopted, use this baseline:

- Imperative, concise commit subjects (`Add popup counter`), subject under ~72 chars, body explaining *why* for non-trivial changes.
- Open PRs against the main branch with a description of the change, a link to any issue, and verification notes (e.g. `pnpm compile` passes, tested in `dev` for Chrome and Firefox).

## Agent & Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. They apply to both human contributors and AI agents (e.g. Claude Code, Codex) working in this repository.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
