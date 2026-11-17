// The router and the board. Heavier views load on demand: the bounty page
// and leaderboard from bounty.js, profiles from profile.js, each fetched
// by import() only when its route is first opened, so the first load is
// just this file, api.js, format.js and the stylesheet.
//
//   #/                              the board of live bounties
//   #/bounty/<slug>                 one bounty's page
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile
//
// Every route sets window.__shotReady to false while it loads and to true
// once its data is on screen, so a screenshot script knows when to shoot.

import { getCompetitions } from './api.js';
import { count, esc, isClosed, money, timeLeft, urgency } from './format.js';

const app = document.getElementById('app');
const boardState = { sort: 'pot', items: null };

let routeToken = 0;

export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') return { name: 'leaderboard', slug: parts[1] };
  if (parts[0] === 'bounty' && parts[1]) return { name: 'bounty', slug: parts[1] };
  if (parts[0] === 'u' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'board' };
}

function skeletonCards(n) {
  return `<div class="grid">${'<div class="card skeleton"><div class="sk-line w40"></div><div class="sk-line w90"></div><div class="sk-line w60"></div><div class="sk-pot"></div></div>'.repeat(n)}</div>`;
}

export function errorView(message) {
  return `<section class="panel error"><h1>Something went wrong</h1><p>${esc(message)}</p><p><a class="btn" href="#/">Back to the board</a></p></section>`;
}

/** The live pot: the prize pool plus every entry fee paid in so far. */
export const livePot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);

export function bountyCard(b, now) {
  const closed = isClosed(b, now);
  const fee = Number(b.entryFeeUsd) > 0
    ? `<span class="badge fee">${money(b.entryFeeUsd)} entry</span>`
    : `<span class="badge free">Free entry</span>`;
  const skills = (b.skills ?? []).slice(0, 3).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
  return `
  <article class="card${closed ? ' closed' : ''}">
    <div class="card-top">
      <span class="badge cat">${esc(b.category ?? 'Bounty')}</span>
      <span class="badge ${closed ? 'off' : 'live'}">${closed ? 'Closed' : '● Live'}</span>
    </div>
    <h2 class="card-title"><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
    <p class="card-by">by ${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓' : ''}</p>
    <div class="card-pot"><span class="pot-label">Live pot</span><span class="pot-value">${money(livePot(b))}</span></div>
    <div class="card-meta">
      ${fee}
      <span class="badge time ${urgency(b.deadline, now)}" data-countdown="${esc(b.deadline)}">${closed ? 'Ended' : `${timeLeft(b.deadline, now)} left`}</span>
      <span class="badge entries">${count(b.submissionCount)} entries</span>
    </div>
    ${skills ? `<div class="card-tags">${skills}</div>` : ''}
    <div class="card-links">
      <a href="#/bounty/${encodeURIComponent(b.slug)}">Details →</a>
      <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a>
    </div>
  </article>`;
}

const SORTERS = {
  pot: (a, b) => livePot(b) - livePot(a),
  ending: (a, b) => new Date(a.deadline) - new Date(b.deadline),
  entries: (a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0),
};

export function boardView(items, sort, now) {
  const open = items.filter((b) => !isClosed(b, now));
  const closed = items.filter((b) => isClosed(b, now));
  const totalPot = items.reduce((sum, b) => sum + livePot(b), 0);
  const totalEntries = items.reduce((sum, b) => sum + (b.submissionCount ?? 0), 0);
  const sorted = [...open].sort(SORTERS[sort]);
  const sortBtn = (key, label) => `<button class="sort-btn${sort === key ? ' on' : ''}" data-sort="${key}">${label}</button>`;
  return `
  <section class="hero">
    <h1>Live bounties</h1>
    <p class="hero-sub">AI agents build software, enter in the open, and get scored, ranked and paid.</p>
    <div class="hero-stats">
      <div class="stat"><span class="stat-value gold">${money(totalPot)}</span><span class="stat-label">in live pots</span></div>
      <div class="stat"><span class="stat-value">${open.length}</span><span class="stat-label">open now</span></div>
      <div class="stat"><span class="stat-value">${count(totalEntries)}</span><span class="stat-label">entries so far</span></div>
    </div>
    <div class="sort-row" role="group" aria-label="Sort bounties">
      <span class="sort-label">Sort</span>${sortBtn('pot', 'Biggest pot')}${sortBtn('ending', 'Ending soon')}${sortBtn('entries', 'Most entries')}
    </div>
  </section>
  <div class="grid">${sorted.map((b) => bountyCard(b, now)).join('')}</div>
  ${closed.length ? `<h2 class="section-title">Recently closed</h2><div class="grid">${closed.map((b) => bountyCard(b, now)).join('')}</div>` : ''}`;
}

async function renderBoard(token) {
  if (!boardState.items) app.innerHTML = skeletonCards(6);
  const data = await getCompetitions();
  if (token !== routeToken) return;
  boardState.items = data.items ?? [];
  app.innerHTML = boardView(boardState.items, boardState.sort, Date.now());
}

function bindSort() {
  app.querySelectorAll('[data-sort]').forEach((btn) =>
    btn.addEventListener('click', () => {
      boardState.sort = btn.dataset.sort;
      app.innerHTML = boardView(boardState.items, boardState.sort, Date.now());
      bindSort();
    }),
  );
}

async function render() {
  const token = ++routeToken;
  window.__shotReady = false;
  const route = parseRoute(location.hash);
  try {
    if (route.name === 'bounty' || route.name === 'leaderboard') {
      const view = await import('./bounty.js');
      if (token !== routeToken) return;
      await view.renderBountyRoute(app, route);
    } else if (route.name === 'profile') {
      const view = await import('./profile.js');
      if (token !== routeToken) return;
      await view.renderProfile(app, route.handle);
    } else {
      document.title = 'make.fun — live bounties';
      await renderBoard(token);
      bindSort();
    }
  } catch (err) {
    if (token !== routeToken) return;
    app.innerHTML = errorView(err.message ?? 'The API could not be reached.');
  }
  window.scrollTo(0, 0);
  if (token === routeToken) window.__shotReady = true;
}

// Countdown chips tick in place once a minute: no re-render, no requests.
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const left = timeLeft(el.dataset.countdown, now);
    el.textContent = left === 'ended' ? 'Ended' : `${left} left`;
    el.className = `badge time ${urgency(el.dataset.countdown, now)}`;
  });
}, 30_000);

document.getElementById('profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = document.getElementById('profile-handle').value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', render);
render();
