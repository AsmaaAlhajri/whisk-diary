# Whisk Diary

A cosy little community diary for matcha lovers in Kuwait. Girls keep a page
with a nickname, a username and their reviews; everybody else reads them.

**Whisk Diary is a reading room.** Nobody using the site can post, comment,
like or rate. The only thing an account lets you do is have a page of your own
and edit it. That is not a rule enforced by hiding buttons — the database
itself has no policy that permits a visitor to write a review, a follow or a
cafe, so those writes are refused even if someone calls the API directly.

Plain HTML, CSS and JavaScript. No build step, no dependencies except the
Supabase client from a CDN.

## Run it

```bash
python -m http.server 5273
```

Then open <http://localhost:5273>. Double-clicking `index.html` mostly works
too, but a local server is safer — browsers restrict `localStorage` and
`fetch` on `file://`, and the session lives in `localStorage`.

## The pages

| File | What it is |
| --- | --- |
| `index.html` | Home. A feminine welcome for all matcha lovers when nobody is signed in; a greeting by name, and by the hour, when someone is. |
| `login.html` | Log in and sign up, two tabs on one card. Checks the username is free while she types. |
| `explore.html` | **The page to customise.** Moods, new girls, busiest cafes, neighbourhoods, one random entry. |
| `search.html` | One box, two filters: Profiles and Matcha cafes. |
| `profile.html?u=` | A public profile: nickname, @username, followers, following, reviews. Shows an **Edit profile** button on your own. |
| `edit-profile.html` | The only writable page. Username, nickname, note, face — and your email, shown and locked. |
| `cafe.html?c=` | One matcha cafe and everything written about it. |

```
css/style.css        the whole look, in numbered sections
js/supabase.js       the two public connection values
js/app.js            session, header, footer, shared html and helpers
js/auth.js           log in / sign up
js/home.js           the greetings
js/explore.js        the shelves on Explore
js/search.js         the search and its two filters
js/profile.js        a profile page
js/edit-profile.js   the edit form
js/cafe.js           a cafe page
```

Every page loads `js/app.js`, which draws the header and footer, so the
navigation is not copied into seven HTML files.

## What is public, and what is not

Public — anyone, signed in or not, can read it:

- username, nickname, the little face, the note
- number of followers and number following
- every review on that profile

Private:

- **email** — only ever shown on `edit-profile.html`, only to the account it
  belongs to, and read only even there. It is not in any public view, so it
  cannot be searched for or reached through the API.
- password — never leaves Supabase Auth

## Supabase

Project **whisk-diary** (`wiugnudhbhbicoprfria`), separate from Whisk Me Away
so the two sites never share accounts.

### Tables

- **`profiles`** — `username`, `nickname`, `bio`, `avatar`. `id` is *not* the
  auth id: `user_id` links a profile to an account, and is null for the seeded
  placeholder profiles, which have no account behind them.
- **`cafes`** — `slug`, `name`, `area`, `blurb`, `emoji`, `price`
- **`reviews`** — `author_id`, `cafe_id`, `rating` 1–5, `body`
- **`follows`** — `follower_id`, `following_id`

### Views

`profile_cards` and `cafe_cards` are the read models the site actually uses:
the row plus its counts (followers, following, reviews) or its average rating.
Both are `security_invoker`, so row level security still applies through them.

### Unique usernames

A unique index on `lower(username)` — so `MayaSips` and `mayasips` are the
same name and the second one is refused. The browser checks while she types,
purely so she finds out early; the index is what actually decides, and the
edit form has a friendly message for the moment two people race.

### Row level security

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | everyone | only your own row, only by you |
| `cafes` | everyone | nobody (no policy exists) |
| `reviews` | everyone | nobody |
| `follows` | everyone | nobody |

Adding reviews, cafes or follows is done from the Supabase dashboard or a
migration — deliberately, since the site is a reading room.

### Sign up

A trigger on `auth.users` (`handle_new_user`) writes the profile row from the
`username` and `nickname` passed as sign-up metadata. If the username has been
taken in the meantime it adds a number rather than failing the sign up.

## Two settings still to change in the dashboard

Neither can be done from code:

1. **Email confirmation** is on, so a new account cannot log in until the
   confirmation email is clicked. While building, Authentication → Sign In /
   Providers → Email → turn *Confirm email* off, and sign up goes straight in.
2. **Leaked password protection** is off. Authentication → Policies turns on
   the check against HaveIBeenPwned.

## Customising Explore

`explore.html` is written to be edited. Each block is a `<section
class="shelf">` — a heading, a note, and an empty container that
`js/explore.js` fills. Reword the headings right in the HTML, drag whole
sections above one another, or delete one: every filler in `explore.js` checks
its container exists first, so removing a shelf breaks nothing.

The mood tiles are the cheapest thing to change — they are the `MOODS` list at
the top of `js/explore.js`, and each one is just a link into `search.html`.

## The placeholder content

The eight profiles, ten cafes and twenty reviews are invented, and the cafe
names are made up rather than real businesses. Replace them when you have real
ones; `BACKLOG.md` keeps that as an open item.

## Deploying

Live at <https://whisk-diary.vercel.app>. Deploys are manual until the repo is
connected to Vercel — see the first open item in `BACKLOG.md`.
