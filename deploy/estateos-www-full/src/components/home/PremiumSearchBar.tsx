"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Crosshair, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

export type HomeMapSearchDetail = {
  query?: string;
  city?: string;
  transactionMode?: "all" | "sale" | "rent";
  propertyType?: "ALL" | "FLAT" | "HOUSE" | "PLOT" | "COMMERCIAL";
};

export default function PremiumSearchBar() {
  const { dict } = useLocale();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [transactionMode, setTransactionMode] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState<HomeMapSearchDetail["propertyType"]>("ALL");
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/location/districts", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json?.strictCities)) {
          setAvailableCities(json.strictCities);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableCities([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dispatchSearch = () => {
    const detail: HomeMapSearchDetail = {
      query: query.trim(),
      city: city || query.trim(),
      transactionMode,
      propertyType,
    };

    window.dispatchEvent(new CustomEvent<HomeMapSearchDetail>("estateos:map-search", { detail }));
    document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl px-4"
    >
      <div className="eos-glass relative overflow-hidden rounded-[2.5rem] p-2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_45%)]" />

        <div className="relative grid gap-2 lg:grid-cols-[1.35fr_0.9fr_0.9fr_auto]">
          <label className="flex min-h-14 items-center rounded-3xl bg-[var(--eos-input)] px-4 sm:px-6">
            <Search className="size-5 text-emerald-400/80" aria-hidden />
            <input
              list="home-cities-list"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") dispatchSearch();
              }}
              placeholder={dict.homePremium.searchPlaceholder}
              className="ml-4 w-full bg-transparent text-sm font-medium text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)]"
            />
            <datalist id="home-cities-list">
              {availableCities.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          <label className="flex min-h-14 items-center rounded-3xl bg-[var(--eos-input)] px-4 sm:px-6">
            <MapPin className="size-5 text-emerald-400" aria-hidden />
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="ml-3 w-full appearance-none bg-transparent text-sm font-light text-[var(--eos-text)] outline-none"
            >
              <option className="bg-[var(--eos-bg-elevated)]" value="">
                {dict.map.allMarkets}
              </option>
              {availableCities.map((option) => (
                <option key={option} className="bg-[var(--eos-bg-elevated)]" value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-h-14 items-center rounded-3xl bg-[var(--eos-input)] px-4 sm:px-6">
            <Building2 className="size-5 text-[var(--eos-muted)]" aria-hidden />
            <select
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value as HomeMapSearchDetail["propertyType"])}
              className="ml-3 w-full appearance-none bg-transparent text-sm font-light text-[var(--eos-text)] outline-none"
            >
              <option className="bg-[var(--eos-bg-elevated)]" value="ALL">{dict.homePremium.searchTypeAll}</option>
              <option className="bg-[var(--eos-bg-elevated)]" value="FLAT">{dict.homePremium.searchTypeFlat}</option>
              <option className="bg-[var(--eos-bg-elevated)]" value="HOUSE">{dict.homePremium.searchTypeHouse}</option>
              <option className="bg-[var(--eos-bg-elevated)]" value="COMMERCIAL">{dict.homePremium.searchTypeCommercial}</option>
              <option className="bg-[var(--eos-bg-elevated)]" value="PLOT">{dict.homePremium.searchTypePlot}</option>
            </select>
          </label>

          <div className="flex items-center gap-2">
            <div className="flex min-h-14 flex-1 rounded-full bg-[var(--eos-input)] p-1 lg:w-36 lg:flex-none">
              {(["sale", "rent"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTransactionMode(mode)}
                  className={`flex-1 rounded-full px-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                    transactionMode === mode ? "eos-segment-active" : "eos-segment-inactive"
                  }`}
                >
                  {mode === "sale" ? dict.homePremium.searchSale : dict.homePremium.searchRent}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="hidden size-14 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)] sm:flex"
              aria-label={dict.homePremium.advancedFilters}
            >
              <SlidersHorizontal className="size-5" />
            </button>
            <button
              type="button"
              onClick={dispatchSearch}
              className="min-h-14 flex-1 rounded-full bg-emerald-400 px-7 text-sm font-black text-black shadow-[0_14px_34px_rgba(16,185,129,0.28)] transition-all hover:scale-[1.02] hover:bg-emerald-300 active:scale-[0.98] lg:flex-none"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Crosshair className="size-4" />
                {dict.homePremium.searchButton}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
