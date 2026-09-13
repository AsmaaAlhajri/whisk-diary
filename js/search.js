/* ============================================================
   search.js - one box, two filters.

   The state of the page is entirely in the url: ?q= what she
   typed, &filter= profiles, cafes or all. That way a search can
   be bookmarked, shared, and the back button behaves.

   With no query at all the page lists everything, so the filters
   double as a way to simply browse.
   ============================================================ */

const form = document.getElementById('searchForm');
const input = document.getElementById('q');
const chipProfiles = document.getElementById('chipProfiles');
const chipCafes = document.getElementById('chipCafes');
const summary = document.getElementById('summary');

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  readUrl();
  run();

  form.addEventListener('submit', e => {
    e.preventDefault();
    pushUrl();
    run();
  });

  /* Clicking a chip narrows the search to that kind - click Profiles and you
     get profiles, which is the only thing a filter button should ever mean.
     Clicking the one that is already on its own lifts the filter and shows
     both again, so there is a way back without hunting for a Clear button.
     Both chips on is the resting state, not "no filter chosen". */
  [chipProfiles, chipCafes].forEach(chip => {
    chip.addEventListener('click', () => {
      const other = chip === chipProfiles ? chipCafes : chipProfiles;
      const isOnlyOneOn = chip.getAttribute('aria-pressed') === 'true'
        && other.getAttribute('aria-pressed') === 'false';

      if (isOnlyOneOn) {
        chip.setAttribute('aria-pressed', 'true');
        other.setAttribute('aria-pressed', 'true');
      } else {
        chip.setAttribute('aria-pressed', 'true');
        other.setAttribute('aria-pressed', 'false');
      }

      pushUrl();
      run();
    });
  });

  /* the back button should put the old search back on screen */
  window.addEventListener('popstate', () => {
    readUrl();
    run();
  });
});

/* ---------- url in, url out ---------- */
function wantsProfiles() { return chipProfiles.getAttribute('aria-pressed') === 'true'; }
function wantsCafes() { return chipCafes.getAttribute('aria-pressed') === 'true'; }

function filterName() {
  if (wantsProfiles() && wantsCafes()) return 'all';
  return wantsProfiles() ? 'profiles' : 'cafes';
}

function readUrl() {
  const url = new URLSearchParams(location.search);
  input.value = url.get('q') || '';

  const f = url.get('filter') || 'all';
  chipProfiles.setAttribute('aria-pressed', String(f !== 'cafes'));
  chipCafes.setAttribute('aria-pressed', String(f !== 'profiles'));
}

function pushUrl() {
  const url = `search.html?q=${encodeURIComponent(input.value.trim())}&filter=${filterName()}`;
  history.pushState(null, '', url);
}

/* ---------- the search ---------- */
async function run() {
  const raw = input.value.trim();
  const q = cleanQuery(raw);

  const profilesBlock = document.getElementById('profilesBlock');
  const cafesBlock = document.getElementById('cafesBlock');

  profilesBlock.hidden = !wantsProfiles();
  cafesBlock.hidden = !wantsCafes();

  /* Headings only earn their place when both kinds are on screen and you
     need telling which is which. Filter down to one and the results are
     simply the results - no section to divide. */
  const both = wantsProfiles() && wantsCafes();
  profilesBlock.querySelector('.section-head').hidden = !both;
  cafesBlock.querySelector('.section-head').hidden = !both;

  /* with the headings gone, this line is the only thing naming what she is
     looking at, so it says which kind rather than just "results" */
  const noun = n => {
    if (both) return n === 1 ? 'result' : 'results';
    if (wantsProfiles()) return n === 1 ? 'profile' : 'profiles';
    return n === 1 ? 'matcha house' : 'matcha houses';
  };

  const browsing = both
    ? 'Everything in the diary, every account and every matcha house.'
    : wantsProfiles()
      ? 'Every account in the diary.'
      : 'Every matcha house in the diary.';

  summary.textContent = raw ? `Searching for “${raw}”…` : browsing;

  const jobs = [];
  if (wantsProfiles()) jobs.push(findProfiles(q));
  if (wantsCafes()) jobs.push(findCafes(q));

  const counts = await Promise.all(jobs);
  const found = counts.reduce((a, b) => a + b, 0);

  if (!raw) return;

  summary.textContent = found
    ? `${found} ${noun(found)} for “${raw}”.`
    : `Nothing matched “${raw}”. Try a shorter word, or the other filter.`;
}

/* username and nickname are both worth matching - she may know a girl by
   either one */
async function findProfiles(q) {
  const box = document.getElementById('profilesResults');
  box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

  let query = sb.from('profile_cards').select('*');

  if (q) query = query.or(`username.ilike.%${q}%,nickname.ilike.%${q}%`);

  const { data, error } = await query
    .order('followers_count', { ascending: false })
    .limit(48);

  if (error) {
    box.innerHTML = emptyNote('Could not search', 'Something went wrong reaching the diary. Try again in a moment.');
    return 0;
  }

  document.getElementById('profilesHeading').textContent =
    data.length ? `Profiles (${data.length})` : 'Profiles';

  box.innerHTML = data.length
    ? data.map(personCard).join('')
    : emptyNote('No profiles', q ? 'No username or nickname matches that.' : 'No accounts yet.');

  return data.length;
}

/* a matcha house can be found by its name, its area, or a word in its blurb */
async function findCafes(q) {
  const box = document.getElementById('cafesResults');
  box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

  let query = sb.from('cafe_cards').select('*');

  if (q) query = query.or(`name.ilike.%${q}%,area.ilike.%${q}%,blurb.ilike.%${q}%`);

  const { data, error } = await query
    .order('reviews_count', { ascending: false })
    .limit(48);

  if (error) {
    box.innerHTML = emptyNote('Could not search', 'Something went wrong reaching the diary. Try again in a moment.');
    return 0;
  }

  document.getElementById('cafesHeading').textContent =
    data.length ? `Matcha houses (${data.length})` : 'Matcha houses';

  box.innerHTML = data.length
    ? data.map(cafeCard).join('')
    : emptyNote('No matcha houses', q ? 'No matcha house name, area or note matches that.' : 'No matcha houses listed yet.');

  return data.length;
}
