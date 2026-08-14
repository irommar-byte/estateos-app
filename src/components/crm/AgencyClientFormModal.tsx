"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Home, ChevronLeft, Check, Radar, CalendarDays, MapPin, SlidersHorizontal } from "lucide-react";
import {
  defaultWebRadarFilters,
  formatRadarSummary,
  type WebRadarFilters,
} from "@/lib/radarCalibrationWeb";
import { parsePesel } from "@/lib/pesel";
import PhoneCountryInput from "@/components/auth/PhoneCountryInput";
import { useLocale } from "@/contexts/LocaleContext";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import CrmRadarCalibrationModal from "@/components/crm/CrmRadarCalibrationModal";

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
  const [buyerFilters, setBuyerFilters] = useState<WebRadarFilters>(defaultWebRadarFilters());
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarCatalog, setRadarCatalog] = useState<{
    strictCities: string[];
    strictCityDistricts: Record<string, string[]>;
  }>({ strictCities: [], strictCityDistricts: {} });
  const [meeting, setMeeting] = useState({
    enabled: false,
    date: "",
    time: "10:00",
    location: "",
    note: "",
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    pesel: "",
    notes: "",
    sellerCity: "",
    sellerPrice: "",
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType(initialType);
    setError("");
    setPhoneE164("");
    setScanning(false);
    setRadarOpen(false);
    setBuyerFilters(defaultWebRadarFilters());
    setMeeting({ enabled: false, date: "", time: "10:00", location: "", note: "" });
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      pesel: "",
      notes: "",
      sellerCity: "",
      sellerPrice: "",
    });
    void (async () => {
      try {
        const res = await fetch("/api/location/districts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setRadarCatalog({
          strictCities: Array.isArray(data?.strictCities) ? data.strictCities : [],
          strictCityDistricts: data?.strictCityDistricts || {},
        });
      } catch {
        /* ignore */
      }
    })();
  }, [open, initialType]);

  const peselData = parsePesel(form.pesel);
  const maxStep = 3;
  const buyerSummary = formatRadarSummary(buyerFilters);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const acquisitionMeeting =
        type === "SELLER" && meeting.enabled && meeting.date && meeting.time
          ? {
              startsAt: new Date(`${meeting.date}T${meeting.time}:00`).toISOString(),
              location: meeting.location.trim() || null,
              notes: meeting.note.trim() || null,
            }
          : null;

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
          ...(type === "SELLER"
            ? {
                sellerCity: form.sellerCity || null,
                sellerPrice: form.sellerPrice
                  ? Number(String(form.sellerPrice).replace(/\s/g, "").replace(",", "."))
                  : null,
                acquisitionMeeting,
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || cl.saveError);

      setScanning(true);
      setSaving(false);
      await new Promise((r) => setTimeout(r, 900));
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
          className="fixed inset-0 z-[99990] flex items-end justify-center p-4 sm:items-center"
          onClick={scanning ? undefined : onClose}
        >
          <div className="eos-modal-backdrop absolute inset-0" />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="eos-themed-modal relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-strong)] sm:p-8"
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
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
                      {cl.formEyebrow} · krok {step}/{maxStep}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[var(--eos-text)]">{cl.formTitle}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {step === 1 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { key: "BUYER" as const, icon: ShoppingBag, title: cl.typeBuyerTitle, body: cl.typeBuyerBody },
                        { key: "SELLER" as const, icon: Home, title: cl.typeSellerTitle, body: cl.typeSellerBody },
                      ] as const
                    ).map((opt) => (
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          {cl.firstName}
                        </span>
                        <input
                          value={form.firstName}
                          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          {cl.lastName}
                        </span>
                        <input
                          value={form.lastName}
                          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.email}
                      </span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                    </label>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.phone}
                      </span>
                      <div className="mt-2">
                        <PhoneCountryInput valueE164={phoneE164} onChangeE164={setPhoneE164} />
                      </div>
                    </div>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        PESEL (opcjonalnie)
                      </span>
                      <input
                        value={form.pesel}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            pesel: e.target.value.replace(/[^\d]/g, "").slice(0, 11),
                          }))
                        }
                        className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                      {form.pesel.length > 0 ? (
                        peselData ? (
                          <p className="mt-2 text-xs font-semibold text-emerald-600">
                            PESEL poprawny · {peselData.gender === "M" ? "Mężczyzna" : "Kobieta"} ·{" "}
                            {peselData.birthDate}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-red-500">PESEL niepoprawny</p>
                        )
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.notes}
                      </span>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                      />
                    </label>
                  </div>
                ) : null}

                {step === 3 && type === "BUYER" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--eos-muted)]">
                      Ustaw pełne kryteria wyszukiwania (mapa lub miasto + dzielnice, budżet, udogodnienia) —
                      system będzie dopasowywał oferty w CRM.
                    </p>
                    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                      <div className="grid gap-2 text-sm">
                        <p>
                          <span className="text-[var(--eos-muted)]">Lokalizacja:</span>{" "}
                          <strong>{buyerSummary.location}</strong>
                        </p>
                        <p>
                          <span className="text-[var(--eos-muted)]">Typ:</span>{" "}
                          <strong>
                            {buyerSummary.transactionType} · {buyerSummary.propertyType}
                          </strong>
                        </p>
                        <p>
                          <span className="text-[var(--eos-muted)]">Budżet:</span>{" "}
                          <strong>{buyerSummary.maxBudget}</strong>
                        </p>
                        <p>
                          <span className="text-[var(--eos-muted)]">Metraż:</span>{" "}
                          <strong>{buyerSummary.minArea}</strong>
                        </p>
                        <p>
                          <span className="text-[var(--eos-muted)]">Próg:</span>{" "}
                          <strong>{buyerSummary.threshold}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRadarOpen(true)}
                        className={eosBtn("home", { className: "mt-4 w-full", size: "sm" })}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        Kalibruj radar klienta
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === 3 && type === "SELLER" ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          Miasto / lokalizacja
                        </span>
                        <input
                          value={form.sellerCity}
                          onChange={(e) => setForm((f) => ({ ...f, sellerCity: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          Szacowana cena
                        </span>
                        <input
                          value={form.sellerPrice}
                          onChange={(e) => setForm((f) => ({ ...f, sellerPrice: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)]"
                        />
                      </label>
                    </div>

                    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={meeting.enabled}
                          onChange={(e) => setMeeting((m) => ({ ...m, enabled: e.target.checked }))}
                          className="size-4 accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-[var(--eos-text)]">
                          Umów wstępne spotkanie pozyskania
                        </span>
                      </label>
                      {meeting.enabled ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                                Data
                              </span>
                              <input
                                type="date"
                                value={meeting.date}
                                onChange={(e) => setMeeting((m) => ({ ...m, date: e.target.value }))}
                                className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                                Godzina
                              </span>
                              <input
                                type="time"
                                value={meeting.time}
                                onChange={(e) => setMeeting((m) => ({ ...m, time: e.target.value }))}
                                className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                              />
                            </label>
                          </div>
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              <MapPin className="mr-1 inline size-3" /> Lokalizacja
                            </span>
                            <input
                              value={meeting.location}
                              onChange={(e) => setMeeting((m) => ({ ...m, location: e.target.value }))}
                              placeholder="Adres / biuro / online"
                              className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              <CalendarDays className="mr-1 inline size-3" /> Notatka do kalendarza
                            </span>
                            <textarea
                              value={meeting.note}
                              onChange={(e) => setMeeting((m) => ({ ...m, note: e.target.value }))}
                              rows={2}
                              className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                            />
                          </label>
                          <p className="text-xs text-[var(--eos-muted)]">
                            Po zapisaniu termin trafi do Twojego dnia w CRM, a klient dostanie e-mail (jeśli podał
                            adres).
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

                <div className="mt-8 flex flex-wrap gap-3">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                      className={eosBtn("secondary")}
                    >
                      <ChevronLeft className="size-4" />
                      {cl.back}
                    </button>
                  ) : null}
                  {step < maxStep ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                      disabled={step === 2 && (!form.firstName.trim() || !form.lastName.trim())}
                      className={eosBtn("home", { className: "ml-auto" })}
                    >
                      {cl.next}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        saving ||
                        (form.pesel.length > 0 && !peselData) ||
                        (type === "SELLER" && meeting.enabled && (!meeting.date || !meeting.time))
                      }
                      onClick={() => void submit()}
                      className={eosBtn("home", { className: "ml-auto" })}
                    >
                      <Check className="size-4" />
                      {saving ? cl.saving : cl.saveClient}
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>

          <CrmRadarCalibrationModal
            open={radarOpen}
            onClose={() => setRadarOpen(false)}
            initialFilters={buyerFilters}
            catalog={radarCatalog}
            saving={false}
            onSave={async (filters) => {
              setBuyerFilters(filters);
              setRadarOpen(false);
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
