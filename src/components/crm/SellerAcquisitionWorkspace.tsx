"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FileUp,
  Loader2,
  Mail,
  PenLine,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";
import {
  ACQUISITION_DOCUMENTS,
  ACQUISITION_STEPS,
  type AcquisitionFormData,
  type AcquisitionRecord,
} from "@/lib/acquisitionWorkflow";
import SignaturePad from "@/components/crm/SignaturePad";
import AddressSuggestInput from "@/components/crm/AddressSuggestInput";
import NumberStepper from "@/components/crm/NumberStepper";
import CommissionRateSlider from "@/components/crm/CommissionRateSlider";
import MarketValuationPanel from "@/components/market/MarketValuationPanel";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import { COMMISSION_RATE_DEFAULT } from "@/lib/leadTransferShared";
import { PROPERTY_AMENITIES } from "@/lib/crm/clientJourney";
import { getDistrictsForCity } from "@/lib/location/locationCatalog";
import SellerPropertyTypeOptions from "@/components/crm/SellerPropertyTypeOptions";
import {
  apartmentNumberForType,
  isFlatSellerProperty,
  parseSellerPropertyType,
  sellerPropertyTypeLabel,
} from "@/lib/crm/sellerProperty";

const OFFER_CITIES = [
  "Warszawa",
  "Kraków",
  "Wrocław",
  "Poznań",
  "Łódź",
  "Lublin",
  "Gdańsk",
  "Gdynia",
  "Sopot",
  "Katowice",
  "Rybnik",
  "Białystok",
  "Zamość",
];

type SellerClient = {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
};

type AcquisitionResponse = {
  acquisition: (AcquisitionRecord & { approvedTemplateConfirmed?: boolean }) | null;
  defaultForm: AcquisitionFormData;
  portalUrl: string | null;
};

const fieldClass =
  "eos-field-inset mt-1.5 w-full rounded-xl px-3.5 py-3 text-sm text-[var(--eos-text)] outline-none";

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="eos-portal-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="eos-portal-label">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${fieldClass} resize-y`}
      />
    </label>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <p className="eos-portal-label">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`eos-raised-chip rounded-full px-3.5 py-2 text-[11px] ${
              value === option ? "eos-raised-chip--on" : ""
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)]/60 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-emerald-500"
      />
      <span className="text-sm font-semibold leading-snug text-[var(--eos-text)]">{label}</span>
    </label>
  );
}

export default function SellerAcquisitionWorkspace({
  client,
  onUpdated,
}: {
  client: SellerClient;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [record, setRecord] = useState<AcquisitionResponse["acquisition"]>(null);
  const [form, setForm] = useState<AcquisitionFormData | null>(null);
  const [step, setStep] = useState(1);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  const [signerName, setSignerName] = useState(`${client.firstName} ${client.lastName}`.trim());
  const [signerEmail, setSignerEmail] = useState(client.email || "");
  const [signatureData, setSignatureData] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/crm/clients/${client.id}/acquisition`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Nie udało się pobrać procesu.");
        if (!active) return;
        const data = json as AcquisitionResponse;
        setRecord(data.acquisition);
        setForm(data.acquisition?.formData || data.defaultForm);
        setStep(data.acquisition?.currentStep || 1);
        setPortalUrl(data.portalUrl);
        setTemplateConfirmed(Boolean(data.acquisition?.approvedTemplateConfirmed));
      })
      .catch((error) => active && setNotice(error instanceof Error ? error.message : "Błąd"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [client.id]);

  const signed = record?.status === "SIGNED";
  const checkedDocuments = useMemo(
    () => ACQUISITION_DOCUMENTS.filter((item) => form?.documents?.[item.id]).length,
    [form?.documents],
  );
  const updateSection = <K extends keyof AcquisitionFormData>(
    section: K,
    patch: Partial<AcquisitionFormData[K]>,
  ) => {
    if (!form || signed) return;
    setForm({ ...form, [section]: { ...(form[section] as object), ...patch } });
  };

  const applyPropertyAddress = async (
    value: string,
    meta?: { city?: string; lat?: number; lng?: number },
  ) => {
    if (!form || signed) return;
    const lat = meta?.lat;
    const lng = meta?.lng;
    updateSection("property", {
      address: value,
      city: meta?.city || form.property.city,
      lat: lat != null ? String(lat) : form.property.lat,
      lng: lng != null ? String(lng) : form.property.lng,
    });
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        streetHint: value,
      });
      if (meta?.city) qs.set("preferredCity", meta.city);
      const response = await fetch(`/api/location/reverse?${qs.toString()}`);
      const json = await response.json();
      if (!response.ok) return;
      setForm((current) => {
        if (!current) return current;
        return {
          ...current,
          property: {
            ...current.property,
            address: value,
            city: String(json.city || meta?.city || current.property.city || ""),
            district: String(json.district || current.property.district || ""),
            lat: String(lat),
            lng: String(lng),
          },
        };
      });
    } catch {
      /* keep manual city/district */
    }
  };

  const save = async (targetStep = step, status = "IN_MEETING") => {
    if (!form || signed) return false;
    setBusy("save");
    setNotice("");
    try {
      const response = await fetch(`/api/crm/clients/${client.id}/acquisition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: form,
          currentStep: targetStep,
          status,
          approvedTemplateConfirmed: templateConfirmed,
          invalidateAgreement: Boolean(record?.agreementSnapshot && targetStep < 6),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Nie udało się zapisać.");
      setRecord(json.acquisition);
      setStep(targetStep);
      setNotice("Zapisano w CRM.");
      onUpdated?.();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Błąd zapisu");
      return false;
    } finally {
      setBusy("");
    }
  };

  const action = async (name: "prepare_terms" | "send_preview" | "sign") => {
    if (!form) return;
    setBusy(name);
    setNotice("");
    try {
      const response = await fetch(`/api/crm/clients/${client.id}/acquisition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: name,
          formData: form,
          currentStep: 6,
          approvedTemplateConfirmed: templateConfirmed,
          signerName,
          signerEmail,
          signatureData,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Nie udało się wykonać akcji.");
      setRecord(json.acquisition);
      setStep(name === "sign" ? 7 : 6);
      setNotice(
        name === "prepare_terms"
          ? "Warunki zostały utrwalone. Możesz wysłać podgląd klientowi."
          : name === "send_preview"
            ? json.emailSent
              ? "Podgląd i lista dokumentów zostały wysłane klientowi."
              : "Podgląd zapisano, ale e-mail nie został wysłany."
            : json.emailSent
              ? "Dokument podpisany. Kopia została wysłana e-mailem."
              : "Dokument podpisany, ale wysyłka e-mail wymaga sprawdzenia.",
      );
      onUpdated?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Błąd");
    } finally {
      setBusy("");
    }
  };

  const uploadPaper = async (file: File) => {
    if (signed) return;
    setBusy("paper");
    setNotice("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      const response = await fetch(`/api/crm/clients/${client.id}/acquisition/paper`, {
        method: "POST",
        body: payload,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Nie udało się wgrać umowy.");
      if (json.formData) setForm(json.formData);
      setNotice("Skan umowy został podpięty i będzie widoczny dla klienta.");
      onUpdated?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Błąd wgrywania");
    } finally {
      setBusy("");
    }
  };

  if (loading || !form) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-2xl border border-[var(--eos-border)]">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_18px_50px_rgba(0,0,0,0.1)]">
      <div className="border-b border-[var(--eos-border)] bg-gradient-to-br from-emerald-500/12 to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 eos-portal-label eos-portal-label--ok">
              <ClipboardList className="size-4" />
              Spotkanie pozyskania
            </p>
            <h3 className="mt-2 text-xl font-black text-[var(--eos-text)]">Prowadzona karta nieruchomości</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
              Przejdź kolejno przez sytuację klienta, stan prawny, parametry lokalu, strategię sprzedaży i warunki współpracy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {portalUrl ? (
              <Link href={portalUrl} target="_blank" className={eosBtn("secondary", { size: "sm" })}>
                Widok klienta <ExternalLink className="size-3.5" />
              </Link>
            ) : null}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-wider ${
              signed ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
            }`}>
              {signed ? <BadgeCheck className="size-3.5" /> : <PenLine className="size-3.5" />}
              {signed ? "Podpisano" : record ? "W toku" : "Nowy proces"}
            </span>
          </div>
        </div>

        <div className="relative mt-6">
          <div className="absolute left-[7%] right-[7%] top-[13px] h-1 rounded-full bg-[rgba(15,23,42,0.1)]" />
          <div
            className="absolute top-[13px] h-1 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
            style={{
              left: "7%",
              width: `${Math.max(0, ((signed ? 6 : Math.max(0, step - 1)) / 6) * 86)}%`,
            }}
          />
          <div className="relative z-10 flex">
          {ACQUISITION_STEPS.map((item) => {
            const done = signed || item.id < step;
            const current = item.id === step;
            return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center"
            >
              <span className={`flex size-7 items-center justify-center rounded-full border text-[11px] font-black shadow-[0_6px_14px_rgba(15,23,42,0.14)] ${
                done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : current
                    ? "border-emerald-300 bg-emerald-700 text-white"
                    : "border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)]"
              }`}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : item.id}
              </span>
              <p className={`mt-2 text-[10px] font-bold leading-tight ${done || current ? "text-[var(--eos-text)]" : "text-[var(--eos-muted)]"}`}>{item.title}</p>
            </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="eos-portal-label eos-portal-label--ok">
            Krok {step} z {ACQUISITION_STEPS.length}
          </p>
          <h4 className="mt-1 text-lg font-black text-[var(--eos-text)]">{ACQUISITION_STEPS[step - 1].title}</h4>
          <p className="text-sm text-[var(--eos-muted)]">{ACQUISITION_STEPS[step - 1].subtitle}</p>
        </div>

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Termin spotkania" type="datetime-local" value={form.meeting.startsAt} onChange={(value) => updateSection("meeting", { startsAt: value })} />
            <AddressSuggestInput
              label="Miejsce spotkania"
              value={form.meeting.location}
              onChange={(value) => updateSection("meeting", { location: value })}
              placeholder="Adres, biuro lub online"
              disabled={signed}
            />
            <ChipRow
              label="Cel klienta"
              options={["Sprzedaż nieruchomości", "Wynajem", "Sprzedaż i zakup kolejnej", "Szybka transakcja", "Maksymalna cena"]}
              value={form.meeting.clientGoal}
              onChange={(value) => updateSection("meeting", { clientGoal: value })}
            />
            <ChipRow
              label="Oczekiwany termin sprzedaży"
              options={["Jak najszybciej", "Do 1 miesiąca", "Do 3 miesięcy", "Do 6 miesięcy", "Bez pośpiechu"]}
              value={form.meeting.targetTimeline}
              onChange={(value) => updateSection("meeting", { targetTimeline: value })}
            />
            <div className="sm:col-span-2">
              <TextArea label="Dlaczego klient sprzedaje i co jest dla niego najważniejsze?" value={form.meeting.reasonForSale} onChange={(value) => updateSection("meeting", { reasonForSale: value })} placeholder="Motywacja, ograniczenia czasowe, kolejna nieruchomość, bezpieczeństwo transakcji…" rows={4} />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Właściciel / współwłaściciele" value={form.ownership.owners} onChange={(value) => updateSection("ownership", { owners: value })} />
              <Field label="Podstawa nabycia" value={form.ownership.ownershipBasis} onChange={(value) => updateSection("ownership", { ownershipBasis: value })} placeholder="akt notarialny, spadek, darowizna…" />
              <Field label="Numer księgi wieczystej" value={form.ownership.landRegisterNumber} onChange={(value) => updateSection("ownership", { landRegisterNumber: value })} />
              {isFlatSellerProperty(form.property.propertyType) ? (
                <div>
                  <Field
                    label="Numer mieszkania (CRM)"
                    value={form.property.apartmentNumber || ""}
                    onChange={(value) => updateSection("property", { apartmentNumber: value.slice(0, 32) })}
                    placeholder="np. 12"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--eos-muted)]">
                    Tylko agent i klient w CRM — nie publikujemy na ogłoszeniu.
                  </p>
                </div>
              ) : null}
              <Field label="Stan cywilny / zgoda małżonka" value={form.ownership.maritalStatus} onChange={(value) => updateSection("ownership", { maritalStatus: value })} />
              <Field label="Hipoteka / kredyt" value={form.ownership.mortgage} onChange={(value) => updateSection("ownership", { mortgage: value })} />
              <Field label="Kto korzysta z lokalu?" value={form.ownership.occupancy} onChange={(value) => updateSection("ownership", { occupancy: value })} />
              <TextArea label="Obciążenia, służebności, roszczenia" value={form.ownership.encumbrances} onChange={(value) => updateSection("ownership", { encumbrances: value })} />
              <TextArea label="Pozostałe uwagi prawne" value={form.ownership.legalNotes} onChange={(value) => updateSection("ownership", { legalNotes: value })} />
            </div>
            <div className="eos-inset-well rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-[var(--eos-text)]">
                  <FileCheck2 className="size-4 text-emerald-500" />
                  Dokumenty klienta
                </p>
                <span className="text-xs font-bold text-emerald-600">{checkedDocuments}/{ACQUISITION_DOCUMENTS.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACQUISITION_DOCUMENTS.map((item) => (
                  <Toggle
                    key={item.id}
                    label={item.label}
                    checked={Boolean(form.documents[item.id])}
                    onChange={(checked) => setForm({ ...form, documents: { ...form.documents, [item.id]: checked } })}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <SellerPropertyTypeOptions
                value={parseSellerPropertyType(form.property.propertyType)}
                onChange={(id) =>
                  updateSection("property", {
                    propertyType: sellerPropertyTypeLabel(id),
                    apartmentNumber: apartmentNumberForType(id, form.property.apartmentNumber),
                  })
                }
                disabled={signed}
              />
            </div>
            {isFlatSellerProperty(form.property.propertyType) ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <Field
                  label="Numer mieszkania (CRM)"
                  value={form.property.apartmentNumber || ""}
                  onChange={(value) => updateSection("property", { apartmentNumber: value.slice(0, 32) })}
                  placeholder="np. 12"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--eos-muted)]">
                  Widoczny tylko dla prowadzącego agenta i klienta — nie trafia na ogłoszenie publiczne.
                </p>
              </div>
            ) : null}
            <div className="sm:col-span-2 lg:col-span-3">
            <AddressSuggestInput
              label="Pełny adres nieruchomości"
              value={form.property.address}
              onChange={(value, meta) => void applyPropertyAddress(value, meta)}
              placeholder="Ulica, numer, miasto"
              disabled={signed}
            />
            </div>
            <ChipRow
              label="Miasto"
              options={OFFER_CITIES}
              value={form.property.city}
              onChange={(value) => {
                const districts = getDistrictsForCity(value);
                updateSection("property", {
                  city: value,
                  district: districts.includes(form.property.district) ? form.property.district : "",
                });
              }}
            />
            {getDistrictsForCity(form.property.city).length > 0 ? (
              <ChipRow
                label="Dzielnica"
                options={getDistrictsForCity(form.property.city)}
                value={form.property.district}
                onChange={(value) => updateSection("property", { district: value })}
              />
            ) : (
              <Field
                label="Dzielnica / miejscowość"
                value={form.property.district}
                onChange={(value) => updateSection("property", { district: value, city: form.property.city || "Reszta kraju" })}
                placeholder="Wykrywana z mapy — możesz poprawić"
              />
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="eos-portal-label">Przyległości i dodatki</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROPERTY_AMENITIES.map((item) => {
                  const selected = String(form.property.amenities || "")
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean);
                  const active = selected.includes(item.label);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={signed}
                      onClick={() => {
                        const next = active
                          ? selected.filter((label) => label !== item.label)
                          : [...selected, item.label];
                        updateSection("property", { amenities: next.join(",") });
                      }}
                      className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${
                        active
                          ? "bg-emerald-500 text-black"
                          : "border border-[var(--eos-border)] text-[var(--eos-text)] hover:border-emerald-500/40"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <NumberStepper label="Powierzchnia" value={form.property.area} onChange={(value) => updateSection("property", { area: value })} step={1} suffix="m²" disabled={signed} />
            <NumberStepper label="Liczba pokoi" value={form.property.rooms} onChange={(value) => updateSection("property", { rooms: value })} step={1} disabled={signed} />
            <NumberStepper label="Piętro" value={form.property.floor} onChange={(value) => updateSection("property", { floor: value })} step={1} min={0} disabled={signed} />
            <NumberStepper label="Liczba pięter w budynku" value={form.property.totalFloors} onChange={(value) => updateSection("property", { totalFloors: value })} step={1} disabled={signed} />
            <NumberStepper label="Rok budowy" value={form.property.yearBuilt} onChange={(value) => updateSection("property", { yearBuilt: value })} step={1} min={1800} max={2035} disabled={signed} />
            <Field label="Stan nieruchomości" value={form.property.condition} onChange={(value) => updateSection("property", { condition: value })} />
            <Field label="Opłaty miesięczne" value={form.property.monthlyFees} onChange={(value) => updateSection("property", { monthlyFees: value })} />
            <Field label="Media / ogrzewanie" value={form.property.utilities} onChange={(value) => updateSection("property", { utilities: value })} />
            <Field label="Parking / garaż" value={form.property.parking} onChange={(value) => updateSection("property", { parking: value })} />
            <Field label="Piwnica / komórka" value={form.property.storage} onChange={(value) => updateSection("property", { storage: value })} />
            <Field label="Wyposażenie pozostające" value={form.property.furnishing} onChange={(value) => updateSection("property", { furnishing: value })} />
            <div className="sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2">
              <TextArea label="Największe zalety" value={form.property.advantages} onChange={(value) => updateSection("property", { advantages: value })} rows={4} />
              <TextArea label="Znane wady / elementy do ujawnienia" value={form.property.defects} onChange={(value) => updateSection("property", { defects: value })} rows={4} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <MarketValuationPanel
              lat={Number(String(form.property.lat || "").replace(",", ".")) || null}
              lng={Number(String(form.property.lng || "").replace(",", ".")) || null}
              area={Number(String(form.property.area || "").replace(/\s/g, "").replace(",", ".")) || null}
              rooms={Number(String(form.property.rooms || "").replace(/\s/g, "")) || null}
              floor={Number(String(form.property.floor || "").replace(/\s/g, "")) || null}
              city={form.property.city || "Warszawa"}
              district={form.property.district || undefined}
              address={form.property.address}
              listingPrice={Number(String(form.strategy.expectedPrice || "").replace(/\s/g, "").replace(",", ".")) || null}
              purpose="crm"
              reportEmail={client.email || undefined}
              clientId={client.id}
              applyLabel="Zastosuj cenę rekomendowaną"
              onApply={(price) => {
                const formatted = String(price).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                updateSection("strategy", { recommendedPrice: formatted, expectedPrice: formatted });
              }}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberStepper label="Cena oczekiwana" value={form.strategy.expectedPrice} onChange={(value) => updateSection("strategy", { expectedPrice: value })} step={5000} suffix="PLN" disabled={signed} />
              <NumberStepper label="Cena rekomendowana" value={form.strategy.recommendedPrice} onChange={(value) => updateSection("strategy", { recommendedPrice: value })} step={5000} suffix="PLN" disabled={signed} />
              <NumberStepper label="Dolna granica rozmów" value={form.strategy.minimumPrice} onChange={(value) => updateSection("strategy", { minimumPrice: value })} step={5000} suffix="PLN" disabled={signed} />
            </div>
            <TextArea label="Zasady prezentacji i dostępność" value={form.strategy.presentationRules} onChange={(value) => updateSection("strategy", { presentationRules: value })} placeholder="Dni, godziny, wyprzedzenie, obecność właściciela, zwierzęta…" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Zgoda na profesjonalną sesję zdjęciową" checked={form.strategy.photoConsent} onChange={(checked) => updateSection("strategy", { photoConsent: checked })} />
              <Toggle label="Zgoda na marketing oferty" checked={form.strategy.marketingConsent} onChange={(checked) => updateSection("strategy", { marketingConsent: checked })} />
              <Toggle label="Zgoda na publikację w portalach ogłoszeniowych" checked={form.strategy.portalConsent} onChange={(checked) => updateSection("strategy", { portalConsent: checked })} />
              <Toggle label="Zgoda na promocję w mediach społecznościowych" checked={form.strategy.socialMediaConsent} onChange={(checked) => updateSection("strategy", { socialMediaConsent: checked })} />
              <Toggle label="Klucze przekazane agentowi na potrzeby prezentacji" checked={form.strategy.keysHandover} onChange={(checked) => updateSection("strategy", { keysHandover: checked })} />
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="eos-portal-label">Rodzaj umowy</span>
                <select value={form.cooperation.agreementType} onChange={(event) => updateSection("cooperation", { agreementType: event.target.value as "EXCLUSIVE" | "OPEN" })} className={fieldClass}>
                  <option value="EXCLUSIVE">Na wyłączność</option>
                  <option value="OPEN">Otwarta</option>
                </select>
              </label>
              <NumberStepper label="Okres współpracy" value={form.cooperation.durationMonths} onChange={(value) => updateSection("cooperation", { durationMonths: value })} step={1} min={1} suffix="mies." disabled={signed} />
              <NumberStepper label="Okres wypowiedzenia" value={form.cooperation.noticeDays} onChange={(value) => updateSection("cooperation", { noticeDays: value })} step={5} min={0} suffix="dni" disabled={signed} />
              <label className="block">
                <span className="eos-portal-label">Sposób naliczenia prowizji</span>
                <select value={form.cooperation.commissionType} onChange={(event) => updateSection("cooperation", { commissionType: event.target.value as "PERCENT" | "FIXED" })} className={fieldClass}>
                  <option value="PERCENT">Procent ceny sprzedaży</option>
                  <option value="FIXED">Kwota stała</option>
                </select>
              </label>
              {form.cooperation.commissionType === "PERCENT" ? (
                <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-[var(--eos-border)] p-4">
                  <CommissionRateSlider
                    value={Number(String(form.cooperation.commissionValue).replace(",", ".")) || COMMISSION_RATE_DEFAULT}
                    onChange={(value) => updateSection("cooperation", { commissionValue: String(value) })}
                    offerPrice={Number(String(form.strategy.expectedPrice || "").replace(/\s/g, "").replace(",", ".")) || 0}
                  />
                </div>
              ) : (
                <NumberStepper
                  label="Prowizja"
                  value={form.cooperation.commissionValue}
                  onChange={(value) => updateSection("cooperation", { commissionValue: value })}
                  step={1000}
                  suffix="PLN"
                  disabled={signed}
                />
              )}
              <Toggle label="Podana prowizja zawiera VAT" checked={form.cooperation.commissionVatIncluded} onChange={(checked) => updateSection("cooperation", { commissionVatIncluded: checked })} />
            </div>
            <Field label="Kiedy prowizja jest należna?" value={form.cooperation.commissionDue} onChange={(value) => updateSection("cooperation", { commissionDue: value })} />
            <TextArea label="Koszty dodatkowe" value={form.cooperation.additionalCosts} onChange={(value) => updateSection("cooperation", { additionalCosts: value })} />
            <TextArea label="Zakres obowiązków agenta" value={form.cooperation.agentObligations} onChange={(value) => updateSection("cooperation", { agentObligations: value })} rows={5} />
            <TextArea label="Obowiązki klienta" value={form.cooperation.clientObligations} onChange={(value) => updateSection("cooperation", { clientObligations: value })} rows={4} />
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="eos-inset-well rounded-xl p-4">
                <p className="eos-portal-label">Dokumenty</p>
                <p className="mt-1 text-xl font-black text-[var(--eos-text)]">{checkedDocuments}/{ACQUISITION_DOCUMENTS.length}</p>
              </div>
              <div className="eos-inset-well rounded-xl p-4">
                <p className="eos-portal-label">Podgląd klienta</p>
                <p className="mt-1 text-sm font-black text-[var(--eos-text)]">{record?.clientAcknowledgedAt ? "Zapoznano" : "Oczekuje"}</p>
              </div>
              <div className="eos-inset-well rounded-xl p-4">
                <p className="eos-portal-label">Umowa</p>
                <p className="mt-1 text-sm font-black text-[var(--eos-text)]">{signed ? "Podpisana" : record?.agreementSnapshot ? "Gotowa" : "Do przygotowania"}</p>
              </div>
            </div>

            {record?.agreementSnapshot ? (
              <pre className="max-h-[30rem] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--eos-border)] bg-white p-5 text-xs leading-relaxed text-slate-800 shadow-inner">
                {record.agreementSnapshot}
              </pre>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--eos-border)] p-6 text-center">
                <FileCheck2 className="mx-auto size-8 text-emerald-500/60" />
                <p className="mt-3 text-sm font-bold text-[var(--eos-text)]">Przygotuj utrwalony dokument z danych spotkania</p>
                <button type="button" disabled={Boolean(busy)} onClick={() => void action("prepare_terms")} className={eosBtn("home", { className: "mt-4" })}>
                  {busy === "prepare_terms" ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                  Przygotuj warunki
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--eos-border)] p-4">
              <p className="flex items-center gap-2 text-sm font-black text-[var(--eos-text)]">
                <FileUp className="size-4 text-emerald-500" />
                Skan podpisanej ręcznie umowy
              </p>
              <p className="mt-1 text-xs text-[var(--eos-muted)]">
                Jeśli umowa została już podpisana na papierze, wgraj PDF lub zdjęcie. Klient zobaczy plik w swoim panelu.
              </p>
              {(form.paperContracts || []).length > 0 ? (
                <div className="mt-3 space-y-2">
                  {form.paperContracts.map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between eos-inset-well rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700"
                    >
                      {file.name}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ))}
                </div>
              ) : null}
              {!signed ? (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-wider">
                  {busy === "paper" ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
                  Wgraj skan umowy
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPaper(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-800"><ShieldAlert className="size-4" /> Kontrola wzoru umowy</p>
              <p className="mt-2 text-xs leading-relaxed text-amber-900/80">
                Podpis na ekranie jest prostym podpisem elektronicznym. Przed użyciem produkcyjnym firma powinna zatwierdzić wzór i sposób zawarcia umowy z prawnikiem lub wdrożyć kwalifikowany podpis elektroniczny.
              </p>
              <label className="mt-3 flex items-start gap-3">
                <input type="checkbox" checked={templateConfirmed} disabled={signed} onChange={(event) => setTemplateConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-emerald-500" />
                <span className="text-sm font-bold text-[var(--eos-text)]">Potwierdzam, że używam zatwierdzonego przez moją firmę wzoru i właściwego sposobu podpisu.</span>
              </label>
            </div>

            {!signed ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!record?.agreementSnapshot || Boolean(busy)} onClick={() => void action("send_preview")} className={eosBtn("secondary")}>
                    {busy === "send_preview" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Wyślij klientowi do zapoznania
                  </button>
                  {portalUrl ? <Link href={portalUrl} target="_blank" className={eosBtn("secondary")}><ExternalLink className="size-4" /> Otwórz na tablecie</Link> : null}
                </div>
                <SignaturePad onChange={setSignatureData} />
                <button
                  type="button"
                  disabled={!record?.agreementSnapshot || !templateConfirmed || !signatureData || !signerName.trim() || !signerEmail.includes("@") || Boolean(busy)}
                  onClick={() => void action("sign")}
                  className={eosBtn("home", { className: "w-full py-4 shadow-[0_14px_34px_rgba(16,185,129,0.24)]" })}
                >
                  {busy === "sign" ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                  Podpisz i wyślij kopię e-mailem
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <p className="flex items-center gap-2 font-black text-emerald-700"><BadgeCheck className="size-5" /> Oferta pozyskana — umowa zamknięta</p>
                <p className="mt-2 text-sm text-[var(--eos-text)]">{record.signerName} · {record.signedAt ? new Date(record.signedAt).toLocaleString("pl-PL") : ""}</p>
                <p className="mt-1 text-sm text-[var(--eos-muted)]">Szkic ogłoszenia nie jest publiczny. Od tej pory umowa jest tylko do podglądu.</p>
                <p className="mt-1 break-all text-[10px] text-[var(--eos-muted)]">SHA-256: {record.documentHash}</p>
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--eos-muted)]"><Mail className="size-3.5" /> {record.copyEmailSentAt ? "Kopia wysłana e-mailem" : "Kopia e-mail wymaga ponownej wysyłki"}</p>
              </div>
            )}
          </div>
        ) : null}

        {notice ? (
          <p className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${notice.includes("Błąd") || notice.includes("nie ") ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-700"}`}>
            {notice}
          </p>
        ) : null}

        {!signed ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--eos-border)] pt-5">
            <button type="button" disabled={step === 1 || Boolean(busy)} onClick={() => setStep((value) => Math.max(1, value - 1))} className={eosBtn("secondary")}>
              <ArrowLeft className="size-4" /> Wstecz
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void save(step)} className={eosBtn("secondary")}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Zapisz
            </button>
            {step < 6 ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void save(step + 1)} className={eosBtn("home", { className: "ml-auto" })}>
                Zapisz i dalej <ArrowRight className="size-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 flex items-center gap-2 border-t border-[var(--eos-border)] pt-5 text-xs font-bold text-emerald-700">
            <Check className="size-4" /> Podpisany proces pozostaje tylko do odczytu.
          </p>
        )}
      </div>
    </section>
  );
}
