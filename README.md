# Whisk Diary

A cosy little community diary for matcha lovers in Kuwait. Girls keep a page
with a nickname and a picture, pin posts and reviews, rate matcha houses out
of five stars, and message each other.

Plain HTML, CSS and JavaScript. No build step, no dependencies except the
Supabase client from a CDN.

> **It used to be a reading room.** Until September 2026 nobody could post,
> comment, like or rate — the database had no write policies at all. That is
> no longer true: posts, reviews and messages are now writable by their
> author. What has *not* changed is that nobody can write as anybody else.

## Run it

```bash
python -m http.server 5273
```

Then open <http://localhost:5273>. Double-clicking `index.html` mostly works
too, but a local server is safer — browsers restrict `localStorage` and
`fetch` on `file://`, and the session lives in `localStorage`.

## The taskbar

Five places, fixed to the bottom of the screen on every page:

| | | |
| --- | --- | --- |
| 🏠 | **Home** | the newest entries in the diary, posts and reviews together |
| 🧭 | **Explore** | the page to customise |
| 📌 | **Write** | the raised pin in the middle — post or review |
| 🔎 | **Search** | profiles and matcha houses |
| 💬 | **Messages** | private, and the only private thing here |

Write and Messages need an account. Rather than hiding them from a
signed-out visitor — which makes the bar jump about depending on who is
looking — they point at the sign in page with `?next=`, so she lands where
she was going once she is in.

## The pages

| File | What it is |
| --- | --- |
| `index.html` | Home. A feminine welcome for all matcha lovers when nobody is signed in; a greeting by name, and by the hour, when someone is. Then the newest entries. |
| `login.html` | Log in and sign up, two tabs on one card. Checks the username is free while she types. |
| `create.html` | **The pin.** Post or Review, behind two tabs. |
| `explore.html` | **The page to customise.** Moods, new girls, busiest matcha houses, neighbourhoods, one random entry. |
| `search.html` | One box, two filter buttons under it. Clicking one narrows the search to that kind; clicking it again shows both. |
| `messages.html` | Private messages. |
| `profile.html?u=` | A public profile: picture, nickname, @username, followers, following, and everything she has pinned. Shows **Edit profile** on your own and **Message** on anyone else's. |
| `edit-profile.html` | Picture, username, nickname, note, face — and your email, shown and locked. |
| `cafe.html?c=` | One matcha house, its average rating, and everything written about it. |

Every page loads `js/app.js`, which draws the header, the footer and the
taskbar, so the navigation is not copied into nine HTML files.

## Posts and reviews

They are deliberately different things.

|  | Post | Review |
| --- | --- | --- |
| About | anything | one matcha house |
| Rating | — | 1 to 5 stars, required |
| Location | yes, free text | — (the matcha house *is* the place) |
| Photo or video | yes | yes |
| How many | as many as you like | one per matcha house, per girl |

A second review of the same matcha house **updates the first** rather than
adding another, so an average rating means something. The form notices and
says so before she writes.

The stars are five real radio buttons, reversed in the markup so CSS can
light up every star to the left of the one under the cursor. That means the
keyboard works on them for free.

## What is public, and what is not

Public — anyone, signed in or not:

- username, nickname, profile picture, note
- followers and following counts
- every post and review, and any photo or video attached to them

Private:

- **messages** — only the two people in a conversation can read one.
  `anon` has no privilege on the table at all, so a signed-out visitor is
  refused before row level security is even consulted.
- **email** — only ever shown on `edit-profile.html`, only to the account it
  belongs to, and read only even there.
- password — never leaves Supabase Auth

## Supabase

Project **whisk-diary** (`wiugnudhbhbicoprfria`), separate from Whisk Me Away
so the two sites never share accounts.

### Tables

- **`profiles`** — `username`, `nickname`, `bio`, `avatar` (emoji),
  `avatar_path` (picture). `id` is *not* the auth id: `user_id` links a
  profile to an account, and is null for the seeded placeholder profiles.
- **`posts`** — `author_id`, `body`, `place`, `media_path`, `media_type`
- **`reviews`** — `author_id`, `cafe_id`, `rating` 1–5, `body`, `media_path`,
  `media_type`. Unique on `(author_id, cafe_id)`.
- **`cafes`** — the matcha houses: `slug`, `name`, `area`, `blurb`, `emoji`,
  `price`
- **`follows`** — `follower_id`, `following_id`
- **`direct_messages`** — `sender_id`, `recipient_id`, `body`, `read_at`

`direct_messages` is deliberately two columns rather than a
conversations-and-members pair: there is no membership table to recurse
through in a policy, and a conversation is simply every row between two
people, gathered in the browser.

### Views

`profile_cards`, `cafe_cards` and `post_cards` are the read models the site
uses — the row plus its counts, or its average rating, or its author. All
three are `security_invoker`, so row level security still applies through
them.

### Who may write what

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | everyone | your own row |
| `posts` | everyone | your own |
| `reviews` | everyone | your own |
| `cafes` | everyone | nobody from the site |
| `follows` | everyone | nobody from the site |
| `direct_messages` | the two people in it | send as yourself; mark as read if it is to you |

Every write policy is keyed on `my_profile_id()`, a small stable function
that turns `auth.uid()` into the profile row behind it. It is security
*invoker*, not definer — `profiles` is publicly readable anyway, so it needs
no extra privilege, and that keeps it off the security advisor's list.

### Storage

Two public buckets, each laid out as one folder per auth id, writable only
by its owner:

- **`avatars`** — 2 MB, JPG/PNG/WEBP/GIF
- **`media`** — 25 MB, those plus MP4, WEBM and MOV

SVG is excluded from both on purpose, since an SVG can carry script.

Paths are stored in the database, never whole URLs, and a check constraint
enforces the `<uuid>/<filename>` shape — so nobody can point their picture at
an external tracker. Nothing uploads until she presses the button, so an
entry that fails to save leaves no orphaned file behind.

### Sign up

A trigger on `auth.users` (`handle_new_user`) writes the profile row from the
`username` and `nickname` passed as sign-up metadata. If the username has been
taken in the meantime it adds a number rather than failing the sign up.

## Google and Apple sign-in

The buttons are built and wired. **Neither provider works yet**, because both
need credentials that can only come from outside this repo — and until they
are in, the two buttons sit dimmed with a line saying so, rather than sending
anyone to a raw JSON error page.

The page asks `/auth/v1/settings` which providers are enabled and lights the
buttons up on its own, so once you finish the steps below nothing here needs
changing.

### Google

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth
   client ID**, type *Web application*.
2. Under *Authorised redirect URIs* add exactly:
   `https://wiugnudhbhbicoprfria.supabase.co/auth/v1/callback`
3. Copy the client ID and client secret into Supabase → Authentication →
   Sign In / Providers → **Google**, and enable it.

### Apple

Harder, and **it costs money**: Apple only issues the credentials to members
of the Apple Developer Program, which is about 99 USD a year. You will need a
Services ID, a Team ID, a Key ID and a `.p8` private key from
developer.apple.com, pasted into Supabase → Authentication → Sign In /
Providers → **Apple**.

Apple also refuses plain `http://` redirects, so Apple sign-in cannot be
tested on `http://localhost:5273` — it needs the deployed HTTPS site.

If that is more than you want to take on, leave Apple switched off. The button
stays dimmed and explains itself, and nothing else breaks.

### Redirect URLs

Supabase → Authentication → URL Configuration → **Redirect URLs** must list
every address the browser may come back to, or the return trip lands on the
Site URL instead:

- `http://localhost:5273/**` while you are building
- `https://whisk-diary.vercel.app/**` once it deploys

### What an account from Google or Apple looks like

Neither provider sends a username, so the sign-up trigger takes one from the
email handle and adds a number if it is taken. For the nickname it uses
whatever real name the provider gave (`full_name`, then `name`) instead of
repeating the username back at her. She can change both from Edit profile.

Apple only sends a name the **first** time someone authorises the app, so an
Apple account may well arrive with the email handle as its nickname.

## One setting still to change in the dashboard

**Leaked password protection** is off. Authentication → Policies turns on the
check against HaveIBeenPwned. It cannot be done from code.

## Customising Explore

`explore.html` is written to be edited. Each block is a `<section
class="shelf">` — a heading, a note, and an empty container that
`js/explore.js` fills. Reword the headings right in the HTML, drag whole
sections above one another, or delete one: every filler in `explore.js` checks
its container exists first, so removing a shelf breaks nothing.

The mood tiles are the cheapest thing to change — they are the `MOODS` list at
the top of `js/explore.js`, and each one is just a link into `search.html`.

## The content

**The matcha houses are real** — six of them: Gary's Matcha, Matcha Matcha,
Matcha Osaka, Cha Yen, Abu's Matcha and Neighbors Matcha. Only their name and
icon are filled in; area, description and price are blank, because those are
facts about real businesses rather than things to invent, and every card hides
whichever of the three is still empty.

**The eight profiles are invented** placeholders with no accounts behind them
(`profiles.user_id` is null). There is one real account alongside them.

**There are no posts or reviews yet.** Until there are, most mood tiles on
Explore find nothing (they search the blurbs) and *By neighbourhood* stays
empty (the matcha houses have no area).

## Deploying

Live at <https://whisk-diary.vercel.app>. The repo is **not connected to
Vercel yet**, so that address still serves the old placeholder page — see the
first open item in `BACKLOG.md`.
