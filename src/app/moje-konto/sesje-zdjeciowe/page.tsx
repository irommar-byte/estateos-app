import UserPhotoSessionsPanel from '@/components/photoSession/UserPhotoSessionsPanel';

export default function PhotoSessionsAccountPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-[var(--eos-border)] pb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">Moje konto</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sesje zdjęciowe</h1>
          <p className="mt-3 text-sm text-[var(--eos-muted)]">
            Rezerwacje EstateOS Studio i negocjacje terminu — tak jak w aplikacji mobilnej.
          </p>
        </header>
        <UserPhotoSessionsPanel />
      </div>
    </main>
  );
}
