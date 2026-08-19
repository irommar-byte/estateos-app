"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import {
  buildForwardGeocodeSearchText,
  mapboxForwardGeocodeUrl,
  parseAddressSearchQuery,
} from "@/lib/mapboxGeocodeClient";

type Suggestion = {
  id: string;
  label: string;
  address: string;
  city?: string;
  lat?: number;
  lng?: number;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3.5 py-3 text-sm text-[var(--eos-text)] outline-none transition focus:border-emerald-500/50";

export default function AddressSuggestInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string, meta?: { city?: string; lat?: number; lng?: number }) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const seq = useRef(0);
  const wrapRef = useRef<HTMLLabelElement>(null);
  const acceptedRef = useRef<string | null>(null);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const query = value.trim();
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (acceptedRef.current && query === acceptedRef.current) {
      setItems([]);
      setOpen(false);
      return;
    }
    if (disabled || query.length < 3 || !token) {
      setItems([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const requestId = ++seq.current;
      setLoading(true);
      try {
        const parsed = parseAddressSearchQuery(query);
        const searchText =
          parsed.fullQuery || buildForwardGeocodeSearchText(parsed.streetPart || query, parsed.cityPart, parsed.countryIso || undefined);
        const response = await fetch(mapboxForwardGeocodeUrl(searchText, token, { limit: 6, autocomplete: true }));
        const geo = await response.json();
        if (requestId !== seq.current) return;
        const features = Array.isArray(geo?.features) ? geo.features : [];
        setItems(
          features.map((feature: any, index: number) => {
            const label = String(feature?.place_name_pl || feature?.place_name || "").trim();
            const context = Array.isArray(feature?.context) ? feature.context : [];
            const place = context.find((item: { id?: string }) => String(item?.id || "").startsWith("place"));
            const coords = Array.isArray(feature?.center) ? feature.center : [];
            return {
              id: String(feature?.id || index),
              label,
              address: label,
              city: String(place?.text_pl || place?.text || "").trim() || undefined,
              lng: Number(coords[0]),
              lat: Number(coords[1]),
            };
          }).filter((item: Suggestion) => item.label),
        );
        setOpen(true);
      } catch {
        if (requestId === seq.current) setItems([]);
      } finally {
        if (requestId === seq.current) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [value, disabled]);

  return (
    <label className="relative block min-w-0" ref={wrapRef}>
      <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--eos-muted)]">{label}</span>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            acceptedRef.current = null;
            onChange(event.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          className={`${fieldClass} pl-10`}
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-500" /> : null}
      </div>
      {open && items.length > 0 ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full px-3.5 py-2.5 text-left text-sm text-[var(--eos-text)] hover:bg-emerald-500/10"
              onClick={() => {
                const next = item.address;
                acceptedRef.current = next;
                seq.current += 1;
                setItems([]);
                setOpen(false);
                onChange(next, {
                  city: item.city,
                  lat: Number.isFinite(item.lat) ? item.lat : undefined,
                  lng: Number.isFinite(item.lng) ? item.lng : undefined,
                });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
