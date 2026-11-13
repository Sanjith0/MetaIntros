// Serves the Expo web export (dist/) and forwards /api and /images to the Queue Up server,
// the same way vercel.json does on Vercel. Usage: QUEUEUP_URL=http://localhost:3000 node scripts/preview.mjs
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const backend = new URL(process.env.QUEUEUP_URL ?? 'http://localhost:3000');
const port = Number(process.env.PORT ?? 8081);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.task': 'application/octet-stream' };

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/images/')) {
    const up = http.request({ hostname: backend.hostname, port: backend.port || 80, path: req.url, method: req.method, headers: { ...req.headers, host: backend.host } }, r => {
      res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502); res.end('Queue Up server unreachable'); });
    req.pipe(up);
    return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(root, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(port, () => console.log(`Preview on http://localhost:${port} → Queue Up at ${backend.origin}`));
