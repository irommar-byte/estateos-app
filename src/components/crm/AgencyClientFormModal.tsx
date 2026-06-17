"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Home, ChevronLeft, Check } from "lucide-react";
import CrmRadarCalibrationModal from "@/components/crm/CrmRadarCalibrationModal";
import { defaultWebRadarFilters, formatRadarSummary } from "@/lib/radarCalibrationWeb";
import { useLocale } from "@/contexts/LocaleContext";

type Props = {
  open: boolean;
  initialType?: "BUYER" | "SELLER";
  onClose: () => void;
  onCreated: () => void;
};

export default function AgencyClientFormModal({
  open,
  initialType = "BUYER",
  onClose,
  onCreated,
}: Props) {
  const { dict } = useLocale();
  const cl = dict.crmClients;
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<"BUYER" | "SELLER">(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [buyerFilters, setBuyerFilters] = useState(defaultWebRadarFilters());
  const [catalog, setCatalog] = useState<{ strictCities: string[]; strictCityDistricts: Record<string, string[]> }>({
    strictCities: ["Warszawa"],
    strictCityDistricts: {},
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
    sellerTransactionType: "SELL",
    sellerPropertyType: "FLAT",
    sellerCity: "Warszawa",
    sellerDistrict: "",
    sellerPrice: "",
    sellerArea: "",
    sellerRooms: "",
    sellerDescription: "",
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType(initialType);
    setError("");
    fetch("/api/location/districts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setCatalog({
          strictCities: Array.isArray(data?.strictCities) ? data.strictCities : ["Warszawa"],
          strictCityDistricts: data?.strictCityDistricts || {},
        });
      })
      .catch(() => {});
  }, [open, initialType]);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          ...(type === "BUYER" ? { buyerFilters } : {}),
          ...(type === "SELLER"
            ? {
                sellerTransactionType: form.sellerTransactionType,
                sellerPropertyType: form.sellerPropertyType,
                sellerCity: form.sellerCity,
                sellerDistrict: form.sellerDistrict,
                sellerPrice: form.sellerPrice,
                sellerArea: form.sellerArea,
                sellerRooms: form.sellerRooms,
                sellerDescription: form.sellerDescription,
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || cl.saveError);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : cl.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99990] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="eos-themed-modal max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl sm:p-8"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">{cl.formEyebrow}</p>
                  <h2 className="mt-1 text-2xl font-bold text-[var(--eos-text)]">{cl.formTitle}</h2>
                </div>
                <button type="button" onClick={onClose} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]">
                  <X className="size-5" />
                </button>
              </div>

              {step === 1 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { key: "BUYER" as const, icon: ShoppingBag, title: cl.typeBuyerTitle, body: cl.typeBuyerBody },
                    { key: "SELLER" as const, icon: Home, title: cl.typeSellerTitle, body: cl.typeSellerBody },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setType(opt.key)}
                      className={`rounded-[1.5rem] border p-5 text-left transition ${
                        type === opt.key
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-[var(--eos-border)] hover:border-emerald-500/20"
                      }`}
                    >
                      <opt.icon className="mb-3 size-6 text-emerald-500" />
                      <p className="font-bold text-[var(--eos-text)]">{opt.title}</p>
                      <p className="mt-2 text-sm text-[var(--eos-muted)]">{opt.body}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">{cl.firstName}</span>
                      <input
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">{cl.lastName}</span>
                      <input
                        value={form.lastName}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">{cl.email}</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">{cl.phone}</span>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">{cl.notes}</span>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                  </label>
                </div>
              ) : null}

              {step === 3 && type === "BUYER" ? (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--eos-muted)]">{cl.buyerCriteriaLead}</p>
                  <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4 text-sm text-[var(--eos-text)]">
                    {Object.values(formatRadarSummary(buyerFilters)).join(" · ")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalibrationOpen(true)}
                    className="w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-500"
                  >
                    {cl.configureCriteria}
                  </button>
                </div>
              ) : null}

              {step === 3 && type === "SELLER" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={form.sellerTransactionType}
                      onChange={(e) => setForm((f) => ({ ...f, sellerTransactionType: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    >
                      <option value="SELL">{cl.transactionSell}</option>
                      <option value="RENT">{cl.transactionRent}</option>
                    </select>
                    <select
                      value={form.sellerPropertyType}
                      onChange={(e) => setForm((f) => ({ ...f, sellerPropertyType: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    >
                      <option value="FLAT">{cl.typeFlat}</option>
                      <option value="HOUSE">{cl.typeHouse}</option>
                      <option value="PLOT">{cl.typePlot}</option>
                      <option value="COMMERCIAL">{cl.typeCommercial}</option>
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder={cl.city}
                      value={form.sellerCity}
                      onChange={(e) => setForm((f) => ({ ...f, sellerCity: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                    <input
                      placeholder={cl.district}
                      value={form.sellerDistrict}
                      onChange={(e) => setForm((f) => ({ ...f, sellerDistrict: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      placeholder={cl.price}
                      value={form.sellerPrice}
                      onChange={(e) => setForm((f) => ({ ...f, sellerPrice: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                    <input
                      placeholder={cl.area}
                      value={form.sellerArea}
                      onChange={(e) => setForm((f) => ({ ...f, sellerArea: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                    <input
                      placeholder={cl.rooms}
                      value={form.sellerRooms}
                      onChange={(e) => setForm((f) => ({ ...f, sellerRooms: e.target.value }))}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                    />
                  </div>
                  <textarea
                    placeholder={cl.sellerNotes}
                    value={form.sellerDescription}
                    onChange={(e) => setForm((f) => ({ ...f, sellerDescription: e.target.value }))}
                    rows={4}
                    className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                  />
                </div>
              ) : null}

              {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

              <div className="mt-8 flex flex-wrap gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
                  >
                    <ChevronLeft className="size-4" />
                    {cl.back}
                  </button>
                ) : null}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="ml-auto rounded-full bg-emerald-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black"
                  >
                    {cl.next}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void submit()}
                    className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
                  >
                    <Check className="size-4" />
                    {saving ? cl.saving : cl.saveClient}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CrmRadarCalibrationModal
        open={calibrationOpen}
        onClose={() => setCalibrationOpen(false)}
        initialFilters={buyerFilters}
        catalog={catalog}
        saving={false}
        onSave={async (filters) => {
          setBuyerFilters(filters);
          setCalibrationOpen(false);
        }}
      />
    </>,
    document.body,
  );
}
