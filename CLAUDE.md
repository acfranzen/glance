# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glance is a local-first, AI-extensible personal dashboard designed for OpenClaw integration. AI agents create custom widgets via API calls, and the dashboard displays them with drag-and-drop layout management.

## Commands

```bash
npm run dev          # Start dev server on port 3333 (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type checking
```

## Architecture

### Tech Stack

- **Next.js 16** with App Router (React 19, TypeScript)
- **SQLite** via better-sqlite3 (local database at `./data/glance.db`)
- **Zustand** for client state management
- **Tailwind CSS 4** + shadcn/ui components

### Core Layers

**API Routes** (`src/app/api/`)

- REST endpoints for widgets, credentials, custom-widgets, layout, etc.
- Auth via optional `AUTH_TOKEN` env var (Bearer scheme)

**Widget SDK** (`src/lib/widget-sdk/`)

- `transpiler.ts` - Sucrase-based JSX transpilation with security validation
- `server-executor.ts` - VM sandbox for server code execution
- `hooks.ts` - `useData()`, `useConfig()`, `useWidgetState()`
- `components.tsx` - Safe subset of shadcn/ui components

**Database** (`src/lib/db.ts`)

- Lazy-loaded singleton with auto-schema creation
- Tables: `widgets`, `custom_widgets`, `credentials`, `widget_setups`, `widget_data_cache`, `notes`, `bookmarks`, `settings`, `events`

**State** (`src/lib/store/widget-store.ts`)

- Zustand store managing widget instances and layout

### Widget Creation Flow

1. `POST /api/credentials` - Store encrypted API keys
2. `POST /api/widgets` - Create widget definition with `source_code` (JSX) and optional `server_code`
3. `POST /api/widgets/instances` - Add widget instance to dashboard
4. Widget renders client-side; server code executes via `/api/widgets/:slug/execute`

### API Structure

All widget-related routes consolidated under `/api/widgets/`:
- `/api/widgets` - Custom widget definitions (CRUD)
- `/api/widgets/instances` - Widget instances on dashboard
- `/api/widgets/proxy` - Credential-injected API proxy
- `/api/widgets/import` - Import widget packages
- `/api/widgets/:slug/export` - Export widget as package
- `/api/widgets/:slug/execute` - Run server code
- `/api/widgets/:slug/refresh` - Request data refresh
- `/api/widgets/:slug/cache` - Cache management
- `/api/widgets/setups` - Setup wizard configurations

Other routes:
- `/api/credentials` - Encrypted credential storage
- `/api/layout` - Layout and theme (merged)
- `/api/snapshot` - Dashboard snapshot for AI reading

### Security Model

**Client code** (source_code): JSX transpiled with Sucrase. Forbidden: imports, require, eval, window/document access.

**Server code**: Runs in Node.js VM sandbox. Allowed: `fetch`, `getCredential(provider)`, `params`, `console.log`, JSON/Date/Math/Promise. Blocked: `require`, `import`, `process`, `fs`, `child_process`.

**Credentials**: AES-256-GCM encrypted. Built-in providers: `github`, `anthropic`, `openai`, `vercel`, `openweather`.

## Key Files

- `src/lib/db.ts` - Database schema and operations
- `src/lib/credentials.ts` - Credential encryption/validation
- `src/lib/widget-sdk/` - Widget SDK (transpiler, executor, hooks, components)
- `src/components/dashboard/DashboardGrid.tsx` - Main grid layout
- `src/components/widgets/DynamicWidget.tsx` - Custom widget renderer
- `docs/widget-sdk.md` - Full SDK documentation

## Conventions

- TypeScript strict mode; avoid `any`
- Tailwind for styling; support light/dark modes

## Critical Rules

1. **NEVER push directly to main.** Always create a feature branch and open a PR. Use `git checkout -b <branch-name>`, commit changes, then `git push origin <branch-name>`.

2. **ALWAYS update READMEs when making changes.** After implementing features or making significant changes, check if any README files need updating. Key READMEs to review:
   - `lib/ranking/README.md` — Ranking system, calibration modes, confidence calculation
   - `README.md` — Project overview and features
   - Any module-specific READMEs in the affected directories

   If documentation becomes out of sync with code, fix it immediately. Outdated docs are worse than no docs.
