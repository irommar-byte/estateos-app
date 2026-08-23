"use client";

import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import NoCreditsModal from "@/components/publication/NoCreditsModal";

type PromoteListingButtonProps = {
  endpoint: string;
  label?: string;
  successLabel?: string;
  onPromoted?: () => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

function looksLikeNoCredits(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("kredyt") ||
    m.includes("credit") ||
    m.includes("pakiet") ||
    m.includes("plus") ||
    m.includes("brak")
  );
}

export default function PromoteListingButton({
  endpoint,
  label = "Wyróżnij (1 kredyt)",
  successLabel = "Wyróżnione",
  onPromoted,
  className = "",
  buttonClassName = "",
  disabled = false,
}: PromoteListingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);

  const promote = async () => {
    if (loading || disabled) return;
    if (!window.confirm("Wyróżnić to ogłoszenie za 1 kredyt publikacji na 7 dni?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Nie udało się wyróżnić ogłoszenia.";
        if (looksLikeNoCredits(msg) || res.status === 402 || res.status === 409) {
          setNoCreditsOpen(true);
          return;
        }
        throw new Error(msg);
      }
      setDone(true);
      onPromoted?.();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "Błąd wyróżnienia.");
    } finally {
      setLoading(false);
    }
  };

  const pressed = disabled || done;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void promote()}
        disabled={loading || pressed}
        aria-pressed={pressed}
        className={
          buttonClassName ||
          eosBtn("promote", { size: "sm", className: pressed ? "is-pressed" : "" })
        }
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
        {pressed ? successLabel : label}
      </button>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} />
    </div>
  );
}
