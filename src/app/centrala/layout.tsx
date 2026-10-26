import type { ReactNode } from "react";
import KeiImportProgressHost from "@/components/admin/kei/KeiImportProgress";

/** Wspólny układ Centrali: postęp importu KEI widoczny na każdej podstronie. */
export default function CentralaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <KeiImportProgressHost />
    </>
  );
}
