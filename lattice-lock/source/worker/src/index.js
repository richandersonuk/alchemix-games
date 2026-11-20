// ─────────────────────────────────────────────────────────────────────────────
// Lattice Lock scoreboard — Cloudflare Worker + D1.
// Same API and rules as server/index.mjs (shared filter + scoring modules):
//
//   GET    /api/health
//   GET    /api/scores?limit=20          → { scores }
//   POST   /api/scores                    { name, runId, summary } → { ok, rank, entry }
//   DELETE /api/scores/:id                Authorization: Bearer $ADMIN_TOKEN
// ─────────────────────────────────────────────────────────────────────────────

import { checkName } from '../../shared/nameFilter.js';
import { computeScore, validateSummary } from '../../shared/scoring.js';

const MAX_BODY = 4096;
const POST_LIMIT = { windowMs: 60_000, max: 5 };
const KEEP_TOP = 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env, url);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (err) {
      console.error('scoreboard error', err);
      return json({ ok: false, error: 'server' }, 500, cors);
    }
  },
};

async function route(request, env, url) {
  const { pathname } = url;

  if (pathname === '/api/health' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores').first();
    return json({ ok: true, entries: row?.n ?? 0 });
  }

  if (pathname === '/api/scores' && request.method === 'GET') {
    const limit = clamp(Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 1, 100);
    const { results } = await env.DB.prepare(
      'SELECT id, name, score, waves_cleared, marks, victory, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?',
    )
      .bind(limit)
      .all();
    // Re-filter on read, so tightening the filter also hides older entries
    const scores = results.filter((r) => checkName(r.name).ok).map(publicEntry);
    return json({ scores }, 200, { 'Cache-Control': 'public, max-age=15' });
  }

  if (pathname === '/api/scores' && request.method === 'POST') return submit(request, env);

  const del = pathname.match(/^\/api\/scores\/([0-9a-f-]{36})$/);
  if (del && request.method === 'DELETE') {
    if (!(await adminOk(request, env))) return json({ ok: false, error: 'auth' }, 401);
    const r = await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(del[1]).run();
    return r.meta.changes ? json({ ok: true }) : json({ ok: false, error: 'missing' }, 404);
  }

  return json({ ok: false, error: 'missing' }, 404);
}

async function submit(request, env) {
  if (!/^application\/json/i.test(request.headers.get('content-type') ?? '')) return json({ ok: false, error: 'invalid' }, 415);

  // Rate limit per (hashed) IP
  const ipHash = await hashIp(request.headers.get('cf-connecting-ip') ?? 'unknown');
  const now = Date.now();
  await env.DB.prepare('DELETE FROM submissions WHERE at < ?').bind(now - 3_600_000).run();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND at > ?')
    .bind(ipHash, now - POST_LIMIT.windowMs)
    .first();
  await env.DB.prepare('INSERT INTO submissions (ip_hash, at) VALUES (?, ?)').bind(ipHash, now).run();
  if ((recent?.n ?? 0) >= POST_LIMIT.max) return json({ ok: false, error: 'rate' }, 429);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'invalid' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  const runId = typeof body?.runId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.runId) ? body.runId : null;
  if (!runId) return json({ ok: false, error: 'invalid' }, 400);

  const nameCheck = checkName(body.name);
  // Deliberately generic: never reveal which rule a name tripped
  if (!nameCheck.ok) return json({ ok: false, error: nameCheck.reason === 'blocked' ? 'name' : nameCheck.reason }, 422);

  const sv = validateSummary(body.summary);
  if (!sv.ok) return json({ ok: false, error: 'invalid' }, 400);

  const entry = {
    id: crypto.randomUUID(),
    name: nameCheck.name,
    score: computeScore(sv.summary),
    wavesCleared: sv.summary.wavesCleared,
    marks: sv.summary.marks,
    victory: sv.summary.victory,
    date: new Date().toISOString(),
  };
  try {
    await env.DB.prepare(
      'INSERT INTO scores (id, run_id, name, score, waves_cleared, marks, victory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(entry.id, runId, entry.name, entry.score, entry.wavesCleared, entry.marks, entry.victory ? 1 : 0, entry.date)
      .run();
  } catch (err) {
    if (String(err).includes('UNIQUE')) return json({ ok: false, error: 'duplicate' }, 409);
    throw err;
  }

  const higher = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND created_at < ?)')
    .bind(entry.score, entry.score, entry.date)
    .first();
  const rank = (higher?.n ?? 0) + 1;

  // Keep the table bounded
  await env.DB.prepare(
    `DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, created_at ASC LIMIT ${KEEP_TOP})`,
  ).run();

  return json({ ok: true, rank: rank <= KEEP_TOP ? rank : null, entry }, 201);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function publicEntry(r) {
  return {
    id: r.id,
    name: r.name,
    score: r.score,
    wavesCleared: r.waves_cleared,
    marks: r.marks,
    victory: !!r.victory,
    date: r.created_at,
  };
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (allowed.includes('*')) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

async function hashIp(ip) {
  // Daily-rotating salt: enough to rate-limit, useless for tracking anyone
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`lattice-lock:${day}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function adminOk(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_TOKEN)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
