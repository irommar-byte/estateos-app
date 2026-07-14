"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { carAlertErrorClass } from "@/components/cars/carFormStyles";

type CarOwnerActionsProps = {
  carId: number;
  ownerUserId: number | null;
  currentUserId: number | null;
};

export default function CarOwnerActions({ carId, ownerUserId, currentUserId }: CarOwnerActionsProps) {
  const router = useRouter();
  const { dict } = useLocale();
  const o = dict.cars.owner;
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUserId || !ownerUserId || currentUserId !== ownerUserId) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/cars/${carId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : o.deleteFailed);
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      router.push("/moje-konto/ogloszenia?vertical=car");
      router.refresh();
    } catch {
      setError(o.deleteNetworkError);
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/cars/${carId}/edytuj`}
          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300"
        >
          {o.edit}
        </Link>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
          className="rounded-full border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 disabled:opacity-60 dark:text-red-300"
        >
          {deleting ? o.deleting : o.delete}
        </button>
        {error ? <p className={`w-full ${carAlertErrorClass}`}>{error}</p> : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--eos-bg)]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
            <p className="text-sm leading-relaxed text-[var(--eos-text)]">{o.confirmDelete}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]"
              >
                {dict.cars.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-full border border-red-400/45 bg-red-500/15 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-700 dark:text-red-300"
              >
                {deleting ? o.deleting : o.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
