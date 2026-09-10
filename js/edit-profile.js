/* ============================================================
   edit-profile.js - the only writable page on the site.

   She may change her nickname, her username, her note and the
   little face. The email box is filled in and read only: this is
   the one place in Whisk Diary an email is ever shown, and even
   here it cannot be edited or seen by anyone else.

   Uniqueness of the username is enforced by a unique index on
   lower(username) in the database. The check below is a courtesy,
   not the rule - if two girls press Save at the same instant, one
   of them gets the friendly message from the catch further down.
   ============================================================ */

/* Deliberately old emoji: every one of these has been in Windows and
   phone fonts for years, so nobody sees an empty box where her face
   should be. Newer ones (bubble tea, teapot, bubbles) do not render on
   Windows 10 and were taken back out. */
const FACES = ['\u{1F375}', '\u{1F337}', '\u{1F338}', '\u{1F33F}', '\u{1F361}',
  '\u{1F370}', '\u{1F353}', '\u{1F380}', '\u{1F4D6}', '\u{1F4F7}',
  '\u{1F48C}', '\u{2728}', '\u{1F319}', '\u{1F41A}', '\u{2615}', '\u{1F430}'];

const USERNAME_SHAPE = /^[A-Za-z0-9_.]{3,20}$/;

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  /* signed out? there is nothing here for anyone else */
  if (!Me.signedIn()) {
    location.replace('login.html');
    return;
  }

  const me = Me.profile();
  const user = Me.user();

  if (!me) {
    document.getElementById('msg').textContent =
      'Your profile row is missing. Sign out and back in, and it will be rebuilt.';
    return;
  }

  const form = document.getElementById('editForm');
  const nickname = document.getElementById('nickname');
  const username = document.getElementById('username');
  const bio = document.getElementById('bio');
  const bioCount = document.getElementById('bioCount');
  const email = document.getElementById('email');
  const avatar = document.getElementById('avatar');
  const picker = document.getElementById('avatarPicker');
  const hint = document.getElementById('usernameHint');
  const msg = document.getElementById('msg');

  const say = (text, ok = false) => {
    msg.textContent = text;
    msg.classList.toggle('ok', ok);
  };

  /* ---------- fill the form in ---------- */
  nickname.value = me.nickname || '';
  username.value = me.username || '';
  bio.value = me.bio || '';
  bioCount.textContent = bio.value.length;
  email.value = user.email || '';
  avatar.value = me.avatar || FACES[0];

  document.getElementById('viewPage').href =
    `profile.html?u=${encodeURIComponent(me.username)}`;
  document.getElementById('oldHandle').textContent = `@${me.username}`;

  /* ---------- the faces ---------- */
  picker.innerHTML = FACES.map(face => `
    <button type="button" data-face="${face}"
            aria-pressed="${face === avatar.value}"
            aria-label="Use ${face} beside your name">${face}</button>`).join('');

  picker.addEventListener('click', e => {
    const btn = e.target.closest('[data-face]');
    if (!btn) return;

    avatar.value = btn.dataset.face;
    picker.querySelectorAll('[data-face]').forEach(b =>
      b.setAttribute('aria-pressed', String(b === btn)));
  });

  /* ---------- as she types ---------- */
  bio.addEventListener('input', () => { bioCount.textContent = bio.value.length; });

  let checkTimer = null;

  username.addEventListener('input', () => {
    const name = username.value.trim();
    clearTimeout(checkTimer);

    const setHint = (text, kind) => {
      hint.textContent = text;
      hint.classList.toggle('bad', kind === 'bad');
      hint.classList.toggle('good', kind === 'good');
    };

    if (name.toLowerCase() === (me.username || '').toLowerCase()) {
      return setHint('This is your username now.');
    }
    if (!USERNAME_SHAPE.test(name)) {
      return setHint('Letters, numbers, dots and underscores only - 3 to 20 of them.', 'bad');
    }

    setHint('Checking if that one is free…');

    checkTimer = setTimeout(async () => {
      if (username.value.trim() !== name) return;

      const { data } = await sb
        .from('profiles')
        .select('id')
        .ilike('username', name)          /* no wildcards: exact, any case */
        .maybeSingle();

      if (username.value.trim() !== name) return;

      if (data && data.id !== me.id) {
        setHint(`@${name} belongs to someone else. Try another.`, 'bad');
      } else {
        setHint(`@${name} is free — it can be yours.`, 'good');
      }
    }, 400);
  });

  /* ---------- save ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const wantedName = username.value.trim();
    const wantedNick = nickname.value.trim();

    if (!wantedNick) return say('The diary needs something to call you.');
    if (!USERNAME_SHAPE.test(wantedName)) {
      return say('Username: 3 to 20 letters, numbers, dots or underscores.');
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = await sb
      .from('profiles')
      .update({
        username: wantedName,
        nickname: wantedNick,
        bio: bio.value.trim(),
        avatar: avatar.value
      })
      .eq('id', me.id);

    btn.disabled = false;
    btn.textContent = 'Save changes';

    if (error) {
      /* 23505 is the unique index on lower(username) doing its job */
      if (error.code === '23505' || /duplicate key/i.test(error.message)) {
        return say(`@${wantedName} is already someone's. Pick another and save again.`);
      }
      if (/username_format/i.test(error.message)) {
        return say('That username has a character the diary will not take.');
      }
      return say(error.message);
    }

    const renamed = wantedName.toLowerCase() !== (me.username || '').toLowerCase();

    say('Saved. Your page is updated.', true);
    toast('Your diary page is saved \u{1F338}');

    /* the header shows the nickname and the old username, so reload with
       the new one in hand */
    await Me.load();
    setTimeout(() => {
      location.href = renamed
        ? `profile.html?u=${encodeURIComponent(wantedName)}`
        : 'edit-profile.html';
    }, 700);
  });

  document.getElementById('signOut').addEventListener('click', () => Me.signOut());
});
