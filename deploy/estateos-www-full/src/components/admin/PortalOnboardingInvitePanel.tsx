'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, Sparkles, Users } from 'lucide-react';

export default function PortalOnboardingInvitePanel() {
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/portal-onboarding/invite', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Nie udało się wygenerować linku.');
      setUrl(data.url);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd połączenia.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pl-PL', { dateStyle: 'long' })
    : '';

  return (
    <section className="mt-16 overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-[#0a0a0a] to-[#0a0a0a]">
      <div className="border-b border-emerald-500/15 px-8 py-6 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
              <Users size={14} /> Zaproszenia właścicieli
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Link dla klientów z OtoDom i portali
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Wyślij ten adres właścicielowi nieruchomości. Po rejestracji i wklejeniu linku do ogłoszenia system
              zaimportuje ofertę (jak KEI AMER) i opublikuje ją na profilu użytkownika.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Sparkles size={22} />
          </div>
        </div>
      </div>

      <div className="space-y-5 px-8 py-8 md:px-10">
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Loader2 size={18} className="animate-spin text-emerald-400" />
            Generowanie linku zaproszenia…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              type="button"
              onClick={() => void loadInvite()}
              className="ml-3 font-bold underline"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                <Link2 size={12} /> Link do wysłania klientowi
              </p>
              <p className="break-all font-mono text-sm text-emerald-300">{url}</p>
              {expiryLabel ? (
                <p className="mt-2 text-[11px] text-gray-500">Ważny do {expiryLabel}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Skopiowano' : 'Kopiuj link'}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-white transition hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <ExternalLink size={16} /> Podgląd formularza
              </a>
            </div>

            <ul className="grid gap-2 text-xs text-gray-500 sm:grid-cols-3">
              <li className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                OtoDom · OLX · Nieruchomosci-Online
              </li>
              <li className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                Import + publikacja na profilu
              </li>
              <li className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                Bez ręcznego przepisywania treści
              </li>
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
