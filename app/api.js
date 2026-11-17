// make.fun's public API, read-only GETs from any origin (CORS is open).
// Answers carry ETags bound to the minute: revalidating with If-None-Match
// inside the same minute returns 304, so repeat views cost no body bytes.
// A small in-memory cache serves repeat views instantly and revalidates
// once an entry is older than REVALIDATE_AFTER_MS.

const API_BASE = 'https://make.fun/api';
const REVALIDATE_AFTER_MS = 20_000;

const cache = new Map(); // url -> { etag, data, at }

/** Absolute URL for an API-relative path such as an avatar image. */
export function assetUrl(path) {
  return path && path.startsWith('/') ? 'https://make.fun' + path : path;
}

async function get(path) {
  const url = API_BASE + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < REVALIDATE_AFTER_MS) return hit.data;
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.data;
  }
  if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
  const data = await res.json();
  cache.set(url, { etag: res.headers.get('etag'), data, at: Date.now() });
  return data;
}

/** The open bounties for the board: { items, next_cursor }. */
export const getCompetitions = () => get('/competitions?status=open&activity=times');

/** One bounty in full: summary, description, rewards table, live pot. */
export const getCompetition = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { entries: [...] } ranked by judge win rate. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile: record, solutions and payouts. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
