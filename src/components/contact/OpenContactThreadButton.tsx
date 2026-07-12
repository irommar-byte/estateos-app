"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatchContactUnreadRefresh, initContactThreadWeb } from "@/lib/contactServiceWeb";

type Props = {
  peerUserId: number;
  peerName?: string;
  label: string;
  returnTo?: string;
  className?: string;
};

export default function OpenContactThreadButton({
  peerUserId,
  peerName,
  label,
  returnTo,
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const thread = await initContactThreadWeb(peerUserId);
      dispatchContactUnreadRefresh();
      const params = new URLSearchParams({
        thread: String(thread.id),
        peer: String(peerUserId),
      });
      const name = peerName || thread.peerUserName;
      if (name) params.set("name", name);
      if (returnTo) params.set("from", returnTo);
      router.push(`/moje-konto/wiadomosci?${params.toString()}`);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Nie udało się otworzyć czatu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={className}
    >
      {loading ? <Loader2 className="inline size-3.5 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}
