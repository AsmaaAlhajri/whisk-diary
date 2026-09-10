/* ============================================================
   cafe.js - one matcha cafe, and everything written about it.

   Read only, like the rest of the site: the rating shown is the
   average of the entries below it, and there is no way from this
   page to add another.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  const main = document.getElementById('main');
  const slug = param('c');

  if (!slug) return location.replace('search.html?filter=cafes');

  const { data: cafe, error } = await sb
    .from('cafe_cards')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !cafe) {
    main.innerHTML = `
      <p class="eyebrow">Whisk Diary</p>
      <h1>That cafe is not in the diary.</h1>
      <p class="hand">not yet, anyway</p>
      <p class="muted">The link may be old, or the name may have changed.</p>
      <p style="margin-top:1.4rem">
        <a class="btn" href="search.html?filter=cafes">Browse the matcha cafes</a>
      </p>`;
    return;
  }

  document.title = `Whisk Diary · ${cafe.name}`;

  main.innerHTML = `
    <header class="cafe-head fade-in">
      <span class="cafe-head__emoji" aria-hidden="true">${esc(cafe.emoji || '\u{1F375}')}</span>

      <div style="flex:1;min-width:0">
        ${cafeMeta(cafe)}
        <h1 style="margin-bottom:.35rem">${esc(cafe.name)}</h1>
        ${cafe.blurb ? `<p class="muted" style="margin-bottom:.6rem">${esc(cafe.blurb)}</p>` : ''}
        ${stars(cafe.avg_rating, cafe.reviews_count)}
      </div>

      <span class="note-readonly"><span aria-hidden="true">&#128213;</span> Reading only</span>
    </header>

    <div class="section-head">
      <div>
        <p class="eyebrow">What the girls said</p>
        <h2>Entries about ${esc(cafe.name)}</h2>
      </div>
      ${cafe.area ? `
      <a class="btn btn--ghost btn--small" href="search.html?q=${encodeURIComponent(cafe.area)}&filter=cafes">
        More in ${esc(cafe.area)}
      </a>` : `
      <a class="btn btn--ghost btn--small" href="search.html?filter=cafes">
        All the cafes
      </a>`}
    </div>

    <div id="reviews"><div class="skeleton"></div></div>`;

  loadReviews(cafe);
});

async function loadReviews(cafe) {
  const box = document.getElementById('reviews');

  const { data, error } = await sb
    .from('reviews')
    .select('id,rating,body,created_at,profiles(username,nickname,avatar)')
    .eq('cafe_id', cafe.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.innerHTML = emptyNote('Could not load the entries', 'Something went wrong reaching the diary.');
    return;
  }

  if (!data.length) {
    box.innerHTML = emptyNote('Nobody has written about this one', 'It is waiting for its first entry.');
    return;
  }

  box.innerHTML = data.map(r => reviewRow(r, 'person')).join('');
}
