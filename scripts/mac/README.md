# macOS launcher apps

Source for small local `.app` launchers used on macOS. These aren't part of the
web/api build — they're compiled once per machine into `/Applications` and
double-clicked from Finder or the Dock.

## Tedography Presentation

Opens `/present` as a standalone, chrome-less Chrome window (no tabs, no
address bar) for dragging onto an external monitor/TV. See
`Docs/TEDOGRAPHY_USER_MANUAL.md` §3.8 Presentation Mode for how the feature
itself works.

Build (or rebuild) it with:

```bash
osacompile -o "/Applications/Tedography Presentation.app" scripts/mac/tedography-presentation.applescript
```

Requires `pnpm dev` running first (the launcher just opens the URL — it
doesn't start the server).
