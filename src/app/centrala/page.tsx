"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Users, BarChart3, ShieldAlert, LogOut, ArrowRight, Loader2, AlertTriangle, Smartphone, Power, Link2, Search, PlusCircle, ExternalLink } from "lucide-react";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import type { OtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import OfferDescriptionBody from "@/components/offer/OfferDescriptionBody";
import OtodomCreateConfirmModal from "@/components/admin/OtodomCreateConfirmModal";
import PublicationChoiceModal, {
  type PublicationCouponOption,
  type PublicationRedemption,
} from "@/components/publication/PublicationChoiceModal";

const OtodomImportLocationPreview = dynamic(
  () => import("@/components/admin/OtodomImportLocationPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-white/10 bg-black/30 min-h-[320px] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-400" size={28} />
      </div>
    ),
  },
);

export default function Centrala() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [togglingSms, setTogglingSms] = useState(false);
  const [otodomUrl, setOtodomUrl] = useState("");
  const [otodomLoading, setOtodomLoading] = useState(false);
  const [otodomError, setOtodomError] = useState("");
  const [otodomDraft, setOtodomDraft] = useState<OtodomImportDraft | null>(null);
  const [otodomPresentation, setOtodomPresentation] = useState<OtodomPresentationCopy | null>(null);
  const [otodomCreating, setOtodomCreating] = useState(false);
  const [otodomCreateMessage, setOtodomCreateMessage] = useState("");
  const [otodomCreateError, setOtodomCreateError] = useState("");
  const [otodomCreatedLinks, setOtodomCreatedLinks] = useState<{
    offerId: number;
    editUrl: string;
    publicUrl: string;
  } | null>(null);
  const [otodomConfirmOpen, setOtodomConfirmOpen] = useState(false);
  const [otodomPubOpen, setOtodomPubOpen] = useState(false);
  const [otodomPendingRedemption, setOtodomPendingRedemption] = useState<PublicationRedemption | null>(null);
  const [otodomWalletCoupons, setOtodomWalletCoupons] = useState<PublicationCouponOption[]>([]);
  const [otodomWalletPlusCredits, setOtodomWalletPlusCredits] = useState(0);
  const [otodomWalletHasPlusCredit, setOtodomWalletHasPlusCredit] = useState(false);
  const [otodomResolvedDistrict, setOtodomResolvedDistrict] = useState<string>("");
  const [otodomResolvedCity, setOtodomResolvedCity] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/user/profile', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        const role = data?.role ?? data?.user?.role;
        if (!res.ok) {
          setDebugMsg(
            data?.error ? `Błąd API: ${data.error}` : `Brak sesji (${res.status}). Zaloguj się ponownie.`
          );
        } else if (role !== 'ADMIN') {
          setDebugMsg("Odmowa dostępu. Twoja rola to: " + (role || "BRAK"));
        } else {
          setIsAdmin(true);
          fetch('/api/admin/settings', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => setSmsEnabled(d.smsEnabled))
            .catch(() => {});
        }
      } catch {
        setDebugMsg("Błąd serwera.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!otodomDraft?.lat || !otodomDraft?.lng) {
      setOtodomResolvedDistrict("");
      setOtodomResolvedCity("");
      return;
    }

    let cancelled = false;
    void fetch(
      `/api/location/reverse?lat=${encodeURIComponent(String(otodomDraft.lat))}&lng=${encodeURIComponent(String(otodomDraft.lng))}`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setOtodomResolvedCity(String(data.city || "").trim());
        setOtodomResolvedDistrict(String(data.district || "").trim());
      })
      .catch(() => {
        if (!cancelled) {
          setOtodomResolvedDistrict("");
          setOtodomResolvedCity("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [otodomDraft?.lat, otodomDraft?.lng, otodomDraft?.city]);

  
  const handleSmsToggle = async () => {
    setTogglingSms(true);
    const newState = !smsEnabled;
    try {
      await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ enable: newState }) });
      setSmsEnabled(newState);
      // Szybki restart środowiska z poziomu API żeby uaktualnił się process.env w pamięci ram
      fetch('/api/admin/settings/restart-cache', {method: 'POST'}).catch(()=>{});
    } catch(e) {}
    setTogglingSms(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleOtodomImport = async () => {
    const url = otodomUrl.trim();
    if (!url) {
      setOtodomError("Wklej link do oferty OtoDom.");
      return;
    }

    setOtodomLoading(true);
    setOtodomError("");
    setOtodomDraft(null);
    setOtodomPresentation(null);
    setOtodomCreateMessage("");
    setOtodomCreateError("");
    setOtodomCreatedLinks(null);

    try {
      const res = await fetch("/api/admin/otodom-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtodomError(data?.error || `Błąd importu (${res.status}).`);
        return;
      }
      setOtodomDraft(data.draft ?? null);
      setOtodomPresentation(data.presentation ?? null);
    } catch {
      setOtodomError("Błąd połączenia z serwerem.");
    } finally {
      setOtodomLoading(false);
    }
  };

  const loadOtodomPublicationWallet = async () => {
    const res = await fetch("/api/user/publication-wallet?locale=pl", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(String(data?.error || data?.message || "Nie udało się pobrać portfela publikacji."));
    }
    const coupons = Array.isArray(data.publicationCoupons) ? data.publicationCoupons : [];
    setOtodomWalletCoupons(coupons);
    setOtodomWalletPlusCredits(Number(data.plusCredits || 0));
    setOtodomWalletHasPlusCredit(Boolean(data.hasPlusCredit));
  };

  const handleOtodomStartCreate = async () => {
    if (!otodomDraft) return;
    try {
      await loadOtodomPublicationWallet();
      setOtodomPubOpen(true);
    } catch (e) {
      setOtodomCreateError(e instanceof Error ? e.message : "Nie udało się załadować metod płatności.");
    }
  };

  const handleOtodomCreateOffer = async () => {
    if (!otodomDraft || !otodomPendingRedemption) return;

    setOtodomCreating(true);
    setOtodomCreateError("");
    setOtodomCreateMessage("");
    setOtodomCreatedLinks(null);

    try {
      const res = await fetch("/api/admin/otodom-import/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: otodomDraft,
          rightsConfirmed: true,
          publication: otodomPendingRedemption,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.code === "ALREADY_IMPORTED" && data?.existingOfferId) {
          setOtodomCreatedLinks({
            offerId: Number(data.existingOfferId),
            editUrl: String(data.editUrl || `/edytuj-oferte/${data.existingOfferId}`),
            publicUrl: String(data.publicUrl || `/oferta/${data.existingOfferId}`),
          });
        }
        setOtodomCreateError(data?.error || `Nie udało się utworzyć oferty (${res.status}).`);
        return;
      }

      setOtodomCreateMessage(String(data?.message || "Oferta utworzona."));
      setOtodomCreatedLinks({
        offerId: Number(data.offerId),
        editUrl: String(data.editUrl || `/edytuj-oferte/${data.offerId}`),
        publicUrl: String(data.publicUrl || `/oferta/${data.offerId}`),
      });
    } catch {
      setOtodomCreateError("Błąd połączenia podczas tworzenia oferty.");
    } finally {
      setOtodomCreating(false);
      setOtodomConfirmOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="animate-spin text-red-500" size={40} />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Wczytywanie Centrali...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="text-red-500 mb-6" size={64} />
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">Brak Uprawnień</h1>
        <p className="text-gray-400 mb-8 font-mono text-xs bg-[#111] p-4 rounded-xl">{debugMsg}</p>
      </div>
    );
  }

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] p-6 pt-32 md:p-16 md:pt-40">
      <nav className="max-w-7xl mx-auto flex justify-between items-center mb-24">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert size={20} />
          </div>
          <span className="font-black text-xs uppercase tracking-[0.4em]">Centrala Dowodzenia</span>
        </div>
        <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          Wyloguj <LogOut size={16} />
        </button>
      </nav>

      <main className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-20">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">Zarząd EstateOS<span className="text-red-500">.</span></h1>
          <p className="text-gray-500 max-w-2xl font-medium leading-relaxed">
            Zalogowano pomyślnie na konto Master Admin. Masz pełen dostęp do platformy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Baza Ofert", desc: "Zarządzaj nieruchomościami.", icon: <Database size={32} />, path: "/centrala/oferty", color: "from-blue-500/20 to-blue-500/5" },
            { title: "Użytkownicy", desc: "Zarządzaj kontami.", icon: <Users size={32} />, path: "/centrala/uzytkownicy", color: "from-emerald-500/20 to-emerald-500/5" },
            { title: "Statystyki", desc: "Przeglądaj ruch.", icon: <BarChart3 size={32} />, path: "/centrala/statystyki", color: "from-purple-500/20 to-purple-500/5" }
          ].map((item, index) => (
            <motion.div
              key={item.title}
              onClick={() => window.location.href = item.path}
              className={`group relative bg-[#0a0a0a] border border-white/5 p-10 rounded-[40px] cursor-pointer hover:border-white/20 transition-all overflow-hidden shadow-xl`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="text-gray-400 group-hover:text-white transition-colors duration-500 mb-8">{item.icon}</div>
                <h3 className="text-2xl font-black mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">{item.desc}</p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 duration-300">
                  Wejdź <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* --- SYSTEM GŁÓWNY (MASTER SWITCHES) --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-16 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
              <div className="flex items-start gap-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all duration-500 ${smsEnabled ? 'bg-orange-500/10 border border-orange-500/30 text-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.2)]' : 'bg-white/5 border border-white/10 text-white/30'}`}>
                    <Smartphone size={28} />
                 </div>
                 <div>
                    <h3 className="text-xl md:text-2xl font-black mb-2 flex items-center gap-3">Weryfikacja Kont SMS <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${smsEnabled ? 'bg-orange-500/20 text-orange-500' : 'bg-white/10 text-white/50'}`}>{smsEnabled ? 'Tarcza Aktywna' : 'Tryb Dev (Pominięty)'}</span></h3>
                    <p className="text-gray-500 text-xs md:text-sm leading-relaxed max-w-xl">
                      Przełącznik wymusza fizyczną weryfikację telefonu przez bramkę <b>SMSPlanet</b> przy zakładaniu konta przez inwestorów. Dezaktywuj ten protokół wyłącznie na czas własnych testów developerskich.
                    </p>
                 </div>
              </div>

              <button 
                 onClick={handleSmsToggle} 
                 disabled={togglingSms}
                 className={`shrink-0 h-16 w-32 rounded-full p-2 flex items-center transition-all duration-500 cursor-pointer border relative ${smsEnabled ? 'bg-orange-500 border-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.4)]' : 'bg-[#111] border-white/10 hover:border-white/30'}`}
              >
                 <motion.div 
                   animate={{ x: smsEnabled ? 64 : 0 }} 
                   transition={{ type: "spring", stiffness: 400, damping: 25 }}
                   className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${smsEnabled ? 'bg-black text-orange-500' : 'bg-white/10 text-white/30'}`}
                 >
                    {togglingSms ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} strokeWidth={3} />}
                 </motion.div>
              </button>
           </div>
        </motion.div>

        {/* --- IMPORT OTODOM (Eksperyment) --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 space-y-8">
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <Link2 size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl md:text-2xl font-black mb-2 flex flex-wrap items-center gap-3">
                  Importuj z OtoDom
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400">
                    Eksperyment
                  </span>
                </h3>
                <p className="text-gray-500 text-xs md:text-sm leading-relaxed max-w-2xl">
                  Wklej publiczny link do ogłoszenia OtoDom. Centrala pobierze stronę, sparsuje dane i pokaże podgląd pól
                  do ewentualnego mapowania na EstateOS (bez zapisu oferty).
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="url"
                value={otodomUrl}
                onChange={(e) => setOtodomUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleOtodomImport();
                }}
                placeholder="https://www.otodom.pl/pl/oferta/..."
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => void handleOtodomImport()}
                disabled={otodomLoading}
                className="shrink-0 inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-black px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-xs transition-colors"
              >
                {otodomLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Analizuj
              </button>
            </div>

            {otodomError ? (
              <p className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {otodomError}
              </p>
            ) : null}

            {otodomDraft ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    ["Tytuł (EstateOS)", otodomPresentation?.title ?? otodomDraft.title],
                    ["Tytuł (OtoDom)", otodomDraft.title],
                    ["Transakcja", otodomDraft.transactionType],
                    ["Typ", otodomDraft.propertyType],
                    ["Cena", otodomDraft.price != null ? `${otodomDraft.price} PLN` : "—"],
                    ["Opłaty admin.", otodomDraft.adminFee != null ? `${otodomDraft.adminFee} PLN` : "—"],
                    ["Kaucja", otodomDraft.deposit != null ? `${otodomDraft.deposit} PLN` : "—"],
                    ["Metraż", otodomDraft.area != null ? `${otodomDraft.area} m²` : "—"],
                    ["Pokoje", otodomDraft.rooms ?? "—"],
                    ["Piętro", otodomDraft.floor != null ? `${otodomDraft.floor}${otodomDraft.totalFloors ? ` / ${otodomDraft.totalFloors}` : ""}` : "—"],
                    ["Rok budowy", otodomDraft.yearBuilt ?? "—"],
                    ["Miasto", otodomDraft.city],
                    ["Dzielnica (OtoDom)", otodomDraft.district],
                    ["Dzielnica EstateOS (GPS)", otodomResolvedDistrict || "…"],
                    ["Miasto EstateOS (GPS)", otodomResolvedCity || "…"],
                    ["Rejon", otodomDraft.neighborhood ?? "—"],
                    ["Ulica", otodomDraft.street ?? "—"],
                    ["GPS", otodomDraft.lat != null && otodomDraft.lng != null ? `${otodomDraft.lat.toFixed(5)}, ${otodomDraft.lng.toFixed(5)}` : "—"],
                    ["Zdjęcia", String(otodomDraft.imageCount)],
                    ["ID OtoDom", String(otodomDraft.externalId)],
                    ["Agencja", otodomDraft.agency?.name ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{label}</p>
                      <p className="text-sm text-white/90 break-words">{value}</p>
                    </div>
                  ))}
                </div>

                {otodomPresentation ? (
                  <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/90">
                      Podgląd opisu na EstateOS (przepisany)
                    </p>
                    <OfferDescriptionBody
                      description={otodomPresentation.descriptionHtml}
                      className="text-white/75 max-h-56 overflow-y-auto"
                    />
                  </div>
                ) : null}

                {otodomDraft.lat != null && otodomDraft.lng != null ? (
                  <OtodomImportLocationPreview
                    lat={otodomDraft.lat}
                    lng={otodomDraft.lng}
                    title={otodomDraft.title}
                    street={otodomDraft.street}
                    city={otodomResolvedCity || otodomDraft.city}
                    district={otodomResolvedDistrict || otodomDraft.district}
                    previewImageUrl={otodomDraft.imageUrls[0] ?? null}
                    showPin
                  />
                ) : (
                  <p className="text-amber-400/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    OtoDom nie podał współrzędnych — mapa podglądowa niedostępna.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
                  <button
                    type="button"
                    onClick={() => void handleOtodomStartCreate()}
                    disabled={otodomCreating}
                    className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-xs transition-colors shadow-[0_12px_32px_rgba(16,185,129,0.28)]"
                  >
                    {otodomCreating ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                    Dodaj na EstateOS
                  </button>
                  <p className="text-[11px] text-white/40 max-w-md leading-relaxed">
                    Najpierw opłacisz publikację (kupon lub kredyt Plus), potem potwierdzisz prawa do materiałów.
                    Oferta trafi do weryfikacji z zarezerwowaną publikacją — po akceptacji od razu na rynek.
                  </p>
                </div>

                {otodomCreateMessage ? (
                  <p className="text-emerald-300 text-sm font-medium bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                    {otodomCreateMessage}
                  </p>
                ) : null}

                {otodomCreateError ? (
                  <p className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {otodomCreateError}
                  </p>
                ) : null}

                {otodomCreatedLinks ? (
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={otodomCreatedLinks.editUrl}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15 transition-colors"
                    >
                      Edytuj #{otodomCreatedLinks.offerId} <ExternalLink size={14} />
                    </a>
                    <a
                      href={otodomCreatedLinks.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-xs font-bold uppercase tracking-wider text-blue-300 hover:bg-blue-500/25 transition-colors"
                    >
                      Podgląd oferty <ExternalLink size={14} />
                    </a>
                    <a
                      href="/centrala/oferty"
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                    >
                      Baza Ofert
                    </a>
                  </div>
                ) : null}

                {otodomDraft.locationWarnings.length ? (
                  <p className="text-amber-400/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    {otodomDraft.locationWarnings.join(" ")}
                  </p>
                ) : null}

                {otodomDraft.features.length ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Cechy</p>
                    <div className="flex flex-wrap gap-2">
                      {otodomDraft.features.map((feature) => (
                        <span key={feature} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {otodomDraft.descriptionText && !otodomPresentation ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Opis OtoDom (surowy)</p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto bg-black/30 border border-white/10 rounded-xl p-4">
                      {otodomDraft.descriptionText.slice(0, 1200)}
                      {otodomDraft.descriptionText.length > 1200 ? "…" : ""}
                    </p>
                  </div>
                ) : null}

                <details className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-white/50">
                    Pełny JSON draftu
                  </summary>
                  <pre className="mt-4 text-[11px] text-emerald-300/90 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(otodomDraft, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
          </div>
        </motion.div>

        <PublicationChoiceModal
          isOpen={otodomPubOpen}
          onClose={() => setOtodomPubOpen(false)}
          title="Opłata za publikację importu"
          subtitle="Import z OtoDom zużywa ten sam kredyt lub kupon co zwykłe wystawienie oferty. Po opłaceniu oferta trafi do weryfikacji z zarezerwowaną publikacją."
          coupons={otodomWalletCoupons}
          hasPlusCredit={otodomWalletHasPlusCredit}
          plusCredits={otodomWalletPlusCredits}
          onConfirm={(result) => {
            if (result.action === "cancel") {
              setOtodomPubOpen(false);
              return;
            }
            if (result.action === "buy_plus") {
              setOtodomCreateError("Kup Pakiet Plus w portfelu, a następnie ponów import.");
              setOtodomPubOpen(false);
              return;
            }
            setOtodomPendingRedemption(result.redemption);
            setOtodomPubOpen(false);
            setOtodomConfirmOpen(true);
          }}
        />

        <OtodomCreateConfirmModal
          open={otodomConfirmOpen}
          title={otodomPresentation?.title ?? otodomDraft?.title ?? "Oferta OtoDom"}
          imageCount={otodomDraft?.imageCount ?? 0}
          confirming={otodomCreating}
          onCancel={() => setOtodomConfirmOpen(false)}
          onConfirm={() => void handleOtodomCreateOffer()}
        />

        {/* SNAPSHOT ENGINE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="text-xl md:text-2xl font-black mb-4 flex items-center gap-3">
            🧠 Snapshot Engine
          </h3>

          <button
            onClick={async () => {
              await fetch("/api/admin/snapshot-create", { method: "POST" });
              location.reload();
            }}
            className="bg-green-500 hover:bg-green-400 text-black px-5 py-3 rounded-xl font-bold mb-6"
          >
            ➕ Nowy Snapshot
          </button>

          <div id="snapshots-container" className="space-y-3"></div>
        </motion.div>

      </main>
    </div>
  );
}
