"use client";

import { Camera, FileSearch, Keyboard, ScanLine, ShieldCheck, Upload } from "lucide-react";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import { useState } from "react";

export type CarAddEntryMethod = "scan" | "upload" | "capture" | "manual";

type CarAddEntryScreenProps = {
  onChoose: (method: CarAddEntryMethod) => void;
};

const methods: {
  id: CarAddEntryMethod;
  icon: typeof ScanLine;
  title: string;
  description: string;
  badge?: string;
}[] = [
  {
    id: "scan",
    icon: ScanLine,
    title: "Skanuj kod aparatem",
    description: "Ustaw tył dowodu w kadrze — kod Aztec odczytamy automatycznie i uzupełnimy markę, model oraz VIN.",
    badge: "Najszybsze",
  },
  {
    id: "upload",
    icon: Upload,
    title: "Wgraj zdjęcie dowodu",
    description: "Masz już zdjęcie w galerii? Wgraj plik JPG, PNG lub HEIC — system odczyta kod Aztec z obrazu.",
  },
  {
    id: "capture",
    icon: Camera,
    title: "Zrób zdjęcie i przetwórz",
    description: "Zrób nowe zdjęcie tyłu dowodu aparatem telefonu lub komputera — kod zostanie odczytany od razu.",
  },
  {
    id: "manual",
    icon: Keyboard,
    title: "Wypełnię ręcznie",
    description: "Nie masz dowodu pod ręką? Przejdź do formularza i wpisz dane samodzielnie w swoim tempie.",
  },
];

export default function CarAddEntryScreen({ onChoose }: CarAddEntryScreenProps) {
  const [demoRestrict, setDemoRestrict] = useState(true);

  return (
    <div className="grid gap-6">
      <CatalogBrandHero
        brand="car"
        title="Jak chcesz dodać auto?"
        description="Wybierz sposób wprowadzenia danych z dowodu rejestracyjnego. Formularz możesz wypełnić bez logowania — konto założysz dopiero przy publikacji."
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-sky-400/25 bg-gradient-to-br from-sky-500/[0.08] via-[var(--eos-card)] to-[var(--eos-card)] p-5 shadow-[0_22px_70px_rgba(14,165,233,0.1)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15">
            <ShieldCheck className="size-5 text-sky-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">Nasza przewaga</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Prywatność VIN i pełna historia dla kupującego</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              Po wpisaniu VIN, numeru rejestracyjnego i daty pierwszej rejestracji możesz{" "}
              <strong className="font-semibold text-[var(--eos-text)]">zastrzec te dane</strong> — na publicznym
              ogłoszeniu widoczne będą tylko pierwsze znaki. To nie blokuje weryfikacji: kupujący jednym przyciskiem w
              sklepie sprawdzi{" "}
              <strong className="font-semibold text-[var(--eos-text)]">realną historię CEPIK</strong> — stan auta,
              ubezpieczenie i przebieg — bez ujawniania Twoich wrażliwych danych.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-1">
          <AppleStyleSwitch
            id="demo-restrict-docs"
            checked={demoRestrict}
            onChange={setDemoRestrict}
            label="Zastrzeż dane pojazdu (VIN, rejestracja, pierwsza rejestracja)"
            description="Przykład: na ogłoszeniu WBA*** zamiast pełnego VIN — historia w sklepie nadal kompletna dla kupującego."
          />
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
          <FileSearch className="size-4 shrink-0" aria-hidden />
          <span>W formularzu włączysz lub wyłączysz zastrzeżenie w dowolnym momencie przed publikacją.</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onChoose(method.id)}
            className="group flex h-full flex-col rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 text-left shadow-[0_18px_50px_rgba(14,165,233,0.05)] transition hover:border-sky-400/35 hover:shadow-[0_22px_60px_rgba(14,165,233,0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/12 transition group-hover:bg-sky-500/18">
                <method.icon className="size-5 text-sky-400" aria-hidden />
              </div>
              {method.badge ? (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">
                  {method.badge}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{method.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--eos-muted)]">{method.description}</p>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-sky-500 transition group-hover:text-sky-400">
              Wybierz →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
