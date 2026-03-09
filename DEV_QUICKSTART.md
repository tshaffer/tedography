# Tedography — Developer Quickstart

This guide helps you get a fresh clone of Tedography running in a few minutes.

---

## 1. Prerequisites

Install the following tools:

- Node.js (v20+ recommended)
- pnpm (v10+)
- Git

Install pnpm globally if needed:

```
npm install -g pnpm
```

---

## 2. Clone the Repository

```
git clone <repo-url>
cd tedography
```

---

## 3. Install Dependencies

From the repository root:

```
pnpm install
```

This installs dependencies for all workspace packages.

---

## 4. Verify TypeScript Builds

Run a full workspace typecheck:

```
pnpm -r typecheck
```

All packages should pass without errors.

---

## 5. Start the Web App

```
pnpm --filter @tedography/web dev
```

Open:

```
http://localhost:3000
```

---

## 6. Start the API Server

In another terminal:

```
pnpm --filter @tedography/api dev
```

The API will start in development mode using `tsx`.

---

## 7. Useful Commands

Install dependencies:

```
pnpm install
```

Run type checking across the repo:

```
pnpm -r typecheck
```

Start web dev server:

```
pnpm --filter @tedography/web dev
```

Start API dev server:

```
pnpm --filter @tedography/api dev
```

Clean build outputs:

```
pnpm -r clean
```

---

## 8. Repository Layout

Key directories:

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

---

## 9. Development Workflow

Typical loop:

1. Start API server
2. Start web dev server
3. Implement changes
4. Run:

```
pnpm -r typecheck
```

5. Commit changes

---

## 10. Troubleshooting

If dependencies behave strangely:

```
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

If TypeScript errors appear across packages:

```
pnpm -r typecheck
```

---

For architecture details see:

```
docs/TEDOGRAPHY_ARCHITECTURE.md
```
