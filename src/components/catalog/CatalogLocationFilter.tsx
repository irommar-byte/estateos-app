"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Globe2, MapPin, X } from "lucide-react";
import { canonicalizeCity, canonicalizeDistrict, normalizeText } from "@/lib/location/locationCatalog";
import { countryDisplayName, flagEmojiFromCountryCode } from "@/lib/visitGeo";

export type CatalogLocationFilterValue = {
  countryCode: string | null;
  city: string | null;
  district: string | null;
};

type CatalogLocationOffer = {
  city?: string | null;
  district?: string | null;
  localityCountry?: string | null;
  localityCountryCode?: string | null;
};

type DistrictCatalog = Record<string, string[]>;

export type CatalogLocationFilterLabels = {
  title: string;
  country: string;
  city: string;
  district: string;
  allCountries: string;
  allCities: string;
  allDistricts: string;
  clear: string;
  offersCount: string;
};

type Props = {
  offers: CatalogLocationOffer[];
  value: CatalogLocationFilterValue;
  onChange: (next: CatalogLocationFilterValue) => void;
  labels: CatalogLocationFilterLabels;
  strictCityDistricts?: DistrictCatalog;
  accent?: "sale" | "rent";
};

function resolveOfferCountryCode(offer: CatalogLocationOffer): string {
  const code = String(offer.localityCountryCode || "PL").trim().toUpperCase();
  return code.length === 2 ? code : "PL";
}

function resolveOfferCountryName(offer: CatalogLocationOffer, code: string): string {
  const name = String(offer.localityCountry || "").trim();
  return name || countryDisplayName(code);
}

function matchesLocationSlice(
  offer: CatalogLocationOffer,
  slice: { countryCode?: string | null; city?: string | null; district?: string | null },
): boolean {
  if (slice.countryCode) {
    if (resolveOfferCountryCode(offer) !== slice.countryCode) return false;
  }
  if (slice.city) {
    const city = canonicalizeCity(offer.city);
    if (normalizeText(city) !== normalizeText(slice.city)) return false;
  }
  if (slice.district) {
    const city = slice.city || canonicalizeCity(offer.city);
    const district = canonicalizeDistrict(city, offer.district);
    if (normalizeText(district) !== normalizeText(slice.district)) return false;
  }
  return true;
}

function formatCountLabel(template: string, count: number): string {
  return template.replace("{n}", String(count));
}

export default function CatalogLocationFilter({
  offers,
  value,
  onChange,
  labels,
  strictCityDistricts = {},
  accent = "sale",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const accentIcon = accent === "rent" ? "text-sky-500" : "text-emerald-500";
  const accentActive = "eos-raised-chip eos-raised-chip--on";
  const accentIdle = "eos-raised-chip";
  const accentGlow =
    accent === "rent"
      ? "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_50%)]"
      : "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_50%)]";

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    for (const offer of offers) {
      const code = resolveOfferCountryCode(offer);
      map.set(code, resolveOfferCountryName(offer, code));
    }
    if (!map.size) {
      map.set("PL", countryDisplayName("PL"));
    }
    return [...map.entries()].sort(([aCode, aName], [bCode, bName]) => {
      if (aCode === "PL") return -1;
      if (bCode === "PL") return 1;
      return aName.localeCompare(bName, "pl");
    });
  }, [offers]);

  const countryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const offer of offers) {
      const code = resolveOfferCountryCode(offer);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [offers]);

  const cities = useMemo(() => {
    const map = new Map<string, number>();

    for (const offer of offers) {
      const code = resolveOfferCountryCode(offer);
      if (value.countryCode && code !== value.countryCode) continue;
      const city = canonicalizeCity(offer.city);
      if (!city) continue;
      map.set(city, (map.get(city) ?? 0) + 1);
    }

    return [...map.entries()]
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b, "pl"));
  }, [offers, value.countryCode]);

  const districts = useMemo(() => {
    if (!value.city) return [] as Array<[string, number]>;

    const map = new Map<string, number>();

    for (const offer of offers) {
      const code = resolveOfferCountryCode(offer);
      if (value.countryCode && code !== value.countryCode) continue;
      const city = canonicalizeCity(offer.city);
      if (normalizeText(city) !== normalizeText(value.city)) continue;
      const district = canonicalizeDistrict(value.city, offer.district);
      if (district) map.set(district, (map.get(district) ?? 0) + 1);
    }

    return [...map.entries()]
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b, "pl"));
  }, [offers, strictCityDistricts, value.city, value.countryCode]);

  const activeMatchCount = useMemo(
    () => offers.filter((offer) => matchesLocationSlice(offer, value)).length,
    [offers, value],
  );

  const hasActiveFilter = Boolean(value.countryCode || value.city || value.district);
  const activeSummary = useMemo(() => {
    const parts: string[] = [];
    if (value.countryCode) {
      const country = countries.find(([code]) => code === value.countryCode);
      const count = countryCounts.get(value.countryCode) ?? 0;
      parts.push(
        country
          ? `${flagEmojiFromCountryCode(value.countryCode)} ${country[1]} (${count})`
          : value.countryCode,
      );
    }
    if (value.city) {
      const city = value.city;
      const cityCount = cities.find(([c]) => normalizeText(c) === normalizeText(city))?.[1] ?? 0;
      parts.push(`${city} (${cityCount})`);
    }
    if (value.district) {
      const district = value.district;
      const districtCount =
        districts.find(([d]) => normalizeText(d) === normalizeText(district))?.[1] ?? 0;
      parts.push(`${district} (${districtCount})`);
    }
    return parts.join(" · ");
  }, [cities, countries, countryCounts, districts, value.city, value.countryCode, value.district]);

  useEffect(() => {
    const selectedCity = value.city;
    if (selectedCity && !cities.some(([city]) => normalizeText(city) === normalizeText(selectedCity))) {
      onChange({ ...value, city: null, district: null });
    }
  }, [cities, onChange, value]);

  useEffect(() => {
    const selectedDistrict = value.district;
    if (selectedDistrict && !districts.some(([d]) => normalizeText(d) === normalizeText(selectedDistrict))) {
      onChange({ ...value, district: null });
    }
  }, [districts, onChange, value]);

  const clearFilters = () => onChange({ countryCode: null, city: null, district: null });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      className="mt-5 md:mt-6"
    >
      <div className="eos-glass relative overflow-hidden rounded-[2rem] border border-[var(--eos-border)]/80">
        <div className={`pointer-events-none absolute inset-0 ${accentGlow}`} />

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="relative flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5 md:py-4"
          aria-expanded={expanded}
        >
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
              accent === "rent" ? "bg-sky-500/12" : "bg-emerald-500/12"
            } ${accentIcon}`}
          >
            <Globe2 className="size-5" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block eos-portal-label">
              {labels.title}
            </span>
            <span className="mt-0.5 block truncate text-sm font-medium text-[var(--eos-text)]">
              {hasActiveFilter ? activeSummary : labels.allCountries}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-[var(--eos-muted)]">
              {formatCountLabel(labels.offersCount, activeMatchCount)}
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-[var(--eos-muted)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded ? (
          <div className="relative border-t border-[var(--eos-border)]/70 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                {labels.country}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => onChange({ countryCode: null, city: null, district: null })}
                  className={`shrink-0 px-3.5 py-2 text-[11px] font-bold transition-all ${
                    !value.countryCode ? accentActive : accentIdle
                  }`}
                >
                  {labels.allCountries} ({offers.length})
                </button>
                {countries.map(([code, name]) => {
                  const active = value.countryCode === code;
                  const count = countryCounts.get(code) ?? 0;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        onChange({
                          countryCode: code,
                          city: null,
                          district: null,
                        })
                      }
                      className={`inline-flex shrink-0 items-center gap-2 px-3.5 py-2 text-[11px] font-bold transition-all ${
                        active ? accentActive : accentIdle
                      }`}
                    >
                      <span className="text-base leading-none">{flagEmojiFromCountryCode(code)}</span>
                      <span>
                        {name} <span className="tabular-nums opacity-80">({count})</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="eos-field-inset flex min-h-[3.25rem] items-center rounded-2xl px-4">
                <MapPin className={`size-4 shrink-0 ${accentIcon}`} aria-hidden />
                <select
                  value={value.city || ""}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      city: event.target.value || null,
                      district: null,
                    })
                  }
                  className="ml-3 w-full appearance-none bg-transparent text-sm font-medium text-[var(--eos-text)] outline-none"
                >
                  <option className="bg-[var(--eos-bg-elevated)]" value="">
                    {labels.allCities} ({cities.reduce((sum, [, c]) => sum + c, 0)})
                  </option>
                  {cities.map(([city, count]) => (
                    <option key={city} className="bg-[var(--eos-bg-elevated)]" value={city}>
                      {city} ({count})
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={`eos-field-inset flex min-h-[3.25rem] items-center rounded-2xl px-4 ${
                  !value.city || !districts.length ? "opacity-45" : ""
                }`}
              >
                <MapPin className="size-4 shrink-0 text-[var(--eos-muted)]" aria-hidden />
                <select
                  value={value.district || ""}
                  disabled={!value.city || !districts.length}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      district: event.target.value || null,
                    })
                  }
                  className="ml-3 w-full appearance-none bg-transparent text-sm font-medium text-[var(--eos-text)] outline-none disabled:cursor-not-allowed"
                >
                  <option className="bg-[var(--eos-bg-elevated)]" value="">
                    {labels.allDistricts} (
                    {(() => {
                      const selectedCity = value.city;
                      if (!selectedCity) return 0;
                      return cities.find(([c]) => normalizeText(c) === normalizeText(selectedCity))?.[1] ?? 0;
                    })()}
                    )
                  </option>
                  {districts.map(([district, count]) => (
                    <option key={district} className="bg-[var(--eos-bg-elevated)]" value={district}>
                      {district} ({count})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {hasActiveFilter ? (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--eos-muted)] transition ${
                  accent === "rent" ? "hover:text-sky-600 dark:hover:text-sky-400" : "hover:text-emerald-600 dark:hover:text-emerald-400"
                }`}
              >
                <X className="size-3.5" />
                {labels.clear}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export function offerMatchesCatalogLocationFilter(
  offer: CatalogLocationOffer,
  filter: CatalogLocationFilterValue,
): boolean {
  return matchesLocationSlice(offer, filter);
}
