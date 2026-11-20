# Muoviamoci

A small PWA for two people to log daily activity: swimming (vasche), beach volley and stretching.

Plain HTML/CSS/JS with no build step.

- `index.html`: page shell
- `styles.css`: design (light and dark mode)
- `app.js`: UI, streaks, badges, confetti, create/join flow
- `store.js`: local cache, offline outbox and Supabase sync
- `config.js`: Supabase URL and publishable key (empty = no sync)
- `supabase/schema.sql`: database tables and security rules
- `sw.js` + `manifest.webmanifest`: offline support and home-screen install

## How sync works

- There are no logins. One of you taps **Iniziamo**, which creates a shared "space" with a random invite code (e.g. `K7QM-3XPA-9FDR`). The other taps **Ho un codice di invito**, or opens the invite link.
- Every request carries the code. Supabase row-level security only returns rows for that code, so the code is effectively your shared password.
- Changes are saved on the phone first, then pushed to Supabase. If you're offline they wait and go out when the connection comes back.
- The app pulls fresh data when it opens, when it comes back to the foreground, and every 30 seconds. When the other person has logged something today, you get a 💞 notification in the app.

## Supabase setup (once)

1. Create a free project at supabase.com.
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, then **Run**.
3. Open **Project Settings → API Keys** and copy the **Project URL** and the **publishable** key (`sb_publishable_…`; the legacy `anon` key also works) into `config.js`.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Updating the app

Commit and push to `main`; GitHub Pages republishes in about a minute. Bump `VERSION` in `sw.js` on every release: open apps notice the new version when they're brought to the front, install it and reload by themselves.
