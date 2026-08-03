# Deploying Scroff to Netlify

Netlify hosts static sites + serverless Functions — it can't run the
`app.listen()` process the Dockerfile uses. This has been adapted so:

- **The client** (`client/dist`) is built and served by Netlify directly.
- **The API** runs as a single Netlify Function (`netlify/functions/api.mjs`)
  that wraps the *same* Express app (`server/src/app.js`) with
  `serverless-http` — no route logic was duplicated or rewritten.
- `netlify.toml` redirects `/api/*` to that function and falls back to
  `/index.html` for client-side routing.

## One-time setup

1. **Database:** you need Postgres reachable from Netlify's Functions —
   [Neon](https://neon.tech) works well and has a free tier. Lambda-style
   functions open a lot of short-lived connections, so use Neon's **pooled**
   connection string (the one with `-pooler` in the hostname), not the direct
   one.
2. **Cloudinary:** create a free account for prize-photo uploads (already
   wired up in `server/src/lib/uploadStorage.js`).
3. In the Netlify site's **Environment variables**, set:
   - `DATABASE_URL` — the pooled Neon connection string
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `JWT_SECRET` — a real random string (`openssl rand -hex 32`)
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` — for the first-run seeded admin
   - `NODE_ENV=production` (so cookies are marked `secure`)
   - Do **not** set `CORS_ORIGIN` — client and API share an origin on Netlify.
4. Run the migration against that database once, from your machine, before
   the first deploy (Netlify's build doesn't run migrations automatically):
   ```bash
   DATABASE_URL="<your pooled Neon URL>" npx --prefix server prisma migrate deploy
   ```

## Deploy

Push to the connected Git repo, or run `netlify deploy --build --prod`.
Netlify will:
- run `npm run netlify-build` (root `package.json`) — builds the client and
  installs/generates the server's Prisma client for the function bundle
- publish `client/dist`
- bundle `netlify/functions/api.mjs` as the API, including the Prisma engine
  binary via `included_files` in `netlify.toml`

The Docker/VPS path (`Dockerfile`, `docker-compose.yml`) is untouched and
still works if you ever want to run this as a single always-on process
instead — the two deployment paths coexist.

## Known Netlify-specific constraints

- **Cold starts:** the first request after idle time will be slower (new
  Lambda container + fresh Prisma connection).
- **No local disk:** prize photos already go to Cloudinary, so this isn't an
  issue — but don't reintroduce local-disk storage for anything.
- **10-second default function timeout** on Netlify's free/starter tiers —
  fine for this app's request patterns, but worth knowing if you add
  anything slow (e.g. bulk exports via `exceljs`).
