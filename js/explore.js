/* ============================================================
   explore.js - fills the shelves on explore.html.

   This is the page meant to be customised, so it is built to be
   edited. Two rules keep it safe to change:

     1. Every filler checks its container exists first, so deleting
        a shelf from explore.html breaks nothing here.
     2. The moodboard is data, not markup - edit MOODS below and
        the tiles change.
   ============================================================ */

/* ------------------------------------------------------------
   MOODS - the tiles at the top. Each is a link into the search
   page, so `q` is what gets typed in the box and `filter` is
   which of the two chips is on: 'cafes', 'profiles' or 'all'.
   Reorder, reword, add or remove freely.
   ------------------------------------------------------------ */
const MOODS = [
  { emoji: '\u{1F367}', label: 'Iced &amp; sweet',   q: 'iced',       filter: 'cafes' },
  { emoji: '\u{1F375}', label: 'Ceremonial grade',   q: 'ceremonial', filter: 'cafes' },
  { emoji: '\u{1F4D6}', label: 'Quiet corners',      q: 'quiet',      filter: 'cafes' },
  { emoji: '\u{1F370}', label: 'Cake with it',       q: 'cake',       filter: 'cafes' },
  { emoji: '\u{1F305}', label: 'Open early',         q: 'open',       filter: 'cafes' },
  { emoji: '\u{1F33F}', label: 'Terraces',           q: 'terrace',    filter: 'cafes' },
  { emoji: '\u{1F338}', label: 'Girls like me',      q: 'matcha',     filter: 'profiles' },
  { emoji: '\u{2728}',  label: 'Everything',         q: '',           filter: 'all' }
];

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  drawMoods();
  loadNewcomers();
  loadBusiest();
  loadAreas();
  loadRandomEntry();
});

/* ---------- the moodboard ---------- */
function drawMoods() {
  const box = document.getElementById('moods');
  if (!box) return;

  box.innerHTML = MOODS.map(m => `
    <a class="mood" href="search.html?q=${encodeURIComponent(m.q)}&filter=${m.filter}">
      <span aria-hidden="true">${m.emoji}</span>${m.label}
    </a>`).join('');
}

/* ---------- the newest accounts ---------- */
async function loadNewcomers() {
  const box = document.getElementById('newcomers');
  if (!box) return;

  const { data, error } = await sb
    .from('profile_cards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(4);

  if (error || !data.length) {
    box.innerHTML = emptyNote('No pages yet', 'New accounts will show up here.');
    return;
  }

  box.classList.add('fade-in');
  box.innerHTML = data.map(personCard).join('');
}

/* ---------- the most reviewed matcha houses ---------- */
async function loadBusiest() {
  const box = document.getElementById('busiest');
  if (!box) return;

  const { data, error } = await sb
    .from('cafe_cards')
    .select('*')
    .order('reviews_count', { ascending: false })
    .limit(4);

  if (error || !data.length) {
    box.innerHTML = emptyNote('No matcha houses yet', 'Matcha houses will show up here once they are added.');
    return;
  }

  box.classList.add('fade-in');
  box.innerHTML = data.map(cafeCard).join('');
}

/* ---------- every neighbourhood that has a matcha house in it ---------- */
async function loadAreas() {
  const box = document.getElementById('areas');
  if (!box) return;

  const { data, error } = await sb.from('cafes').select('area');

  if (error || !data.length) {
    box.innerHTML = '<span class="small muted">Areas appear here once the matcha houses have one.</span>';
    return;
  }

  /* count them here rather than asking the database to group */
  const counts = new Map();
  data.forEach(row => {
    if (!row.area) return;
    counts.set(row.area, (counts.get(row.area) || 0) + 1);
  });

  const areas = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  if (!areas.length) {
    box.innerHTML = '<span class="small muted">Areas appear here once the matcha houses have one.</span>';
    return;
  }

  box.innerHTML = areas.map(([area, n]) => `
    <a class="chip" href="search.html?q=${encodeURIComponent(area)}&filter=cafes">
      ${esc(area)} <b style="color:var(--matcha-deep)">${n}</b>
    </a>`).join('');
}

/* ---------- one random entry ---------- */
/* There is no cheap "order by random" over the api, so we take the newest
   handful and pick one of those in the browser. */
async function loadRandomEntry() {
  const box = document.getElementById('randomEntry');
  if (!box) return;

  const { data, error } = await sb
    .from('reviews')
    .select('id,author_id,rating,body,created_at,media_path,media_type,profiles(username,nickname,avatar,avatar_path),cafes(name,slug,emoji)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data.length) {
    box.innerHTML = emptyNote('Nothing to open', 'The first entries will appear here.');
    return;
  }

  const pick = data[Math.floor(Math.random() * data.length)];
  box.classList.add('fade-in');
  box.innerHTML = reviewRow(pick, 'person');
}
