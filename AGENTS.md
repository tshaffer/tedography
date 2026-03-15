# Tedography — Agent Instructions

This repository contains **Tedography**, a personal photo archive and curation system.

Agents operating on this repository should follow the rules and architecture described below.
This document helps automated coding agents (Codex, etc.) understand how to safely modify the codebase.

---

# 1. Project Overview

Tedography is a personal photo management system designed for:

- efficient photo curation
- high‑quality viewing
- long‑term archival management
- flexible organization
- future AI‑assisted search

Primary workflow:

Import → Review → Keep / Pending / Discard → Organize → Browse later

Tedography assumes media lives in **locally controlled storage**. Cloud services may be used as **publication targets**, but not as canonical storage.

---

# 2. Repository Structure

Tedography is implemented as a **pnpm monorepo**.

tedography/
├── apps/
│   ├── web
│   └── api
│
├── packages/
│   ├── domain
│   ├── shared
│   ├── media-metadata
│   └── import-pipeline
│
├── docs/
├── scripts/
├── pnpm-workspace.yaml
└── tsconfig.base.json

### apps/web

React frontend.

Technologies:
- React
- Redux Toolkit
- Material UI
- Webpack
- TypeScript

Responsibilities:
- Review UI
- Library browsing
- Albums
- Search
- Viewer modes (Grid / Loupe / Survey / Fullscreen)

### apps/api

Express backend.

Responsibilities:
- REST API
- MongoDB access
- asset queries
- review state transitions
- import pipeline orchestration
- serving media URLs

### packages/domain

The **core domain model**.

Defines canonical types such as:
- MediaAsset
- Album
- PendingGroup
- Person
- PublicationRecord
- StorageInstance
- AssetEvent

The domain package should remain **pure and dependency‑light**.

### packages/shared

Shared utilities and common code.

Examples:
- utility functions
- shared types
- API request/response shapes

### packages/media-metadata

Handles media metadata extraction such as:
- EXIF extraction
- image dimensions
- MIME type detection
- camera metadata

### packages/import-pipeline

Handles the import pipeline:
- file hashing
- duplicate detection
- metadata extraction
- asset creation
- reimport logic

---

# 3. Dependency Rules

Internal package dependency direction must follow this graph:

domain
   ↑
shared
   ↑
media-metadata
   ↑
import-pipeline
   ↑
api

The web app may depend on:

domain
shared

Rules:

- `domain` must not depend on other internal packages.
- Avoid circular dependencies.
- Prefer placing shared logic in `shared`.

---

# 4. TypeScript Configuration

Tedography uses **project references** and a shared base configuration.

Root configuration:
tsconfig.base.json

Buildable packages use:

module: NodeNext
moduleResolution: NodeNext

Therefore:

All **relative imports must include `.js` extensions**.

Example:

import { PhotoState } from "../enums/PhotoState.js"

Agents must **not remove these extensions**.

Do not change TypeScript configuration to avoid this rule.

---

# 5. Build System

Package manager:

pnpm

Install dependencies:

pnpm install

Run recursive typecheck:

pnpm -r typecheck

Start web development server:

pnpm --filter @tedography/web dev

Start API server:

pnpm --filter @tedography/api dev

---

# 6. Coding Guidelines

### TypeScript

- Use strict typing
- Avoid `any`
- Prefer interfaces and explicit types

### Imports

Prefer workspace imports:

import { MediaAsset } from "@tedography/domain"

Relative imports are acceptable **within the same package only**.

### Side Effects

Packages should be side‑effect free where possible.

---

# 7. Domain Model Principles

The domain model defines canonical system entities.

Key entity: **MediaAsset**

Properties include:

- id
- contentHash
- mediaType
- captureDateTime
- photoState
- pendingGroupId
- albumIds
- peopleIds

### PhotoState values

- New
- Pending
- Keep
- Discard

### Albums

Albums form a hierarchical tree.

Assets belong only to **leaf albums**.

---

# 8. Review Workflow

Review is the core workflow.

States:

New → Pending → Keep → Discard

Agents should not rename these states without updating:

- domain enums
- API logic
- UI logic

---

# 9. Media Storage

Media files are **not stored in MongoDB**.

MongoDB stores metadata only.

Media files reside on **local storage drives**.

The backend exposes media via generated URLs rather than raw filesystem paths.

---

# 10. MongoDB Collections

Expected collections:

- mediaAssets
- albums
- people
- pendingGroups
- publicationRecords
- storageInstances
- assetEvents

Agents should avoid renaming these collections.

---

# 11. AI Agent Behavior Guidelines

When modifying code:

- prefer small, focused patches
- avoid unnecessary refactors
- preserve architecture boundaries
- maintain dependency graph rules

Before large changes:

- inspect relevant files
- understand package boundaries
- check TypeScript project references

After changes:

pnpm -r typecheck

must succeed.

---

# 12. Documentation

Architecture documentation:

docs/TEDOGRAPHY_ARCHITECTURE.md

Agents should consult this document before implementing features.

---

# 13. Future Capabilities

The architecture is designed to support future enhancements:

- AI‑based search
- face recognition pipelines
- slideshow presentation mode
- advanced annotations
- video editing support

Agents should avoid architectural changes that would make these difficult to add.

---

End of Agent Instructions
