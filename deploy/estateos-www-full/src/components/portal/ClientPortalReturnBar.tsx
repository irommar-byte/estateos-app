"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import EosButton from "@/components/ui/EosButton";
import { clientPortalHref, rememberClientPortalToken } from "@/lib/crm/portalSession";

export default function ClientPortalReturnBar({ token }: { token: string }) {
  useEffect(() => {
    rememberClientPortalToken(token);
  }, [token]);

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top,0px)+5rem)] z-30 border-b border-[rgba(196,163,90,0.22)] bg-[rgba(251,250,247,0.92)] px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="eos-portal-label min-w-0">Jesteś w panelu klienta</p>
        <EosButton href={clientPortalHref(token)} variant="home" size="sm">
          <ArrowLeft className="size-3.5" />
          Wróć do panelu
        </EosButton>
      </div>
    </div>
  );
}
