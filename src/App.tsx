import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api/client';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Rules from './pages/Rules';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

export default function App() {
  const uncategorized = useQuery({ queryKey: ['uncategorized'], queryFn: api.uncategorizedCount });
  const open = uncategorized.data?.count ?? 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Finanz-Dashboard</h1>
        <nav className="flex gap-1">
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
          {open > 0 && (
            <NavLink to="/transaktionen?kategorie=none" className="rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200">
              Unkategorisiert ({open})
            </NavLink>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaktionen" element={<Transactions />} />
        <Route path="/kategorien" element={<Categories />} />
        <Route path="/regeln" element={<Rules />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
