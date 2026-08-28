"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  X,
  Check,
  MapPin,
  Bell,
  BellOff,
} from "lucide-react";
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
import LuxurySegmentSwitch from "@/components/ui/LuxurySegmentSwitch";

type Catalog = {
  strictCities: string[];
  strictCityDistricts: Record<string, string[]>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialFilters: WebRadarFilters;
  catalog: Catalog;
  saving: boolean;
  onSave: (filters: WebRadarFilters) => Promise<void>;
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

export default function CrmRadarCalibrationModal({
  open,
  onClose,
  initialFilters,
  catalog,
  saving,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<WebRadarFilters>(initialFilters);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [mapAreaLabel, setMapAreaLabel] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDraft(initialFilters);
      if (
        initialFilters.calibrationMode === "MAP" &&
        initialFilters.lat != null &&
        initialFilters.lng != null
      ) {
        setMapAreaLabel(
          `${initialFilters.city || "Obszar"} · ${initialFilters.radiusKm ?? "?"} km`,
        );
      } else {
        setMapAreaLabel("");
      }
    }
  }, [open, initialFilters]);

  const intelligence = useMemo(
    () => radarIntelligenceLabel(draft.matchThreshold),
    [draft.matchThreshold],
  );

  const cityOptions = catalog.strictCities.length ? catalog.strictCities : ["Warszawa"];
  const districts =
    catalog.strictCityDistricts?.[draft.city] || catalog.strictCityDistricts?.[canonicalizeCity(draft.city) || ""] || [];

  const toggleDistrict = (d: string) => {
    setDraft((prev) => ({
      ...prev,
      selectedDistricts: prev.selectedDistricts.includes(d)
        ? prev.selectedDistricts.filter((x) => x !== d)
        : [...prev.selectedDistricts, d],
    }));
  };

  const radarAwake = draft.pushNotifications;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      draft.pushNotifications &&
      draft.calibrationMode === "CITY" &&
      draft.selectedDistricts.length === 0 &&
      districts.length > 0
    ) {
      return;
    }
    if (
      draft.pushNotifications &&
      draft.calibrationMode === "MAP" &&
      (draft.lat == null || draft.lng == null || !draft.radiusKm)
    ) {
      return;
    }
    await onSave(draft);
  };

  const handleAreaApplied = (sel: RadarMapAreaSelection) => {
    setDraft((p) => ({
      ...p,
      calibrationMode: "MAP",
      lat: sel.lat,
      lng: sel.lng,
      radiusKm: sel.radiusKm,
      city: sel.city || p.city,
      selectedDistricts: sel.district ? [sel.district] : [],
    }));
    setMapAreaLabel(
      sel.addressLabel || `${sel.city} · promień ${sel.radiusKm} km`,
    );
    setAreaPickerOpen(false);
  };

  const modalTree = (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="eos-modal-backdrop fixed inset-0 eos-z-modal-nested overflow-y-auto overscroll-y-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crm-radar-calibration-title"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex min-h-full items-start justify-center px-4 py-6 sm:py-10">
          <motion.div
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            className="eos-modal-surface eos-modal-shell eos-themed-modal relative my-auto w-full max-w-2xl max-h-none overflow-visible rounded-[2.5rem] border p-6 sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
            >
              <X size={20} />
            </button>

            <div className="relative z-10 mb-8 flex items-center gap-4 pr-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <Radar className="text-emerald-500" size={22} />
              </div>
              <div>
                <h3 id="crm-radar-calibration-title" className="text-2xl font-black text-[var(--eos-text)]">Kalibracja radaru</h3>
                <p className="mt-1 text-xs uppercase tracking-widest text-[var(--eos-muted)]">
                  Te same ustawienia co w aplikacji mobilnej
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 max-h-[min(72vh,720px)] space-y-6 overflow-y-auto overscroll-y-contain pr-1">
              <div
                className={`rounded-2xl border p-5 transition-colors ${
                  radarAwake ? "border-emerald-500/30 bg-emerald-500/5" : "eos-modal-panel-soft"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[var(--eos-text)]">Aktywny radar</p>
                    <p className="mt-1 text-xs text-[var(--eos-muted)]">
                      Powiadomienia push o dopasowanych ofertach
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({ ...p, pushNotifications: !p.pushNotifications }))
                    }
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                      radarAwake
                        ? "bg-emerald-500 text-black"
                        : "border border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)]"
                    }`}
                  >
                    {radarAwake ? <Bell size={14} /> : <BellOff size={14} />}
                    {radarAwake ? "Włączony" : "Wyłączony"}
                  </button>
                </div>
              </div>

              {radarAwake ? (
                <>
                  <div className="eos-modal-panel p-5">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-extrabold" style={{ color: intelligence.color }}>
                          {intelligence.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{intelligence.desc}</p>
                      </div>
                      <span
                        className="text-3xl font-black tabular-nums"
                        style={{ color: intelligence.color }}
                      >
                        {draft.matchThreshold}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      step={5}
                      value={draft.matchThreshold}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, matchThreshold: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-500"
                    />
                    <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                      <span>50%</span>
                      <span>Skala dopasowania</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/90">
                      Lokalizacja · wybierz sposób
                    </p>
                    <LuxurySegmentSwitch
                      ariaLabel="Sposób lokalizacji"
                      className="w-full"
                      value={draft.calibrationMode}
                      onChange={(mode) => setDraft((p) => ({ ...p, calibrationMode: mode }))}
                      options={[
                        { value: "CITY", label: "Miasto i dzielnice", accent: "home" },
                        { value: "MAP", label: "Obszar na mapie", accent: "car" },
                      ]}
                    />
                  </div>

                  {draft.calibrationMode === "MAP" ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setAreaPickerOpen(true)}
                        className="flex w-full items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                          <MapPin className="text-emerald-600 dark:text-emerald-400" size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[var(--eos-text)]">Wybierz obszar na mapie</p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
                            Przesuń mapę i ustaw promień — tak jak w aplikacji mobilnej.
                          </p>
                          {mapAreaLabel ? (
                            <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400/90">{mapAreaLabel}</p>
                          ) : null}
                        </div>
                      </button>
                      {draft.lat == null || draft.lng == null || !draft.radiusKm ? (
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400/90">
                          Ustaw obszar na mapie, aby zapisać kalibrację w trybie MAP.
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
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  city,
                                  selectedDistricts: [],
                                }))
                              }
                              className={choiceChip(draft.city === city)}
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                          Dzielnice · {draft.city}
                        </label>
                        <div className="eos-modal-panel grid max-h-52 grid-cols-1 gap-2 overflow-y-auto p-2 sm:grid-cols-2">
                          {districts.map((d) => {
                            const selected = draft.selectedDistricts.includes(d);
                            return (
                              <div
                                key={d}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleDistrict(d)}
                                onKeyDown={(e) => e.key === "Enter" && toggleDistrict(d)}
                                className={`eos-modal-chip ${selected ? "eos-modal-chip--selected" : ""}`}
                              >
                                <div
                                  className={`eos-modal-chip-check ${selected ? "eos-modal-chip-check--on" : ""}`}
                                >
                                  {selected ? (
                                    <Check size={12} className="text-black" strokeWidth={3} />
                                  ) : null}
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--eos-text)]">
                                  {d}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {districts.length > 0 && draft.selectedDistricts.length === 0 ? (
                          <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-400/90">
                            Wybierz co najmniej jedną dzielnicę (jak w aplikacji).
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      Przeznaczenie i typ
                    </label>
                    <LuxurySegmentSwitch
                      ariaLabel="Kupno lub wynajem"
                      className="mb-4 w-full"
                      value={draft.transactionType}
                      onChange={(tx) => setDraft((p) => ({ ...p, transactionType: tx }))}
                      options={[
                        { value: "SELL", label: "Kupno", accent: "home" },
                        { value: "RENT", label: "Wynajem", accent: "rent" },
                      ]}
                    />
                    <div className="flex flex-wrap gap-2">
                      {PROPERTY_TYPES.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, propertyType: pt.id }))}
                          className={amenityChip(draft.propertyType === pt.id)}
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
                      value={draft.minArea > 0 ? draft.minArea : RADAR_MIN_AREA}
                      displayValue={formatRadarAreaLabel(draft.minArea)}
                      onChange={(v) => setDraft((p) => ({ ...p, minArea: v <= RADAR_MIN_AREA ? 0 : v }))}
                    />
                    <CrmRadarScrubber
                      label="Rok budowy (od)"
                      min={RADAR_MIN_YEAR}
                      max={RADAR_MAX_YEAR}
                      step={1}
                      value={draft.minYear > RADAR_MIN_YEAR ? draft.minYear : RADAR_MIN_YEAR}
                      displayValue={formatRadarYearLabel(draft.minYear)}
                      onChange={(v) =>
                        setDraft((p) => ({ ...p, minYear: v <= RADAR_MIN_YEAR ? RADAR_MIN_YEAR : v }))
                      }
                    />
                    <CrmRadarScrubber
                      label="Maks. budżet (PLN)"
                      min={RADAR_MIN_BUDGET}
                      max={RADAR_MAX_BUDGET}
                      step={50_000}
                      value={draft.maxPrice > 0 ? Math.min(draft.maxPrice, RADAR_MAX_BUDGET) : RADAR_MAX_BUDGET}
                      displayValue={formatRadarBudgetLabel(draft.maxPrice)}
                      onChange={(v) =>
                        setDraft((p) => ({ ...p, maxPrice: v >= RADAR_MAX_BUDGET ? 0 : v }))
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      Obowiązkowe 100% — bez tego oferta nie wejdzie
                    </label>
                    <p className="mb-3 text-xs leading-relaxed text-[var(--eos-muted)]">
                      Zaznacz tylko to, bez czego nie kupisz. Balkon na 100% odcina mieszkania bez balkonu.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {AMENITIES.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({ ...p, [a.key]: !p[a.key] }))
                          }
                          className={amenityChip(draft[a.key])}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="eos-modal-panel-soft rounded-2xl p-4 text-sm text-[var(--eos-muted)]">
                  Radar jest wyłączony — zapisz, aby zatrzymać powiadomienia (jak wyłącznik w aplikacji).
                </p>
              )}

              <button
                type="submit"
                disabled={
                  saving ||
                  (radarAwake &&
                    draft.calibrationMode === "CITY" &&
                    districts.length > 0 &&
                    draft.selectedDistricts.length === 0) ||
                  (radarAwake &&
                    draft.calibrationMode === "MAP" &&
                    (draft.lat == null || draft.lng == null || !draft.radiusKm))
                }
                className="group relative mt-2 w-full cursor-pointer overflow-hidden rounded-xl border border-emerald-300/50 bg-gradient-to-r from-emerald-500 to-emerald-400 py-5 font-black uppercase tracking-[0.2em] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <Radar size={20} className={saving ? "animate-spin" : ""} />
                  {saving ? "Zapisywanie…" : "Zastosuj kalibrację"}
                </div>
              </button>
            </form>
          </motion.div>
          </div>
        </motion.div>
      ) : null}

      <CrmRadarAreaPicker
        open={areaPickerOpen}
        initialLat={draft.lat}
        initialLng={draft.lng}
        initialRadiusKm={draft.radiusKm}
        onCancel={() => setAreaPickerOpen(false)}
        onApply={handleAreaApplied}
      />
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalTree, document.body);
}
