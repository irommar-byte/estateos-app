import type { Metadata } from "next";
import Link from "next/link";
import KeiImportControlCenter from "@/components/admin/kei/KeiImportControlCenter";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { buildKeiImportAnalytics, type KeiImportAnalytics } from "@/lib/keiImportAnalytics";

export const metadata: Metadata = { title: "Maszyna importu · Centrala EstateOS" };
export const dynamic = "force-dynamic";

export default async function KeiImportPage() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== "ADMIN") {
    return (
      <div className="kei-lux flex min-h-screen items-center justify-center bg-[color:var(--k-bg)] px-6 text-center">
        <div className="k-card max-w-md p-8">
          <p className="k-kicker">Centrala</p>
          <h1 className="k-serif mt-2 text-[28px] text-[color:var(--k-ink)]">Brak uprawnień</h1>
          <p className="mt-3 text-[14px] text-[color:var(--k-ink-2)]">Ta strona jest dostępna tylko dla administratora.</p>
          <Link href="/login" className="k-btn mt-6 inline-flex">Zaloguj się</Link>
        </div>
      </div>
    );
  }
  // Pierwszy widok od razu z danymi (bez migotania szkieletu); przy błędzie bazy dociągnie je klient.
  let initialData: KeiImportAnalytics | null = null;
  try {
    initialData = await buildKeiImportAnalytics("30");
  } catch {
    initialData = null;
  }
  return <KeiImportControlCenter initialData={JSON.parse(JSON.stringify(initialData)) as KeiImportAnalytics | null} />;
}
