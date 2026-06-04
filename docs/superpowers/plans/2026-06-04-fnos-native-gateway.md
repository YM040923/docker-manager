# fnOS Native Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert docker-manager from a Docker Compose web app into a fnOS native `.fpk` application that runs behind the fnOS unified gateway and uses SQLite.

**Architecture:** The Node/Express server will support both normal TCP development and fnOS Unix socket production via `FNOS_SOCKET_PATH`. The app will trust fnOS gateway headers for admin authentication in native mode, while keeping local password auth only for non-gateway deployments. SQLite will be the only runtime database.

**Tech Stack:** Node 22, Express, React/Vite, tRPC, Drizzle SQLite, better-sqlite3, fnOS native package layout, fnpack.

---

### Task 1: Server Runtime and Database

**Files:**
- Modify: `server/_core/index.ts`
- Modify: `server/_core/vite.ts`
- Modify: `server/db.ts`
- Modify: `server/_core/env.ts`
- Modify: `drizzle.config.ts`

- [ ] Add real SQLite table initialization using `CREATE TABLE IF NOT EXISTS`.
- [ ] Add Unix socket listening when `FNOS_SOCKET_PATH` is present.
- [ ] Keep TCP port mode for local development and Docker fallback.
- [ ] Make static serving work under gateway prefix.

**Verify:** `pnpm check`, `pnpm build`, targeted tests.

### Task 2: fnOS Gateway Authentication

**Files:**
- Modify: `server/_core/context.ts`
- Modify: `server/_core/index.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/Login.tsx`
- Modify: `client/src/components/Navigation.tsx`

- [ ] Trust gateway headers only in fnOS mode.
- [ ] Require `X-Trim-Isadmin: true` for protected operations.
- [ ] Remove login screen requirement in fnOS mode.
- [ ] Keep local login only for non-fnOS mode.

**Verify:** tests for gateway admin/non-admin context and local auth behavior.

### Task 3: fnOS Native Package Scaffold

**Files:**
- Create: `packaging/fnos-native/ym040923.docker-manager/manifest`
- Create: `packaging/fnos-native/ym040923.docker-manager/config/privilege`
- Create: `packaging/fnos-native/ym040923.docker-manager/config/resource`
- Create: `packaging/fnos-native/ym040923.docker-manager/cmd/main`
- Create: `packaging/fnos-native/ym040923.docker-manager/app/ui/config`
- Create: `scripts/build-fnos-native.mjs`
- Modify: `package.json`

- [ ] Add gateway entry `/app/ym040923-docker-manager` with `app.sock`.
- [ ] Add lifecycle script that starts Node on `${TRIM_APPDEST}/app.sock`.
- [ ] Copy build outputs into package app/server and app/ui.
- [ ] Add minimal icon placeholders if no real assets exist.

**Verify:** package directory created; build script fails clearly if `fnpack` is missing but still prepares package files.

### Task 4: Final Verification

- [ ] Run `pnpm check`.
- [ ] Run `pnpm test` where feasible.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm build:fnos` and inspect output/package tree.
- [ ] Commit changes and report NAS install steps.
