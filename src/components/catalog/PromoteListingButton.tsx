"use client";

import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";

type PromoteListingButtonProps = {
  endpoint: string;
  label?: string;
  successLabel?: string;
  onPromoted?: () => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

export default function PromoteListingButton({
  endpoint,
  label = "Wyróżnij (1 kredyt)",
  successLabel = "Wyróżniono",
  onPromoted,
  className = "",
  buttonClassName = "",
  disabled = false,
}: PromoteListingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promote = async () => {
    if (loading || disabled) return;
    if (!window.confirm("Wyróżnić to ogłoszenie za 1 kredyt publikacji na 7 dni?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się wyróżnić ogłoszenia.");
      }
      setDone(true);
      onPromoted?.();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "Błąd wyróżnienia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void promote()}
        disabled={loading || disabled || done}
        className={buttonClassName || eosBtn("promote", { size: "sm" })}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
        {done ? successLabel : label}
      </button>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
