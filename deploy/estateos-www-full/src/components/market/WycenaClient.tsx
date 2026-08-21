"use client";

import { useEffect, useMemo, useState } from "react";
import AddressSuggestInput from "@/components/crm/AddressSuggestInput";
import MarketValuationPanel from "@/components/market/MarketValuationPanel";
import MarketProTeaser from "@/components/market/MarketProTeaser";
import {
  closestWarsawDistrict,
  WARSAW_DISTRICT_CENTROIDS,
} from "@/lib/market/warsawDistricts";

const DISTRICTS = Object.keys(WARSAW_DISTRICT_CENTROIDS);

export default function WycenaClient() {
  const [district, setDistrict] = useState("Mokotów");
  const [area, setArea] = useState("62");
  const [rooms, setRooms] = useState("3");
  const [floor, setFloor] = useState("3");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [hasMarketPro, setHasMarketPro] = useState(false);
  const [teaserHref, setTeaserHref] = useState("/cennik");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/check", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const user = data?.user;
        const pro = Boolean(user?.hasMarketPro || user?.officePro || user?.role === "ADMIN" || user?.isPro);
        setHasMarketPro(pro);
        const agency =
          String(user?.role || "").toUpperCase() === "AGENT" ||
          String(user?.planType || "").toUpperCase() === "AGENCY";
        setTeaserHref(agency && !pro ? "/moje-konto/firma?upgrade=pro#pakiet" : "/cennik");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = WARSAW_DISTRICT_CENTROIDS[district] || WARSAW_DISTRICT_CENTROIDS.Mokotów;
  const coords = pin || fallback;
  const pinHint = useMemo(() => {
    if (!pin) return "Pin z centrum wybranej dzielnicy — wpisz adres, żeby wycenić konkretny budynek.";
    return `Pin z geokodowania · ${closestWarsawDistrict(pin.lat, pin.lng)}`;
  }, [pin]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="eos-portal-label eos-portal-label--ok">EstateOS™ Market</p>
        <h1 className="text-3xl font-black tracking-tight text-[var(--eos-text)]">Wycena nieruchomości</h1>
        <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
          Porównanie z aktami RCN i raport e-mail są w Investor Pro albo Partner Pro biura.
          To nie jest operat szacunkowy rzeczoznawcy.
        </p>
      </header>

      <div className="eos-lux-panel rounded-[1.75rem] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="eos-portal-label">Dzielnica Warszawy</span>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setPin(null);
              }}
              className="eos-field-inset eos-field-inset--pill mt-1 w-full py-3 text-sm text-[var(--eos-text)] outline-none"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <AddressSuggestInput
              label="Adres / ulica"
              value={address}
              placeholder="ul. Puławska 12, Warszawa"
              onChange={(value, meta) => {
                setAddress(value);
                if (meta?.lat != null && meta?.lng != null && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)) {
                  setPin({ lat: meta.lat, lng: meta.lng });
                  setDistrict(closestWarsawDistrict(meta.lat, meta.lng));
                }
              }}
            />
            <p className="mt-1 text-[11px] text-[var(--eos-muted)]">{pinHint}</p>
          </div>
          <Field label="E-mail do raportu" value={email} onChange={setEmail} placeholder="jan@..." />
          <Field label="Powierzchnia m²" value={area} onChange={setArea} />
          <Field label="Pokoje" value={rooms} onChange={setRooms} />
          <Field label="Piętro" value={floor} onChange={setFloor} />
          <Field label="Twoja cena ofertowa (opcjonalnie)" value={price} onChange={setPrice} />
        </div>
      </div>

      {hasMarketPro ? (
        <MarketValuationPanel
          lat={coords.lat}
          lng={coords.lng}
          area={Number(area) || null}
          rooms={Number(rooms) || null}
          floor={Number(floor) || null}
          city="Warszawa"
          district={district}
          address={address}
          listingPrice={Number(price.replace(/\s/g, "")) || null}
          purpose="consumer"
          reportEmail={email}
          showReport
        />
      ) : (
        <MarketProTeaser href={teaserHref} />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="eos-portal-label">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="eos-field-inset eos-field-inset--pill mt-1 w-full py-3 text-sm text-[var(--eos-text)] outline-none"
      />
    </label>
  );
}
