"use client";

import { useMemo, useState } from "react";
import { Check, Lock, LockOpen, MapPin, SlidersHorizontal } from "lucide-react";
import { canonicalizeCity } from "@/lib/location/locationCatalog";
import {
  radarIntelligenceLabel,
  type WebRadarFilters,
} from "@/lib/radarCalibrationWeb";
import CrmRadarAreaPicker from "@/components/crm/CrmRadarAreaPicker";
import CrmRadarScrubber from "@/components/crm/CrmRadarScrubber";
import {
  RADAR_MAX_AREA,
  RADAR_MAX_BUDGET,
  RADAR_MAX_YEAR,
  RADAR_MIN_AREA,
  RADAR_MIN_BUDGET,
  RADAR_MIN_YEAR,
  formatRadarAreaLabel,
  formatRadarBudgetLabel,
  formatRadarYearLabel,
} from "@/lib/radarScrubberLimits";
import type { RadarMapAreaSelection } from "@/lib/radarMapArea";
import {
  DEFAULT_INTELLIGENCE_LOCKS,
  type IntelligenceLockKey,
  type IntelligenceLocks,
} from "@/lib/crm/clientIntelligence";

type Catalog = {
  strictCities: string[];
  strictCityDistricts: Record<string, string[]>;
};

type Props = {
  value: WebRadarFilters;
  onChange: (next: WebRadarFilters) => void;
  catalog: Catalog;
  /** Compact embed inside client create wizard step 3 */
  compact?: boolean;
  locks?: IntelligenceLocks;
  onLocksChange?: (next: IntelligenceLocks) => void;
};

const PROPERTY_TYPES = [
  { id: "FLAT", label: "Mieszkanie" },
  { id: "HOUSE", label: "Dom" },
  { id: "PLOT", label: "Działka" },
  { id: "COMMERCIAL", label: "Lokal" },
] as const;

const AMENITIES = [
  { key: "requireBalcony" as const, label: "Balkon" },
  { key: "requireGarden" as const, label: "Ogródek" },
  { key: "requireTwoLevel" as const, label: "Dwupoziomowe" },
  { key: "requireElevator" as const, label: "Winda" },
  { key: "requireParking" as const, label: "Parking" },
  { key: "requireFurnished" as const, label: "Umeblowane" },
];

function segmentBtn(active: boolean) {
  return [
    "flex-1 rounded-full py-3 text-[10px] font-black uppercase tracking-widest transition-all",
    active
      ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)]"
      : "eos-segment-inactive text-[var(--eos-muted)] hover:text-[var(--eos-text)]",
  ].join(" ");
}

function choiceChip(active: boolean) {
  return [
    "rounded-xl border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
    active
      ? "border-emerald-500 bg-emerald-500 text-black"
      : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:border-emerald-500/35 hover:text-[var(--eos-text)]",
  ].join(" ");
}

function amenityChip(active: boolean) {
  return [
    "rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
    active
      ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:border-emerald-500/30",
  ].join(" ");
}

function LockToggle({
  locked,
  label,
  onToggle,
}: {
  locked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={locked ? `Odblokuj ${label}` : `Zablokuj ${label}`}
      title={
        locked
          ? "Zablokowane — asystent nie zmieni tego kryterium na podstawie reakcji"
          : "Odblokowane — asystent może dopisać naukę z reakcji klienta"
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
        locked
          ? "border-amber-400/50 bg-amber-400/15 text-amber-600"
          : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:border-emerald-500/40 hover:text-[var(--eos-text)]"
      }`}
    >
      {locked ? <Lock size={13} /> : <LockOpen size={13} />}
    </button>
  );
}
export default function AgencyClientCriteriaEditor({
  value,
  onChange,
  catalog,
  compact = false,
  locks,
  onLocksChange,
}: Props) {
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [mapAreaLabel, setMapAreaLabel] = useState(() => {
    if (value.calibrationMode === "MAP" && value.lat != null && value.lng != null) {
      return `${value.city || "Obszar"} · ${value.radiusKm ?? "?"} km`;
    }
    return "";
  });

  const intelligence = useMemo(
    () => radarIntelligenceLabel(value.matchThreshold),
    [value.matchThreshold],
  );

  const cityOptions = catalog.strictCities.length ? catalog.strictCities : ["Warszawa"];
  const districts =
    catalog.strictCityDistricts?.[value.city] ||
    catalog.strictCityDistricts?.[canonicalizeCity(value.city) || ""] ||
    [];

  const patch = (partial: Partial<WebRadarFilters>) => {
    onChange({ ...value, ...partial, pushNotifications: false });
  };

  const currentLocks = locks || DEFAULT_INTELLIGENCE_LOCKS;
  const toggleLock = (key: IntelligenceLockKey) => {
    if (!onLocksChange) return;
    onLocksChange({ ...currentLocks, [key]: !currentLocks[key] });
  };

  const toggleDistrict = (d: string) => {
    patch({
      selectedDistricts: value.selectedDistricts.includes(d)
        ? value.selectedDistricts.filter((x) => x !== d)
        : [...value.selectedDistricts, d],
    });
  };

  const handleAreaApplied = (sel: RadarMapAreaSelection) => {
    patch({
      calibrationMode: "MAP",
      lat: sel.lat,
      lng: sel.lng,
      radiusKm: sel.radiusKm,
      city: sel.city || value.city,
      selectedDistricts: sel.district ? [sel.district] : [],
    });
    setMapAreaLabel(sel.addressLabel || `${sel.city} · promień ${sel.radiusKm} km`);
    setAreaPickerOpen(false);
  };

  return (
    <div
      className={`space-y-5 ${compact ? "" : "rounded-2xl border border-[var(--eos-border)] p-4 sm:p-5"}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <SlidersHorizontal className="size-4 text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--eos-text)]">Parametry dopasowań</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
            Kryteria wyszukiwania ofert w CRM. Dopasowania wysyłasz e-mailem — to nie jest osobisty radar
            ani powiadomienia push.
            {onLocksChange
              ? " Kłódka przy polu: asystent nie zmieni go na podstawie reakcji klienta."
              : ""}
          </p>
        </div>
      </div>

      <div className="eos-modal-panel p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-extrabold break-words" style={{ color: intelligence.color }}>
              {intelligence.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{intelligence.desc}</p>
          </div>
          <span
            className="shrink-0 text-2xl font-black tabular-nums sm:text-3xl"
            style={{ color: intelligence.color }}
          >
            {value.matchThreshold}%
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={value.matchThreshold}
          onChange={(e) => patch({ matchThreshold: Number(e.target.value) })}
          className="w-full accent-emerald-500"
        />
        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
          <span>50%</span>
          <span>Próg dopasowania</span>
          <span>100%</span>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/90">
          Lokalizacja · wybierz sposób
        </p>
        <div className="eos-segment-track">
          {(["CITY", "MAP"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => patch({ calibrationMode: mode })}
              className={segmentBtn(value.calibrationMode === mode)}
            >
              {mode === "CITY" ? "Miasto i dzielnice" : "Obszar na mapie"}
            </button>
          ))}
        </div>
      </div>

      {value.calibrationMode === "MAP" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setAreaPickerOpen(true)}
            className="flex w-full items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15 sm:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <MapPin className="text-emerald-600 dark:text-emerald-400" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--eos-text)]">Ustaw obszar na mapie</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)] break-words">
                Przesuń mapę i ustaw promień wyszukiwania.
              </p>
              {mapAreaLabel ? (
                <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400/90 break-words">
                  {mapAreaLabel}
                </p>
              ) : null}
            </div>
          </button>
          {value.lat == null || value.lng == null || !value.radiusKm ? (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400/90">
              Ustaw obszar na mapie, aby zapisać kryteria w trybie mapy.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div>
            <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
              Metropolia
            </label>
            <div className="flex flex-wrap gap-2">
              {cityOptions.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => patch({ city, selectedDistricts: [] })}
                  className={choiceChip(value.city === city)}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                Dzielnice · {value.city}
              </label>
              {onLocksChange ? (
                <LockToggle
                  locked={currentLocks.districts}
                  label="dzielnice"
                  onToggle={() => toggleLock("districts")}
                />
              ) : null}
            </div>
            <div className="eos-modal-panel grid max-h-52 grid-cols-1 gap-2 overflow-y-auto overscroll-y-contain p-2 sm:grid-cols-2">
              {districts.map((d) => {
                const selected = value.selectedDistricts.includes(d);
                return (
                  <div
                    key={d}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleDistrict(d)}
                    onKeyDown={(e) => e.key === "Enter" && toggleDistrict(d)}
                    className={`eos-modal-chip ${selected ? "eos-modal-chip--selected" : ""}`}
                  >
                    <div className={`eos-modal-chip-check ${selected ? "eos-modal-chip-check--on" : ""}`}>
                      {selected ? <Check size={12} className="text-black" strokeWidth={3} /> : null}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--eos-text)] break-words">
                      {d}
                    </span>
                  </div>
                );
              })}
            </div>
            {districts.length > 0 && value.selectedDistricts.length === 0 ? (
              <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-400/90">
                Wybierz co najmniej jedną dzielnicę.
              </p>
            ) : null}
          </div>
        </>
      )}

      <div>
        <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
          Przeznaczenie i typ
        </label>
        <div className="eos-segment-track mb-4">
          {(["SELL", "RENT"] as const).map((tx) => (
            <button
              key={tx}
              type="button"
              onClick={() => patch({ transactionType: tx })}
              className={[
                "flex-1 rounded-full py-2.5 text-[10px] font-black uppercase tracking-widest",
                value.transactionType === tx
                  ? tx === "SELL"
                    ? "bg-emerald-500 text-black"
                    : "bg-sky-500 text-black"
                  : "eos-segment-inactive text-[var(--eos-muted)]",
              ].join(" ")}
            >
              {tx === "SELL" ? "Kupno" : "Wynajem"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.id}
              type="button"
              onClick={() => patch({ propertyType: pt.id })}
              className={amenityChip(value.propertyType === pt.id)}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <CrmRadarScrubber
          label="Min. metraż"
          min={RADAR_MIN_AREA}
          max={RADAR_MAX_AREA}
          step={1}
          value={value.minArea > 0 ? value.minArea : RADAR_MIN_AREA}
          displayValue={formatRadarAreaLabel(value.minArea)}
          trailing={
            onLocksChange ? (
              <LockToggle locked={currentLocks.minArea} label="metraż" onToggle={() => toggleLock("minArea")} />
            ) : null
          }
          onChange={(v) => patch({ minArea: v <= RADAR_MIN_AREA ? 0 : v })}
        />
        <CrmRadarScrubber
          label="Rok budowy (od)"
          min={RADAR_MIN_YEAR}
          max={RADAR_MAX_YEAR}
          step={1}
          value={value.minYear > RADAR_MIN_YEAR ? value.minYear : RADAR_MIN_YEAR}
          displayValue={formatRadarYearLabel(value.minYear)}
          trailing={
            onLocksChange ? (
              <LockToggle locked={currentLocks.minYear} label="rok budowy" onToggle={() => toggleLock("minYear")} />
            ) : null
          }
          onChange={(v) => patch({ minYear: v <= RADAR_MIN_YEAR ? RADAR_MIN_YEAR : v })}
        />
        <CrmRadarScrubber
          label="Maks. budżet (PLN)"
          min={RADAR_MIN_BUDGET}
          max={RADAR_MAX_BUDGET}
          step={50_000}
          value={value.maxPrice > 0 ? Math.min(value.maxPrice, RADAR_MAX_BUDGET) : RADAR_MAX_BUDGET}
          displayValue={formatRadarBudgetLabel(value.maxPrice)}
          trailing={
            onLocksChange ? (
              <LockToggle locked={currentLocks.maxPrice} label="budżet" onToggle={() => toggleLock("maxPrice")} />
            ) : null
          }
          onChange={(v) => patch({ maxPrice: v >= RADAR_MAX_BUDGET ? 0 : v })}
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
          Obowiązkowe 100% — bez tego oferta nie wejdzie
        </label>
        <p className="mb-3 text-xs leading-relaxed text-[var(--eos-muted)]">
          Zaznacz tylko to, bez czego klient absolutnie nie kupi. Balkon na 100% odcina mieszkania bez balkonu, parking odcina oferty bez miejsca — i tak dalej.
        </p>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const lockKey = a.key as IntelligenceLockKey | "requireTwoLevel";
            const canLock = onLocksChange && lockKey !== "requireTwoLevel";
            return (
              <span key={a.key} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => patch({ [a.key]: !value[a.key] })}
                  className={amenityChip(value[a.key])}
                >
                  {a.label}
                </button>
                {canLock ? (
                  <LockToggle
                    locked={currentLocks[lockKey]}
                    label={a.label}
                    onToggle={() => toggleLock(lockKey)}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <CrmRadarAreaPicker
        open={areaPickerOpen}
        initialLat={value.lat}
        initialLng={value.lng}
        initialRadiusKm={value.radiusKm}
        onCancel={() => setAreaPickerOpen(false)}
        onApply={handleAreaApplied}
      />
    </div>
  );
}

export function buyerCriteriaReady(filters: WebRadarFilters, districtCount: number): boolean {
  if (filters.calibrationMode === "CITY" && districtCount > 0 && filters.selectedDistricts.length === 0) {
    return false;
  }
  if (
    filters.calibrationMode === "MAP" &&
    (filters.lat == null || filters.lng == null || !filters.radiusKm)
  ) {
    return false;
  }
  return true;
}
