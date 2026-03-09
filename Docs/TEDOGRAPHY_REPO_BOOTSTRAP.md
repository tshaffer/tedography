# TEDOGRAPHY_REPO_BOOTSTRAP.md

Author: Ted Shaffer  
Project: Tedography  
Root directory: `/Users/tedshaffer/Documents/Projects/tedography`

This document defines the **initial repo bootstrap** for Tedography based on the current architecture.

---

# 1. Goals of the bootstrap

This bootstrap sets up:

- the exact initial monorepo directory tree
- pnpm workspace configuration
- root and package `package.json` files
- shared TypeScript configuration
- the first commands to run

The goal is to get Tedography into a clean state where you can:

- install dependencies
- build shared packages
- start the API
- start the web app
- evolve the codebase without restructuring the repo again immediately

---

# 2. Exact directory tree

Create the repo with this structure:

```text
tedography/
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .npmrc
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── server.ts
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── app/
│               └── store.ts
├── packages/
│   ├── domain/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── entities/
│   │       │   ├── MediaAsset.ts
│   │       │   ├── Album.ts
│   │       │   ├── PendingGroup.ts
│   │       │   ├── Person.ts
│   │       │   ├── PublicationRecord.ts
│   │       │   ├── StorageInstance.ts
│   │       │   └── AssetEvent.ts
│   │       ├── enums/
│   │       │   ├── MediaType.ts
│   │       │   ├── PhotoState.ts
│   │       │   ├── StorageRole.ts
│   │       │   └── AssetEventType.ts
│   │       └── types/
│   │           └── SearchSpec.ts
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/
│   │       │   └── health.ts
│   │       └── util/
│   │           └── assertNever.ts
│   ├── media-metadata/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── extractMetadata.ts
│   └── import-pipeline/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── hashFile.ts
│           └── importAsset.tstouch \
.gitignore \
package.json \
pnpm-workspace.yaml \
tsconfig.base.json \
.npmrc \
apps/api/package.json \
apps/api/tsconfig.json \
apps/api/src/index.ts \
apps/api/src/server.ts \
apps/web/package.json \
apps/web/tsconfig.json \
apps/web/tsconfig.node.json \
apps/web/vite.config.ts \
apps/web/index.html \
apps/web/src/main.tsx \
apps/web/src/App.tsx \
apps/web/src/app/store.ts \
packages/domain/package.json \
packages/domain/tsconfig.json \
packages/domain/src/index.ts \
packages/domain/src/entities/MediaAsset.ts \
packages/domain/src/entities/Album.ts \
packages/domain/src/entities/PendingGroup.ts \
packages/domain/src/entities/Person.ts \
packages/domain/src/entities/PublicationRecord.ts \
packages/domain/src/entities/StorageInstance.ts \
packages/domain/src/entities/AssetEvent.ts \
packages/domain/src/enums/MediaType.ts \
packages/domain/src/enums/PhotoState.ts \
packages/domain/src/enums/StorageRole.ts \
packages/domain/src/enums/AssetEventType.ts \
packages/domain/src/types/SearchSpec.ts \
packages/shared/package.json \
packages/shared/tsconfig.json \
packages/shared/src/index.ts \
packages/shared/src/api/health.ts \
packages/shared/src/util/assertNever.ts \
packages/media-metadata/package.json \
packages/media-metadata/tsconfig.json \
packages/media-metadata/src/index.ts \
packages/media-metadata/src/extractMetadata.ts \
packages/import-pipeline/package.json \
packages/import-pipeline/tsconfig.json \
packages/import-pipeline/src/index.ts \
packages/import-pipeline/src/hashFile.ts \
packages/import-pipeline/src/importAsset.ts \
docs/TEDOGRAPHY_ARCHITECTURE.md \
docs/TEDOGRAPHY_REPO_BOOTSTRAP.md \
scripts/bootstrap.sh
├── docs/
│   ├── TEDOGRAPHY_ARCHITECTURE.md
│   └── TEDOGRAPHY_REPO_BOOTSTRAP.md
└── scripts/
    └── bootstrap.sh
```

---

# 3. Workspace files

## 3.1 `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

## 3.2 `.npmrc`

```ini
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
```

This keeps the workspace simple at the start.

---

# 4. Root package.json

Create `tedography/package.json`:

```json
{
  "name": "tedography",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.6.1",
  "scripts": {
    "build": "pnpm -r build",
    "dev:web": "pnpm --filter @tedography/web dev",
    "dev:api": "pnpm --filter @tedography/api dev",
    "dev": "pnpm -r --parallel --filter @tedography/api --filter @tedography/web dev",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "typescript": "^5.7.3"
  }
}
```

Notes:

- `private: true` is required for a monorepo root.
- `packageManager` pins the intended pnpm version.
- `dev` runs both app dev servers in parallel.

---

# 5. Root TypeScript setup

## 5.1 `tsconfig.base.json`

Create `tedography/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@tedography/domain": ["packages/domain/src/index.ts"],
      "@tedography/shared": ["packages/shared/src/index.ts"],
      "@tedography/media-metadata": ["packages/media-metadata/src/index.ts"],
      "@tedography/import-pipeline": ["packages/import-pipeline/src/index.ts"]
    }
  }
}
```

This establishes:

- strict typing from day one
- project references compatibility
- path aliases for internal packages

---

# 6. Package package.json files

## 6.1 `packages/domain/package.json`

```json
{
  "name": "@tedography/domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  }
}
```

## 6.2 `packages/shared/package.json`

```json
{
  "name": "@tedography/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  }
}
```

## 6.3 `packages/media-metadata/package.json`

```json
{
  "name": "@tedography/media-metadata",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  }
}
```

## 6.4 `packages/import-pipeline/package.json`

```json
{
  "name": "@tedography/import-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  },
  "dependencies": {
    "@tedography/domain": "workspace:*",
    "@tedography/media-metadata": "workspace:*",
    "@tedography/shared": "workspace:*"
  }
}
```

## 6.5 `apps/api/package.json`

```json
{
  "name": "@tedography/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  },
  "dependencies": {
    "@tedography/domain": "workspace:*",
    "@tedography/import-pipeline": "workspace:*",
    "@tedography/shared": "workspace:*",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "mongoose": "^8.10.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "tsx": "^4.19.3"
  }
}
```

## 6.6 `apps/web/package.json`

```json
{
  "name": "@tedography/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build",
    "dev": "vite",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist",
    "lint": "echo 'lint not configured yet'"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "^7.0.1",
    "@mui/material": "^7.0.1",
    "@reduxjs/toolkit": "^2.6.1",
    "@tedography/domain": "workspace:*",
    "@tedography/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-redux": "^9.2.0",
    "react-router-dom": "^7.3.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^6.2.0"
  }
}
```

---

# 7. TypeScript config per workspace

## 7.1 Reusable package tsconfig pattern

For each package under `packages/*`, use this shape:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Use that for:

- `packages/domain/tsconfig.json`
- `packages/shared/tsconfig.json`
- `packages/media-metadata/tsconfig.json`
- `packages/import-pipeline/tsconfig.json`

## 7.2 `apps/api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"]
}
```

## 7.3 `apps/web/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

## 7.4 `apps/web/tsconfig.node.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

---

# 8. Minimal starter source files

These are not the full app, but they give the repo a bootable starting point.

## 8.1 `apps/api/src/index.ts`

```ts
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 4000);
const app = createServer();

app.listen(port, () => {
  console.log(`Tedography API listening on port ${port}`);
});
```

## 8.2 `apps/api/src/server.ts`

```ts
import cors from 'cors';
import express from 'express';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'tedography-api' });
  });

  return app;
}
```

## 8.3 `apps/web/src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './app/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

## 8.4 `apps/web/src/App.tsx`

```tsx
import { CssBaseline, Container, Typography } from '@mui/material';

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Tedography
        </Typography>
        <Typography>
          Repo bootstrap successful.
        </Typography>
      </Container>
    </>
  );
}
```

## 8.5 `apps/web/src/app/store.ts`

```ts
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {}
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## 8.6 `apps/web/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tedography</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## 8.7 `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
```

---

# 9. Initial domain model starter exports

The domain package should compile immediately, even if the types are still minimal.

## 9.1 `packages/domain/src/enums/PhotoState.ts`

```ts
export enum PhotoState {
  Unreviewed = 'Unreviewed',
  Pending = 'Pending',
  Select = 'Select',
  Reject = 'Reject'
}
```

## 9.2 `packages/domain/src/enums/MediaType.ts`

```ts
export enum MediaType {
  Photo = 'Photo',
  Video = 'Video'
}
```

## 9.3 `packages/domain/src/enums/StorageRole.ts`

```ts
export enum StorageRole {
  Primary = 'Primary',
  Backup = 'Backup',
  ImportSource = 'ImportSource',
  Quarantine = 'Quarantine'
}
```

## 9.4 `packages/domain/src/enums/AssetEventType.ts`

```ts
export enum AssetEventType {
  Import = 'Import',
  ReviewChange = 'ReviewChange',
  Publication = 'Publication',
  Reimport = 'Reimport',
  IntegrityRepair = 'IntegrityRepair'
}
```

## 9.5 `packages/domain/src/entities/MediaAsset.ts`

```ts
import { MediaType } from '../enums/MediaType';
import { PhotoState } from '../enums/PhotoState';

export interface MediaAsset {
  id: string;
  contentHash: string;
  mediaType: MediaType;
  captureDateTime?: string;
  photoState: PhotoState;
  pendingGroupId?: string;
  albumIds: string[];
  peopleIds: string[];
}
```

## 9.6 `packages/domain/src/entities/Album.ts`

```ts
export interface Album {
  id: string;
  name: string;
  parentAlbumId?: string;
}
```

## 9.7 `packages/domain/src/entities/PendingGroup.ts`

```ts
export interface PendingGroup {
  id: string;
  name: string;
  createdAt: string;
}
```

## 9.8 `packages/domain/src/entities/Person.ts`

```ts
export interface Person {
  id: string;
  name: string;
}
```

## 9.9 `packages/domain/src/entities/PublicationRecord.ts`

```ts
export interface PublicationRecord {
  id: string;
  assetId: string;
  service: string;
  serviceMediaId: string;
  exportDateTime: string;
  status: string;
}
```

## 9.10 `packages/domain/src/entities/StorageInstance.ts`

```ts
import { StorageRole } from '../enums/StorageRole';

export interface StorageInstance {
  id: string;
  assetId: string;
  role: StorageRole;
  path: string;
  verifiedAt?: string;
}
```

## 9.11 `packages/domain/src/entities/AssetEvent.ts`

```ts
import { AssetEventType } from '../enums/AssetEventType';

export interface AssetEvent {
  id: string;
  assetId: string;
  eventType: AssetEventType;
  eventDateTime: string;
  payload?: Record<string, unknown>;
}
```

## 9.12 `packages/domain/src/types/SearchSpec.ts`

```ts
import { PhotoState } from '../enums/PhotoState';

export interface SearchSpec {
  photoStates?: PhotoState[];
  albumIds?: string[];
  peopleIds?: string[];
  captureDateFrom?: string;
  captureDateTo?: string;
  published?: boolean;
}
```

## 9.13 `packages/domain/src/index.ts`

```ts
export * from './entities/Album';
export * from './entities/AssetEvent';
export * from './entities/MediaAsset';
export * from './entities/PendingGroup';
export * from './entities/Person';
export * from './entities/PublicationRecord';
export * from './entities/StorageInstance';
export * from './enums/AssetEventType';
export * from './enums/MediaType';
export * from './enums/PhotoState';
export * from './enums/StorageRole';
export * from './types/SearchSpec';
```

---

# 10. Shared package starter files

## 10.1 `packages/shared/src/api/health.ts`

```ts
export interface HealthResponse {
  ok: boolean;
  service: string;
}
```

## 10.2 `packages/shared/src/util/assertNever.ts`

```ts
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

## 10.3 `packages/shared/src/index.ts`

```ts
export * from './api/health';
export * from './util/assertNever';
```

---

# 11. Media metadata and import pipeline starter files

## 11.1 `packages/media-metadata/src/extractMetadata.ts`

```ts
export interface ExtractedMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  captureDateTime?: string;
}

export async function extractMetadata(_filePath: string): Promise<ExtractedMetadata> {
  return {};
}
```

## 11.2 `packages/media-metadata/src/index.ts`

```ts
export * from './extractMetadata';
```

## 11.3 `packages/import-pipeline/src/hashFile.ts`

```ts
export async function hashFile(_filePath: string): Promise<string> {
  return 'TODO_HASH';
}
```

## 11.4 `packages/import-pipeline/src/importAsset.ts`

```ts
export async function importAsset(_filePath: string): Promise<void> {
  // placeholder
}
```

## 11.5 `packages/import-pipeline/src/index.ts`

```ts
export * from './hashFile';
export * from './importAsset';
```

---

# 12. Suggested .gitignore

Create `tedography/.gitignore`:

```gitignore
node_modules
.pnpm-store
.DS_Store
.env
.env.*
dist
coverage
.vite
*.log
```

---

# 13. Optional bootstrap shell script

Create `scripts/bootstrap.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

pnpm install
pnpm build
```

Then make it executable:

```bash
chmod +x scripts/bootstrap.sh
```

---

# 14. First commands to run

From the parent directory:

```bash
cd /Users/tedshaffer/Documents/Projects
mkdir -p tedography
cd tedography
```

If you have not initialized git yet:

```bash
git init
```

If pnpm is not already available:

```bash
npm install -g pnpm
```

Then install dependencies:

```bash
pnpm install
```

Build everything once:

```bash
pnpm build
```

Run the API:

```bash
pnpm dev:api
```

In a second terminal, run the web app:

```bash
cd /Users/tedshaffer/Documents/Projects/tedography
pnpm dev:web
```
```

At that point:

- API should respond at `http://localhost:4000/api/health`
- web app should load at `http://localhost:5173`

---

# 15. Recommended first implementation sequence after bootstrap

After the repo is up, the next implementation order should be:

1. flesh out `packages/domain`
2. add Mongo connection scaffolding to `apps/api`
3. add first collection models and repository layer
4. add Review page shell in `apps/web`
5. add Library page shell
6. add shared API client layer in `packages/shared`
7. add real metadata extraction in `packages/media-metadata`
8. add first real import flow in `packages/import-pipeline`

---

# 16. One implementation note

Your broader preference elsewhere has often been npm, but this architecture explicitly defines a **pnpm monorepo**, so this bootstrap follows that architecture as requested.

