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
       account behind them - so the profile row has to be looked up. We ask
       the database "which profile am I?" rather than reading the column that
       links the two, because that column is no longer published to anyone:
       it is also the folder name where a girl's pictures are kept. */
    const { data: ownId } = await sb.rpc('my_profile_id');

    if (!ownId) return null;

    /* profile_cards is the same row plus the three public counts */
    const { data } = await sb
      .from('profile_cards')
      .select('*')
      .eq('id', ownId)
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
        <div class="searchbox__field">
          <span class="searchbox__icon" aria-hidden="true">\u{1F50E}</span>
          <label class="sr-only" for="topSearchInput">Search profiles and matcha houses</label>
          <input id="topSearchInput" type="search" name="q" placeholder="Search profiles or matcha houses…"
                 autocomplete="off">
        </div>
        <div class="searchbox__filters">
          <span class="sr-only" id="topFilterLabel">Show</span>
          <button class="chip chip--mini chip--blush" type="button" id="topProfiles"
                  aria-pressed="true" aria-describedby="topFilterLabel">Profiles</button>
          <button class="chip chip--mini" type="button" id="topHouses"
                  aria-pressed="true" aria-describedby="topFilterLabel">Matcha houses</button>
        </div>
      </form>
      ${account}
    </div>`;

  const footer = document.createElement('footer');
  footer.className = 'foot';
  footer.innerHTML = `
    <div class="wrap foot__row">
      <span>Whisk Diary · a community diary for matcha lovers · Kuwait 2026</span>
      <nav aria-label="Footer">
        ${me ? '' : '<a href="login.html">Sign in</a>'}
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

  /* her own page if she has one, the sign in page if she has not */
  const mine = me
    ? `profile.html?u=${encodeURIComponent(me.username)}`
    : 'login.html?next=index.html';

  bar.innerHTML = `
    ${tab('index.html', 'home', '\u{1F3E0}', 'Home')}
    ${tab('explore.html', 'explore', '\u{1F9ED}', 'Explore')}
    ${tab(gated ? gated + 'create.html' : 'create.html', 'create',
          '\u{1F58B}\u{FE0F}', 'Write')}
    ${tab('search.html', 'search', '\u{1F50E}', 'Search')}
    ${tab(gated ? gated + 'messages.html' : 'messages.html', 'messages',
          '\u{1F4AC}', 'Messages')}
    ${tab(mine, 'profile', '\u{1F337}', 'My page')}`;

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

/* ============================================================
   The search box in the header

   The two chips under it choose what to look for, from any page,
   so she does not have to land on the results page first and then
   narrow it. They behave exactly like the pair on the search page:
   clicking one selects that kind, clicking the one already on its
   own lifts the filter and shows both again.
   ============================================================ */
function wireSearchBox() {
  const form = document.getElementById('topSearch');
  if (!form) return;

  const input = form.querySelector('input');
  const chipProfiles = document.getElementById('topProfiles');
  const chipHouses = document.getElementById('topHouses');

  const url = new URLSearchParams(location.search);

  /* if we are already on the results page, show what was searched and
     which way it was narrowed */
  const asked = url.get('q');
  if (asked) input.value = asked;

  const startingFilter = url.get('filter') || 'all';
  chipProfiles.setAttribute('aria-pressed', String(startingFilter !== 'cafes'));
  chipHouses.setAttribute('aria-pressed', String(startingFilter !== 'profiles'));

  const chosen = () => {
    const p = chipProfiles.getAttribute('aria-pressed') === 'true';
    const h = chipHouses.getAttribute('aria-pressed') === 'true';
    if (p && h) return 'all';
    return p ? 'profiles' : 'cafes';
  };

  const goSearch = q =>
    `search.html?q=${encodeURIComponent(q)}&filter=${chosen()}`;

  [chipProfiles, chipHouses].forEach(chip => {
    chip.addEventListener('click', () => {
      const other = chip === chipProfiles ? chipHouses : chipProfiles;
      const onlyThisOne = chip.getAttribute('aria-pressed') === 'true'
        && other.getAttribute('aria-pressed') === 'false';

      chip.setAttribute('aria-pressed', 'true');
      other.setAttribute('aria-pressed', String(onlyThisOne));

      /* On the results page a change should show immediately, otherwise
         she would be staring at results that no longer match the chips.
         Anywhere else it just waits for her to search. */
      if (document.body.dataset.page === 'search') {
        location.href = goSearch(input.value.trim());
      }
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    location.href = goSearch(q);
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

/* ============================================================
   The three dots

   Shown only on your own entries, and only listing what that
   kind allows: a post may be pinned, edited or deleted; a review
   may only be deleted. Every page gets this for free because the
   clicks are caught once, at the bottom of this file.
   ============================================================ */
function ownerMenu(kind, item) {
  const me = Me.profile();
  if (!me || me.id !== item.author_id) return '';

  const pin = item.pinned
    ? `<button type="button" data-act="unpin">Unpin from my page</button>`
    : `<button type="button" data-act="pin">Pin to my page</button>`;

  const forPost = kind === 'post'
    ? `${pin}<button type="button" data-act="edit">Edit</button>`
    : '';

  return `
    <div class="dots" data-kind="${kind}" data-id="${esc(item.id)}">
      <button class="dots__button" type="button" aria-haspopup="true" aria-expanded="false"
              aria-label="More for this ${kind}">&#8943;</button>
      <div class="dots__menu" hidden>
        ${forPost}
        <button type="button" data-act="delete" class="is-danger">Delete</button>
      </div>
    </div>`;
}

/* "3 days ago", plus "edited an hour ago" when it has been changed. The
   exact stamp is on the title, so hovering gives the real date and time. */
function stamps(item) {
  const made = `<time class="review__when" datetime="${item.created_at}"
                      title="Posted ${fullWhen(item.created_at)}">${when(item.created_at)}</time>`;

  if (!item.edited_at) return made;

  return `${made}<span class="review__edited"
                       title="Edited ${fullWhen(item.edited_at)}">edited ${when(item.edited_at)}</span>`;
}

/* a post: an entry about nothing in particular, and the only kind that
   carries a place */
function postCard(p) {
  return `
    <article class="review review--post${p.pinned ? ' is-pinned' : ''}" data-entry="${esc(p.id)}">
      <div class="review__top">
        ${faceHtml(p, 'face face--sm')}
        <a class="review__who" href="profile.html?u=${encodeURIComponent(p.username || '')}">${esc(p.nickname || p.username || 'Someone')}</a>
        <span class="tag tag--post">Post</span>
        ${p.pinned ? `<span class="tag tag--pinned">\u{1F4CC} Pinned</span>` : ''}
        ${stamps(p)}
        ${ownerMenu('post', p)}
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
    <article class="review" data-entry="${esc(r.id)}">
      <div class="review__top">
        ${head}
        <span class="stars" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating)}<span style="color:var(--rule)">${'★'.repeat(5 - r.rating)}</span></span>
        ${stamps(r)}
        ${ownerMenu('review', r)}
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

/* the real date and time, for the tooltip behind a relative one */
function fullWhen(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ============================================================
   The three dots, wired once for every page

   Clicks are caught on the document, so a page that draws entries
   after loading - which is all of them - needs no wiring of its
   own. Row level security is the real guard here: the delete and
   update below only touch rows the signed-in girl owns, whatever
   id this code sends.
   ============================================================ */
document.addEventListener('click', async e => {
  /* clicking anywhere else closes an open menu */
  const inside = e.target.closest('.dots');
  document.querySelectorAll('.dots__menu').forEach(menu => {
    if (menu.parentElement !== inside) {
      menu.hidden = true;
      menu.previousElementSibling.setAttribute('aria-expanded', 'false');
    }
  });

  if (!inside) return;

  const toggle = e.target.closest('.dots__button');
  if (toggle) {
    const menu = inside.querySelector('.dots__menu');
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
    return;
  }

  const button = e.target.closest('[data-act]');
  if (!button) return;

  const kind = inside.dataset.kind;
  const id = inside.dataset.id;
  const table = kind === 'post' ? 'posts' : 'reviews';

  inside.querySelector('.dots__menu').hidden = true;

  if (button.dataset.act === 'edit') {
    location.href = `create.html?edit=${encodeURIComponent(id)}`;
    return;
  }

  if (button.dataset.act === 'delete') {
    const what = kind === 'post' ? 'post' : 'review';
    if (!confirm(`Delete this ${what}? It cannot be brought back.`)) return;

    /* Ask for the file name before the row goes, or it is lost with the row
       and the picture stays in the bucket for ever, readable by anyone who
       kept the link. Deleting a row is not deleting a photograph. */
    const { data: had } = await sb
      .from(table)
      .select('media_path')
      .eq('id', id)
      .maybeSingle();

    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return toast('That would not delete.');

    if (had && had.media_path) {
      const gone = await sb.storage.from('media').remove([had.media_path]);
      if (gone.error) toast('Entry deleted, but the picture would not go. Try again.');
    }

    const card = document.querySelector(`[data-entry="${CSS.escape(id)}"]`);
    if (card) card.remove();
    toast(`${what[0].toUpperCase()}${what.slice(1)} deleted.`);
    return;
  }

  /* pinning: unpin whatever is pinned first, because the database allows
     only one and would refuse the second */
  if (button.dataset.act === 'pin' || button.dataset.act === 'unpin') {
    const me = Me.profile();
    if (!me) return;

    const wantPinned = button.dataset.act === 'pin';

    if (wantPinned) {
      await sb.from('posts').update({ pinned: false })
        .eq('author_id', me.id).eq('pinned', true);
    }

    const { error } = await sb.from('posts').update({ pinned: wantPinned }).eq('id', id);
    if (error) return toast('That would not pin.');

    toast(wantPinned ? 'Pinned to your page \u{1F4CC}' : 'Unpinned.');
    setTimeout(() => location.reload(), 700);
  }
});

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
/* Coming back from Google or Apple, the browser lands with the tokens in the
   url hash. supabase-js reads them itself, but two things still need doing:
   wait for it to finish before anyone asks who is signed in, and get the
   tokens out of the address bar afterwards so they are not sitting in her
   history or in a link she pastes to a friend. */
async function settleOAuthReturn() {
  if (!/access_token|error_description/.test(location.hash)) return;

  await sb.auth.getSession();
  history.replaceState(null, '', location.pathname + location.search);
}

const AppReady = (async () => {
  await settleOAuthReturn();
  await Me.load();
  mountChrome();

  /* a sign out in another tab should not leave this one looking signed in */
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && Me.signedIn()) location.reload();
  });
})();
