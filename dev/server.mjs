// Yerel geliştirme/test sunucusu: Worker'ı Node'da çalıştırır. D1 yerine node:sqlite, ASSETS yerine public/ klasörü.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import worker from '../src/worker.js';

const DBFILE = process.env.DBFILE || ':memory:';
const db = new DatabaseSync(DBFILE);
const clean = a => a.map(v => v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
function stmt(sql, params = []) {
  return {
    bind: (...p) => stmt(sql, clean(p)),
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    first: async col => { const r = db.prepare(sql).get(...params); return r === undefined ? null : (col ? r[col] : r); },
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
    _raw: () => db.prepare(sql).run(...params)
  };
}
const DB = {
  prepare: sql => stmt(sql),
  batch: async list => { db.exec('BEGIN'); try { const out = list.map(s => s._raw()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  exec: async sql => { db.exec(sql); return { count: 1 }; }
};
const PUB = path.resolve(new URL('../public', import.meta.url).pathname);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const ASSETS = { fetch: async req => {
  let p = decodeURIComponent(new URL(req.url).pathname); if (p === '/') p = '/index.html';
  const f = path.join(PUB, p); if (!f.startsWith(PUB)) return new Response('no', { status: 403 });
  try { return new Response(await readFile(f), { headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); }
  catch { return new Response(await readFile(path.join(PUB, 'index.html')), { headers: { 'content-type': TYPES['.html'] } }); }
} };
const env = { DB, ASSETS, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '', ANTHROPIC_BASE: process.env.ANTHROPIC_BASE || undefined };
const port = Number(process.env.PORT || 8787);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = new Request('http://localhost:' + port + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, env);
  const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
  res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log('Paramotor yerel: http://localhost:' + port));
