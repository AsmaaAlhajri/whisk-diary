# Whisk Diary — Backlog

Ordered by when it matters, not by size. Move an item up rather than starting
two at once.

## Now

- [x] Scaffold the repo — `index.html`, `css/style.css`, `js/app.js`
- [x] **Decide what Whisk Diary is.** A reading room: a community diary of
      matcha houses in Kuwait. Accounts are public pages, not posting rights.
- [x] Pick the stack — staying with plain HTML, CSS and JS
- [x] Settle the visual direction — cream paper, matcha green, blush pink;
      Fraunces, Quicksand and Caveat
- [x] Build the seven real screens
- [x] Supabase: tables, views, row level security, the sign-up trigger
- [ ] **Turn off email confirmation while building.** Authentication → Sign In
      / Providers → Email → *Confirm email* off. Until then a new account
      cannot log in without clicking the email.
- [ ] Turn on leaked password protection (Authentication → Policies)
- [ ] Finish the Vercel link: GitHub → Settings → Applications → Vercel →
      Configure, add `whisk-diary` to the allowed repositories, then hit
      Connect in Vercel → whisk-diary → Settings → Git. Until then the site
      is live but deploys are manual.

- [x] Profile pictures — upload, replace, remove; the emoji face is the
      fallback for anyone who has not uploaded one
- [x] Make the two search filter buttons work the obvious way: clicking
      Profiles shows profiles. They used to do the opposite

## Next

- [x] Replace the invented matcha houses with the real six — Gary's Matcha, Matcha
      Matcha, Matcha Osaka, Cha Yen, Abu's Matcha, Neighbors Matcha
- [ ] **Give each of the six an area, a line of description and a price.**
      They have only a name and an icon. Until the areas are in, the *By
      neighbourhood* shelf on Explore is empty; until the descriptions are in,
      most mood tiles find nothing
- [ ] Reviews: there are none, since the old ones went with the invented
      matcha houses. Decide where real ones come from before writing any —
      inventing
      reviews of real businesses is not on
- [ ] The eight profiles are still invented placeholders with no accounts
      behind them
- [ ] Customise Explore. The shelves are in `explore.html`, the mood tiles are
      the `MOODS` list in `js/explore.js`
- [ ] Decide how reviews get written, since visitors cannot write them:
      straight into the dashboard, a migration, or an admin page behind a
      role check
- [ ] Follower and following **lists**, not just the counts — a page or a
      panel showing who they are
- [ ] Real photographs for the matcha houses instead of one emoji each. The
      `avatars` bucket pattern from profile pictures is the model to copy
- [ ] Shrink profile pictures before uploading. A 2 MB photo is sent whole and
      then displayed in a circle a few millimetres across, which is slow on
      phone data. A canvas resize down to about 400px square before upload
      would fix it
- [ ] A favicon file and the social preview tags (an emoji data-uri stands in
      for the favicon today)
- [ ] Keep the SQL in the repo. The schema, the policies and the trigger only
      exist inside the Supabase project right now — nothing in git describes
      the database, so it cannot be reviewed, diffed or rebuilt from here

## Later

- [ ] Custom domain on Vercel
- [ ] Accessibility pass: focus states, contrast, keyboard order
- [ ] Arabic translation and RTL layout
- [ ] Paging on search once there are more than about fifty of anything —
      the queries are capped at 48 results today
- [ ] Let a girl delete her own account
- [ ] Analytics, if there is a question worth answering with them

## Decided, for the record

- **Anyone can read everything, signed in or not.** Accounts are public by
  design; the only private thing is an email address.
- **No posting, commenting, liking or rating from the site.** Enforced in the
  database, not just in the interface — there is no policy that lets a
  visitor write to `reviews`, `follows` or `cafes`.
- **Whisk Diary is separate from Whisk Me Away**, including its Supabase
  project, so the two never share accounts.
