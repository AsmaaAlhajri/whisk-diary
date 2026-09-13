/* ============================================================
   edit-profile.js - the only writable page on the site.

   She may change her picture, her nickname, her username, her note
   and the little face. The email box is filled in and read only:
   this is the one place in Whisk Diary an email is ever shown, and
   even here it cannot be edited or seen by anyone else.

   Pictures go into the avatars bucket, in a folder named after her
   auth id. Storage policies only let her write inside that folder,
   so the worst anyone can do with a stolen upload url is overwrite
   their own face. Nothing is uploaded until she presses Save.

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

/* The bucket enforces both of these too, but a message here is friendlier
   than a rejected upload. */
const PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

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

    drawPhoto();          /* the preview falls back to this face */
  });

  /* ============================================================
     The picture

     Three states, in order of precedence: a file she has just
     chosen and not yet saved, the picture already on her profile,
     or no picture at all - in which case the emoji shows.
     ============================================================ */
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photoPreview');
  const photoRemove = document.getElementById('photoRemove');
  const photoButtonText = document.getElementById('photoButtonText');
  const photoHint = document.getElementById('photoHint');

  let pendingFile = null;          /* chosen, not uploaded yet */
  let clearPhoto = false;          /* she pressed Remove */
  let objectUrl = null;            /* the local preview, needs revoking */

  function savedPhotoUrl() {
    if (!me.avatar_path) return null;
    return sb.storage.from('avatars').getPublicUrl(me.avatar_path).data.publicUrl;
  }

  function drawPhoto() {
    const saved = clearPhoto ? null : savedPhotoUrl();
    const src = objectUrl || saved;

    photoPreview.innerHTML = src
      ? `<img src="${src}" alt="">`
      : esc(avatar.value || FACES[0]);

    photoRemove.hidden = !src;
    photoButtonText.textContent = src ? 'Choose another' : 'Choose a picture';
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    const say2 = (text, bad) => {
      photoHint.textContent = text;
      photoHint.classList.toggle('bad', !!bad);
      photoHint.classList.toggle('good', !bad);
    };

    if (!PHOTO_TYPES[file.type]) {
      photoInput.value = '';
      return say2('That needs to be a JPG, PNG, WEBP or GIF.', true);
    }
    if (file.size > PHOTO_MAX_BYTES) {
      photoInput.value = '';
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return say2(`That one is ${mb} MB. The limit is 2 MB - try a smaller copy.`, true);
    }

    pendingFile = file;
    clearPhoto = false;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    say2('Looking good. Press Save changes to keep it.');
    drawPhoto();
  });

  photoRemove.addEventListener('click', () => {
    pendingFile = null;
    clearPhoto = true;
    photoInput.value = '';

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    photoHint.textContent = 'Your little face will show instead. Press Save changes.';
    photoHint.classList.remove('bad', 'good');
    drawPhoto();
  });

  drawPhoto();

  /* Uploads under a fresh name every time. Reusing one name would leave the
     old picture sitting in the cache, and she would swear nothing happened. */
  async function uploadPhoto(file) {
    const path = `${user.id}/${Date.now()}.${PHOTO_TYPES[file.type]}`;

    const { error } = await sb.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;
    return path;
  }

  /* Everything in her folder except the picture she is using now. Runs after
     the profile row is saved, so a failure here costs a stray file and
     nothing else. */
  async function tidyOldPhotos(keepPath) {
    const { data: files } = await sb.storage.from('avatars').list(user.id);
    if (!files) return;

    const stale = files
      .map(f => `${user.id}/${f.name}`)
      .filter(p => p !== keepPath);

    if (stale.length) await sb.storage.from('avatars').remove(stale);
  }

  /* ============================================================
     One username change a day

     The database refuses a second change inside 24 hours - a
     trigger, so it holds however the change is attempted. This
     only reads the clock to say so before she retypes her name
     for nothing.
     ============================================================ */
  const { data: ownRow } = await sb
    .from('profiles')
    .select('username_changed_at')
    .eq('id', me.id)
    .maybeSingle();

  const changedAt = ownRow && ownRow.username_changed_at
    ? new Date(ownRow.username_changed_at)
    : null;

  const nextChangeAt = changedAt ? new Date(changedAt.getTime() + 864e5) : null;
  const lockedUntil = nextChangeAt && nextChangeAt > new Date() ? nextChangeAt : null;

  function hoursLeft() {
    return Math.max(1, Math.ceil((lockedUntil - new Date()) / 36e5));
  }

  if (lockedUntil) {
    username.readOnly = true;
    hint.textContent =
      `You changed your username in the last day, so it is fixed for another ${hoursLeft()} ${hoursLeft() === 1 ? 'hour' : 'hours'}.`;
    hint.classList.add('bad');
  }

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

    /* the picture first: if the upload fails, nothing else has changed yet */
    let wantedPath = me.avatar_path || null;

    if (pendingFile) {
      btn.textContent = 'Uploading…';
      try {
        wantedPath = await uploadPhoto(pendingFile);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Save changes';
        return say(
          /exceeded|too large/i.test(err.message || '')
            ? 'That picture is over the 2 MB limit.'
            : `The picture would not upload: ${err.message || 'unknown error'}`
        );
      }
    } else if (clearPhoto) {
      wantedPath = null;
    }

    btn.textContent = 'Saving…';

    const { error } = await sb
      .from('profiles')
      .update({
        username: wantedName,
        nickname: wantedNick,
        bio: bio.value.trim(),
        avatar: avatar.value,
        avatar_path: wantedPath
      })
      .eq('id', me.id);

    btn.disabled = false;
    btn.textContent = 'Save changes';

    if (error) {
      /* 23505 is the unique index on lower(username) doing its job */
      if (error.code === '23505' || /duplicate key/i.test(error.message)) {
        return say(`@${wantedName} is already someone's. Pick another and save again.`);
      }

      /* the trigger raises username_too_soon:<hours left> */
      const tooSoon = /username_too_soon:(\d+)/.exec(error.message || '');
      if (tooSoon) {
        const hrs = Number(tooSoon[1]);
        username.value = me.username;
        return say(
          `A username can only be changed once a day. Try again in ${hrs} ${hrs === 1 ? 'hour' : 'hours'}.`
        );
      }
      if (/username_format/i.test(error.message)) {
        return say('That username has a character the diary will not take.');
      }
      return say(error.message);
    }

    /* the row is safe now, so clear out the pictures it no longer points at */
    await tidyOldPhotos(wantedPath);

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
