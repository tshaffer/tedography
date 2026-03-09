# Tedography Debugging

## Backend (API)
1. Open VS Code Run and Debug.
2. Select `Debug Tedography API`.
3. Start debugging.

This runs a prelaunch build (`pnpm --filter @tedography/api build`) and then launches `apps/api/dist/index.js`
with source maps enabled. This keeps breakpoints stable across repeated requests.
If you stop it from the terminal with `Ctrl+C`, Node may print `Waiting for the debugger to disconnect...`.
Stop with VS Code `Shift+F5` (or disconnect the debugger) to end cleanly.

## Frontend (Web)
1. Open VS Code Run and Debug.
2. Select `Debug Tedography Web`.
3. Start debugging.

This opens Chrome at `http://localhost:3000`.

## Full stack
1. Select `Debug Tedography Full Stack`.
2. Start debugging to launch both API and Web debug configs.

## Breakpoints
- Backend: place breakpoints in `apps/api/src/*.ts`.
- Frontend: place breakpoints in `apps/web/src/*` (`.ts`/`.tsx`).

## Health check
- Open `http://localhost:3000` for the frontend.
- Verify API health through the proxied route at `http://localhost:3000/api/health`.
- Direct API endpoint is `http://localhost:4000/api/health`.
