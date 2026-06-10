"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Radar,
  Check,
  MapPin,
  Bell,
  BellOff,
} from "lucide-react";
import { canonicalizeCity } from "@/lib/location/locationCatalog";
import {
  type WebRadarFilters,
} from "@/lib/radarCalibrationWeb";
import { isWebRadarCalibrationReady } from "@/lib/radarMatchedOffers";
import CrmRadarAreaPicker from "@/components/crm/CrmRadarAreaPicker";
import EosModal from "@/components/ui/EosModal";
import type { RadarMapAreaSelection } from "@/lib/radarMapArea";
import { useLocale } from "@/contexts/LocaleContext";
import { fmtDict } from "@/i18n/crmExtendedDictionary";

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

const PROPERTY_TYPE_IDS = ["FLAT", "HOUSE", "PLOT", "COMMERCIAL"] as const;

const AMENITY_KEYS = [
  "requireBalcony",
  "requireGarden",
  "requireTwoLevel",
  "requireElevator",
  "requireParking",
  "requireFurnished",
] as const;

export default function CrmRadarCalibrationModal({
  open,
  onClose,
  initialFilters,
  catalog,
  saving,
  onSave,
}: Props) {
  const { dict } = useLocale();
  const rc = dict.crm.radar.calibration;
  const [draft, setDraft] = useState<WebRadarFilters>(initialFilters);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [mapAreaLabel, setMapAreaLabel] = useState("");

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

  const intelligence = useMemo(() => {
    const t = Math.max(50, Math.min(100, draft.matchThreshold));
    const intel = rc.intelligence;
    if (t >= 90) return { ...intel.sniper, color: "#a78bfa" };
    if (t >= 75) return { ...intel.selective, color: "#10b981" };
    if (t >= 60) return { ...intel.balanced, color: "#38bdf8" };
    return { ...intel.wide, color: "#f59e0b" };
  }, [draft.matchThreshold, rc.intelligence]);

  const propertyTypeLabel = (id: (typeof PROPERTY_TYPE_IDS)[number]) => {
    const map = {
      FLAT: rc.types.flat,
      HOUSE: rc.types.house,
      PLOT: rc.types.plot,
      COMMERCIAL: rc.types.commercial,
    };
    return map[id];
  };

  const amenityLabel = (key: (typeof AMENITY_KEYS)[number]) => {
    const map = {
      requireBalcony: rc.amenitiesList.balcony,
      requireGarden: rc.amenitiesList.garden,
      requireTwoLevel: rc.amenitiesList.twoLevel,
      requireElevator: rc.amenitiesList.elevator,
      requireParking: rc.amenitiesList.parking,
      requireFurnished: rc.amenitiesList.furnished,
    };
    return map[key];
  };

  const cityOptions = catalog.strictCities.length ? catalog.strictCities : ["Warszawa"];
  const districts =
    catalog.strictCityDistricts?.[draft.city] || catalog.strictCityDistricts?.[canonicalizeCity(draft.city) || ""] || [];

  const calibrationReady = useMemo(
    () => isWebRadarCalibrationReady(draft, districts),
    [draft, districts],
  );

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
    if (!calibrationReady) return;
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
      sel.addressLabel ||
        fmtDict(rc.radiusKmLabel, { km: String(sel.radiusKm) }),
    );
    setAreaPickerOpen(false);
  };

  return (
    <>
      <EosModal
        open={open && !areaPickerOpen}
        onClose={onClose}
        title={rc.title}
        subtitle={rc.subtitle}
        icon={<Radar size={20} />}
        maxWidth="max-w-2xl"
        ariaLabelledBy="crm-radar-calibration-title"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className={`eos-modal-panel p-5 transition-colors ${
              radarAwake ? "border-emerald-500/30 bg-emerald-500/5" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[var(--eos-text)]">{rc.activeTitle}</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">{rc.activeHint}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((p) => ({ ...p, pushNotifications: !p.pushNotifications }))
                }
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  radarAwake
                    ? "bg-emerald-500 text-black"
                    : "border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)]"
                }`}
              >
                {radarAwake ? <Bell size={14} /> : <BellOff size={14} />}
                {radarAwake ? rc.enabled : rc.disabled}
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
                  <span className="text-3xl font-black tabular-nums" style={{ color: intelligence.color }}>
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
                  <span>{rc.matchScale}</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/90">
                  {rc.locationMode}
                </p>
                <div className="flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] p-1">
                  {(["CITY", "MAP"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, calibrationMode: mode }))}
                      className={`flex-1 rounded-full py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                        draft.calibrationMode === mode
                          ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                          : "text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
                      }`}
                    >
                      {mode === "CITY" ? rc.modeCity : rc.modeMap}
                    </button>
                  ))}
                </div>
              </div>

              {draft.calibrationMode === "MAP" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setAreaPickerOpen(true)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                      <MapPin className="text-emerald-500" size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--eos-text)]">{rc.pickMapTitle}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
                        {rc.pickMapHint}
                      </p>
                      {mapAreaLabel ? (
                        <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400/90">{mapAreaLabel}</p>
                      ) : null}
                    </div>
                  </button>
                  {draft.lat == null || draft.lng == null || !draft.radiusKm ? (
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400/90">
                      {rc.mapRequired}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {rc.metropolis}
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
                          className={`rounded-xl border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                            draft.city === city
                              ? "border-emerald-500 bg-emerald-500 text-black"
                              : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:border-emerald-500/30"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {rc.districts} · {draft.city}
                      <span className="ml-2 font-medium normal-case tracking-normal text-[var(--eos-subtle)]">
                        {rc.districtsOptional}
                      </span>
                    </label>
                    <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-2">
                      {districts.map((d) => (
                        <div
                          key={d}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleDistrict(d)}
                          onKeyDown={(e) => e.key === "Enter" && toggleDistrict(d)}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-all ${
                            draft.selectedDistricts.includes(d)
                              ? "border-emerald-500/50 bg-emerald-500/10"
                              : "border-[var(--eos-border)] hover:border-emerald-500/30"
                          }`}
                        >
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              draft.selectedDistricts.includes(d)
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-[var(--eos-border)]"
                            }`}
                          >
                            {draft.selectedDistricts.includes(d) ? (
                              <Check size={12} className="text-black" strokeWidth={3} />
                            ) : null}
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--eos-text)]">
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>
                    {districts.length > 0 && draft.selectedDistricts.length === 0 ? (
                      <p className="mt-2 text-[11px] font-medium text-[var(--eos-muted)]">
                        {fmtDict(rc.wholeCity, { city: draft.city })}
                      </p>
                    ) : null}
                  </div>
                </>
              )}

              <div>
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {rc.purposeType}
                </label>
                <div className="mb-4 flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] p-1">
                  {(["SELL", "RENT"] as const).map((tx) => (
                    <button
                      key={tx}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, transactionType: tx }))}
                      className={`flex-1 rounded-full py-2.5 text-[10px] font-black uppercase tracking-widest ${
                        draft.transactionType === tx
                          ? tx === "SELL"
                            ? "bg-emerald-500 text-black"
                            : "bg-sky-500 text-black"
                          : "text-[var(--eos-subtle)]"
                      }`}
                    >
                      {tx === "SELL" ? rc.buy : rc.rent}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPE_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, propertyType: id }))}
                      className={`rounded-xl border px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${
                        draft.propertyType === id
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "border-[var(--eos-border)] text-[var(--eos-muted)]"
                      }`}
                    >
                      {propertyTypeLabel(id)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {rc.minArea}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 font-black text-[var(--eos-text)] outline-none focus:border-emerald-500"
                    placeholder="np. 40"
                    value={draft.minArea > 0 ? String(draft.minArea) : ""}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        minArea: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {rc.minYear}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 font-black text-[var(--eos-text)] outline-none focus:border-emerald-500"
                    placeholder="np. 2010"
                    value={draft.minYear > 1900 ? String(draft.minYear) : ""}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        minYear: parseInt(e.target.value.replace(/\D/g, ""), 10) || 1900,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {rc.maxBudget}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 font-black text-emerald-600 outline-none focus:border-emerald-500 dark:text-emerald-400"
                    placeholder="2 500 000"
                    value={draft.maxPrice > 0 ? draft.maxPrice.toLocaleString("pl-PL") : ""}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        maxPrice: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {rc.amenities}
                </label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({ ...p, [key]: !p[key] }))
                      }
                      className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        draft[key]
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "border-[var(--eos-border)] text-[var(--eos-subtle)]"
                      }`}
                    >
                      {amenityLabel(key)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="eos-modal-panel p-4 text-sm text-[var(--eos-muted)]">
              {rc.radarOffHint}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !calibrationReady}
            className={`group relative mt-2 w-full cursor-pointer overflow-hidden rounded-xl border py-5 font-black uppercase tracking-[0.2em] transition-all ${
              calibrationReady && !saving
                ? "border-emerald-300/50 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-[0_12px_32px_rgba(16,185,129,0.35)] hover:scale-[1.01]"
                : "border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-subtle)] cursor-not-allowed"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <div className="relative z-10 flex items-center justify-center gap-3">
              <Radar size={20} className={saving ? "animate-spin" : ""} />
              {saving ? rc.saving : rc.save}
            </div>
          </button>
        </form>
      </EosModal>

      <CrmRadarAreaPicker
        open={areaPickerOpen}
        initialLat={draft.lat}
        initialLng={draft.lng}
        initialRadiusKm={draft.radiusKm}
        onCancel={() => setAreaPickerOpen(false)}
        onApply={handleAreaApplied}
      />
    </>
  );
}
