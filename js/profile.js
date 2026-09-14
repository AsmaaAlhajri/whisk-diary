/* ============================================================
   profile.js - one account, exactly as the public sees it.

   Everything on this page is public: username, nickname, the two
   follow counts and the reviews. An email never appears here, not
   even on her own profile - that lives on edit-profile.html and
   only she can open it.

   The one difference on her own page is the Edit profile button.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  const main = document.getElementById('main');
  let username = param('u');

  /* profile.html with no name: her own page, or the sign in page */
  if (!username) {
    const me = Me.profile();
    if (me) return location.replace(`profile.html?u=${encodeURIComponent(me.username)}`);
    return location.replace('login.html');
  }

  /* usernames are unique regardless of case, so the lookup is too */
  const { data: person, error } = await sb
    .from('profile_cards')
    .select('*')
    .ilike('username', username)
    .maybeSingle();

  if (error || !person) {
    main.innerHTML = `
      <p class="eyebrow">Whisk Diary</p>
      <h1>No page under that name.</h1>
      <p class="hand">@${esc(username)} has not written here</p>
      <p class="muted">The username may have changed, or the link may have a typo in it.</p>
      <p style="margin-top:1.4rem">
        <a class="btn" href="search.html?filter=profiles">Search the profiles</a>
      </p>`;
    return;
  }

  const me = Me.profile();
  const mine = !!me && me.id === person.id;

  document.title = `Whisk Diary · @${person.username}`;

  main.innerHTML = `
    <header class="profile-head fade-in">
      ${faceHtml(person, 'face face--lg')}

      <div class="profile-head__main">
        <h1 class="profile-head__name">${esc(person.nickname || person.username)}</h1>
        <p class="profile-head__handle">@${esc(person.username)}</p>
        ${person.bio
          ? `<p class="profile-head__bio">${esc(person.bio)}</p>`
          : `<p class="profile-head__bio muted">${mine
              ? 'Your page has no little note yet - add one from Edit profile.'
              : 'No note on this page yet.'}</p>`}
        <p class="profile-head__joined">Keeping this diary since ${joinedOn(person.created_at)}</p>
      </div>

      <div class="profile-head__actions">
        ${mine
          ? `<a class="btn" href="edit-profile.html">&#9998; Edit profile</a>`
          : `<div class="profile-head__row">
               <button class="btn" type="button" id="followBtn">Follow</button>
               <a class="btn btn--blush" href="messages.html?to=${encodeURIComponent(person.username)}">
                 <span aria-hidden="true">&#128172;</span> Message
               </a>
               <div class="dots" id="profileDots">
                 <button class="dots__button" type="button" aria-haspopup="true" aria-expanded="false"
                         aria-label="More about this page">&#8943;</button>
                 <div class="dots__menu" hidden>
                   <button type="button" data-act="share">Share profile</button>
                   <button type="button" data-act="remove-follower" hidden>Remove follower</button>
                   <button type="button" data-act="block" class="is-danger">Block</button>
                 </div>
               </div>
             </div>`}
      </div>
    </header>

    <div class="stats fade-in">
      <div class="stat"><b>${person.followers_count}</b><span>Followers</span></div>
      <div class="stat"><b>${person.following_count}</b><span>Following</span></div>
      <div class="stat"><b>${person.reviews_count}</b><span>Reviews</span></div>
    </div>

    <div class="section-head">
      <div>
        <p class="eyebrow">${mine ? 'Your entries' : 'Her entries'}</p>
        <h2>${mine ? 'Everything you have written' : `Everything ${esc(person.nickname || person.username)} has written`}</h2>
      </div>
      ${mine ? `<a class="btn btn--small" href="create.html">&#128395;&#65039; Write something</a>` : ''}
    </div>

    <div id="reviews"><div class="skeleton"></div></div>`;

  loadEntries(person, mine);
  if (!mine) drawRelationship(person, me);
});

/* ============================================================
   Follow, block, share, remove follower

   Every one of these only shows what the database already allows.
   Following is refused unless the row is in her own name, and a
   blocked pair cannot follow each other at all, so none of these
   buttons is what does the stopping.
   ============================================================ */
async function drawRelationship(person, me) {
  const followBtn = document.getElementById('followBtn');
  const dots = document.getElementById('profileDots');
  if (!followBtn || !dots) return;

  /* signed out: the button is a way in, not a dead end */
  if (!me) {
    followBtn.addEventListener('click', () => {
      location.href = 'login.html?next=index.html';
    });
    dots.querySelector('[data-act="remove-follower"]').hidden = true;
    wireMenu(person, me, false);
    return;
  }

  const [iFollow, theyFollow, blocked] = await Promise.all([
    sb.from('follows').select('following_id')
      .eq('follower_id', me.id).eq('following_id', person.id).maybeSingle(),
    sb.from('follows').select('follower_id')
      .eq('follower_id', person.id).eq('following_id', me.id).maybeSingle(),
    sb.from('blocks').select('blocked_id')
      .eq('blocker_id', me.id).eq('blocked_id', person.id).maybeSingle()
  ]);

  const following = !!iFollow.data;
  const followsMe = !!theyFollow.data;
  const isBlocked = !!blocked.data;

  followBtn.textContent = following ? 'Unfollow' : 'Follow';
  followBtn.classList.toggle('btn--ghost', following);
  followBtn.disabled = isBlocked;

  /* moots - each following the other - is what decides whether a message
     lands in her inbox or in her requests */
  if (following && followsMe) {
    followBtn.title = 'You follow each other, so your messages go straight to her.';
  }

  followBtn.onclick = async () => {
    followBtn.disabled = true;

    const { error } = following
      ? await sb.from('follows').delete()
          .eq('follower_id', me.id).eq('following_id', person.id)
      : await sb.from('follows').insert({ follower_id: me.id, following_id: person.id });

    followBtn.disabled = false;
    if (error) return toast(/too_fast/.test(error.message)
      ? 'That is a lot of following in one hour. Try again shortly.'
      : 'That would not save.');

    toast(following ? 'Unfollowed.' : 'Followed.');
    location.reload();
  };

  const removeItem = dots.querySelector('[data-act="remove-follower"]');
  removeItem.hidden = !followsMe;

  const blockItem = dots.querySelector('[data-act="block"]');
  blockItem.textContent = isBlocked ? 'Unblock' : 'Block';
  blockItem.dataset.act = isBlocked ? 'unblock' : 'block';

  wireMenu(person, me, isBlocked);
}

function wireMenu(person, me, isBlocked) {
  const dots = document.getElementById('profileDots');

  dots.addEventListener('click', async e => {
    const button = e.target.closest('[data-act]');
    if (!button) return;

    const act = button.dataset.act;

    if (act === 'share') return shareProfile(person);

    if (!me) return (location.href = 'login.html?next=index.html');

    if (act === 'remove-follower') {
      if (!confirm(`Remove ${person.nickname || person.username} from your followers?`)) return;
      const { error } = await sb.from('follows').delete()
        .eq('follower_id', person.id).eq('following_id', me.id);
      if (error) return toast('That would not save.');
      toast('Removed.');
      return location.reload();
    }

    if (act === 'block' || act === 'unblock') {
      if (act === 'block' && !confirm(
        `Block ${person.nickname || person.username}? They will not be able to message you.`)) return;

      const { error } = act === 'block'
        ? await sb.from('blocks').insert({ blocker_id: me.id, blocked_id: person.id })
        : await sb.from('blocks').delete()
            .eq('blocker_id', me.id).eq('blocked_id', person.id);

      if (error) return toast('That would not save.');
      toast(act === 'block' ? 'Blocked.' : 'Unblocked.');
      return location.reload();
    }
  });
}

/* the phone share sheet where there is one, the clipboard otherwise, and
   the plain address if the browser refuses both */
async function shareProfile(person) {
  const url = new URL(`profile.html?u=${encodeURIComponent(person.username)}`, location.href).href;
  const title = `${person.nickname || person.username} on Whisk Diary`;

  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch (err) {
    prompt('Copy this link', url);
  }
}

/* Everything she has written - posts and reviews together, newest first.
   They live in two tables, so they are merged here rather than in sql. */
async function loadEntries(person, mine) {
  const box = document.getElementById('reviews');

  const [reviews, posts] = await Promise.all([
    sb.from('reviews')
      .select('id,author_id,rating,body,created_at,media_path,media_type,cafes(name,slug,emoji)')
      .eq('author_id', person.id)
      .order('created_at', { ascending: false }),

    sb.from('post_cards')
      .select('*')
      .eq('author_id', person.id)
      .order('created_at', { ascending: false })
  ]);

  if (reviews.error && posts.error) {
    box.innerHTML = emptyNote('Could not load the entries', 'Something went wrong reaching the diary.');
    return;
  }

  /* newest first, except the one pinned post, which sits at the top of her
     page however old it is - that is what pinning is for */
  const entries = [
    ...(reviews.data || []).map(r => ({ at: r.created_at, pinned: false, html: reviewRow(r, 'cafe') })),
    ...(posts.data || []).map(p => ({ at: p.created_at, pinned: !!p.pinned, html: postCard(p) }))
  ].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.at) - new Date(a.at)));

  if (!entries.length) {
    box.innerHTML = emptyNote(
      mine ? 'Your page is still blank' : 'Nothing written yet',
      mine
        ? 'Press the pen at the bottom of the screen to write your first entry.'
        : 'This girl has not written anything yet.'
    );
    return;
  }

  box.innerHTML = entries.map(e => e.html).join('');
}
