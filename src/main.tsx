import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { STANDALONE } from './lib/env';
import './index.css';

// Aus einer lokalen Datei (file://) funktionieren nur Hash-Adressen.
const Router = STANDALONE ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root fehlt');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <App />
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
