"use client";

import { useMemo, useState } from "react";
import LuxSheet from "./LuxSheet";
import { formatPln } from "./portalApi";

/** Taksa notarialna (max stawki) dla umowy sprzedaży — wartość netto. */
function notaryFee(value: number): number {
  if (value <= 3000) return 100;
  if (value <= 10000) return 100 + 0.03 * (value - 3000);
  if (value <= 30000) return 310 + 0.02 * (value - 10000);
  if (value <= 60000) return 710 + 0.01 * (value - 30000);
  if (value <= 1000000) return 1010 + 0.004 * (value - 60000);
  if (value <= 2000000) return 4770 + 0.002 * (value - 1000000);
  return Math.min(10000, 6770 + 0.0025 * (value - 2000000));
}

function Field({ id, label, value, onChange, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[12px] font-bold text-[#45423C]">{label}</span>
      <span className="mt-1 flex h-12 items-center rounded-2xl border border-[#E6E0D6] bg-white px-3">
        <input
          id={id}
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/\s/g, "").replace(",", ".")) || 0)}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none"
        />
        <span className="text-[13px] text-[#5B574F]">{suffix}</span>
      </span>
    </label>
  );
}

/** Rata kredytu i koszty zakupu — wyliczenie orientacyjne. */
export default function PortalCostCalculator({ open, onClose, initialPrice }: { open: boolean; onClose: () => void; initialPrice: number }) {
  const [price, setPrice] = useState(initialPrice || 800000);
  const [ownPct, setOwnPct] = useState(20);
  const [rate, setRate] = useState(7.2);
  const [years, setYears] = useState(25);
  const [commission, setCommission] = useState(2);
  const [primary, setPrimary] = useState(false);

  const calc = useMemo(() => {
    const loan = Math.max(0, price * (1 - ownPct / 100));
    const r = rate / 100 / 12;
    const n = Math.max(1, years * 12);
    const monthly = r > 0 ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
    const pcc = primary ? 0 : price * 0.02;
    const notary = notaryFee(price) * 1.23 + (loan > 0 ? notaryFee(loan) * 0.5 * 1.23 : 0);
    const court = 200 + (loan > 0 ? 200 : 0);
    const agency = price * (commission / 100) * 1.23;
    const extras = pcc + notary + court + agency + 300;
    return { loan, monthly, pcc, notary, court, agency, extras, cash: price * (ownPct / 100) + extras };
  }, [price, ownPct, rate, years, commission, primary]);

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Narzędzie" title="Rata i koszty zakupu">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field id="calc-price" label="Cena nieruchomości" value={price} onChange={setPrice} suffix="zł" />
        </div>
        <Field id="calc-own" label="Wkład własny" value={ownPct} onChange={setOwnPct} suffix="%" />
        <Field id="calc-rate" label="Oprocentowanie" value={rate} onChange={setRate} suffix="%" />
        <Field id="calc-years" label="Okres kredytu" value={years} onChange={setYears} suffix="lat" />
        <Field id="calc-comm" label="Prowizja biura" value={commission} onChange={setCommission} suffix="%" />
      </div>
      <label className="mt-3 flex items-center justify-between rounded-2xl border border-[#E6E0D6] bg-white px-4 py-3 text-[14px]">
        Rynek pierwotny (bez podatku PCC)
        <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="size-5 accent-[#0E4D3F]" />
      </label>

      <div className="mt-4 rounded-[22px] bg-black p-5 text-[#F6F3EE]">
        <p className="text-[13px] font-bold text-[#D8C3A0]">Rata miesięczna</p>
        <p className="lux-serif mt-1 text-[34px]">{formatPln(calc.monthly)}</p>
        <p className="text-[12px] text-[#BDB6AA]">Kredyt: {formatPln(calc.loan)} · {years} lat · {rate}%</p>
        <div className="my-4 h-px bg-[#D8C3A0]/30" />
        {[
          ["Podatek PCC (2%)", calc.pcc],
          ["Notariusz (z VAT, z hipoteką)", calc.notary],
          ["Wpisy do księgi wieczystej", calc.court],
          [`Wynagrodzenie biura (${commission}% + VAT)`, calc.agency],
          ["Wypisy i opłaty drobne", 300],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between py-1 text-[14px]">
            <span className="text-[#BDB6AA]">{label}</span>
            <span className="font-semibold">{formatPln(Number(value))}</span>
          </div>
        ))}
        <div className="my-3 h-px bg-[#D8C3A0]/30" />
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold text-[#D8C3A0]">Potrzebna gotówka</span>
          <span className="lux-serif text-[24px]">{formatPln(calc.cash)}</span>
        </div>
        <p className="mt-1 text-[12px] text-[#BDB6AA]">Wkład własny + koszty transakcji.</p>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[#5B574F]">
        Wyliczenie orientacyjne (maksymalna taksa notarialna, rata równa). Dokładne koszty potwierdzi notariusz i bank.
      </p>
    </LuxSheet>
  );
}
