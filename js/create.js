/* ============================================================
   create.js - the pin. Two forms behind two tabs.

   A post is about anything and can carry a place. A review is
   about one matcha house, carries a rating out of five, and no
   place - the matcha house is the place.

   Both may hang one photo or one video off the entry. Media goes
   to the media bucket, in a folder named after her auth id, and
   nothing is uploaded until she presses the button - so an entry
   that fails to save leaves no orphaned file behind.
   ============================================================ */

/* the bucket enforces these too; saying it here is friendlier */
const MEDIA_TYPES = {
  'image/jpeg': ['jpg', 'image'],
  'image/png': ['png', 'image'],
  'image/webp': ['webp', 'image'],
  'image/gif': ['gif', 'image'],
  'video/mp4': ['mp4', 'video'],
  'video/webm': ['webm', 'video'],
  'video/quicktime': ['mov', 'video']
};
const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

document.addEventListener('DOMContentLoaded', async () => {
  await AppReady;

  /* writing needs an account */
  if (!Me.signedIn() || !Me.profile()) {
    location.replace('login.html?next=create.html');
    return;
  }

  const me = Me.profile();
  const user = Me.user();

  /* ---------- the two tabs ---------- */
  const tabPost = document.getElementById('tabPost');
  const tabReview = document.getElementById('tabReview');
  const postForm = document.getElementById('postForm');
  const reviewForm = document.getElementById('reviewForm');

  function show(which) {
    const review = which === 'review';
    tabPost.setAttribute('aria-selected', String(!review));
    tabReview.setAttribute('aria-selected', String(review));
    postForm.hidden = review;
    reviewForm.hidden = !review;
  }

  tabPost.addEventListener('click', () => show('post'));
  tabReview.addEventListener('click', () => show('review'));

  /* cafe.html links here with ?review=<slug> to review that one, and the
     three dots on a post link here with ?edit=<id> to change it */
  const wantedSlug = param('review');
  const editingId = param('edit');
  show(wantedSlug ? 'review' : 'post');

  /* ============================================================
     One picture picker, used by both forms.

     Returns an object the form can ask for its file later, rather
     than uploading as soon as she chooses - see the header.
     ============================================================ */
  function mediaPicker(names) {
    const input = document.getElementById(names.input);
    const clear = document.getElementById(names.clear);
    const preview = document.getElementById(names.preview);
    const text = document.getElementById(names.text);
    const hint = document.getElementById(names.hint);

    let file = null;
    let objectUrl = null;
    let existingPath = null;      /* only when editing something already saved */

    function reset() {
      file = null;
      existingPath = null;
      input.value = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      preview.hidden = true;
      preview.innerHTML = '';
      clear.hidden = true;
      text.textContent = 'Choose a photo or video';
    }

    input.addEventListener('change', () => {
      const picked = input.files && input.files[0];
      if (!picked) return;

      const known = MEDIA_TYPES[picked.type];

      if (!known) {
        input.value = '';
        hint.classList.add('bad');
        hint.textContent = 'That kind of file will not go in - photos and videos only.';
        return;
      }
      if (picked.size > MEDIA_MAX_BYTES) {
        input.value = '';
        hint.classList.add('bad');
        hint.textContent =
          `That one is ${(picked.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`;
        return;
      }

      hint.classList.remove('bad');
      hint.textContent = 'Attached. It goes up when you press the button.';

      file = picked;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(picked);

      preview.innerHTML = known[1] === 'video'
        ? `<video src="${objectUrl}" controls playsinline></video>`
        : `<img src="${objectUrl}" alt="">`;
      preview.hidden = false;
      clear.hidden = false;
      text.textContent = 'Choose another';
    });

    clear.addEventListener('click', () => {
      reset();
      hint.classList.remove('bad');
      hint.textContent = 'JPG, PNG, WEBP, GIF, MP4, WEBM or MOV, up to 25 MB.';
    });

    return {
      file: () => file,
      reset,

      /* the picture a post already had, shown so an edit does not look as
         though it lost it */
      hasExisting: () => !!existingPath,

      showExisting(path, kind) {
        existingPath = path;
        const { data } = sb.storage.from('media').getPublicUrl(path);

        preview.innerHTML = kind === 'video'
          ? `<video src="${esc(data.publicUrl)}" controls playsinline></video>`
          : `<img src="${esc(data.publicUrl)}" alt="">`;
        preview.hidden = false;
        clear.hidden = false;
        text.textContent = 'Choose another';
      },

      /* uploads under a fresh name and hands back what the row needs */
      async upload() {
        if (!file) return { media_path: null, media_type: null };

        const [ext, kind] = MEDIA_TYPES[file.type];
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error } = await sb.storage
          .from('media')
          .upload(path, file, { contentType: file.type, upsert: false });

        if (error) throw error;
        return { media_path: path, media_type: kind };
      }
    };
  }

  const postMedia = mediaPicker({
    input: 'postMedia', clear: 'postMediaClear', preview: 'postPreview',
    text: 'postMediaText', hint: 'postMediaHint'
  });

  const reviewMedia = mediaPicker({
    input: 'reviewMedia', clear: 'reviewMediaClear', preview: 'reviewPreview',
    text: 'reviewMediaText', hint: 'reviewMediaHint'
  });

  /* ---------- counters ---------- */
  const postBody = document.getElementById('postBody');
  const postCount = document.getElementById('postCount');
  postBody.addEventListener('input', () => { postCount.textContent = postBody.value.length; });

  const reviewBody = document.getElementById('reviewBody');
  const reviewCount = document.getElementById('reviewCount');
  reviewBody.addEventListener('input', () => { reviewCount.textContent = reviewBody.value.length; });

  function busy(form, on, label) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  /* ============================================================
     Posting, and editing a post

     Editing reuses this same form. The only differences are that
     the fields arrive filled in, the button says Save, and the
     write is an update rather than an insert - row level security
     makes sure that update can only ever touch her own row.
     ============================================================ */
  const postMsg = document.getElementById('postMsg');
  const postSubmit = document.getElementById('postSubmit');
  const postPlace = document.getElementById('postPlace');

  /* the file this post had when the form opened, so a replaced or removed
     picture can be taken out of the bucket rather than left behind */
  let mediaWhenOpened = null;

  if (editingId) {
    const { data: existing } = await sb
      .from('posts')
      .select('id,author_id,body,place,media_path,media_type')
      .eq('id', editingId)
      .maybeSingle();

    if (!existing || existing.author_id !== me.id) {
      /* not hers, or gone: quietly fall back to writing a new one */
      location.replace('create.html');
      return;
    }

    show('post');
    tabReview.disabled = true;
    tabReview.title = 'You are editing a post';

    document.querySelector('h1').textContent = 'Change your post';
    document.querySelector('.hand').textContent = 'the diary will note that you edited it';
    postSubmit.textContent = 'Save changes';

    mediaWhenOpened = existing.media_path || null;

    postBody.value = existing.body || '';
    postCount.textContent = postBody.value.length;
    postPlace.value = existing.place || '';

    if (existing.media_path) {
      postMedia.showExisting(existing.media_path, existing.media_type);
    }
  }

  postForm.addEventListener('submit', async e => {
    e.preventDefault();

    const body = postBody.value.trim();
    const place = postPlace.value.trim();

    postMsg.classList.remove('ok');

    /* an edit that drops the picture and the words has nothing left */
    const keepsMedia = postMedia.file() || (editingId && postMedia.hasExisting());
    if (!body && !keepsMedia) {
      return (postMsg.textContent = 'Write something, or add a photo.');
    }

    busy(postForm, true, postMedia.file() ? 'Uploading…' : 'Saving…');

    let media;
    try {
      media = await postMedia.upload();
    } catch (err) {
      busy(postForm, false);
      return (postMsg.textContent = `The file would not upload: ${err.message || 'unknown error'}`);
    }

    let error;
    let row = null;

    if (editingId) {
      row = { body, place };

      /* a new file replaces the old one; removing it clears both columns;
         leaving it alone touches neither */
      if (media.media_path) {
        row.media_path = media.media_path;
        row.media_type = media.media_type;
      } else if (!postMedia.hasExisting()) {
        row.media_path = null;
        row.media_type = null;
      }

      ({ error } = await sb.from('posts').update(row).eq('id', editingId));
    } else {
      ({ error } = await sb.from('posts').insert({
        author_id: me.id,
        body,
        place,
        media_path: media.media_path,
        media_type: media.media_type
      }));
    }

    busy(postForm, false);

    if (error) {
      return (postMsg.textContent = /too_fast/.test(error.message)
        ? 'That is a lot of writing in one hour. Try again shortly.'
        : error.message);
    }

    /* the row is saved, so the picture it no longer points at can go. Done
       after the save, so a failure here costs a stray file and nothing more. */
    if (editingId && mediaWhenOpened && row && 'media_path' in row
        && row.media_path !== mediaWhenOpened) {
      await sb.storage.from('media').remove([mediaWhenOpened]);
    }

    postMsg.classList.add('ok');
    postMsg.textContent = editingId ? 'Saved. Taking you to your page…' : 'Posted. Taking you to your page…';
    toast(editingId ? 'Post updated \u{1F58B}\u{FE0F}' : 'Written into your diary \u{1F58B}\u{FE0F}');
    setTimeout(() => {
      location.href = `profile.html?u=${encodeURIComponent(me.username)}`;
    }, 800);
  });

  /* ============================================================
     Reviewing
     ============================================================ */
  const reviewMsg = document.getElementById('reviewMsg');
  const cafeSelect = document.getElementById('reviewCafe');
  const existingNote = document.getElementById('reviewExisting');
  const starsValue = document.getElementById('starsValue');

  /* the matcha houses to choose from */
  const { data: houses } = await sb
    .from('cafes')
    .select('id,slug,name,area')
    .order('name');

  cafeSelect.innerHTML =
    '<option value="">Choose one…</option>' +
    (houses || []).map(h =>
      `<option value="${esc(h.id)}" data-slug="${esc(h.slug)}">${esc(h.name)}${h.area ? ` — ${esc(h.area)}` : ''}</option>`
    ).join('');

  if (wantedSlug) {
    const match = (houses || []).find(h => h.slug === wantedSlug);
    if (match) cafeSelect.value = match.id;
  }

  /* the stars */
  const starInputs = [...reviewForm.querySelectorAll('input[name="rating"]')];
  const chosenRating = () => {
    const on = starInputs.find(i => i.checked);
    return on ? Number(on.value) : 0;
  };

  starInputs.forEach(input => {
    input.addEventListener('change', () => {
      const n = chosenRating();
      starsValue.textContent = `${n} out of 5`;
    });
  });

  /* One review each per matcha house - if she has already written one,
     say so, and fill the form with it so saving reads as an edit. */
  async function loadExisting() {
    existingNote.textContent = '';
    if (!cafeSelect.value) return;

    const { data } = await sb
      .from('reviews')
      .select('rating,body,media_path,media_type')
      .eq('author_id', me.id)
      .eq('cafe_id', cafeSelect.value)
      .maybeSingle();

    if (!data) return;

    existingNote.textContent =
      'You have written about this one before - saving will update that review.';

    const star = starInputs.find(i => Number(i.value) === data.rating);
    if (star) {
      star.checked = true;
      starsValue.textContent = `${data.rating} out of 5`;
    }
    reviewBody.value = data.body || '';
    reviewCount.textContent = reviewBody.value.length;
  }

  cafeSelect.addEventListener('change', loadExisting);
  if (cafeSelect.value) loadExisting();

  reviewForm.addEventListener('submit', async e => {
    e.preventDefault();

    const cafeId = cafeSelect.value;
    const rating = chosenRating();
    const body = reviewBody.value.trim();

    reviewMsg.classList.remove('ok');

    if (!cafeId) return (reviewMsg.textContent = 'Which matcha house is this about?');
    if (!rating) return (reviewMsg.textContent = 'Give it a rating, one to five stars.');

    busy(reviewForm, true, reviewMedia.file() ? 'Uploading…' : 'Saving…');

    let media;
    try {
      media = await reviewMedia.upload();
    } catch (err) {
      busy(reviewForm, false);
      return (reviewMsg.textContent = `The file would not upload: ${err.message || 'unknown error'}`);
    }

    /* upsert, because the unique index allows her only one per house */
    const row = {
      author_id: me.id,
      cafe_id: cafeId,
      rating,
      body
    };

    /* keep the old picture if she did not choose a new one */
    if (media.media_path) {
      row.media_path = media.media_path;
      row.media_type = media.media_type;
    }

    const { error } = await sb
      .from('reviews')
      .upsert(row, { onConflict: 'author_id,cafe_id' });

    busy(reviewForm, false);

    if (error) {
      return (reviewMsg.textContent = /too_fast/.test(error.message)
        ? 'That is a lot of writing in one hour. Try again shortly.'
        : error.message);
    }

    const slug = cafeSelect.selectedOptions[0].dataset.slug;

    reviewMsg.classList.add('ok');
    reviewMsg.textContent = 'Posted. Taking you to the matcha house…';
    toast('Your review is up \u{2B50}');
    setTimeout(() => {
      location.href = `cafe.html?c=${encodeURIComponent(slug)}`;
    }, 800);
  });
});
