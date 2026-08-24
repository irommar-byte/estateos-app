"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingBag,
  Home,
  ChevronLeft,
  Check,
  Radar,
  CalendarDays,
  MapPin,
  History,
  UserRoundSearch,
} from "lucide-react";
import {
  defaultWebRadarFilters,
  type WebRadarFilters,
} from "@/lib/radarCalibrationWeb";
import { parsePesel } from "@/lib/pesel";
import PhoneCountryInput from "@/components/auth/PhoneCountryInput";
import { useLocale } from "@/contexts/LocaleContext";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import AgencyClientCriteriaEditor, {
  buyerCriteriaReady,
} from "@/components/crm/AgencyClientCriteriaEditor";
import AddressSuggestInput from "@/components/crm/AddressSuggestInput";
import { canonicalizeCity } from "@/lib/location/locationCatalog";
import { CLIENT_PREP_ITEMS } from "@/lib/crm/clientJourney";

type LookupMatch = {
  id: number;
  status: string;
  type: "BUYER" | "SELLER" | string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  matchCount?: number;
  activityCount?: number;
  buyerCity?: string | null;
  topMatches?: Array<{
    score: number;
    offerId: number;
    offerTitle: string;
    city: string;
    price: number;
  }>;
  activities?: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    offerId: number | null;
    createdAt: string;
  }>;
  matchedBy?: { email: boolean; phone: boolean };
};

type FieldStatus = "idle" | "checking" | "available" | "taken" | "invalid";

type Props = {
  open: boolean;
  initialType?: "BUYER" | "SELLER";
  onClose: () => void;
  onCreated: (clientId?: number) => void;
};

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function isCompletePhoneE164(raw: string): boolean {
  const v = String(raw || "").trim();
  if (!v.startsWith("+")) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function FieldTrailIcon({ status }: { status: FieldStatus }) {
  if (status === "checking") {
    return (
      <span className="size-3.5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
    );
  }
  if (status === "available") {
    return <Check className="size-4 text-emerald-500" strokeWidth={3} />;
  }
  if (status === "taken" || status === "invalid") {
    return <X className="size-4 text-red-500" strokeWidth={3} />;
  }
  return null;
}

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
  const [buyerFilters, setBuyerFilters] = useState<WebRadarFilters>(() => ({
    ...defaultWebRadarFilters(),
    pushNotifications: false,
  }));
  const [criteriaCatalog, setCriteriaCatalog] = useState<{
    strictCities: string[];
    strictCityDistricts: Record<string, string[]>;
  }>({ strictCities: [], strictCityDistricts: {} });
  const [meeting, setMeeting] = useState({
    enabled: true,
    date: "",
    time: "10:00",
    location: "",
    note: "",
  });
  const [alsoSearching, setAlsoSearching] = useState(false);
  const [listingUrl, setListingUrl] = useState("");
  const [prepItems, setPrepItems] = useState<string[]>([]);
  const [addressMeta, setAddressMeta] = useState<{ city?: string; lat?: number; lng?: number }>({});

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

  const [emailStatus, setEmailStatus] = useState<FieldStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<FieldStatus>("idle");
  const [lookupMatches, setLookupMatches] = useState<LookupMatch[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const lookupSeq = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType(initialType);
    setError("");
    setPhoneE164("");
    setScanning(false);
    setEmailStatus("idle");
    setPhoneStatus("idle");
    setLookupMatches([]);
    setLookupBusy(false);
    setForceCreate(false);
    setBuyerFilters({ ...defaultWebRadarFilters(), pushNotifications: false });
    setMeeting({ enabled: true, date: "", time: "10:00", location: "", note: "" });
    setAlsoSearching(false);
    setListingUrl("");
    setPrepItems([]);
    setAddressMeta({});
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
        setCriteriaCatalog({
          strictCities: Array.isArray(data?.strictCities) ? data.strictCities : [],
          strictCityDistricts: data?.strictCityDistricts || {},
        });
      } catch {
        /* ignore */
      }
    })();
  }, [open, initialType]);

  const runLookup = useCallback(async (email: string, phone: string) => {
    const emailTrim = email.trim().toLowerCase();
    const phoneOk = isCompletePhoneE164(phone);
    const emailOk = isValidEmail(emailTrim);
    const emailPartial = emailTrim.length > 0 && !emailOk;
    const phonePartial = phone.trim().length > 0 && !phoneOk;

    if (emailPartial) setEmailStatus("invalid");
    else if (!emailTrim) setEmailStatus("idle");

    if (phonePartial) setPhoneStatus("invalid");
    else if (!phone.trim()) setPhoneStatus("idle");

    if (!emailOk && !phoneOk) {
      setLookupMatches([]);
      setLookupBusy(false);
      if (emailOk === false && emailTrim && !emailPartial) setEmailStatus("idle");
      return;
    }

    if (emailOk) setEmailStatus("checking");
    if (phoneOk) setPhoneStatus("checking");
    setLookupBusy(true);

    const seq = ++lookupSeq.current;
    const params = new URLSearchParams({ quick: "1" });
    if (emailOk) params.set("email", emailTrim);
    if (phoneOk) params.set("phone", phone);

    try {
      const res = await fetch(`/api/crm/clients/lookup?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (seq !== lookupSeq.current) return;
      if (!res.ok || !json.success) {
        if (emailOk) setEmailStatus("idle");
        if (phoneOk) setPhoneStatus("idle");
        setLookupMatches([]);
        return;
      }

      const matches = (Array.isArray(json.matches) ? json.matches : []) as LookupMatch[];
      setLookupMatches(matches);

      if (emailOk) {
        const emailHit = matches.some((m) => m.matchedBy?.email);
        setEmailStatus(emailHit ? "taken" : "available");
      }
      if (phoneOk) {
        const phoneHit = matches.some((m) => m.matchedBy?.phone);
        setPhoneStatus(phoneHit ? "taken" : "available");
      }
    } catch {
      if (seq !== lookupSeq.current) return;
      if (emailOk) setEmailStatus("idle");
      if (phoneOk) setPhoneStatus("idle");
      setLookupMatches([]);
    } finally {
      if (seq === lookupSeq.current) setLookupBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open || step !== 2) return;
    const t = setTimeout(() => {
      void runLookup(form.email, phoneE164);
    }, 500);
    return () => clearTimeout(t);
  }, [open, step, form.email, phoneE164, runLookup]);

  const primaryMatch = useMemo(() => lookupMatches[0] || null, [lookupMatches]);

  const peselData = parsePesel(form.pesel);
  const maxStep = 3;
  const districtCount =
    criteriaCatalog.strictCityDistricts?.[buyerFilters.city]?.length ||
    criteriaCatalog.strictCityDistricts?.[canonicalizeCity(buyerFilters.city) || ""]?.length ||
    0;
  const buyerStepReady = type !== "BUYER" || buyerCriteriaReady(buyerFilters, districtCount);

  const openExisting = (id: number) => {
    onCreated(id);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const acquisitionMeeting =
        type === "SELLER" && meeting.enabled && meeting.date && meeting.time
          ? {
              startsAt: new Date(`${meeting.date}T${meeting.time}:00`).toISOString(),
              location: meeting.location.trim() || form.sellerCity.trim() || null,
              notes: meeting.note.trim() || form.notes.trim() || null,
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
          forceCreate,
          ...(type === "BUYER"
            ? { buyerFilters: { ...buyerFilters, pushNotifications: false } }
            : {}),
          ...(type === "SELLER"
            ? {
              sellerCity: form.sellerCity || null,
              sellerDistrict: addressMeta.city || null,
              sellerPrice: form.sellerPrice
                ? Number(String(form.sellerPrice).replace(/\s/g, "").replace(",", "."))
                : null,
              notes: form.notes || null,
              listingUrl: listingUrl.trim() || null,
              prepItems,
              lat: addressMeta.lat ?? null,
              lng: addressMeta.lng ?? null,
              acquisitionMeeting,
                ...(alsoSearching ? { buyerFilters: { ...buyerFilters, pushNotifications: false } } : {}),
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        const matches = (Array.isArray(json.matches) ? json.matches : []) as LookupMatch[];
        if (matches.length) setLookupMatches(matches);
        setStep(2);
        setForceCreate(false);
        throw new Error(json.error || "Klient o tym e-mailu lub telefonie już jest w CRM.");
      }
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

  const emailBorder =
    emailStatus === "taken" || emailStatus === "invalid"
      ? "border-red-500/55"
      : emailStatus === "available"
        ? "border-emerald-500/55"
        : "border-[var(--eos-border)] focus-within:border-emerald-500/60";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99990] flex items-end justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4"
        >
          <div
            className="eos-modal-backdrop absolute inset-0"
            onClick={scanning ? undefined : onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="eos-themed-modal relative my-auto max-h-[min(92vh,900px)] w-full max-w-xl overflow-y-auto overscroll-y-contain rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.28),0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-8"
          >
            {scanning ? (
              <div className="flex flex-col items-center py-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_12px_40px_rgba(16,185,129,0.25)]"
                >
                  <Radar className="size-9 text-emerald-500" />
                </motion.div>
                <p className="text-lg font-bold text-[var(--eos-text)] break-words">{cl.scanningTitle}</p>
                <p className="mt-2 max-w-xs text-sm text-[var(--eos-muted)] break-words">{cl.scanningBody}</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
                      {cl.formEyebrow} · krok {step}/{maxStep}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[var(--eos-text)] break-words sm:text-2xl">
                      {cl.formTitle}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
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
                        className={`rounded-[1.5rem] border p-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition ${
                          type === opt.key
                            ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_14px_36px_rgba(16,185,129,0.18)]"
                            : "border-[var(--eos-border)] hover:border-emerald-500/20"
                        }`}
                      >
                        <opt.icon className="mb-3 size-6 text-emerald-500" />
                        <p className="font-bold text-[var(--eos-text)] break-words">{opt.title}</p>
                        <p className="mt-2 text-sm text-[var(--eos-muted)] break-words">{opt.body}</p>
                      </button>
                    ))}
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          {cl.firstName}
                        </span>
                        <input
                          value={form.firstName}
                          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                          {cl.lastName}
                        </span>
                        <input
                          value={form.lastName}
                          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                        />
                      </label>
                    </div>

                    <label className="block min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.email}
                      </span>
                      <div
                        className={`mt-2 flex items-center rounded-2xl border bg-[var(--eos-input)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors ${emailBorder}`}
                      >
                        <input
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          className="eos-modal-field min-w-0 flex-1 rounded-2xl border-0 bg-transparent px-4 py-3 text-[var(--eos-text)] outline-none"
                          placeholder="np. jan@firma.pl"
                        />
                        <div className="flex shrink-0 items-center pr-3">
                          <FieldTrailIcon status={emailStatus} />
                        </div>
                      </div>
                      {emailStatus === "available" ? (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                          E-mail wolny w CRM
                        </p>
                      ) : null}
                      {emailStatus === "taken" ? (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                          E-mail już w bazie klientów
                        </p>
                      ) : null}
                      {emailStatus === "invalid" ? (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
                          Nieprawidłowy e-mail
                        </p>
                      ) : null}
                    </label>

                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.phone}
                      </span>
                      <div className="mt-2">
                        <PhoneCountryInput
                          valueE164={phoneE164}
                          onChangeE164={setPhoneE164}
                          hideLabel
                          status={phoneStatus}
                        />
                      </div>
                    </div>

                    {primaryMatch ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="overflow-hidden rounded-[1.5rem] border border-amber-500/35 bg-gradient-to-b from-amber-500/12 to-[var(--eos-card)] shadow-[0_16px_40px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]"
                      >
                        <div className="border-b border-amber-500/20 px-4 py-3 sm:px-5">
                          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                            <UserRoundSearch className="size-3.5" />
                            Klient już w bazie
                            {lookupBusy ? " · sprawdzam…" : ""}
                          </p>
                          <p className="mt-2 text-lg font-bold text-[var(--eos-text)]">
                            {primaryMatch.firstName} {primaryMatch.lastName}
                          </p>
                          <p className="mt-1 break-words text-sm text-[var(--eos-muted)]">
                            {primaryMatch.type === "BUYER" ? "Kupujący" : "Sprzedający"}
                            {primaryMatch.status !== "ACTIVE" ? ` · ${primaryMatch.status}` : ""}
                            {" · "}
                            {primaryMatch.email || "brak e-mail"} · {primaryMatch.phone || "brak telefonu"}
                          </p>
                          <p className="mt-2 text-xs text-[var(--eos-muted)]">
                            W bazie od{" "}
                            {primaryMatch.createdAt
                              ? new Date(primaryMatch.createdAt).toLocaleDateString("pl-PL")
                              : "—"}{" "}
                            · {primaryMatch.activityCount ?? 0} aktywności · {primaryMatch.matchCount ?? 0} dopasowań
                            {primaryMatch.buyerCity ? ` · ${primaryMatch.buyerCity}` : ""}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {primaryMatch.matchedBy?.email ? (
                              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                                ten sam e-mail
                              </span>
                            ) : null}
                            {primaryMatch.matchedBy?.phone ? (
                              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                                ten sam telefon
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="max-h-52 space-y-2 overflow-y-auto px-4 py-3 sm:px-5">
                          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                            <History className="size-3.5" />
                            Historia w CRM
                          </p>
                          {(primaryMatch.activities?.length ?? 0) === 0 &&
                          (primaryMatch.topMatches?.length ?? 0) === 0 ? (
                            <p className="text-sm text-[var(--eos-muted)]">Brak zapisanych aktywności.</p>
                          ) : null}
                          {(primaryMatch.topMatches || []).slice(0, 3).map((m) => (
                            <div
                              key={`m-${m.offerId}`}
                              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/70 px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
                            >
                              <p className="text-sm font-semibold text-[var(--eos-text)]">
                                Match {m.score}% · {m.offerTitle}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--eos-muted)]">
                                {m.city} · {Number.isFinite(Number(m.price)) ? Math.round(Number(m.price)).toLocaleString("pl-PL") : "—"} zł
                              </p>
                            </div>
                          ))}
                          {(primaryMatch.activities || []).slice(0, 8).map((a) => (
                            <div
                              key={a.id}
                              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/70 px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-[var(--eos-text)]">
                                  {a.title || a.kind || "Aktywność"}
                                </p>
                                <span className="shrink-0 text-[10px] font-semibold text-[var(--eos-muted)]">
                                  {new Date(a.createdAt).toLocaleString("pl-PL")}
                                </span>
                              </div>
                              {a.body ? (
                                <p className="mt-1 line-clamp-2 text-xs text-[var(--eos-muted)]">{a.body}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-amber-500/20 px-4 py-3 sm:px-5">
                          <button
                            type="button"
                            onClick={() => openExisting(primaryMatch.id)}
                            className={eosBtn("home", { className: "shadow-[0_10px_28px_rgba(16,185,129,0.28)]" })}
                          >
                            Otwórz tego klienta
                          </button>
                          {lookupMatches.length > 1 ? (
                            <p className="self-center text-xs text-[var(--eos-muted)]">
                              +{lookupMatches.length - 1} innych trafień w bazie
                            </p>
                          ) : null}
                          <label className="flex items-start gap-2 self-center text-xs text-[var(--eos-muted)]">
                            <input
                              type="checkbox"
                              checked={forceCreate}
                              onChange={(e) => setForceCreate(e.target.checked)}
                              className="mt-0.5 size-4 accent-emerald-500"
                            />
                            To inna osoba — utwórz mimo to
                          </label>
                        </div>
                      </motion.div>
                    ) : null}

                    <label className="block min-w-0">
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
                        className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                      />
                      {form.pesel.length > 0 ? (
                        peselData ? (
                          <p className="mt-2 text-xs font-semibold text-emerald-600 break-words">
                            PESEL poprawny · {peselData.gender === "M" ? "Mężczyzna" : "Kobieta"} ·{" "}
                            {peselData.birthDate}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-red-500">PESEL niepoprawny</p>
                        )
                      ) : null}
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {cl.notes}
                      </span>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        className="eos-modal-field mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                      />
                    </label>
                  </div>
                ) : null}

                {step === 3 && type === "BUYER" ? (
                  <div className="min-w-0 space-y-4">
                    <p className="text-sm text-[var(--eos-muted)] break-words">
                      Ustaw kryteria wyszukiwania (mapa lub miasto + dzielnice, budżet, udogodnienia) —
                      system dopasuje oferty w CRM. Kontakt z klientem idzie e-mailem.
                    </p>
                    <AgencyClientCriteriaEditor
                      compact
                      value={buyerFilters}
                      onChange={setBuyerFilters}
                      catalog={criteriaCatalog}
                    />
                  </div>
                ) : null}

                {step === 3 && type === "SELLER" ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <AddressSuggestInput
                          label="Adres nieruchomości"
                          value={form.sellerCity}
                          placeholder="Ulica, numer, miasto…"
                          onChange={(value, meta) => {
                            setForm((f) => ({ ...f, sellerCity: value }));
                            if (meta) setAddressMeta(meta);
                            if (meta?.lat && !meeting.location) {
                              setMeeting((m) => ({ ...m, location: value }));
                            }
                          }}
                        />
                        {Number.isFinite(addressMeta.lat) && Number.isFinite(addressMeta.lng) ? (
                          <p className="mt-2 text-xs font-bold text-emerald-500">
                            Pinezka ustawiona — adres zweryfikowany
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--eos-muted)]">
                            Wybierz podpowiedź, żeby potwierdzić lokalizację pinezką.
                          </p>
                        )}
                      </div>
                      <label className="block min-w-0">
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

                    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={meeting.enabled}
                          onChange={(e) => setMeeting((m) => ({ ...m, enabled: e.target.checked }))}
                          className="size-4 accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-[var(--eos-text)] break-words">
                          Termin spotkania (klient dostanie e-mail z wizytówką i kalendarzem)
                        </span>
                      </label>
                      {meeting.enabled ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block min-w-0">
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
                            <label className="block min-w-0">
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
                          <label className="block min-w-0">
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
                          <label className="block min-w-0">
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
                          <p className="text-xs text-[var(--eos-muted)] break-words">
                            Termin trafi do kalendarza CRM (Terminy). Kartę pozyskania wypełniasz już na miejscu — nie
                            tutaj.
                          </p>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              Klient ma przygotować
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {CLIENT_PREP_ITEMS.map((item) => {
                                const checked = prepItems.includes(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    className="flex items-start gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-xs text-[var(--eos-text)]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setPrepItems((current) =>
                                          checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                                        )
                                      }
                                      className="mt-0.5 size-4 accent-emerald-500"
                                    />
                                    <span className="leading-snug">{item.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <label className="block min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              Komentarz
                            </span>
                            <textarea
                              value={form.notes}
                              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                              rows={3}
                              placeholder="Notatka dla Ciebie i do maila ze spotkaniem"
                              className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              Link do ogłoszenia klienta (Otodom / OLX)
                            </span>
                            <input
                              value={listingUrl}
                              onChange={(e) => setListingUrl(e.target.value)}
                              placeholder="https://www.otodom.pl/pl/oferta/..."
                              className="eos-modal-field mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[var(--eos-text)]"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={alsoSearching}
                          onChange={(e) => setAlsoSearching(e.target.checked)}
                          className="size-4 accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-[var(--eos-text)]">Klient też szuka nieruchomości</span>
                      </label>
                      <p className="mt-2 text-xs text-[var(--eos-muted)]">
                        Włącz radar zakupowy — system będzie dopasowywał oferty tak jak dla kupującego.
                      </p>
                      {alsoSearching ? (
                        <div className="mt-4">
                          <AgencyClientCriteriaEditor
                            compact
                            value={buyerFilters}
                            onChange={setBuyerFilters}
                            catalog={criteriaCatalog}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {error ? <p className="mt-4 text-sm text-red-500 break-words">{error}</p> : null}
                {step === 3 && lookupMatches.length > 0 ? (
                  <label className="mt-4 flex items-start gap-2 text-sm text-[var(--eos-text)]">
                    <input
                      type="checkbox"
                      checked={forceCreate}
                      onChange={(e) => setForceCreate(e.target.checked)}
                      className="mt-0.5 size-4 accent-emerald-500"
                    />
                    To inna osoba — utwórz drugi profil mimo tego samego e-maila lub telefonu
                  </label>
                ) : null}

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
                      disabled={
                        step === 2 &&
                        (!form.firstName.trim() ||
                          !form.lastName.trim() ||
                          emailStatus === "invalid" ||
                          phoneStatus === "invalid")
                      }
                      className={eosBtn("home", { className: "ml-auto shadow-[0_12px_32px_rgba(16,185,129,0.25)]" })}
                    >
                      {cl.next}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        saving ||
                        !buyerStepReady ||
                        (form.pesel.length > 0 && !peselData) ||
                        (type === "SELLER" && meeting.enabled && (!meeting.date || !meeting.time)) ||
                        (lookupMatches.length > 0 && !forceCreate)
                      }
                      onClick={() => void submit()}
                      className={eosBtn("home", { className: "ml-auto shadow-[0_12px_32px_rgba(16,185,129,0.25)]" })}
                    >
                      <Check className="size-4" />
                      {saving ? cl.saving : lookupMatches.length > 0 && forceCreate ? "Zapisz mimo to" : cl.saveClient}
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
