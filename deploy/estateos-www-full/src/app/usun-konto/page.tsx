import type { Metadata } from "next";
import DeleteAccountPageClient from "./DeleteAccountPageClient";

export const metadata: Metadata = {
  title: "Usunięcie konta | EstateOS",
  description:
    "Jak trwale usunąć konto EstateOS i powiązane dane w aplikacji mobilnej lub przez kontakt z obsługą.",
  alternates: { canonical: "https://estateos.pl/usun-konto" },
};

export default function DeleteAccountPage() {
  return <DeleteAccountPageClient />;
}
