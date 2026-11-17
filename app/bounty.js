// The bounty page and its leaderboard, loaded by import() only when a
// bounty route is opened, so they cost the board's first load nothing.

import { assetUrl, getCompetition, getLeaderboard } from './api.js';
import { ago, count, dateOnly, dateTime, esc, isClosed, money, timeLeft, urgency, viewCss, winRate } from './format.js';

/** Minimal, safe markdown for bounty descriptions: headings, lists, bold, code. */
export function renderMarkdown(md) {
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(md ?? '').split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((bullet ?? numbered)[1])}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/** The rewards table: each place's prize as it stands with fees included. */
export function rewardsTable(b) {
  const rows = (b.rewardsNow ?? []).map((r) => `
    <tr>
      <td class="num">#${r.place}</td>
      <td class="num">${money(r.baseUsd)}</td>
      <td class="num">${money(r.feeShareUsd)}</td>
      <td class="num strong">${money(r.amountUsd)}</td>
    </tr>`).join('');
  if (rows) {
    return `<table class="table rewards">
      <thead><tr><th class="num">Place</th><th class="num">Prize</th><th class="num">Fee share</th><th class="num">Pays now</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="note">Entry fees paid in join the pot and are split over the places in proportion to their prizes.</p>`;
  }
  const places = Object.entries(b.rewards ?? {}).map(([place, amount]) => `
    <tr><td class="num">#${place}</td><td class="num strong">${money(amount)}</td></tr>`).join('');
  return `<table class="table rewards"><thead><tr><th class="num">Place</th><th class="num">Prize</th></tr></thead><tbody>${places}</tbody></table>`;
}

export function bountyView(b) {
  const closed = isClosed(b);
  const fee = Number(b.entryFeeUsd) > 0 ? money(b.entryFeeUsd) : 'Free';
  const latest = (b.submissions ?? []).slice(0, 8).map((s) => `
    <li class="entry-row">
      <a href="#/u/${encodeURIComponent(s.hunter)}" class="who">@${esc(s.hunter)}</a>
      <span class="what">${esc(s.title || 'Untitled entry')}</span>
      <span class="when">${ago(s.createdAt)}</span>
    </li>`).join('');
  return `
  <p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
  <section class="panel bounty-head">
    <div class="card-top">
      <span class="badge cat">${esc(b.category ?? 'Bounty')}</span>
      <span class="badge ${closed ? 'off' : 'live'}">${closed ? 'Closed to entries' : '● Open'}</span>
      <span class="badge time ${urgency(b.deadline)}" data-countdown="${esc(b.deadline)}">${closed ? 'Ended' : `${timeLeft(b.deadline)} left`}</span>
    </div>
    <h1>${esc(b.title)}</h1>
    <p class="summary">${esc(b.summary ?? '')}</p>
    <div class="stat-grid">
      <div class="stat"><span class="sval gold">${money(b.potUsd ?? b.rewardAmount)}</span><span class="slab">Live pot</span></div>
      <div class="stat"><span class="sval">${fee}</span><span class="slab">Entry fee</span></div>
      <div class="stat"><span class="sval">${count(b.submissionCount)}</span><span class="slab">Entries</span></div>
      <div class="stat"><span class="sval">${dateOnly(b.deadline)}</span><span class="slab">Deadline</span></div>
    </div>
    <dl class="facts">
      <dt>Deadline</dt><dd>${dateTime(b.deadline)}</dd>
      <dt>Opened</dt><dd>${b.publishedAt ? dateTime(b.publishedAt) : '—'}</dd>
      <dt>Status</dt><dd>${closed ? 'Closed — past its deadline' : `Open — ${esc(b.status ?? 'open')}`}</dd>
      <dt>Sponsor</dt><dd>${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓ verified' : ''}</dd>
      ${Number(b.entryFeesUsd) > 0 ? `<dt>Fees in the pot</dt><dd>${money(b.entryFeesUsd)} from ${count(b.entryFeePayers)} entrants</dd>` : ''}
    </dl>
  </section>
  <section class="panel">
    <h2>Rewards — the live pot split</h2>
    ${rewardsTable(b)}
  </section>
  <section class="panel">
    <h2>About this bounty</h2>
    <div class="prose">${renderMarkdown(b.description)}</div>
  </section>
  ${latest ? `<section class="panel"><h2>Latest entries</h2><ul class="entries">${latest}</ul></section>` : ''}`;
}

// The leaderboard is windowed: every entry is fetched once, but only
// the visible slice of rows is in the DOM. windowedRows() renders that
// slice between two spacer rows that hold the height of the rows above
// and below, so the scrollbar still spans the full ranking.
const LB_ROW_H = 42; // px; re-measured from the first real row after mount
const lb = { entries: [], title: '', rowH: LB_ROW_H, headH: 0, start: -1, end: -1, box: null, body: null };

function lbRow(e) {
  const v = e.values ?? {};
  const j = e.judge ?? {};
  const record = j.matches ? `${j.wins ?? 0}W · ${j.draws ?? 0}D · ${j.losses ?? 0}L` : '—';
  const avatar = e.image ? `<img class="avatar" crossorigin="anonymous" src="${esc(assetUrl(e.image))}" alt="" loading="lazy">` : '';
  return `<tr data-row${e.rank <= 3 ? ' class="podium"' : ''}><td class="num strong">${e.rank}</td><td><span class="entrant">${avatar}<a href="#/u/${encodeURIComponent(e.handle)}">@${esc(e.handle)}</a></span></td><td class="title-cell">${esc(e.title ?? '')}</td><td class="num strong gold">${winRate(v.judge)}</td><td class="num muted">${v.judge_low != null ? `${winRate(v.judge_low)} – ${winRate(v.judge_high)}` : '—'}</td><td class="num muted">${record}</td><td class="num muted">${v.bytes ? `${Math.round(v.bytes / 1024)} KB` : '—'}</td></tr>`;
}

function windowedRows() {
  const { box, body, entries } = lb;
  if (!box || !body) return;
  const st = Math.max(0, box.scrollTop - lb.headH);
  const start = Math.max(0, Math.floor(st / lb.rowH) - 8);
  const end = Math.min(entries.length, Math.ceil((st + box.clientHeight) / lb.rowH) + 8);
  if (start === lb.start && end === lb.end) return;
  lb.start = start;
  lb.end = end;
  const above = start * lb.rowH, below = (entries.length - end) * lb.rowH;
  body.innerHTML =
    (above ? `<tr class="sp"><td colspan="7" style="height:${above}px"></td></tr>` : '') +
    entries.slice(start, end).map(lbRow).join('') +
    (below ? `<tr class="sp"><td colspan="7" style="height:${below}px"></td></tr>` : '');
}

export function leaderboardView(slug, data) {
  const total = lb.entries.length;
  return `
  <p class="crumbs"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(lb.title || 'Bounty')}</a> · <a href="#/">All bounties</a></p>
  <section class="panel">
    <h1>Leaderboard</h1>
    <p class="summary">${esc(data.phase?.title ?? 'Results')} · ranked by judge win rate · ${count(total)} ranked entries${data.competition?.placements === 'after_finalize' ? ' · placements settle after the final' : ''} · windowed: only the rows on screen are in the DOM, scroll for the rest</p>
    ${total === 0 ? '<p class="note">No ranked entries yet — judging is still running.</p>' : `
    <div class="lbwin" id="lbwin"><table class="table lb">
      <thead><tr><th class="num">#</th><th>Entrant</th><th>Entry</th><th class="num">Win rate</th><th class="num">90% range</th><th class="num">Record</th><th class="num">Size</th></tr></thead>
      <tbody id="lbbody"></tbody>
    </table></div>`}
  </section>`;
}

function mountWindowedRows(app) {
  lb.box = app.querySelector('#lbwin');
  lb.body = app.querySelector('#lbbody');
  lb.start = -1;
  lb.end = -1;
  if (!lb.box) return;
  lb.box.addEventListener('scroll', () => requestAnimationFrame(windowedRows), { passive: true });
  windowedRows();
  requestAnimationFrame(() => {
    const head = lb.box.querySelector('thead');
    if (head) lb.headH = head.offsetHeight;
    const row = lb.body.querySelector('tr[data-row]');
    if (row && row.offsetHeight > 0 && row.offsetHeight !== lb.rowH) {
      lb.rowH = row.offsetHeight;
      lb.start = -1;
      windowedRows();
    }
  });
}

export async function renderBountyRoute(app, route) {
  viewCss();
  if (route.name === 'leaderboard') {
    app.innerHTML = '<section class="panel"><p class="note">Loading the leaderboard…</p></section>';
    const data = await getLeaderboard(route.slug);
    lb.entries = data.entries ?? [];
    lb.title = data.competition?.title ?? '';
    lb.rowH = LB_ROW_H;
    lb.headH = 0;
    document.title = `Leaderboard · ${lb.title} | make.fun`;
    app.innerHTML = leaderboardView(route.slug, data);
    mountWindowedRows(app);
    return;
  }
  app.innerHTML = '<section class="panel"><p class="note">Loading the bounty…</p></section>';
  const b = await getCompetition(route.slug);
  document.title = `${b.title} | make.fun`;
  app.innerHTML = bountyView(b);
}
