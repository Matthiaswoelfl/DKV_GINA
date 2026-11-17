import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api/client';
import { STANDALONE } from './lib/env';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Rules from './pages/Rules';
import Budgets from './pages/Budgets';
import Data from './pages/Data';
import ThemeToggle from './components/ThemeToggle';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transaktionen': 'Transaktionen',
  '/kategorien': 'Kategorien',
  '/regeln': 'Regeln',
  '/budgets': 'Budgets',
  '/daten': 'Daten & Backup',
};

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

export default function App() {
  const uncategorized = useQuery({ queryKey: ['uncategorized'], queryFn: api.uncategorizedCount });
  const open = uncategorized.data?.count ?? 0;
  const storage = useQuery({ queryKey: ['storage-problem'], queryFn: async () => api.storageProblem(), refetchInterval: STANDALONE ? 4000 : false, enabled: STANDALONE });
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${TITLES[pathname] ?? 'Finanz-Dashboard'} · Finanz-Dashboard`;
  }, [pathname]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only rounded bg-indigo-600 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">
        Zum Inhalt springen
      </a>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-xl font-semibold">Finanz-Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Hauptnavigation" className="flex flex-wrap gap-1">
          <NavLink to="/" end className={link}>
            Dashboard
          </NavLink>
          <NavLink to="/transaktionen" end className={link}>
            Transaktionen
          </NavLink>
          <NavLink to="/kategorien" className={link}>
            Kategorien
          </NavLink>
          <NavLink to="/regeln" className={link}>
            Regeln
          </NavLink>
          <NavLink to="/budgets" className={link}>
            Budgets
          </NavLink>
          <NavLink to="/daten" className={link}>
            Daten
          </NavLink>
          {open > 0 && (
            <NavLink to="/transaktionen?kategorie=none" className="rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200">
              Unkategorisiert ({open})
            </NavLink>
          )}
        </nav>
        <ThemeToggle />
        </div>
      </header>
      {storage.data && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Der Browser erlaubt kein Speichern (privates Fenster oder gesperrter Speicher). Deine Eingaben gehen beim Schließen dieser Seite verloren. Öffne die Datei in einem normalen Fenster oder lade regelmäßig ein JSON-Backup herunter.
        </p>
      )}
      <main id="main" tabIndex={-1} className="outline-none">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaktionen" element={<Transactions />} />
        <Route path="/kategorien" element={<Categories />} />
        <Route path="/regeln" element={<Rules />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/daten" element={<Data />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </main>
    </div>
  );
}
