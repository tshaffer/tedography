import type { HelpTopic } from '../types.js';

export const runningOnTheNetwork: HelpTopic = {
  slug: 'running-on-the-network',
  title: 'Running on the Local Network',
  category: 'Admin',
  order: 3,
  keywords: ['LAN', 'network', 'localhost', 'other device', 'phone', 'tablet', 'ipad', 'iphone', 'dev server', 'remote access'],
  body: `By default you run Tedography on the same Mac as the server and browse to \`localhost:3000\`. The dev server also accepts connections from other devices on the same local network — useful for checking a photo on a phone or tablet, or browsing from another computer without copying the repo there.

**Setup (already done in this repo):** \`apps/web/webpack.config.js\` binds the dev server to \`host: '0.0.0.0'\` (all network interfaces, not just localhost) and sets \`allowedHosts: 'all'\` so it accepts requests carrying a LAN IP as the Host header. Its \`/api\`, \`/media\`, and \`/import-media\` proxy still points at \`http://localhost:4000\`, so the API server only needs to be reachable from the Mac itself — proxying happens inside webpack-dev-server, not in the browser.

**To connect from another device:**

1. Run \`pnpm dev\` on the Mac as usual (or \`pnpm dev:web\` + \`pnpm dev:api\`) — keep it running.
2. Find the Mac's LAN IP: \`ipconfig getifaddr en0\` (Wi-Fi) in Terminal, or System Settings → Network.
3. On the other device — same Wi-Fi network — browse to \`http://<mac-lan-ip>:3000\`.

The Mac's firewall may prompt to allow incoming connections the first time; allow it. This only works while \`pnpm dev\` is running on the Mac and both devices are on the same network — it's not a way to access Tedography over the internet.`,
};
