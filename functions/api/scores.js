// Arcade leaderboard: GET returns the top ten, POST saves a score and returns the new top ten.
// The game runs in the browser, so a score can't be proven; these checks only keep out junk.

const TOP = 10;
const PER_DAY = 30;          // saves per visitor per day
const MIN_GAP_MS = 8000;     // and at least this long apart

// Initials we won't show on the board.
const BLOCKED = new Set(['ASS', 'CUM', 'FAG', 'FUK', 'FUC', 'FCK', 'FUX', 'KKK', 'NIG', 'NGR', 'SEX', 'TIT', 'DIK', 'DIC', 'COK', 'COC', 'PIS', 'JIZ', 'NAZ', 'HOE', 'CNT', 'VAG', 'PUS', 'WOP', 'KYK', 'KIK', 'JAP']);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// The most a player could have scored by the time they reach a stage (with headroom).
const maxScore = stage => stage * 8000 + 250 * stage * (stage + 1);

async function topTen(db) {
  const { results } = await db.prepare('SELECT id, name, score, stage FROM scores ORDER BY score DESC, id ASC LIMIT ?').bind(TOP).all();
  return results;
}

async function visitorKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + day));
  return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
  return json({ top: await topTen(env.DB) });
}

export async function onRequestPost({ request, env }) {
  // Only the site's own page may post.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 500) return json({ error: 'too large' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const name = String(body && body.name || '').toUpperCase();
  const score = Number(body && body.score), stage = Number(body && body.stage);

  if (!/^[A-Z]{3}$/.test(name)) return json({ error: 'initials', message: 'USE THREE LETTERS' }, 400);
  if (BLOCKED.has(name)) return json({ error: 'initials', message: 'PICK DIFFERENT INITIALS' }, 400);
  if (!Number.isInteger(stage) || stage < 1 || stage > 999) return json({ error: 'bad score' }, 400);
  if (!Number.isInteger(score) || score <= 0 || score % 50 !== 0 || score > maxScore(stage)) return json({ error: 'bad score' }, 400);

  const who = await visitorKey(request), now = Date.now();
  const seen = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(created_at) AS last FROM scores WHERE who = ?').bind(who).first();
  if (seen.n >= PER_DAY || (seen.last && now - seen.last < MIN_GAP_MS)) return json({ error: 'slow down', message: 'TRY AGAIN IN A MOMENT' }, 429);

  const saved = await env.DB.prepare('INSERT INTO scores (name, score, stage, who, created_at) VALUES (?, ?, ?, ?, ?)').bind(name, score, stage, who, now).run();
  const better = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ?').bind(score).first();
  return json({ id: saved.meta.last_row_id, rank: better.n + 1, top: await topTen(env.DB) });
}
