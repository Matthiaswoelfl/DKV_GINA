import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Transactions from './pages/Transactions';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

export default function App() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Finanz-Dashboard</h1>
        <nav className="flex gap-1">
          <NavLink to="/transaktionen" className={link}>
            Transaktionen
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/transaktionen" element={<Transactions />} />
        <Route path="*" element={<Navigate to="/transaktionen" replace />} />
      </Routes>
    </div>
  );
}
