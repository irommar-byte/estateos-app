"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import EosButton from "@/components/ui/EosButton";
import { useLocale } from "@/contexts/LocaleContext";
import { carAlertErrorClass } from "@/components/cars/carFormStyles";

type CarOwnerActionsProps = {
  carId: number;
  ownerUserId: number | null;
  currentUserId: number | null;
  isAdmin?: boolean;
};

export default function CarOwnerActions({
  carId,
  ownerUserId,
  currentUserId,
  isAdmin = false,
}: CarOwnerActionsProps) {
  const router = useRouter();
  const { dict } = useLocale();
  const o = dict.cars.owner;
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const canEdit = isOwner || isAdmin;
  if (!canEdit) return null;

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
      <div className="flex flex-wrap gap-2.5">
        <EosButton href={`/cars/${carId}/edytuj`} variant="car" size="sm">
          <Pencil className="size-3.5" aria-hidden />
          {o.edit}
        </EosButton>
        {isOwner ? (
          <EosButton type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)} disabled={deleting}>
            {deleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
            {deleting ? o.deleting : o.delete}
          </EosButton>
        ) : null}
        {error ? <p className={`w-full ${carAlertErrorClass}`}>{error}</p> : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--eos-bg)]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
            <p className="text-sm leading-relaxed text-[var(--eos-text)]">{o.confirmDelete}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2.5">
              <EosButton type="button" variant="secondary" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                {dict.cars.common.cancel}
              </EosButton>
              <EosButton type="button" variant="danger" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {deleting ? o.deleting : o.delete}
              </EosButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
