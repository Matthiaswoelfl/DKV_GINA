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
app.listen(port, '127.0.0.1', () => {
  console.log(`Finanz-Dashboard: http://localhost:${port}  (Daten: ${dbFile})`);
});
