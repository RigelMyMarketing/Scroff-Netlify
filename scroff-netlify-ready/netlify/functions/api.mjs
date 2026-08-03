// Netlify Function entrypoint. This does NOT duplicate any app logic — it
// just wraps the real Express app (server/src/app.js) with serverless-http
// so it can run inside AWS Lambda (what Netlify Functions run on), instead
// of via app.listen() like server/src/index.js does for Docker/VPS deploys.
//
// Imports resolve from server/src/app.js's own location, so they use
// server/node_modules (installed by `npm install --prefix server` in the
// build command below) — nothing needs to be duplicated here.
import serverless from 'serverless-http';
import { createApp } from '../../server/src/app.js';
import { ensureSeedAdmin } from '../../server/prisma/seed.js';

const app = createApp();

// Multipart prize-photo uploads need to survive Lambda's request/response
// encoding: Netlify base64-encodes bodies whose content-type isn't in this
// list before handing them to the function.
const serverlessHandler = serverless(app, {
  binary: ['multipart/form-data'],
});

// The original server (server/src/index.js) seeds the first admin account +
// default prize pool once, at process startup, before app.listen(). There's
// no equivalent long-lived startup here — each cold start is a fresh
// process — so this runs once per cold start instead. ensureSeedAdmin() is
// already idempotent (it only creates rows that don't exist yet), and this
// module-level flag stops it from re-querying the DB on every warm
// invocation of the same container.
let seeded = false;

export async function handler(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!seeded) {
    await ensureSeedAdmin();
    seeded = true;
  }
  return serverlessHandler(event, context);
}
