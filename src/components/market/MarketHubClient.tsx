"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddressSuggestInput from "@/components/crm/AddressSuggestInput";
import MarketValuationPanel from "@/components/market/MarketValuationPanel";
import {
  closestWarsawDistrict,
  WARSAW_DISTRICT_CENTROIDS,
} from "@/lib/market/warsawDistricts";
import type { MarketAreaStatView } from "@/lib/market/types";
import type { MarketIntelligencePayload } from "@/lib/market/types";

const PERIODS = [
  { days: 90, label: "3 miesiące" },
  { days: 180, label: "6 miesięcy" },
  { days: 365, label: "12 miesięcy" },
  { days: 730, label: "24 miesiące" },
];

function plnM2(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("pl-PL")} zł/m²`;
}

export default function MarketHubClient() {
  const [periodDays, setPeriodDays] = useState(365);
  const [district, setDistrict] = useState("");
  const [cityStat, setCityStat] = useState<MarketAreaStatView | null>(null);
  const [districts, setDistricts] = useState<MarketAreaStatView[]>([]);
  const [intel, setIntel] = useState<MarketIntelligencePayload | null>(null);
  const [lagNote, setLagNote] = useState<string | null>(null);
  const [asOfLabel, setAsOfLabel] = useState<string | null>(null);
  const [area, setArea] = useState("62");
  const [rooms, setRooms] = useState("3");
  const [floor, setFloor] = useState("4");
  const [address, setAddress] = useState("");
  const [pinOverride, setPinOverride] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/market/stats?city=Warszawa&periodDays=${periodDays}`).then((r) => r.json()),
      fetch(`/api/market/intelligence?city=Warszawa&periodDays=${periodDays}`).then((r) => r.json()),
    ]).then(([stats, intelligence]) => {
      if (cancelled) return;
      setCityStat(stats.cityStat || null);
      setDistricts(Array.isArray(stats.districts) ? stats.districts : []);
      setLagNote(stats.lagNote || intelligence?.lagNote || null);
      setAsOfLabel(stats.asOfLabel || null);
      if (intelligence?.ok) setIntel(intelligence);
    });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const activeDistrict = districts.find((d) => d.district === district) || null;
  const pin = pinOverride
    || (district && WARSAW_DISTRICT_CENTROIDS[district]
      ? WARSAW_DISTRICT_CENTROIDS[district]
      : { lat: 52.2297, lng: 21.0122 });

  const maxMedian = useMemo(
    () => Math.max(...districts.map((d) => d.medianPpsm || 0), 1),
    [districts],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-500">EstateOS™ Market</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--eos-text)] sm:text-4xl">
          Rzeczywiste ceny transakcyjne nieruchomości
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
          Warszawa · lokale mieszkalne · dane z Rejestru Cen Nieruchomości. Nie średnia z ogłoszeń — akty notarialne.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setPeriodDays(p.days)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
              periodDays === p.days
                ? "bg-emerald-500 text-black"
                : "border border-[var(--eos-border)] text-[var(--eos-muted)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {lagNote ? (
        <p className="max-w-3xl text-[12px] leading-relaxed text-[var(--eos-muted)]">
          {asOfLabel ? `Kompletne akty do ${asOfLabel}. ` : ""}
          {lagNote}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Średnia cena", value: plnM2(cityStat?.avgPpsm) },
          { label: "Mediana", value: plnM2(cityStat?.medianPpsm) },
          {
            label: "Zmiana vs poprzednie okno",
            value: cityStat?.yoyChangePct != null ? `${cityStat.yoyChangePct > 0 ? "+" : ""}${cityStat.yoyChangePct.toFixed(1)}%` : "—",
          },
          { label: "Transakcje", value: cityStat?.txnCount?.toLocaleString("pl-PL") || "—" },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{item.label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums text-[var(--eos-text)]">{item.value}</p>
          </div>
        ))}
      </div>

      {intel ? (
        <div className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">Market Intelligence</p>
          <p className="mt-2 text-xl font-black text-[var(--eos-text)]">
            Warszawa · {intel.headline}
            {intel.yoyChangePct != null ? ` · ${intel.yoyChangePct > 0 ? "+" : ""}${intel.yoyChangePct}%` : ""}
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            <IntelCol title="Najszybciej rosnące" rows={intel.fastestGrowing.map((r) => `${r.district} +${r.yoyChangePct}%`)} />
            <IntelCol title="Najdroższe" rows={intel.mostExpensive.map((r) => `${r.district} — ${plnM2(r.medianPpsm)}`)} />
            <IntelCol title="Najwięcej transakcji" rows={intel.mostDeals.map((r) => `${r.district} · ${r.txnCount}`)} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Dzielnice Warszawy</p>
          <div className="space-y-2">
            {districts.map((d) => {
              const width = Math.max(8, Math.round(((d.medianPpsm || 0) / maxMedian) * 100));
              return (
                <button
                  key={d.district}
                  type="button"
                  onClick={() => {
                    setDistrict(d.district);
                    setPinOverride(null);
                  }}
                  className={`block w-full rounded-2xl px-3 py-2 text-left ${
                    district === d.district ? "bg-emerald-500/10" : "hover:bg-[var(--eos-input)]"
                  }`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--eos-text)]">{d.district}</span>
                    <span className="text-sm font-black tabular-nums text-[var(--eos-text)]">{plnM2(d.medianPpsm)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--eos-input)]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                    {d.txnCount} aktów
                    {d.yoyChangePct != null ? ` · ${d.yoyChangePct > 0 ? "+" : ""}${d.yoyChangePct.toFixed(1)}%` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Wycena konkretnej nieruchomości</p>
            <p className="mt-1 text-sm text-[var(--eos-muted)]">
              {district || "Warszawa"} {activeDistrict ? `· ${plnM2(activeDistrict.medianPpsm)}` : ""}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Field label="m²" value={area} onChange={setArea} />
              <Field label="Pokoje" value={rooms} onChange={setRooms} />
              <Field label="Piętro" value={floor} onChange={setFloor} />
            </div>
            <div className="mt-3">
              <AddressSuggestInput
                label="Adres (opcjonalnie)"
                value={address}
                placeholder="ul. Przykładowa 10, Warszawa"
                onChange={(value, meta) => {
                  setAddress(value);
                  if (meta?.lat != null && meta?.lng != null && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)) {
                    setPinOverride({ lat: meta.lat, lng: meta.lng });
                    setDistrict(closestWarsawDistrict(meta.lat, meta.lng));
                  }
                }}
              />
            </div>
          </div>
          <MarketValuationPanel
            lat={pin.lat}
            lng={pin.lng}
            area={Number(area) || null}
            rooms={Number(rooms) || null}
            floor={Number(floor) || null}
            city="Warszawa"
            district={district || null}
            address={address}
            purpose="hub"
          />
          <p className="text-sm text-[var(--eos-muted)]">
            Chcesz raport na e-mail za 1 kredyt? Przejdź do{" "}
            <Link href="/wycena" className="font-bold text-emerald-500">
              wyceny konsumenckiej
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
      />
    </label>
  );
}

function IntelCol({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{title}</p>
      <ol className="mt-2 space-y-1 text-sm text-[var(--eos-text)]">
        {rows.map((row, i) => (
          <li key={row}>
            <span className="text-[var(--eos-muted)]">{i + 1}. </span>
            {row}
          </li>
        ))}
      </ol>
    </div>
  );
}
