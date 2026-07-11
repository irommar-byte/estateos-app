"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getCarsDictionary } from "@/i18n/carsDictionary";

type CarOwnerActionsProps = {
  carId: number;
  ownerUserId: number | null;
  currentUserId: number | null;
};

export default function CarOwnerActions({ carId, ownerUserId, currentUserId }: CarOwnerActionsProps) {
  const { locale } = useLocale();
  const d = getCarsDictionary(locale);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUserId || !ownerUserId || currentUserId !== ownerUserId) return null;

  const handleDelete = async () => {
    if (!window.confirm(d.ownerDeleteConfirm)) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/cars/${carId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : d.ownerDeleteError);
        setDeleting(false);
        return;
      }
      router.push("/moje-konto/ogloszenia");
      router.refresh();
    } catch {
      setError(d.ownerNetworkError);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href={`/cars/${carId}/edytuj`}
        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-300"
      >
        {d.ownerEdit}
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-full border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-300 disabled:opacity-60"
      >
        {deleting ? d.ownerDeleting : d.ownerDelete}
      </button>
      {error ? <p className="w-full text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
