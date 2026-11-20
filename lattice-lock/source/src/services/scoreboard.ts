import { checkName } from '../../shared/nameFilter.js';
import { computeScore, type RunSummary } from '../../shared/scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
// Online scoreboard client with an on-device fallback.
// The server re-validates the name and recomputes the score; the client-side
// filter only gives instant feedback.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  wavesCleared: number;
  marks: number;
  victory: boolean;
  date: string;
}

export type SubmitError = 'name' | 'length' | 'charset' | 'invalid' | 'duplicate' | 'rate' | 'offline';
export type SubmitResult = { ok: true; rank: number | null; entry: ScoreEntry; online: boolean } | { ok: false; error: SubmitError };

const BASE = (import.meta.env.VITE_SCOREBOARD_URL ?? '').replace(/\/+$/, '');
const API = `${BASE}/api`;
const LOCAL_KEY = 'lattice-lock:local-scores:v1';
const LAST_NAME_KEY = 'lattice-lock:last-name';

async function request(path: string, init?: RequestInit, timeoutMs = 7000) {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(`${API}${path}`, { ...init, signal: ctl.signal, credentials: 'omit' });
  } finally {
    window.clearTimeout(t);
  }
}

/** Thrown when there is no scoreboard server at the configured address (e.g. static hosting only). */
export class ScoreboardNotConfigured extends Error {}

export async function fetchGlobalScores(limit = 25): Promise<ScoreEntry[]> {
  const res = await request(`/scores?limit=${limit}`);
  const json = /json/i.test(res.headers.get('content-type') ?? '');
  if (res.status === 404 || res.status === 405 || (res.ok && !json)) throw new ScoreboardNotConfigured('no scoreboard server');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { scores?: ScoreEntry[] };
  return Array.isArray(body.scores) ? body.scores.filter((e) => checkName(e.name).ok) : [];
}

export async function submitScore(rawName: string, runId: string, summary: RunSummary): Promise<SubmitResult> {
  const check = checkName(rawName);
  if (!check.ok) return { ok: false, error: check.reason === 'blocked' ? 'name' : check.reason };
  const name = check.name;
  rememberName(name);

  const local: ScoreEntry = {
    id: runId,
    name,
    score: computeScore(summary),
    wavesCleared: summary.wavesCleared,
    marks: summary.marks,
    victory: summary.victory,
    date: new Date().toISOString(),
  };
  saveLocal(local);

  try {
    const res = await request('/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, runId, summary }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; rank?: number | null; entry?: ScoreEntry; error?: string };
    if (res.ok && body.ok && body.entry) return { ok: true, rank: body.rank ?? null, entry: body.entry, online: true };
    if (res.status === 422) {
      removeLocal(runId);
      return { ok: false, error: body.error === 'length' || body.error === 'charset' ? body.error : 'name' };
    }
    if (res.status === 409) return { ok: false, error: 'duplicate' };
    if (res.status === 429) return { ok: false, error: 'rate' };
    if (res.status >= 500 || res.status === 404) return { ok: true, rank: null, entry: local, online: false };
    return { ok: false, error: 'invalid' };
  } catch {
    return { ok: true, rank: null, entry: local, online: false };
  }
}

// ── On-device scores ────────────────────────────────────────────────────────

export function getLocalScores(): ScoreEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as ScoreEntry[];
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.name === 'string' && checkName(e.name).ok) : [];
  } catch {
    return [];
  }
}

function saveLocal(e: ScoreEntry) {
  try {
    const list = getLocalScores().filter((x) => x.id !== e.id);
    list.push(e);
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 25)));
  } catch {
    /* storage unavailable */
  }
}

function removeLocal(id: string) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(getLocalScores().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}

export function lastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberName(n: string) {
  try {
    localStorage.setItem(LAST_NAME_KEY, n);
  } catch {
    /* ignore */
  }
}
