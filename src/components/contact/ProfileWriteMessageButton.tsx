"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatchContactUnreadRefresh, initContactThreadWeb } from "@/lib/contactServiceWeb";

type Props = {
  peerUserId: number;
  peerName?: string;
  currentUserId?: number | string | null;
  variant?: "dark" | "light" | "offer";
  className?: string;
};

export default function ProfileWriteMessageButton({
  peerUserId,
  peerName,
  currentUserId,
  variant = "dark",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const selfId = Number(currentUserId);
  if (Number.isFinite(selfId) && selfId > 0 && selfId === peerUserId) return null;

  const handleClick = async () => {
    if (loading) return;
    if (!currentUserId) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLoading(true);
    try {
      const thread = await initContactThreadWeb(peerUserId);
      dispatchContactUnreadRefresh();
      const name = encodeURIComponent(peerName || thread.peerUserName || "");
      router.push(`/moje-konto/wiadomosci?thread=${thread.id}&peer=${peerUserId}${name ? `&name=${name}` : ""}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Nie udało się otworzyć czatu.";
      window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  const styles =
    variant === "light"
      ? "border border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-text)] hover:border-emerald-500/40 hover:text-emerald-500"
      : variant === "offer"
        ? "border border-white/15 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-white"
        : "border border-emerald-500/30 bg-emerald-500 text-black hover:bg-emerald-400";

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-70 ${styles} ${className}`}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <MessageCircle className="size-4" strokeWidth={2.2} aria-hidden />
      )}
      Napisz
    </button>
  );
}
