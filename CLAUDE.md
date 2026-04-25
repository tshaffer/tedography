# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Tedography

Personal photo archive and curation system. pnpm monorepo, TypeScript throughout.

Primary workflow: **Import → Review (New/Pending/Keep/Discard) → Organize → Browse**

Full architecture reference: @./Docs/CLAUDE_PROJECT_SUMMARY.md

---

## Commands

```bash
pnpm install              # install all dependencies
pnpm dev                  # start web + api together
pnpm dev:web              # web only (webpack-dev-server, port 3000)
pnpm dev:api              # api only (tsx watch)
pnpm -r typecheck         # typecheck all packages — run after every change
pnpm --filter @tedography/api test   # run API tests (tsx --test)
pnpm thumbnails:verify    # check thumbnail integrity
pnpm thumbnails:repair    # repair missing thumbnails
pnpm thumbnails:rebuild   # rebuild all thumbnails
pnpm locations:backfill   # backfill location metadata on existing assets
```

---

## Repo Structure

```
apps/web          React 19 + Redux Toolkit + MUI frontend
apps/api          Express 5 backend
apps/duplicate-*  Duplicate detection tooling
packages/domain   Canonical data model — entities, enums, types
packages/shared   Cross-app utilities
packages/media-metadata   EXIF extraction, dimensions, MIME types
packages/import-pipeline  File hashing, duplicate detection, asset creation
packages/duplicate-domain Types for duplicate workflows
packages/image-analysis   Image analysis support
```

---

## Non-Negotiable Rules

1. **`.js` extensions on all relative imports.** The project uses NodeNext module resolution. Never remove them.
   ```ts
   import { PhotoState } from '../enums/PhotoState.js'  // correct
   import { PhotoState } from '../enums/PhotoState'      // wrong
   ```

2. **Dependency direction — never violate:**
   ```
   domain ← shared ← media-metadata ← import-pipeline ← api
   web → domain, shared only
   ```
   No circular dependencies. `domain` must have no internal package dependencies.

3. **Never rename PhotoState values** (New / Pending / Keep / Discard) without updating domain enums, API logic, and UI together.

4. **`pnpm -r typecheck` must pass** after every change.

5. **Prefer workspace imports** across packages: `import { MediaAsset } from '@tedography/domain'`

6. **Prefer small focused patches.** No unnecessary refactors.

---

## Key Files

| File | Purpose |
|---|---|
| `packages/domain/src/index.ts` | All exported domain types |
| `packages/domain/src/entities/MediaAsset.ts` | Central entity |
| `packages/domain/src/enums/PhotoState.ts` | Review state enum |
| `apps/api/src/server.ts` | Express app, all routes mounted here |
| `apps/api/src/config.ts` | Env var parsing (MongoDB URI, storage roots, people pipeline) |
| `apps/api/src/repositories/assetRepository.ts` | All MediaAsset DB queries |
| `apps/api/src/import/registerImportService.ts` | Core import pipeline logic |
| `apps/web/src/App.tsx` | Main UI component (grid/loupe/review/albums/search) |

### API Route Files (`apps/api/src/routes/`)

Each domain area has its own route file mounted in `server.ts`:
`albumTreeRoutes`, `importRoutes`, `keywordRoutes`, `mediaRoutes`, `peoplePipelineRoutes`, `smartAlbumRoutes`

### Web App Structure (`apps/web/src/`)

```
api/           Typed fetch wrappers (one file per domain area, mirrors route files)
app/           Redux slices and store (subdirs: albums, assets, import, maintenance, people)
components/    React components (subdirs match app/ structure)
App.tsx        Top-level component — all major views and state live here
```

Redux state and API calls are organized by the same domain areas (albums, assets, import, people). When adding a feature, touch all three layers: `api/`, `app/`, and `components/`.

---

## Environment (apps/api/.env)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `TEDOGRAPHY_STORAGE_ROOTS` | `id\|label\|/absolute/path` separated by `;` |
| `TEDOGRAPHY_DERIVED_ROOT` | Absolute path for derived files (converted HEIC, thumbnails) |
| `TEDOGRAPHY_UNROTATED_ROOT` | Optional path for pre-rotation originals |
| `TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED` | `true` / `false` |
| `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE` | `rekognition` / `mock` / `none` |

---

## Docs

Additional documentation in `Docs/` and root-level markdown files (`ARCHITECTURE_DECISIONS.md`, `DEBUGGING.md`, `REPO_MAP.md`). Some files may be out of date — treat source code as truth.
