import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ensureSession } from './lib/session.js';
import { authRouter } from './routes/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { gameRouter } from './routes/game.routes.js';
import { playerRouter } from './routes/player.routes.js';

// import.meta.url is undefined when esbuild bundles this to CommonJS for
// Netlify Functions (there's no client build alongside the function anyway,
// see the fs.existsSync guard below) — fall back to null instead of
// crashing the whole function on startup.
let __dirname;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  __dirname = null;
}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Only needed when the client dev-server runs on a different origin/port
  // than this API (i.e. local development). In production the built client
  // is served by this same process, so no cross-origin requests happen.
  if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  }

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/game', ensureSession, gameRouter);
  app.use('/api/player', ensureSession, playerRouter);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
  });

  // Serve the built client (client/dist) in production so the whole app is
  // a single deployable process (Docker/VPS style). `npm run build` in
  // /client produces this. On Netlify the client is deployed separately as
  // a static site and this API only ever receives /api/* traffic (see
  // netlify/functions/api.mjs + netlify.toml), so clientDist won't exist
  // there — skip this block entirely in that case instead of erroring.
  const clientDist = __dirname ? path.join(__dirname, '..', '..', 'client', 'dist') : null;
  if (clientDist && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  return app;
}
