import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">Hier ist etwas schiefgelaufen</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">Deine Daten sind nicht betroffen. Lade die Seite neu. Besteht das Problem weiter, sieh in die Konsole des Servers.</p>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Seite neu laden
        </button>
      </div>
    );
  }
}
