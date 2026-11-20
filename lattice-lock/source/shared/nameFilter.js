// ─────────────────────────────────────────────────────────────────────────────
// Player-name safety filter — shared by the browser client and the scoreboard
// server (the server is authoritative). Plain ESM so Node can import it as-is.
//
// Checks: length, character set, profanity/slurs (with leetspeak, accent and
// repeated-letter normalisation), contact details / personal info (digits,
// URLs, social handles), and impersonation. The block list is base64-encoded
// so it is not readable at a glance in the shipped bundle; rejection reasons
// for blocked content are deliberately generic.
// ─────────────────────────────────────────────────────────────────────────────

const ENC = 'eyJzIjpbImZ1Y2siLCJmdWsiLCJmY2siLCJzaGl0IiwiY3VudCIsIm5pZ2dlciIsIm5pZ2dhIiwiZmFnZ290IiwiZmFnb3QiLCJiaXRjaCIsImJhc3RhcmQiLCJ3YW5rIiwiYm9sbG9jayIsImJlbGxlbmQiLCJzbHV0Iiwid2hvcmUiLCJyZXRhcmQiLCJwYWVkbyIsInBlZG9waGlsZSIsInBhZWRvcGhpbGUiLCJqaXp6IiwicHVzc3kiLCJkaWNraGVhZCIsImNvY2tzdWNrZXIiLCJtb3RoZXJmdWNrIiwiYXJzZWhvbGUiLCJhc3Nob2xlIiwidG9zc2VyIiwidHdhdCIsInJhcGlzdCIsInBvcm4iLCJoaXRsZXIiLCJuYXppIiwidHJhbm55Iiwic3Bhc3RpYyIsInN1aWNpZGUiLCJraWxseW91cnNlbGYiLCJraWxsdXJzZWxmIiwiY3Vtc2hvdCIsImJsb3dqb2IiLCJoYW5kam9iIiwiZGlsZG8iLCJ2YWdpbmEiLCJwZW5pcyIsInRlc3RpY2xlIiwiY2xpdG9yaXMiLCJvcmdhc20iLCJtYXN0dXJiYXQiLCJtb2xlc3QiLCJnZW5vY2lkZSIsImNvY2FpbmUiLCJ3ZXRiYWNrIiwia2lrZSIsImdlc3RhcG8iLCJqaWhhZCIsInRlcnJvcmlzdCIsImJ1a2tha2UiLCJmZWxjaCIsInF1ZWVmIiwic2thbmsiLCJkb3VjaGUiLCJ3YW5rZXIiLCJtaW5nZXIiLCJub25jZSJdLCJ3IjpbImFzcyIsImFyc2UiLCJ0aXQiLCJ0aXRzIiwidGl0dHkiLCJib29iIiwiYm9vYnMiLCJjdW0iLCJzZXgiLCJzZXh5IiwiYW5hbCIsInJhcGUiLCJyYXBlZCIsImRpY2siLCJjb2NrIiwicHJpY2siLCJrbm9iIiwiZmFubnkiLCJjcmFwIiwiZGFtbiIsInBlZG8iLCJmYWciLCJmYWdzIiwiZHlrZSIsInNwaWMiLCJjaGluayIsImdvb2siLCJ3b2ciLCJtb25nIiwic3BheiIsImt5cyIsImtrayIsImhvZSIsImhvZXMiLCJwdWJlIiwicHViZXMiLCJudWRlIiwibnVkZXMiLCJuYWtlZCIsInBvb3AiLCJwaXNzIiwidHVyZCIsImJ1dHQiLCJiYWxscyIsImtpbGwiLCJkaWUiLCJkZWFkIiwiZ2F5IiwibGVzYm8iLCJob21vIiwibmVncm8iLCJneXBvIiwicGlrZXkiLCJ0YXJkIiwic2xhZyIsIm5vYiIsInNjcm90ZSIsImJ1bSIsIndpbGx5IiwibWV0aCIsImlzaXMiLCJjb29uIiwicGFraSIsImhlcm9pbiIsInNoYWciLCJraWsiLCJhZGRyZXNzIiwic3lzdGVtIl0sImMiOlsic25hcGNoYXQiLCJzbmFwIiwiaW5zdGEiLCJpbnN0YWdyYW0iLCJ0aWt0b2siLCJkaXNjb3JkIiwid2hhdHNhcHAiLCJ0ZWxlZ3JhbSIsInlvdXR1YmUiLCJ0d2l0Y2giLCJmYWNlYm9vayIsInBob25lIiwibW9iaWxlIiwiZW1haWwiLCJnbWFpbCIsImhvdG1haWwiLCJvdXRsb29rIiwicG9zdGNvZGUiLCJhZG1pbiIsIm1vZGVyYXRvciIsIm9mZmljaWFsIiwidGVhY2hlciIsImhlYWR0ZWFjaGVyIiwic3RhZmYiLCJzdXBwb3J0Il19';

/** @type {{ s: string[]; w: Set<string>; c: string[] } | null} */
let LISTS = null;

function lists() {
  if (!LISTS) {
    const bin = atob(ENC);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    LISTS = { s: raw.s, w: new Set(raw.w), c: raw.c };
  }
  return LISTS;
}

const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' };

const base = (str) => str.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lower-case, strip accents, de-leet every digit/symbol. Used per token. */
function normalise(str) {
  return base(str).replace(/[0-9@$!|+]/g, (ch) => LEET[ch] ?? ch);
}

/**
 * Conservative de-leet for substring scanning: symbols always, but a digit only
 * when it is a lone digit touching a letter ("sh1t", "f4ck") — so plain numbers
 * like "Galena 21" are not misread as letters.
 */
function normaliseInline(str) {
  return base(str)
    .replace(/[@$!|+]/g, (ch) => LEET[ch] ?? ch)
    .replace(/(?<![0-9])[0-9](?![0-9])/g, (d, i, all) =>
      /[a-z]/.test(all[i - 1] ?? '') || /[a-z]/.test(all[i + 1] ?? '') ? LEET[d] : d,
    );
}

/** Collapse repeated letters: "fuuuuck" → "fuck". */
function squeeze(str) {
  return str.replace(/(.)\1+/g, '$1');
}

/** Cap letter runs at two: "asssss" → "ass". */
function cap2(str) {
  return str.replace(/(.)\1{2,}/g, '$1$1');
}

/** Whole-word match, tolerant of stretched letters. */
function wholeHit(W, t) {
  return W.has(t) || W.has(cap2(t)) || W.has(squeeze(t));
}

export const NAME_MIN = 3;
export const NAME_MAX = 16;

/**
 * @param {unknown} input
 * @returns {{ ok: true, name: string } | { ok: false, reason: 'length' | 'charset' | 'blocked' }}
 */
export function checkName(input) {
  if (typeof input !== 'string') return { ok: false, reason: 'charset' };
  const name = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: 'length' };
  if (!/^[A-Za-z0-9 _.\-]+$/.test(name)) return { ok: false, reason: 'charset' };
  if ((name.match(/[A-Za-z]/g) ?? []).length < 2) return { ok: false, reason: 'charset' };

  // Personal information: long digit runs (phone numbers, ages+years), URLs/domains
  if (/\d{4,}/.test(name)) return { ok: false, reason: 'blocked' };
  if (/(^|[^a-z])(www|https?)([^a-z]|$)/i.test(name) || /\.(com|net|org|uk|io|co|gg|tv|me|xyz|ly|app|dev)\b/i.test(name))
    return { ok: false, reason: 'blocked' };

  const L = lists();
  const letters = normaliseInline(name).replace(/[^a-z]/g, '');
  const capped = cap2(letters);
  const squeezed = squeeze(letters);
  // Raw entries against run-capped text; squeezed entries (≥4 letters) against squeezed text
  const hit = (w) => capped.includes(w) || (squeeze(w).length >= 4 && squeezed.includes(squeeze(w)));
  if (L.s.some(hit) || L.c.some(hit)) return { ok: false, reason: 'blocked' };

  const norm = normalise(name);
  const tokens = name.split(/[^A-Za-z0-9@$!|+]+/).map(normalise).filter(Boolean);
  // Also treat camel-case joins ("BigAss") as tokens
  const camel = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  tokens.push(...camel.split(/[^A-Za-z0-9@$!|+]+/).map(normalise).filter(Boolean));
  for (const t of tokens) {
    if (wholeHit(L.w, t)) return { ok: false, reason: 'blocked' };
  }
  // A whole-word term spelled as the entire squashed name ("a s s")
  if (wholeHit(L.w, letters) || wholeHit(L.w, norm.replace(/[^a-z]/g, ''))) return { ok: false, reason: 'blocked' };

  return { ok: true, name };
}

const ADJ = ['Brave', 'Swift', 'Lucid', 'Stable', 'Noble', 'Bright', 'Polar', 'Ionic', 'Covalent', 'Molten', 'Quantum', 'Lattice', 'Crystal', 'Prism', 'Atomic', 'Radiant'];
const NOUN = ['Quartz', 'Diamond', 'Graphene', 'Garnet', 'Beryl', 'Halite', 'Topaz', 'Galena', 'Pyrite', 'Calcite', 'Cobalt', 'Argon', 'Neon', 'Boron', 'Carbon', 'Iodine'];

/** Friendly random alias, always passes the filter. */
export function randomAlias() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n} ${Math.floor(10 + Math.random() * 90)}`.slice(0, NAME_MAX);
}
