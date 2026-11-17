// An account's public profile, loaded by import() only when a profile
// route is opened: record, entries and payouts from /api/profiles/<handle>.

import { assetUrl, getProfile } from './api.js';
import { count, dateOnly, esc, money, shortAddress, winRate } from './format.js';

export function profileView(p) {
  const r = p.record ?? {};
  const avatar = p.image || p.avatar?.url
    ? `<img class="avatar big" crossorigin="anonymous" src="${esc(assetUrl(p.image || p.avatar.url))}" alt="">`
    : '';
  const stat = (value, label) => `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
  const solutions = (p.solutions ?? []).map((s) => `
    <li class="entry-row">
      <a class="what" href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.title || s.competition.title)}</a>
      <span class="when">${esc(s.competition.title)}</span>
      <span class="score">${s.placement ? `#${s.placement}` : s.score?.value != null ? winRate(s.score.value) : 'entered'}</span>
      ${s.prize_usd ? `<span class="prize">${money(s.prize_usd)}</span>` : ''}
    </li>`).join('');
  const payouts = (p.payouts ?? []).map((pay) => `
    <li class="entry-row">
      <span class="what">${esc(pay.competition.title)}</span>
      <span class="when">place #${pay.place} · ${dateOnly(pay.paid_at)}</span>
      <span class="prize">${money(pay.amount_usd)}</span>
    </li>`).join('');
  return `
  <p class="crumbs"><a href="#/">← All bounties</a></p>
  <section class="panel profile-head">
    ${avatar}
    <div class="profile-id">
      <h1>@${esc(p.handle)}${p.house ? ' <span class="badge cat">house</span>' : ''}</h1>
      ${p.bio ? `<p class="summary">${esc(p.bio)}</p>` : ''}
      <p class="note">Joined ${p.joined_at ? dateOnly(p.joined_at) : '—'}${p.wallet?.address ? ` · wallet ${esc(shortAddress(p.wallet.address))}` : ''}${p.github_login ? ` · GitHub ${esc(p.github_login)}` : ''}${p.x ? ` · X ${esc(p.x)}` : ''}</p>
    </div>
  </section>
  <section class="panel">
    <h2>Record</h2>
    <div class="stat-grid">
      ${stat(count(r.competitions_entered), 'Entered')}
      ${stat(count(r.competitions_placed), 'Placed')}
      ${stat(count(r.competitions_won), 'Won')}
      ${stat(count(r.podium_finishes), 'Podiums')}
      ${stat(r.best_placement ? `#${r.best_placement}` : '—', 'Best place')}
      ${stat(`<span class="gold">${money(r.prize_usd)}</span>`, 'Prizes won')}
    </div>
  </section>
  ${solutions ? `<section class="panel"><h2>Entries</h2><ul class="entries">${solutions}</ul></section>` : ''}
  ${payouts ? `<section class="panel"><h2>Payouts</h2><ul class="entries">${payouts}</ul></section>` : ''}`;
}

export async function renderProfile(app, handle) {
  app.innerHTML = '<section class="panel"><p class="note">Loading the profile…</p></section>';
  const p = await getProfile(handle);
  document.title = `@${p.handle} | make.fun`;
  app.innerHTML = profileView(p);
}
