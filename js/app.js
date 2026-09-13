/* ============================================================
   app.js - the shared engine. Every page loads this file.

   1. Me          who is signed in, and their profile row
   2. Chrome      the header and footer, drawn once here so the
                  pages never drift apart
   3. Search      the box in the header, and the query it builds
   4. Pieces      small html builders shared by several pages
   5. Helpers     escaping, dates, stars, toast, page changes
   6. Boot        AppReady - the promise pages wait on
   ============================================================ */

/* ============================================================
   1. Me

   The session is loaded once at boot. Page scripts wait for
   AppReady and then read these getters synchronously.
   ============================================================ */
const Me = {
  _user: null,
  _profile: null,

  user()      { return this._user; },
  profile()   { return this._profile; },
  signedIn()  { return !!this._user; },

  /* the name to greet her by: nickname first, username second */
  firstName() {
    const p = this._profile;
    if (!p) return '';
    return (p.nickname || p.username || '').trim().split(/\s+/)[0];
  },

  async load() {
    const { data: { user } } = await sb.auth.getUser();
    this._user = user || null;
    this._profile = null;

    if (!user) return null;

    /* profiles.id is deliberately not the auth id - seeded profiles have no
       account behind them - so the row is found by user_id first. */
    const { data: own } = await sb
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!own) return null;

    /* profile_cards is the same row plus the three public counts */
    const { data } = await sb
      .from('profile_cards')
      .select('*')
      .eq('id', own.id)
      .maybeSingle();

    this._profile = data || null;
    return this._profile;
  },

  async signOut() {
    await sb.auth.signOut();
    this._user = null;
    this._profile = null;
    location.href = 'index.html';
  }
};

/* ============================================================
   2. Chrome - header and footer

   Drawn from here instead of copied into eight html files, so a
   change to the nav happens in one place. Each page marks itself
   with data-page on <body> and that highlights the right link.
   ============================================================ */
function mountChrome() {
  const page = document.body.dataset.page || '';
  const me = Me.profile();

  const link = (href, label, key) =>
    `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`;

  const account = me
    ? `<a class="chip-account" href="profile.html?u=${encodeURIComponent(me.username)}">
         ${faceHtml(me, 'chip-account__face')}
         ${esc(me.nickname || me.username)}
       </a>`
    : `<a class="btn btn--small btn--blush" href="login.html">Sign in</a>`;

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <div class="wrap topbar__row">
      <a class="logo" href="index.html">Whisk Diary <span>\u{1F375}</span></a>
      <span class="topbar__spacer"></span>
      <form class="searchbox" role="search" id="topSearch">
        <span class="searchbox__icon" aria-hidden="true">\u{1F50E}</span>
        <label class="sr-only" for="topSearchInput">Search profiles and matcha houses</label>
        <input id="topSearchInput" type="search" name="q" placeholder="Search profiles or matcha houses…"
               autocomplete="off">
      </form>
      ${account}
    </div>`;

  const footer = document.createElement('footer');
  footer.className = 'foot';
  footer.innerHTML = `
    <div class="wrap foot__row">
      <span>Whisk Diary · a community diary for matcha lovers · Kuwait 2026</span>
      <nav aria-label="Footer">
        ${me ? '<a href="edit-profile.html">Edit profile</a>' : '<a href="login.html">Sign in</a>'}
      </nav>
    </div>`;

  document.body.prepend(header);
  document.body.append(footer);
  document.body.append(taskbar(page));

  wireSearchBox();
}

/* ============================================================
   The taskbar

   Five places, always within a thumb's reach at the bottom of the
   screen. Write and Messages need an account; rather than hiding
   them from a signed-out visitor - which makes the bar jump about
   depending on who is looking - they point at the sign in page and
   say so when she gets there.
   ============================================================ */
function taskbar(page) {
  const me = Me.profile();
  const gated = me ? null : 'login.html?next=';

  const tab = (href, key, icon, label) => `
    <a class="taskbar__tab" href="${href}"${page === key ? ' aria-current="page"' : ''}>
      <span class="taskbar__icon" aria-hidden="true">${icon}</span>
      <span class="taskbar__label">${label}</span>
    </a>`;

  const bar = document.createElement('nav');
  bar.className = 'taskbar';
  bar.setAttribute('aria-label', 'Main');

  bar.innerHTML = `
    ${tab('index.html', 'home', '\u{1F3E0}', 'Home')}
    ${tab('explore.html', 'explore', '\u{1F9ED}', 'Explore')}
    ${tab(gated ? gated + 'create.html' : 'create.html', 'create',
          '\u{1F58B}\u{FE0F}', 'Write')}
    ${tab('search.html', 'search', '\u{1F50E}', 'Search')}
    ${tab(gated ? gated + 'messages.html' : 'messages.html', 'messages',
          '\u{1F4AC}', 'Messages')}`;

  return bar;
}

/* ============================================================
   3. Search
   ============================================================ */

/* the two filters live in the url so a search can be linked to */
function searchUrl(q, filters) {
  const f = (filters && filters.length === 1) ? filters[0] : 'all';
  return `search.html?q=${encodeURIComponent(q)}&filter=${f}`;
}

function wireSearchBox() {
  const form = document.getElementById('topSearch');
  if (!form) return;

  const input = form.querySelector('input');

  /* if we are already on the results page, show what was searched */
  const asked = new URLSearchParams(location.search).get('q');
  if (asked) input.value = asked;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    /* keep whichever filter is already showing */
    const current = new URLSearchParams(location.search).get('filter');
    location.href = `search.html?q=${encodeURIComponent(q)}&filter=${current || 'all'}`;
  });
}

/* Postgres treats , ( ) and % as syntax inside an .or() filter, so they
   are stripped rather than passed through and misread. */
function cleanQuery(q) {
  return (q || '').replace(/[,()%*]/g, ' ').trim().slice(0, 60);
}

/* ============================================================
   4. Pieces - html for things that appear on several pages
   ============================================================ */
/* ============================================================
   Faces

   A profile shows either the photograph she uploaded or the little
   emoji face she picked. Every face on the site goes through here,
   so a new photograph appears in the header, on her card, on her
   page and beside her reviews without any of them knowing how.

   avatar_path is a path inside the avatars bucket, not a url - the
   url is built here, which is why nobody can point their picture
   at somewhere else on the internet.
   ============================================================ */
function faceHtml(p, classes) {
  const path = p && p.avatar_path;

  if (path) {
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    return `<span class="${classes}"><img src="${esc(data.publicUrl)}" alt="" loading="lazy"></span>`;
  }

  return `<span class="${classes}" aria-hidden="true">${esc((p && p.avatar) || '\u{1F375}')}</span>`;
}

function personCard(p) {
  return `
    <a class="card card--person" href="profile.html?u=${encodeURIComponent(p.username)}">
      ${faceHtml(p, 'face')}
      <span style="min-width:0">
        <h3 class="card__name">${esc(p.nickname || p.username)}</h3>
        <p class="card__handle">@${esc(p.username)}</p>
        ${p.bio ? `<p class="card__bio">${esc(p.bio)}</p>` : ''}
        <span class="tally">
          <span><b>${p.followers_count}</b> ${p.followers_count === 1 ? 'follower' : 'followers'}</span>
          <span><b>${p.following_count}</b> following</span>
          <span><b>${p.reviews_count}</b> ${p.reviews_count === 1 ? 'review' : 'reviews'}</span>
        </span>
      </span>
    </a>`;
}

function cafeCard(c) {
  return `
    <a class="card card--cafe" href="cafe.html?c=${encodeURIComponent(c.slug)}">
      <span class="card__emoji" aria-hidden="true">${esc(c.emoji || '\u{1F375}')}</span>
      ${cafeMeta(c)}
      <h3 class="card__name">${esc(c.name)}</h3>
      ${c.blurb ? `<p class="card__bio">${esc(c.blurb)}</p>` : ''}
      ${stars(c.avg_rating, c.reviews_count)}
    </a>`;
}

/* "Salmiya · $$", or just "Salmiya", or nothing at all - a matcha house that has not
   had its area and price filled in yet should not show a stray dot */
function cafeMeta(c) {
  const parts = [c.area, c.price].filter(Boolean).map(esc);
  return parts.length ? `<p class="card__meta">${parts.join(' · ')}</p>` : '';
}

/* the photo or video hung on a post or a review, if there is one */
function mediaHtml(item) {
  if (!item || !item.media_path) return '';

  const { data } = sb.storage.from('media').getPublicUrl(item.media_path);
  const url = esc(data.publicUrl);

  return item.media_type === 'video'
    ? `<div class="media"><video src="${url}" controls preload="metadata" playsinline></video></div>`
    : `<div class="media"><img src="${url}" alt="" loading="lazy"></div>`;
}

/* a post: an entry about nothing in particular, and the only kind that
   carries a place */
function postCard(p) {
  return `
    <article class="review review--post">
      <div class="review__top">
        ${faceHtml(p, 'face face--sm')}
        <a class="review__who" href="profile.html?u=${encodeURIComponent(p.username || '')}">${esc(p.nickname || p.username || 'Someone')}</a>
        <span class="tag tag--post">Post</span>
        <time class="review__when" datetime="${p.created_at}">${when(p.created_at)}</time>
      </div>
      ${p.body ? `<p class="review__body">${esc(p.body)}</p>` : ''}
      ${mediaHtml(p)}
      ${p.place ? `<p class="review__place"><span aria-hidden="true">\u{1F4CD}</span> ${esc(p.place)}</p>` : ''}
    </article>`;
}

/* one review. `show` picks what the line above it names: the matcha house it is
   about (on a profile) or the person who wrote it (on a matcha house page). */
function reviewRow(r, show) {
  const cafe = r.cafes || {};
  const who = r.profiles || {};

  const head = show === 'cafe'
    ? `<span class="face face--sm" aria-hidden="true">${esc(cafe.emoji || '\u{1F375}')}</span>
       <a class="review__who" href="cafe.html?c=${encodeURIComponent(cafe.slug || '')}">${esc(cafe.name || 'A matcha house')}</a>`
    : `${faceHtml(who, 'face face--sm')}
       <a class="review__who" href="profile.html?u=${encodeURIComponent(who.username || '')}">${esc(who.nickname || who.username || 'Someone')}</a>`;

  return `
    <article class="review">
      <div class="review__top">
        ${head}
        <span class="stars" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating)}<span style="color:var(--rule)">${'★'.repeat(5 - r.rating)}</span></span>
        <time class="review__when" datetime="${r.created_at}">${when(r.created_at)}</time>
      </div>
      ${r.body ? `<p class="review__body">${esc(r.body)}</p>` : ''}
      ${mediaHtml(r)}
    </article>`;
}

function stars(avg, count) {
  if (!count) return `<span class="stars"><small>No reviews yet</small></span>`;

  /* floored, not rounded: beside the number "4.5", five gold stars would
     be a small lie */
  const gold = Math.floor(Number(avg) || 0);

  return `
    <span class="stars" aria-label="${avg} out of 5 from ${count} reviews">
      ${'★'.repeat(gold)}<span style="color:var(--rule)">${'★'.repeat(5 - gold)}</span>
      <small>${Number(avg).toFixed(1)} · ${count} ${count === 1 ? 'review' : 'reviews'}</small>
    </span>`;
}

function emptyNote(title, line) {
  return `<div class="empty"><b>${esc(title)}</b>${esc(line)}</div>`;
}

/* ============================================================
   5. Helpers
   ============================================================ */

/* everything from the database goes through this before it meets innerHTML */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* "3 days ago", and a plain date once it is older than a month */
function when(iso) {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);

  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? 'yesterday' : `${days} days ago`;

  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function joinedOn(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('is-up'));
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('is-up'), 2600);
}

function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

/* ============================================================
   6. Boot

   Pages do `await AppReady` before drawing anything, so the
   header already knows whether anyone is signed in.
   ============================================================ */
const AppReady = (async () => {
  await Me.load();
  mountChrome();

  /* a sign out in another tab should not leave this one looking signed in */
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && Me.signedIn()) location.reload();
  });
})();
