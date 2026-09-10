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
      <span class="face face--lg" aria-hidden="true">${esc(person.avatar || '\u{1F375}')}</span>

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
          : `<span class="note-readonly"><span aria-hidden="true">&#128213;</span> Reading only</span>`}
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
        <h2>${mine ? 'Reviews on your page' : `Reviews by ${esc(person.nickname || person.username)}`}</h2>
      </div>
    </div>

    <div id="reviews"><div class="skeleton"></div></div>`;

  loadReviews(person, mine);
});

/* every review this profile has written, newest first, each one naming the
   matcha house it is about */
async function loadReviews(person, mine) {
  const box = document.getElementById('reviews');

  const { data, error } = await sb
    .from('reviews')
    .select('id,rating,body,created_at,cafes(name,slug,emoji)')
    .eq('author_id', person.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.innerHTML = emptyNote('Could not load the entries', 'Something went wrong reaching the diary.');
    return;
  }

  if (!data.length) {
    box.innerHTML = emptyNote(
      mine ? 'Your page is still blank' : 'Nothing written yet',
      mine
        ? 'Whisk Diary is a reading room for now - reviews are added by the diary keeper.'
        : 'This girl has not written a review yet.'
    );
    return;
  }

  box.innerHTML = data.map(r => reviewRow(r, 'cafe')).join('');
}
