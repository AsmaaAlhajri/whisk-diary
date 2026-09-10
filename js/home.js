/* ============================================================
   home.js - the greeting, then three shelves of what is new.

   The greeting has two moods. Signed out it welcomes every
   matcha lover; signed in it is addressed to her by nickname
   and changes with the hour.
   ============================================================ */

/* ---------- the words ---------- */

/* signed out: a different welcome each visit, all of them for everyone */
const WELCOMES = [
  {
    title: 'Hello, matcha <em>darling</em>.',
    hand: 'the kettle is already on&hellip;',
    lede: 'Whisk Diary is a little community diary of matcha &mdash; the matcha houses we adore, the cups we cannot stop thinking about, and the girls who write it all down. Pull up a chair and read as long as you like.'
  },
  {
    title: 'Come in, <em>matcha lovers</em>.',
    hand: 'shoes off, whisk out, page open',
    lede: 'Every review here was written by someone who really did sit down with that cup. Wander the profiles, follow the matcha houses, and let somebody else do the ordering for once.'
  },
  {
    title: 'Sweet girl, <em>you found us</em>.',
    hand: 'a whole diary, all of it green',
    lede: 'This is where matcha lovers keep their notes &mdash; which matcha house foams it properly, which one is too sweet, and which one is worth the drive across Kuwait.'
  },
  {
    title: 'Whisked, poured, <em>written down</em>.',
    hand: 'one cup, one little entry',
    lede: 'A community of matcha girls with strong opinions about ceremonial grade. Read every page for free; make an account when you would like one of your own.'
  }
];

/* signed in: the hour of the day picks the line */
function personalGreeting(name) {
  const hour = new Date().getHours();

  if (hour < 5) return {
    title: `Still up, <em>${name}</em>?`,
    hand: 'hojicha at this hour, not matcha'
  };
  if (hour < 12) return {
    title: `Good morning, <em>${name}</em>.`,
    hand: 'first whisk of the day is yours'
  };
  if (hour < 17) return {
    title: `Afternoon, <em>${name}</em>.`,
    hand: 'iced, tall, and no arguments'
  };
  if (hour < 21) return {
    title: `Evening, <em>${name}</em>.`,
    hand: 'the diary saved you a page'
  };
  return {
    title: `Late night, <em>${name}</em>.`,
    hand: 'one more entry before bed'
  };
}

/* ---------- the page ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  drawGreeting();
  loadLatest();
  loadPeople();
  loadCafes();
});

function drawGreeting() {
  const eyebrow = document.getElementById('heroEyebrow');
  const title = document.getElementById('heroTitle');
  const hand = document.getElementById('heroHand');
  const lede = document.getElementById('heroLede');
  const cta = document.getElementById('heroCta');

  const me = Me.profile();

  if (!me) {
    const w = WELCOMES[Math.floor(Math.random() * WELCOMES.length)];
    eyebrow.textContent = 'Whisk Diary';
    title.innerHTML = w.title;
    hand.innerHTML = w.hand;
    lede.innerHTML = w.lede;
    cta.innerHTML = `
      <a class="btn" href="login.html?tab=signup">Make an account</a>
      <a class="btn btn--ghost" href="explore.html">Look around first</a>`;
    return;
  }

  const g = personalGreeting(esc(Me.firstName() || me.username));
  eyebrow.textContent = `@${me.username}`;
  title.innerHTML = g.title;
  hand.innerHTML = g.hand;

  /* a brand new page has nothing to count, so say something kinder than
     three zeroes */
  const brandNew = !me.following_count && !me.followers_count && !me.reviews_count;

  lede.innerHTML = brandNew
    ? `Your page is open and completely blank &mdash; which is the nicest way
       to start. Wander the diary and see whose notes you agree with.`
    : `You are following <b>${me.following_count}</b>
       ${me.following_count === 1 ? 'diary' : 'diaries'},
       <b>${me.followers_count}</b> ${me.followers_count === 1 ? 'girl reads' : 'girls read'} yours,
       and there ${me.reviews_count === 1 ? 'is' : 'are'} <b>${me.reviews_count}</b>
       ${me.reviews_count === 1 ? 'review' : 'reviews'} on your page.`;
  cta.innerHTML = `
    <a class="btn" href="explore.html">Explore today</a>
    <a class="btn btn--ghost" href="profile.html?u=${encodeURIComponent(me.username)}">My profile</a>
    <a class="btn btn--ghost" href="edit-profile.html">Edit profile</a>
    <button class="btn btn--ghost" type="button" id="signOut">Sign out</button>`;

  document.getElementById('signOut').addEventListener('click', () => Me.signOut());
}

/* the newest reviews anywhere in the diary */
async function loadLatest() {
  const box = document.getElementById('latest');

  const { data, error } = await sb
    .from('reviews')
    .select('id,rating,body,created_at,profiles(username,nickname,avatar),cafes(name,slug,emoji)')
    .order('created_at', { ascending: false })
    .limit(4);

  if (error || !data || !data.length) {
    box.innerHTML = emptyNote('A blank page', 'No entries yet - the first one will show up here.');
    return;
  }

  box.classList.add('fade-in');
  box.innerHTML = data.map(r => reviewRow(r, 'person')).join('');
}

/* the most followed profiles */
async function loadPeople() {
  const box = document.getElementById('people');

  const { data, error } = await sb
    .from('profile_cards')
    .select('*')
    .order('followers_count', { ascending: false })
    .limit(4);

  if (error || !data || !data.length) {
    box.innerHTML = emptyNote('Nobody yet', 'The first accounts will appear here.');
    return;
  }

  box.classList.add('fade-in');
  box.innerHTML = data.map(personCard).join('');
}

/* the best rated matcha houses, ties broken by how many wrote about them */
async function loadCafes() {
  const box = document.getElementById('cafes');

  const { data, error } = await sb
    .from('cafe_cards')
    .select('*')
    .order('avg_rating', { ascending: false, nullsFirst: false })
    .order('reviews_count', { ascending: false })
    .limit(4);

  if (error || !data || !data.length) {
    box.innerHTML = emptyNote('No matcha houses listed', 'Matcha houses will appear here once they are added.');
    return;
  }

  box.classList.add('fade-in');
  box.innerHTML = data.map(cafeCard).join('');
}
