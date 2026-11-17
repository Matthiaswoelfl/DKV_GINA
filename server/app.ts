import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { ZodError } from 'zod';
import type { Db } from './db';
import { transactionsRouter } from './routes/transactions';
import { categoriesRouter } from './routes/categories';
import { rulesRouter } from './routes/rules';

export function createApp(db: Db, opts: { staticDir?: string } = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/transactions', transactionsRouter(db));
  app.use('/api/categories', categoriesRouter(db));
  app.use('/api/rules', rulesRouter(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Nicht gefunden' });
  });

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(express.static(dir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (res.headersSent) {
      next(err);
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Interner Fehler' });
  };
  app.use(onError);
  return app;
}
