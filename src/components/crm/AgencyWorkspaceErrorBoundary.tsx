'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };

type State = { error: Error | null };

export default class AgencyWorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AgencyCompanyWorkspace]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-8 text-center sm:p-10">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={36} />
          <h1 className="text-xl font-black text-[var(--eos-text)]">Nie udało się wczytać panelu biura</h1>
          <p className="eos-muted-copy mx-auto mt-2 max-w-lg text-sm leading-relaxed">
            Wystąpił błąd po stronie przeglądarki. Spróbuj odświeżyć stronę. Jeśli problem wraca, wróć do CRM i
            otwórz panel ponownie.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black"
            >
              <RefreshCw size={14} /> Spróbuj ponownie
            </button>
            <Link
              href="/moje-konto/crm"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
            >
              Wróć do CRM
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
