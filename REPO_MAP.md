# Tedography Repository Map

This document provides a high-level map of the Tedography repository to help developers and AI agents quickly understand the structure and purpose of major components.

Repository root:

tedography/
├── AGENTS.md
├── REPO_MAP.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .npmrc
│
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.tsx          # React entry point
│   │       └── App.tsx           # Root React component
│   │
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # API server entry point
│           └── server.ts         # Express app setup
│
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
│   │
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/
│   │       │   └── health.ts
│   │       └── util/
│   │           └── assertNever.ts
│   │
│   ├── media-metadata/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── extractMetadata.ts
│   │
│   └── import-pipeline/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── hashFile.ts
│           └── importAsset.ts
│
├── docs/
│   └── TEDOGRAPHY_ARCHITECTURE.md
│
└── scripts/
    └── bootstrap.sh

Key Concepts:

1. apps/web
The React frontend for browsing, reviewing, and organizing photos.

2. apps/api
The backend service responsible for data persistence, media serving, and orchestration of the import pipeline.

3. packages/domain
The canonical data model for Tedography. This package defines entities, enums, and core types.

4. packages/shared
Reusable utilities and shared code used across applications and packages.

5. packages/media-metadata
Responsible for extracting metadata from image and video files.

6. packages/import-pipeline
Handles ingesting media files, computing hashes, detecting duplicates, and creating MediaAsset records.

Dependency Direction:

domain
   ↑
shared
   ↑
media-metadata
   ↑
import-pipeline
   ↑
api

web may depend on:
domain
shared

Guidelines:

- Avoid circular dependencies between packages.
- Keep domain free of external dependencies where possible.
- Relative imports inside NodeNext packages must include `.js` extensions.
