'use client';

import Link from 'next/link';
import AdminPhotoSessionsPanel from '@/components/photoSession/AdminPhotoSessionsPanel';

export default function CentralaPhotoSessionsPage() {
  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] p-6 pt-32 text-[var(--eos-text)] md:p-16 md:pt-40">
      <div className="mx-auto max-w-4xl">
        <Link href="/centrala" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white">
          ← Centrala
        </Link>
        <header className="mb-10 mt-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Narzędzia admina</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Sesje zdjęciowe</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-500">
            Negocjuj terminy z klientami — akceptuj, odrzucaj lub proponuj kontrofertę.
          </p>
        </header>
        <AdminPhotoSessionsPanel />
      </div>
    </div>
  );
}
