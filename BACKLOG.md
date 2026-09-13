# Whisk Diary — Backlog

Ordered by when it matters, not by size. Move an item up rather than starting
two at once.

## Now

- [ ] **Give each of the six matcha houses an area, a description and a
      price.** They have only a name and an icon. Until the areas are in, the
      *By neighbourhood* shelf on Explore is empty; until the descriptions are
      in, most mood tiles find nothing.
- [ ] Finish the Vercel link: GitHub → Settings → Applications → Vercel →
      Configure, add `whisk-diary` to the allowed repositories, then hit
      Connect in Vercel → whisk-diary → Settings → Git. Until then
      whisk-diary.vercel.app still serves the old placeholder page.
- [ ] **Switch on Google sign-in.** The button is built and dimmed until you
      do. Google Cloud Console → Credentials → OAuth client ID (Web), redirect
      URI `https://wiugnudhbhbicoprfria.supabase.co/auth/v1/callback`, then
      paste the id and secret into Supabase → Authentication → Providers.
      Add `http://localhost:5273/**` and the Vercel URL to the Redirect URLs
      list at the same time, or the trip back lands in the wrong place.
- [ ] **Decide about Apple sign-in.** The button is built, but Apple only
      issues credentials to Apple Developer Program members — about 99 USD a
      year — and refuses plain http redirects, so it cannot even be tested
      until the site is deployed over HTTPS. Leaving it off is a perfectly
      good answer; the button explains itself.
- [ ] Turn on leaked password protection (Authentication → Policies). The one
      thing the security advisor still flags.
- [ ] Decide about email confirmation. It is **on**, so a new girl cannot log
      in until she clicks the email — one real person has already done it, so
      it works, but it is friction while you are testing.

## Next

- [ ] Nobody can edit or delete their own post or review from the site. The
      policies already allow both; the buttons are missing.
- [ ] **Deleting an account leaves its photos and videos behind.** The
      database cascades, the storage buckets do not. Needs an edge function on
      user deletion, or a sweep for folders with no matching profile.
- [ ] Messages do not arrive on their own — a thread only updates when you
      send or reopen it. Supabase realtime on `direct_messages` would fix it.
- [ ] No unread count on the Messages tab itself, only inside the page.
- [ ] Nothing stops a post being written twice by double-pressing the button
      on a slow connection.
- [ ] Shrink pictures before uploading. A 2 MB photo is sent whole and then
      shown in a circle a few millimetres across; a canvas resize to about
      400px square first would fix it. Videos are worse — 25 MB, untouched.
- [ ] Report or block. There is a message box and public posts, and no way at
      all to deal with someone unpleasant. Worth doing before the site is
      shared widely.
- [ ] The eight placeholder profiles are invented and sit alongside real
      accounts. Decide whether they stay.
- [ ] Customise Explore. The shelves are in `explore.html`, the mood tiles are
      the `MOODS` list in `js/explore.js`.
- [ ] Follower and following **lists**, not just the counts.
- [ ] Real photographs for the matcha houses instead of one emoji each.
- [ ] A favicon file and the social preview tags (an emoji data-uri stands in
      for the favicon today).
- [ ] Keep the SQL in the repo. The schema, the policies and the triggers only
      exist inside the Supabase project — nothing in git describes the
      database, so it cannot be reviewed, diffed or rebuilt from here.

## Later

- [ ] Custom domain on Vercel
- [ ] Accessibility pass: focus states, contrast, keyboard order
- [ ] Arabic translation and RTL layout
- [ ] Paging on search, and on the feed, once there is enough to need it —
      the queries are capped at 48 results today
- [ ] Let a girl delete her own account
- [ ] Comments, if the diary ever wants them
- [ ] Analytics, if there is a question worth answering with them

## Done

- [x] Scaffold, visual direction, and the first seven screens
- [x] Supabase: tables, views, row level security, the sign-up trigger
- [x] Unique usernames, enforced on `lower(username)`
- [x] Profile pictures — upload, replace, remove, with the emoji as fallback
- [x] Replace the invented matcha houses with the real six
- [x] Call them matcha houses, not cafes
- [x] Search filter buttons that filter the obvious way
- [x] Taskbar at the bottom: Home, Explore, Write, Search, Messages
- [x] Posts and reviews written from the site, each with a photo or a video
- [x] Star ratings, one to five, one review per matcha house per girl
- [x] Locations, on posts only
- [x] Direct messages
- [x] A pen, not a pin, as the write symbol
- [x] Filter the search to one kind and show just that, undivided
- [x] Google and Apple sign-in buttons, wired and degrading gracefully until
      the providers are switched on

## Decided, for the record

- **Whisk Diary is a community diary, not a reading room.** It began as
  read-only — no policy anywhere let a visitor write. That was reversed in
  September 2026 when posts, reviews and messages arrived.
- **Nobody can write as anybody else.** Every write policy is keyed on
  `my_profile_id()`, so `author_id` and `sender_id` cannot be spoofed from the
  browser, whatever the interface sends.
- **Accounts are public. Messages are not.** A signed-out visitor is refused
  `direct_messages` at the privilege level, before row level security is even
  consulted.
- **Matcha houses are added by you, not by girls using the site.** There is no
  write policy on `cafes`, on purpose.
- **Whisk Diary is separate from Whisk Me Away**, including its Supabase
  project, so the two never share accounts.
