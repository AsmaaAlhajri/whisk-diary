/* ============================================================
   messages.js - the one private corner of the diary.

   Messages are two columns and a policy: a row names a sender and
   a recipient, and row level security lets exactly those two read
   it. There is no conversations table, so there is no membership
   to recurse through and nothing for a signed-out visitor to see -
   anon has no grant on the table at all.

   A conversation is therefore not a thing in the database; it is
   every row between me and one other girl, gathered here.
   ============================================================ */

let me = null;
let openWith = null;      /* the profile id of whoever is on screen */
let everyone = new Map(); /* profile id -> her public card */

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  if (!Me.signedIn() || !Me.profile()) {
    location.replace('login.html?next=messages.html');
    return;
  }

  me = Me.profile();

  document.getElementById('dmForm').addEventListener('submit', send);

  await drawList();

  /* profile.html links here with ?to=<username> */
  const wanted = param('to');
  if (wanted) {
    const { data } = await sb
      .from('profile_cards')
      .select('*')
      .ilike('username', wanted)
      .maybeSingle();

    if (data && data.id !== me.id) {
      everyone.set(data.id, data);
      await openThread(data.id);
    }
  }
});

/* ============================================================
   The list of people
   ============================================================ */

/* Every message I am part of, newest first, folded down to one row
   per person. Done in the browser: the whole point of this table is
   that it is small and mine. */
async function conversations() {
  const { data, error } = await sb
    .from('direct_messages')
    .select('*')
    .or(`sender_id.eq.${me.id},recipient_id.eq.${me.id}`)
    .order('created_at', { ascending: false })
    .limit(400);

  if (error || !data) return [];

  const byPerson = new Map();

  data.forEach(m => {
    const otherId = m.sender_id === me.id ? m.recipient_id : m.sender_id;
    if (!byPerson.has(otherId)) {
      byPerson.set(otherId, { otherId, last: m, unread: 0 });
    }
    if (m.recipient_id === me.id && !m.read_at) {
      byPerson.get(otherId).unread += 1;
    }
  });

  const rows = [...byPerson.values()];

  /* fetch the people in one go rather than one request per row */
  const ids = rows.map(r => r.otherId).filter(id => !everyone.has(id));
  if (ids.length) {
    const { data: people } = await sb
      .from('profile_cards')
      .select('*')
      .in('id', ids);

    (people || []).forEach(p => everyone.set(p.id, p));
  }

  /* Moots - the two of you following each other - decides where a
     conversation sits. Asked as two questions over the whole list rather
     than two per person. */
  const everyoneHere = rows.map(r => r.otherId);

  const [iFollow, theyFollow] = await Promise.all([
    sb.from('follows').select('following_id')
      .eq('follower_id', me.id).in('following_id', everyoneHere),
    sb.from('follows').select('follower_id')
      .eq('following_id', me.id).in('follower_id', everyoneHere)
  ]);

  const mine = new Set((iFollow.data || []).map(f => f.following_id));
  const theirs = new Set((theyFollow.data || []).map(f => f.follower_id));

  rows.forEach(r => { r.moots = mine.has(r.otherId) && theirs.has(r.otherId); });

  return rows;
}

async function drawList() {
  const box = document.getElementById('dmList');
  const rows = await conversations();

  if (!rows.length) {
    box.innerHTML = `
      <div class="empty" style="border:0;background:transparent">
        <b>No messages yet</b>
        Open someone's page and press Message to start.
      </div>`;
    return;
  }

  const person = r => {
    const who = everyone.get(r.otherId) || { username: '', nickname: 'Someone' };
    const fromMe = r.last.sender_id === me.id;

    return `
      <button class="dm__person" type="button" data-person="${esc(r.otherId)}"
              aria-current="${r.otherId === openWith}">
        ${faceHtml(who, 'face face--sm')}
        <span style="min-width:0">
          <span class="dm__who">${esc(who.nickname || who.username)}</span>
          <span class="dm__peek">${fromMe ? 'You: ' : ''}${esc(r.last.body)}</span>
        </span>
        ${r.unread ? `<span class="dm__unread">${r.unread}</span>` : ''}
      </button>`;
  };

  /* Someone you both follow reaches you directly. Anyone else waits in
     requests until you follow them back. */
  const moots = rows.filter(r => r.moots);
  const requests = rows.filter(r => !r.moots);
  const waiting = requests.reduce((n, r) => n + r.unread, 0);

  box.innerHTML = `
    ${moots.length ? `<p class="dm__heading">Messages</p>${moots.map(person).join('')}` : ''}
    ${requests.length ? `
      <p class="dm__heading">
        Message requests${waiting ? ` <span class="dm__unread">${waiting}</span>` : ''}
      </p>
      <p class="dm__note">From girls you do not follow back yet.</p>
      ${requests.map(person).join('')}` : ''}`;

  box.querySelectorAll('[data-person]').forEach(btn => {
    btn.addEventListener('click', () => openThread(btn.dataset.person));
  });
}

/* ============================================================
   One thread
   ============================================================ */
async function openThread(personId) {
  openWith = personId;
  document.getElementById('dm').classList.add('is-reading');

  let who = everyone.get(personId);
  if (!who) {
    const { data } = await sb.from('profile_cards').select('*').eq('id', personId).maybeSingle();
    if (data) { who = data; everyone.set(personId, data); }
  }

  const head = document.getElementById('dmHead');
  head.innerHTML = `
    <button class="btn btn--ghost btn--small" type="button" id="dmBack"
            style="margin-right:.2rem">&#8592;</button>
    ${faceHtml(who || {}, 'face face--sm')}
    <a class="dm__who" style="text-decoration:none;color:inherit"
       href="profile.html?u=${encodeURIComponent((who && who.username) || '')}">
      ${esc((who && (who.nickname || who.username)) || 'Someone')}
    </a>`;

  document.getElementById('dmBack').addEventListener('click', () => {
    openWith = null;
    document.getElementById('dm').classList.remove('is-reading');
    drawList();
  });

  document.getElementById('dmForm').hidden = false;

  await drawThread();
  await markRead();
  await drawList();
}

async function drawThread() {
  const scroll = document.getElementById('dmScroll');

  /* both directions between the two of us */
  const { data, error } = await sb
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${me.id},recipient_id.eq.${openWith}),` +
      `and(sender_id.eq.${openWith},recipient_id.eq.${me.id})`
    )
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) {
    scroll.innerHTML = '<p class="muted small">Could not load this one.</p>';
    return;
  }

  scroll.innerHTML = data.length
    ? data.map(m => `
        <div class="bubble bubble--${m.sender_id === me.id ? 'me' : 'them'}">
          ${esc(m.body)}
          <time datetime="${m.created_at}">${when(m.created_at)}</time>
        </div>`).join('')
    : '<p class="muted small">Nothing here yet. Say hello.</p>';

  scroll.scrollTop = scroll.scrollHeight;
}

/* the policy lets the recipient, and only the recipient, do this */
async function markRead() {
  await sb
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me.id)
    .eq('sender_id', openWith)
    .is('read_at', null);
}

async function send(e) {
  e.preventDefault();

  const input = document.getElementById('dmText');
  const body = input.value.trim();
  if (!body || !openWith) return;

  input.value = '';
  input.disabled = true;

  const { error } = await sb.from('direct_messages').insert({
    sender_id: me.id,
    recipient_id: openWith,
    body
  });

  input.disabled = false;
  input.focus();

  if (error) {
    input.value = body;          /* give it back rather than losing it */

    /* the database refuses a message between two people where either has
       blocked the other; it does not say which way round, and neither do we */
    if (/too_fast/.test(error.message)) {
      return toast('Too many messages this hour. Try again shortly.');
    }
    if (/row-level security|violates/i.test(error.message)) {
      return toast('This message cannot be sent.');
    }
    return toast('That would not send.');
  }

  await drawThread();
  await drawList();
}
