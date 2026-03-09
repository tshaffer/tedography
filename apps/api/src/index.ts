import { createServer } from './server.js';

const app = createServer();
const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`[src] Tedography API running on http://localhost:${port}`);
});

void server;