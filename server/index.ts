import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = process.env.DB_FILE ?? path.join(root, 'data', 'finanzen.db');
const port = Number(process.env.PORT ?? 5174);

const db = openDb(dbFile);
const app = createApp(db, {
  staticDir: path.join(root, 'dist'),
  backupDir: path.join(path.dirname(dbFile), 'backups'),
});

// Nur lokal erreichbar: Finanzdaten verlassen den Rechner nicht.
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Finanz-Dashboard: http://localhost:${port}  (Daten: ${dbFile})`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} ist belegt. Läuft die App schon? Anderen Port wählen: PORT=5180 npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

// Sauber beenden, damit SQLite den Write-Ahead-Log zurückschreibt.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
