"use client";

import { Suspense, use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import SellerCarsSection from "@/components/cars/SellerCarsSection";
import AgentPublicProfile from "@/components/profile/AgentPublicProfile";
import PortalImportProfileGuide from "@/components/onboarding/PortalImportProfileGuide";

export default function UserProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const profileId = Number(resolvedParams.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/profil/${resolvedParams.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--eos-bg)]">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <h1 className="text-2xl font-black">Profil niedostępny</h1>
      </div>
    );
  }

  return (
    <>
      {Number.isFinite(profileId) ? (
        <Suspense fallback={null}>
          <PortalImportProfileGuide profileUserId={profileId} />
        </Suspense>
      ) : null}
      <AgentPublicProfile data={data} />
      {Number.isFinite(profileId) && profileId > 0 ? <SellerCarsSection userId={profileId} /> : null}
    </>
  );
}
