# Tedography — Architecture Decisions (ADR Log)

This document records important architectural decisions for the Tedography project.
Each entry briefly captures the context, the decision made, and the reasoning.

ADR entries help future maintainers (including the original author) understand
why certain choices were made.

---

## ADR‑0001 — Use a pnpm Monorepo

Status: Accepted

Context:
Tedography consists of multiple related components (web UI, API, shared libraries,
domain model, metadata extraction, and import pipeline). Managing them as separate
repositories would create friction and duplication.

Decision:
Use a **pnpm workspace monorepo** to host all applications and packages.

Consequences:
- Easy local linking of internal packages
- Shared dependency management
- Single lockfile
- Simplified refactoring across packages

---

## ADR‑0002 — Separate Domain Model Package

Status: Accepted

Context:
The core entities (MediaAsset, Album, PendingGroup, etc.) define the canonical data
model for the system. These structures must be shared across the API and frontend.

Decision:
Create a dedicated package:

packages/domain

Consequences:
- Single source of truth for core entities
- Type safety across API and frontend
- Cleaner architecture boundaries

---

## ADR‑0003 — Local Media Storage

Status: Accepted

Context:
Tedography is designed as a long‑term personal photo archive. Relying on external
cloud providers for canonical storage introduces risk and reduces control.

Decision:
Media files are stored **locally on user‑controlled storage**.

The database stores only metadata and references.

Consequences:
- Full ownership of the archive
- Offline operation possible
- Backend must generate URLs for media access

---

## ADR‑0004 — Node ESM + TypeScript NodeNext

Status: Accepted

Context:
Modern Node.js supports native ECMAScript modules. Aligning with the standard
ESM ecosystem improves long‑term compatibility.

Decision:
Use:

- `"type": "module"` in package.json
- `"module": "NodeNext"`
- `"moduleResolution": "NodeNext"`

Relative imports must include `.js` extensions.

Consequences:
- ESM‑compatible builds
- Consistency between runtime and TypeScript
- Slightly stricter import syntax

---

## ADR‑0005 — Webpack for the Web Application

Status: Accepted

Context:
Tedography requires a predictable, fully controlled build system. Webpack remains
stable, flexible, and widely supported for complex frontend builds.

Decision:
Use **webpack** instead of Vite or other dev servers for the web application.

Consequences:
- More configuration, but full control
- Stable integration with TypeScript and React
- Familiar tooling ecosystem

---

## ADR‑0006 — MongoDB for Metadata Persistence

Status: Accepted

Context:
Tedography stores flexible metadata describing media assets. The schema may evolve
as the system gains features such as people recognition or AI tagging.

Decision:
Use **MongoDB** for persistence.

Consequences:
- Flexible document schema
- Natural fit for metadata
- Easy expansion of asset metadata over time

---

End of Architecture Decision Log
