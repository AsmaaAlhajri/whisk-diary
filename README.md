# Whisk Diary

A new project, freshly scaffolded. Plain HTML, CSS and JS for now — no build
step, no dependencies.

## Run it

Double-clicking `index.html` works, but a small local server is safer
(some browsers restrict `localStorage` and `fetch` on `file://`):

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>.

## Files

```
index.html      the placeholder landing page
css/style.css   tokens, reset, shell — numbered sections
js/app.js       entry point
BACKLOG.md      what's planned, in order
```

## Deploying

Live at <https://whisk-diary.vercel.app>.

Deploys are manual until the repo is connected to Vercel - see the first
open item in `BACKLOG.md`.

## What this is

Undecided, deliberately. `BACKLOG.md` holds the open questions and the first
few pieces of work. Nothing here is load-bearing yet, so it is cheap to change
direction.
