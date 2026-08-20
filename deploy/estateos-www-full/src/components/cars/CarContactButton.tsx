"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatchContactUnreadRefresh, initContactThreadWeb } from "@/lib/contactServiceWeb";
import EosButton from "@/components/ui/EosButton";

type CarContactButtonProps = {
  sellerUserId: number;
  sellerName?: string;
  currentUserId?: number | null;
  carTitle?: string;
  className?: string;
};

export default function CarContactButton({
  sellerUserId,
  sellerName,
  currentUserId,
  carTitle,
  className = "",
}: CarContactButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const selfId = Number(currentUserId);
  if (Number.isFinite(selfId) && selfId > 0 && selfId === sellerUserId) return null;

  const handleClick = async () => {
    if (loading) return;
    if (!currentUserId) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLoading(true);
    try {
      const thread = await initContactThreadWeb(sellerUserId);
      dispatchContactUnreadRefresh();
      const name = encodeURIComponent(sellerName || thread.peerUserName || "");
      const carHint = carTitle ? encodeURIComponent(`Pytanie o: ${carTitle}`) : "";
      router.push(
        `/moje-konto/wiadomosci?thread=${thread.id}&peer=${sellerUserId}${name ? `&name=${name}` : ""}${carHint ? `&prefill=${carHint}` : ""}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Nie udało się otworzyć wiadomości.";
      window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <EosButton
      type="button"
      variant="car"
      block
      onClick={() => void handleClick()}
      disabled={loading}
      className={`mt-4 ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
      Kontakt ze sprzedającym
    </EosButton>
  );
}
