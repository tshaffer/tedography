# Tedography — Contributing Guidelines

This document describes the standards and workflow for contributing to the Tedography repository.

Even though Tedography is primarily a single‑maintainer project, these guidelines help ensure that:
- changes remain consistent
- automated agents (Codex, etc.) behave predictably
- the architecture remains stable over time

---

# 1. Core Principles

When contributing to Tedography:

1. Prefer **small, focused changes**
2. Preserve the **architecture boundaries**
3. Avoid unnecessary refactoring
4. Keep the **domain model clean and stable**
5. Ensure the repository **typechecks successfully** before committing

Always run:

```
pnpm -r typecheck
```

before committing code.

---

# 2. Repository Architecture

Tedography is a **pnpm monorepo**.

High‑level structure:

```
apps/
  web/   → React frontend
  api/   → Express backend

packages/
  domain/          → Core data model
  shared/          → Shared utilities
  media-metadata/  → Metadata extraction
  import-pipeline/ → Import orchestration
```

Dependency direction must follow:

```
domain
   ↑
shared
   ↑
media-metadata
   ↑
import-pipeline
   ↑
api
```

The **web app** may depend on:

```
domain
shared
```

Do not introduce circular dependencies between packages.

---

# 3. TypeScript Standards

Tedography uses strict TypeScript settings.

Guidelines:

- Avoid `any`
- Prefer explicit interfaces or types
- Keep domain entities strongly typed
- Maintain strict null safety

Node-based packages use:

```
module: NodeNext
moduleResolution: NodeNext
```

Therefore **relative imports must include `.js` extensions**.

Example:

```
import { PhotoState } from "../enums/PhotoState.js"
```

Do not remove `.js` extensions from relative imports.

---

# 4. Import Guidelines

Preferred imports:

```
import { MediaAsset } from "@tedography/domain"
```

Relative imports should only be used **within the same package**.

Example:

```
import { PhotoState } from "../enums/PhotoState.js"
```

---

# 5. Domain Model Rules

The `packages/domain` package defines the canonical data model.

It should:

- remain dependency-light
- avoid runtime logic where possible
- define core entities and enums

Key entities:

- MediaAsset
- Album
- PendingGroup
- Person
- PublicationRecord
- StorageInstance
- AssetEvent

Changes to domain entities should be made carefully because they affect:

- database schema
- API contracts
- UI behavior

---

# 6. Code Style

General style guidelines:

- use descriptive variable names
- prefer immutability
- avoid deeply nested logic
- keep functions small and focused

Formatting is handled by editor configuration.

---

# 7. Commit Guidelines

Write clear commit messages.

Recommended format:

```
type(scope): short description
```

Examples:

```
feat(domain): add PendingGroup entity
fix(api): correct asset query filter
refactor(import): simplify hashing pipeline
```

Common commit types:

| Type | Meaning |
|-----|------|
| feat | new feature |
| fix | bug fix |
| refactor | internal code improvement |
| docs | documentation |
| chore | maintenance |

---

# 8. Development Workflow

Typical workflow:

1. Pull latest changes
2. Create a branch
3. Implement change
4. Run:

```
pnpm -r typecheck
```

5. Commit changes
6. Merge

---

# 9. Working With AI Agents

Tedography uses AI-assisted development tools.

When modifying the repository:

- prefer incremental changes
- verify changes compile
- maintain package boundaries

Agents should consult:

```
AGENTS.md
REPO_MAP.md
docs/TEDOGRAPHY_ARCHITECTURE.md
```

before making major changes.

---

# 10. Testing (Future)

Formal automated testing will be added later.

Expected areas for tests:

- domain logic
- import pipeline
- metadata extraction
- API endpoints

---

# 11. Documentation

Important documentation files:

```
DEV_QUICKSTART.md
REPO_MAP.md
AGENTS.md
docs/TEDOGRAPHY_ARCHITECTURE.md
```

Documentation updates should accompany architectural changes.

---

# 12. Long-Term Philosophy

Tedography is intended to be a **long-lived personal archive system**.

Code should prioritize:

- clarity
- maintainability
- architectural stability
- correctness over cleverness

Avoid introducing complexity that makes the system harder to maintain over time.

---

End of Contributing Guidelines
