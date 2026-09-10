# Whisk Diary

A cosy little community diary for matcha lovers in Kuwait. Girls keep a page
with a nickname, a username and their reviews; everybody else reads them.

**Whisk Diary is a reading room.** Nobody using the site can post, comment,
like or rate. The only thing an account lets you do is have a page of your own
and edit it. That is not a rule enforced by hiding buttons — the database
itself has no policy that permits a visitor to write a review, a follow or a
matcha house, so those writes are refused even if someone calls the API
directly.

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
| `explore.html` | **The page to customise.** Moods, new girls, busiest matcha houses, neighbourhoods, one random entry. |
| `search.html` | One box, two filter buttons under it: Profiles and Matcha houses. Clicking one narrows the search to that kind; clicking it again shows both. |
| `profile.html?u=` | A public profile: nickname, @username, followers, following, reviews. Shows an **Edit profile** button on your own. |
| `edit-profile.html` | The only writable page. Picture, username, nickname, note, face — and your email, shown and locked. |
| `cafe.html?c=` | One matcha house and everything written about it. |

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
js/cafe.js           a matcha house page
```

Every page loads `js/app.js`, which draws the header and footer, so the
navigation is not copied into seven HTML files.

## What is public, and what is not

Public — anyone, signed in or not, can read it:

- username, nickname, the profile picture, the little face, the note
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

- **`profiles`** — `username`, `nickname`, `bio`, `avatar` (the emoji),
  `avatar_path` (the picture). `id` is *not* the auth id: `user_id` links a
  profile to an account, and is null for the seeded placeholder profiles,
  which have no account behind them.
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

Adding reviews, matcha houses or follows is done from the Supabase dashboard or a
migration — deliberately, since the site is a reading room.

### Profile pictures

Files live in the public **`avatars`** storage bucket, capped at 2 MB and
limited to JPG, PNG, WEBP and GIF. SVG is deliberately excluded, since an SVG
can carry script.

Each picture sits in a folder named after its owner's auth id, and the storage
policies only let her write inside that folder — so the worst anyone can do
with a stolen upload URL is overwrite their own face. Reads are open, because
profiles are public.

`profiles.avatar_path` holds the path inside the bucket, **not** a URL; the
browser builds the URL from it. A check constraint enforces the
`<uuid>/<filename>` shape, so nobody can point their picture at an external
tracker. Each upload gets a fresh filename — reusing one would leave the old
picture in the CDN cache — and the previous file is deleted once the row is
safely saved.

Uploading is the one write besides the profile row itself, and it happens only
on Save, so a failed upload leaves everything as it was.

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

## The content

**The matcha houses are real** — six of them: Gary's Matcha, Matcha Matcha, Matcha Osaka,
Cha Yen, Abu's Matcha and Neighbors Matcha. Only their name and icon are
filled in. Area, blurb and price are deliberately blank, because those are
facts about real businesses rather than things to invent, and every card hides
whichever of the three is still empty.

**The eight profiles are invented** placeholders and have no accounts behind
them (`profiles.user_id` is null).

**There are no reviews.** The twenty placeholder ones were about the invented
matcha houses and went when those were deleted. Nothing has been written about
the six real ones, so every rating reads "No reviews yet".

Two things follow from that, until reviews and blurbs exist:

- most **mood tiles** on Explore search for words in the blurbs — "iced",
  "ceremonial", "quiet" — so they find nothing yet
- **By neighbourhood** on Explore stays empty until the matcha houses have an area

`BACKLOG.md` keeps both as open items.

## Deploying

Live at <https://whisk-diary.vercel.app>. Deploys are manual until the repo is
connected to Vercel — see the first open item in `BACKLOG.md`.
