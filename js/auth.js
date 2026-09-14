/* ============================================================
   auth.js - log in and sign up, on Supabase Auth.

   Passwords are hashed and checked on Supabase's servers; nothing
   in this file ever sees or keeps one. Signing in returns a
   session, and that session is what lets her edit her own profile
   row - and nothing else in the database.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const title = document.getElementById('authTitle');
  const sub = document.getElementById('authSub');
  const msg = document.getElementById('msg');

  const say = (text, ok = false) => {
    msg.textContent = text;
    msg.classList.toggle('ok', ok);
  };

  /* ---------- the two tabs ---------- */
  function show(which) {
    const signup = which === 'signup';

    tabLogin.setAttribute('aria-selected', String(!signup));
    tabSignup.setAttribute('aria-selected', String(signup));
    loginForm.hidden = signup;
    signupForm.hidden = !signup;

    title.textContent = signup ? 'Start your page' : 'Welcome back';
    sub.textContent = signup
      ? 'A nickname, a username, and somewhere to send the confirmation.'
      : 'Your page is exactly where you left it.';

    say('');
    document.title = `Whisk Diary · ${signup ? 'sign up' : 'sign in'}`;
  }

  tabLogin.addEventListener('click', () => show('login'));
  tabSignup.addEventListener('click', () => show('signup'));

  /* index.html links straight to the sign up tab */
  show(new URLSearchParams(location.search).get('tab') === 'signup' ? 'signup' : 'login');

  /* ----------------------------------------------------------------
     The lock beside a password field is a button. Click it and the
     password is readable for three seconds, then it hides itself -
     long enough to check a typo, short enough that a password is
     never left sitting on a screen someone else can see.
  ---------------------------------------------------------------- */
  const PEEK_SECONDS = 3;

  document.querySelectorAll('[data-peek]').forEach(btn => {
    const input = btn.closest('.field').querySelector('input');
    if (!input) return;
    let timer = null;

    function hide() {
      clearTimeout(timer);
      timer = null;
      input.type = 'password';
      btn.textContent = '\u{1F512}';
      btn.setAttribute('aria-label', 'Show the password for three seconds');
    }

    btn.addEventListener('click', () => {
      if (timer) return hide();          /* a second click hides it early */
      input.type = 'text';
      btn.textContent = '\u{1F513}';
      btn.setAttribute('aria-label', 'Hide the password');
      timer = setTimeout(hide, PEEK_SECONDS * 1000);
    });

    /* never leave a password showing once she has moved on */
    input.addEventListener('blur', hide);
  });

  /* disable a submit button while the network call is in flight */
  function busy(form, on, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  await AppReady;

  /* The taskbar sends her here with ?next=create.html when she presses Write
     or Messages while signed out, so she lands where she was going instead of
     back on the home page. Only our own pages are allowed, so the parameter
     cannot be used to bounce anyone off to another site. */
  const OUR_PAGES = [
    'index.html', 'explore.html', 'search.html',
    'create.html', 'messages.html', 'edit-profile.html'
  ];
  const asked = new URLSearchParams(location.search).get('next') || '';
  const next = OUR_PAGES.includes(asked) ? asked : 'index.html';

  if (next !== 'index.html') {
    const why = next === 'create.html'
      ? 'Sign in to pin a post or a review.'
      : 'Sign in to read your messages.';
    say(why, true);
  }

  /* already signed in? there is nothing to do on this page */
  if (Me.signedIn()) {
    location.replace(next);
    return;
  }

  /* ============================================================
     Google and Apple

     signInWithOAuth sends the browser straight to Supabase, which
     answers with a bare json error page if the provider is not
     switched on - an ugly dead end. So we ask Supabase which ones
     are enabled FIRST, and only redirect when one really is. The
     buttons come alive on their own the moment a provider is turned
     on in the dashboard; nothing here needs changing.
     ============================================================ */
  const providerButtons = [...document.querySelectorAll('[data-oauth]')];
  const providerNote = document.getElementById('providerNote');
  const NICE = { google: 'Google', apple: 'Apple' };

  let providerCache = null;

  async function enabledProviders() {
    if (providerCache) return providerCache;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_KEY }
      });
      providerCache = (await r.json()).external || {};
    } catch (e) {
      providerCache = {};            /* offline: let the click find out */
    }
    return providerCache;
  }

  if (providerButtons.length) {
    enabledProviders().then(ext => {
      const off = providerButtons.filter(b => !ext[b.dataset.oauth]);
      off.forEach(b => b.classList.add('is-off'));

      if (off.length) {
        const names = off.map(b => NICE[b.dataset.oauth]).join(' and ');
        providerNote.textContent =
          `${names} ${off.length === 1 ? 'is' : 'are'} not switched on yet — use an email below.`;
        providerNote.hidden = false;
      }
    });

    providerButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.oauth;
        const nice = NICE[provider] || provider;

        btn.disabled = true;
        const ext = await enabledProviders();

        if (!ext[provider]) {
          btn.disabled = false;
          return say(`${nice} sign-in is not switched on for Whisk Diary yet.`);
        }

        /* come back to whichever page she was heading for */
        const { error } = await sb.auth.signInWithOAuth({
          provider,
          options: { redirectTo: new URL(next, location.href).href }
        });

        btn.disabled = false;
        if (error) say(error.message);
      });
    });
  }

  /* ============================================================
     Usernames

     Unique regardless of case - the database has a unique index on
     lower(username) and will refuse a duplicate no matter what the
     browser thinks. This check is only here so she finds out while
     she is still typing instead of after pressing the button.
     ============================================================ */
  const USERNAME_SHAPE = /^[A-Za-z0-9_.]{3,20}$/;

  const usernameInput = document.getElementById('username');
  const usernameHint = document.getElementById('usernameHint');
  let usernameState = 'empty';        /* empty | bad | taken | free | checking */
  let checkTimer = null;

  function hint(text, kind) {
    usernameHint.textContent = text;
    usernameHint.classList.toggle('bad', kind === 'bad');
    usernameHint.classList.toggle('good', kind === 'good');
  }

  async function isTaken(name) {
    /* ilike with no wildcards is a case-insensitive exact match */
    const { data, error } = await sb
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .maybeSingle();

    if (error) return null;            /* could not tell - let the server decide */
    return !!data;
  }

  usernameInput.addEventListener('input', () => {
    const name = usernameInput.value.trim();
    clearTimeout(checkTimer);

    if (!name) {
      usernameState = 'empty';
      return hint('3–20 letters, numbers, dots or underscores. Yours alone.');
    }

    if (!USERNAME_SHAPE.test(name)) {
      usernameState = 'bad';
      return hint('Letters, numbers, dots and underscores only - 3 to 20 of them.', 'bad');
    }

    usernameState = 'checking';
    hint('Checking if that one is free…');

    checkTimer = setTimeout(async () => {
      /* she may have kept typing while we asked */
      if (usernameInput.value.trim() !== name) return;

      const taken = await isTaken(name);
      if (usernameInput.value.trim() !== name) return;

      if (taken === null) {
        usernameState = 'free';
        return hint('Could not check just now - we will try again when you sign up.');
      }
      if (taken) {
        usernameState = 'taken';
        return hint(`@${name} is already someone's. Try another.`, 'bad');
      }
      usernameState = 'free';
      hint(`@${name} is free — it is yours.`, 'good');
    }, 400);
  });

  /* ---------- LOG IN ---------- */
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) return say('Please fill in both fields.');

    busy(loginForm, true, 'Opening…');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(loginForm, false);

    if (error) {
      /* Supabase deliberately does not say which of the two was wrong,
         so neither do we. */
      if (/invalid login/i.test(error.message)) {
        return say('That email and password do not match. Try again, or sign up.');
      }
      if (/not confirmed/i.test(error.message)) {
        return say('Almost there - confirm the account from the email we sent, then log in.');
      }
      return say(error.message);
    }

    say('Welcome back. Opening your diary…', true);
    setTimeout(() => location.replace(next), 500);
  });

  /* ---------- SIGN UP ---------- */
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();

    const nickname = document.getElementById('nickname').value.trim();
    const username = usernameInput.value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!nickname) return say('What should the diary call you?');
    if (!USERNAME_SHAPE.test(username)) return say('Pick a username: 3 to 20 letters, numbers, dots or underscores.');
    if (usernameState === 'taken') return say(`@${username} is taken. Try another.`);
    if (!/^\S+@\S+\.\S+$/.test(email)) return say('That email does not look right.');
    if (password.length < 10) return say('Password needs at least ten characters.');

    busy(signupForm, true, 'Making your page…');

    /* one last look, in case someone claimed it in the last few seconds */
    if (await isTaken(username)) {
      busy(signupForm, false);
      usernameState = 'taken';
      hint(`@${username} is already someone's. Try another.`, 'bad');
      return say(`@${username} was claimed a moment ago. Pick another.`);
    }

    /* nickname and username ride along as metadata; a trigger on the
       database turns them into the profile row. */
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { username, nickname } }
    });
    busy(signupForm, false);

    const CHECK_YOUR_EMAIL =
      'Nearly done - check your email to finish, then log in.';

    if (error) {
      /* An address that already has an account gets the SAME answer as a new
         one. Saying "that email is taken" would let anyone test a list of
         addresses and learn who has an account here, which for a small
         community is itself the harm. The real owner is told what happened
         by the email Supabase sends her. */
      if (/already registered|already exists/i.test(error.message)) {
        return say(CHECK_YOUR_EMAIL, true);
      }
      return say(error.message);
    }

    /* no session means the project still asks for email confirmation */
    if (!data.session) {
      return say(CHECK_YOUR_EMAIL, true);
    }

    say('Your page is ready. Taking you in…', true);
    setTimeout(() => location.replace(next), 700);
  });
});
