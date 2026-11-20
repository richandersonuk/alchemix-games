// ─────────────────────────────────────────────────────────────────────────────
// Lattice Lock scoreboard server — zero dependencies (Node ≥ 18).
//
//   GET    /api/health
//   GET    /api/scores?limit=20          → { scores: ScoreEntry[] }
//   POST   /api/scores                    { name, runId, summary } → { ok, rank, entry }
//   DELETE /api/scores/:id                (Authorization: Bearer $ADMIN_TOKEN) moderation
//
// Also serves the built game from ../dist so one process can host everything.
//
// Env: PORT (8787) · HOST (0.0.0.0) · DATA_DIR (server/data) · ALLOWED_ORIGINS (comma list, default *)
//      ADMIN_TOKEN (enables DELETE) · TRUST_PROXY=1 (use X-Forwarded-For for rate limits)
//      SERVE_STATIC=0 (disable static hosting)
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs, existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkName } from '../shared/nameFilter.js';
import { computeScore, validateSummary } from '../shared/scoring.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(HERE, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const DIST = path.resolve(HERE, '..', 'dist');
const SERVE_STATIC = process.env.SERVE_STATIC !== '0' && existsSync(DIST);
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const MAX_ENTRIES = 1000;
const MAX_BODY = 4096;
const POST_LIMIT = { windowMs: 60_000, max: 5 };
const GET_LIMIT = { windowMs: 60_000, max: 120 };

// ── Storage ─────────────────────────────────────────────────────────────────

/** @type {{ id: string, runId: string, name: string, score: number, wavesCleared: number, marks: number, victory: boolean, date: string }[]} */
let scores = [];
const seenRuns = new Set();
let writeTimer = null;

async function load() {
  try {
    const raw = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      // Re-filter on load so tightening the filter also cleans old entries
      scores = raw.filter((e) => e && typeof e.name === 'string' && checkName(e.name).ok && Number.isFinite(e.score));
      scores.sort(byScore);
      scores.forEach((e) => seenRuns.add(e.runId));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[scoreboard] could not read data file:', err.message);
  }
}

function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(scores));
      await fs.rename(tmp, DATA_FILE);
    } catch (err) {
      console.error('[scoreboard] write failed:', err.message);
    }
  }, 250);
}

const byScore = (a, b) => b.score - a.score || a.date.localeCompare(b.date);
const publicEntry = ({ id, name, score, wavesCleared, marks, victory, date }) => ({ id, name, score, wavesCleared, marks, victory, date });

// ── Rate limiting (in-memory, per IP) ───────────────────────────────────────

const buckets = new Map();
function limited(ip, kind, { windowMs, max }) {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  return arr.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) if (!arr.some((t) => now - t < 60_000)) buckets.delete(k);
}, 60_000).unref();

function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function adminOk(req) {
  if (!ADMIN_TOKEN) return false;
  const h = req.headers.authorization ?? '';
  const given = Buffer.from(h.replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
}

// ── Routes ──────────────────────────────────────────────────────────────────

async function handleApi(req, res, url) {
  const ip = clientIp(req);

  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, entries: scores.length });

  if (url.pathname === '/api/scores' && req.method === 'GET') {
    if (limited(ip, 'get', GET_LIMIT)) return json(res, 429, { ok: false, error: 'rate' });
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    return json(res, 200, { scores: scores.slice(0, limit).map(publicEntry) });
  }

  if (url.pathname === '/api/scores' && req.method === 'POST') {
    if (!/^application\/json/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { ok: false, error: 'invalid' });
    if (limited(ip, 'post', POST_LIMIT)) return json(res, 429, { ok: false, error: 'rate' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (err) {
      return json(res, err.status ?? 400, { ok: false, error: 'invalid' });
    }
    const runId = typeof body?.runId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.runId) ? body.runId : null;
    if (!runId) return json(res, 400, { ok: false, error: 'invalid' });
    if (seenRuns.has(runId)) return json(res, 409, { ok: false, error: 'duplicate' });

    const nameCheck = checkName(body.name);
    // Deliberately generic: never reveal which rule a name tripped
    if (!nameCheck.ok) return json(res, 422, { ok: false, error: nameCheck.reason === 'blocked' ? 'name' : nameCheck.reason });

    const sv = validateSummary(body.summary);
    if (!sv.ok) return json(res, 400, { ok: false, error: 'invalid' });

    const entry = {
      id: randomUUID(),
      runId,
      name: nameCheck.name,
      score: computeScore(sv.summary),
      wavesCleared: sv.summary.wavesCleared,
      marks: sv.summary.marks,
      victory: sv.summary.victory,
      date: new Date().toISOString(),
    };
    seenRuns.add(runId);
    scores.push(entry);
    scores.sort(byScore);
    const rank = scores.indexOf(entry) + 1;
    if (scores.length > MAX_ENTRIES) scores.length = MAX_ENTRIES;
    persist();
    return json(res, 201, { ok: true, rank: rank <= MAX_ENTRIES ? rank : null, entry: publicEntry(entry) });
  }

  const del = url.pathname.match(/^\/api\/scores\/([0-9a-f-]{36})$/);
  if (del && req.method === 'DELETE') {
    if (!adminOk(req)) return json(res, 401, { ok: false, error: 'auth' });
    const before = scores.length;
    scores = scores.filter((e) => e.id !== del[1]);
    if (scores.length === before) return json(res, 404, { ok: false, error: 'missing' });
    persist();
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: 'missing' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

async function handleStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(DIST, '.' + rel);
  if (!file.startsWith(DIST + path.sep)) return json(res, 403, { ok: false });
  let target = file;
  try {
    const st = await fs.stat(target);
    if (!st.isFile()) throw new Error('not file');
  } catch {
    target = path.join(DIST, 'index.html'); // SPA fallback
  }
  const ext = path.extname(target);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      cors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      return await handleApi(req, res, url);
    }
    if (SERVE_STATIC && (req.method === 'GET' || req.method === 'HEAD')) return await handleStatic(req, res, url);
    json(res, 404, { ok: false, error: 'missing' });
  } catch (err) {
    console.error('[scoreboard] error:', err);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'server' });
  }
});

await load();
server.listen(PORT, HOST, () => {
  console.log(`[scoreboard] listening on http://${HOST}:${PORT} · ${scores.length} entries · static ${SERVE_STATIC ? 'on' : 'off'}`);
});
