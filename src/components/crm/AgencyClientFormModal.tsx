"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Home, ChevronLeft, Check, Radar } from "lucide-react";
import { defaultWebRadarFilters } from "@/lib/radarCalibrationWeb";
import { parsePesel } from "@/lib/pesel";
import PhoneCountryInput from "@/components/auth/PhoneCountryInput";
import { useLocale } from "@/contexts/LocaleContext";

type Props = {
  open: boolean;
  initialType?: "BUYER" | "SELLER";
  onClose: () => void;
  onCreated: (clientId?: number) => void;
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
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [buyerFilters] = useState(defaultWebRadarFilters());

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    pesel: "",
    notes: "",
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType(initialType);
    setError("");
    setPhoneE164("");
    setScanning(false);
  }, [open, initialType]);

  const peselData = parsePesel(form.pesel);

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
          phone: phoneE164 || form.phone,
          pesel: form.pesel,
          notes: form.notes,
          ...(type === "BUYER" ? { buyerFilters } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || cl.saveError);

      setScanning(true);
      setSaving(false);
      await new Promise((r) => setTimeout(r, 1200));
      onCreated(json.client?.id);
      setScanning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : cl.saveError);
      setSaving(false);
      setScanning(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99990] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          onClick={scanning ? undefined : onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="eos-themed-modal relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl sm:p-8"
          >
            {scanning ? (
              <div className="flex flex-col items-center py-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10"
                >
                  <Radar className="size-9 text-emerald-500" />
                </motion.div>
                <p className="text-lg font-bold text-[var(--eos-text)]">{cl.scanningTitle}</p>
                <p className="mt-2 max-w-xs text-sm text-[var(--eos-muted)]">{cl.scanningBody}</p>
              </div>
            ) : (
              <>
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
                ) : (
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
                      <div className="mt-2">
                        <PhoneCountryInput valueE164={phoneE164} onChangeE164={setPhoneE164} />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">PESEL (opcjonalnie)</span>
                      <input
                        value={form.pesel}
                        onChange={(e) => setForm((f) => ({ ...f, pesel: e.target.value.replace(/[^\d]/g, "").slice(0, 11) }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                      {form.pesel.length > 0 ? (
                        peselData ? (
                          <p className="mt-2 text-xs font-semibold text-emerald-600">
                            PESEL poprawny · Płeć: {peselData.gender === "M" ? "Mężczyzna" : "Kobieta"} · Data ur.: {peselData.birthDate}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-red-500">PESEL niepoprawny</p>
                        )
                      ) : null}
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
                )}

                {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

                <div className="mt-8 flex flex-wrap gap-3">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
                    >
                      <ChevronLeft className="size-4" />
                      {cl.back}
                    </button>
                  ) : null}
                  {step < 2 ? (
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="ml-auto rounded-full bg-emerald-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black"
                    >
                      {cl.next}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving || (form.pesel.length > 0 && !peselData)}
                      onClick={() => void submit()}
                      className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
                    >
                      <Check className="size-4" />
                      {saving ? cl.saving : cl.saveClient}
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
