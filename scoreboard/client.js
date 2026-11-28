/*
 * Alchemix Arcade — global scoreboard client (shared by the web games).
 * Each game has its own separate boards on the server.
 *
 *   <script src="/scoreboard/client.js"></script>
 *
 *   const rows = await ArcadeScores.top('qad', { board: 'main', limit: 12 });
 *   const res  = await ArcadeScores.submit('qad', { name, score, meta: { spec: 'WJEC GCSE' } });
 *   // res: { ok: true, rank, entry } | { ok: false, error: 'name'|'length'|'charset'|'tag'|'invalid'|'rate'|'duplicate'|'offline' }
 *
 * `top()` throws when the scoreboard can't be reached, so games can fall back
 * to their on-device board. Messages for rejected names are deliberately generic.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://alchemix-games-scores.alchemix-games.workers.dev';
  var TIMEOUT_MS = 7000;

  function request(path, init) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    var opts = Object.assign({ credentials: 'omit' }, init || {});
    if (ctl) opts.signal = ctl.signal;
    return fetch(ENDPOINT + path, opts).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function newRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /** UTC date key for daily boards, e.g. "2026-11-20". */
  function todayUTC() {
    return new Date().toISOString().slice(0, 10);
  }

  async function top(game, opts) {
    opts = opts || {};
    var q = new URLSearchParams({ board: opts.board || 'main', limit: String(opts.limit || 10) });
    if (opts.tag) q.set('tag', opts.tag);
    var res = await request('/api/games/' + encodeURIComponent(game) + '/scores?' + q.toString());
    if (!res.ok) throw new Error('scoreboard HTTP ' + res.status);
    var body = await res.json();
    return Array.isArray(body.scores) ? body.scores : [];
  }

  async function submit(game, data) {
    var payload = {
      runId: data.runId || newRunId(),
      name: String(data.name || '').trim(),
      score: Math.max(0, Math.floor(Number(data.score) || 0)),
      board: data.board || 'main',
      tag: data.tag || undefined,
      meta: data.meta || undefined,
    };
    try {
      var res = await request('/api/games/' + encodeURIComponent(game) + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var body = {};
      try { body = await res.json(); } catch (e) { /* ignore */ }
      if (res.ok && body.ok) return { ok: true, rank: body.rank, entry: body.entry };
      return { ok: false, error: body.error || (res.status >= 500 ? 'offline' : 'invalid') };
    } catch (e) {
      return { ok: false, error: 'offline' };
    }
  }

  /** Friendly, non-revealing message for a submit error. */
  function message(error) {
    switch (error) {
      case 'name': return 'That name isn’t available. Please choose another.';
      case 'tag': return 'That class code isn’t available. Please choose another.';
      case 'length': return 'Names must be 3–16 characters.';
      case 'charset': return 'Use letters, numbers, spaces, dots, dashes or underscores (at least 2 letters).';
      case 'rate': return 'Too many submissions — wait a minute and try again.';
      case 'duplicate': return 'This score has already been submitted.';
      case 'offline': return 'Global scoreboard offline — saved on this device.';
      default: return 'This score couldn’t be submitted.';
    }
  }

  window.ArcadeScores = { top: top, submit: submit, message: message, todayUTC: todayUTC, endpoint: ENDPOINT };
})();
