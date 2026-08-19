"use client";
import DealRoom from "@/components/crm/DealRoom";
import { Check } from "lucide-react";
import { useUserMode } from '@/contexts/UserModeContext';
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ProWidget, { AppleClock } from "@/components/ProWidget";
import OpenHouseProCard from "@/components/openHouse/OpenHouseProCard";
import ReviewsModal from "@/components/ReviewsModal";
import OfferRenewalModal from "@/components/offer/OfferRenewalModal";
import OfferPrivateCommentModal from "@/components/crm/OfferPrivateCommentModal";
import EliteStatusBadges from "@/components/ui/EliteStatusBadges";
import { Briefcase, ArrowRight, ShieldCheck, ChevronLeft, ArchiveX, Calendar, Crown, Plus, Phone, CheckCircle, Loader2, Star, ChevronDown, Building2, DollarSign, Wallet, X, Radar, Send, Clock, FileText, Lock, Unlock, Activity, TrendingUp, Wifi, RefreshCcw, Sparkles, Edit2, ExternalLink, Home, Key, LayoutGrid, CalendarDays, SlidersHorizontal, MapPin, Target, MessageSquare, Users } from 'lucide-react';
import OfferFavoriteButton from '@/components/offer/OfferFavoriteButton';
import { useFavorites } from '@/hooks/useFavorites';
import AppointmentManager from "@/components/AppointmentManager";
import { canonicalizeCity, getDistrictsForCity } from "@/lib/location/locationCatalog";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import CrmRadarCalibrationModal from "@/components/crm/CrmRadarCalibrationModal";
import PlanningPresentationCalendar from "@/components/crm/PlanningPresentationCalendar";
import PresentationFlowBanner from "@/components/presentation/PresentationFlowBanner";
import { enrichAppointmentForUi } from "@/lib/crm/planningCalendar";
import { buildReviewsModalPayload, EMPTY_REVIEWS_MODAL, type ReviewsModalPayload } from "@/lib/reviewsPresentation";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";
import { resolveProfileHeadlines, isAgentOrAgencySeller } from "@/lib/sellerDisplay";
import CrmClientsWorkspace from "@/components/crm/CrmClientsWorkspace";
import CrmSectionTabBar, { type CrmSectionTabId } from "@/components/crm/CrmSectionTabBar";
import CrmLeadInbox from "@/components/crm/CrmLeadInbox";
import DelegatedOffersPanel from "@/components/crm/DelegatedOffersPanel";
import AgencyTransferModal from "@/components/crm/AgencyTransferModal";
import { type AgencyMembershipUi } from "@/components/crm/ProfileAgencyOfficeCard";
import CrmIdentityHeader from "@/components/crm/CrmIdentityHeader";
import CrmDayBrief from "@/components/crm/CrmDayBrief";
import AgencyGrowthBanner from "@/components/crm/AgencyGrowthBanner";
import PortalImportProfileGuide from "@/components/onboarding/PortalImportProfileGuide";
import type { PartnerGrowthInsight } from "@/lib/partnerGrowth";
import {
  buildLegacyRadarUpdateBody,
  buildRadarPreferencesPostBody,
  defaultWebRadarFilters,
  formatRadarSummary,
  webRadarFiltersFromPreference,
  type WebRadarFilters,
} from "@/lib/radarCalibrationWeb";
import type { RadarPreferenceDto } from "@/lib/radarPreferenceShape";
import { isInvestorProIdentity } from "@/utils/partnerIdentity";
import { resolveEliteBadges } from "@/lib/eliteStatus";
import { shapeMatchedOfferForCrm } from "@/lib/crmMatchedOffer";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { parseDealEvent } from "@/components/crm/dealRoomUtils";
import { fmtDict } from "@/i18n/crmExtendedDictionary";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";

type CrmTab = "klienci" | "radar" | "my_offers" | "offers" | "planowanie" | "transakcje";

const WowOverlay = ({
  type,
  wow,
}: {
  type: "investor" | "agency" | "plus" | "renewal";
  wow: CrmExtendedDictionary["wow"];
}) => {
  if (type === "plus") return null;

  const [step, setStep] = useState(0);
  useEffect(() => {
    setTimeout(() => setStep(1), 500);
    setTimeout(() => setStep(2), 1500);
  }, []);

  const config = {
    investor: { color: "yellow", text: wow.investorTitle, sub: wow.investorSub },
    agency: { color: "yellow", text: wow.agencyTitle, sub: wow.agencySub },
    plus: { color: "emerald", text: wow.plusTitle, sub: wow.plusSub },
    renewal: { color: "blue", text: wow.renewalTitle, sub: wow.renewalSub },
  };

  const cfg = config[type];
  const isGold = type === "investor" || type === "agency";
  const isBlue = type === "renewal";
  const glowColor = isGold ? "#facc15" : isBlue ? "#3b82f6" : "#10b981";
  const textColor = isGold ? "text-yellow-500" : isBlue ? "text-blue-500" : "text-emerald-500";
  const bgGlow = isGold ? "bg-yellow-500" : isBlue ? "bg-blue-500" : "bg-emerald-500";
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[var(--eos-bg)]/95 backdrop-blur-3xl overflow-hidden">
      <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.6, duration: 1 }} className="text-center relative">
         {step >= 2 && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 4, 0], opacity: [1, 0] }} transition={{ duration: 1.5, ease: "easeOut" }} className={`absolute inset-0 rounded-full blur-[100px] pointer-events-none z-0 ${bgGlow}`} />
         )}
         
         <div className={`w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-8 relative transition-all duration-700 z-10 ${step >= 2 ? (isGold ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-[0_0_150px_rgba(250,204,21,0.8)] scale-110' : isBlue ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_150px_rgba(59,130,246,0.8)] scale-110' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_150px_rgba(16,185,129,0.8)] scale-110') : 'bg-[#111] border border-[var(--eos-border)] shadow-[0_0_30px_rgba(255,255,255,0.05)]'}`}>
            {step >= 2 ? (
               type === 'investor' ? <Home size={80} className="text-black relative z-10" /> :
               type === 'agency' ? <Unlock size={80} className="text-black relative z-10" /> :
               type === 'renewal' ? <Activity size={80} className="text-white relative z-10" /> :
               <Sparkles size={80} className="text-black relative z-10" />
            ) : <Lock size={80} className="text-[var(--eos-subtle)] relative z-10" />}
            
            {type === 'investor' && step >= 2 && Array.from({ length: 6 }).map((_, i) => (
                <motion.div key={i} className="absolute z-20 text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }} animate={{ x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 600 - 100, scale: [0, 1.5, 0], opacity: [1, 1, 0], rotate: Math.random() * 720 }} transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}>
                    <Key size={30} />
                </motion.div>
            ))}
         </div>
         
         <motion.h1 animate={step >= 2 ? { textShadow: [`0px 0px 0px ${glowColor}`, `0px 0px 50px ${glowColor}`, `0px 0px 0px ${glowColor}`] } : {}} transition={{ duration: 2, repeat: Infinity }} className="text-5xl md:text-7xl font-black text-[var(--eos-text)] mb-4 tracking-tighter relative z-10">
            {step >= 2 ? <>{cfg.text} <span className={textColor}>{wow.confirmed}</span></> : wow.auth}
         </motion.h1>
         
         <p className={`text-sm md:text-xl font-bold uppercase tracking-widest transition-colors duration-700 relative z-10 ${step >= 2 ? textColor : 'text-[var(--eos-subtle)]'}`}>
            {step >= 2 ? cfg.sub : wow.stripeVerify}
         </p>
      </motion.div>
    </motion.div>
  );
};

interface Particle { id: number; x: number; y: number; z: number; vX: number; vY: number; vZ: number; scale: number; rotX: number; rotY: number; rotZ: number; color: string; }

const WowPlusOverlay = ({ wowPlus }: { wowPlus: CrmExtendedDictionary["wowPlus"] }) => {
  const [stage, setStage] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const reqRef = useRef<number>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 2000);
    const t3 = setTimeout(() => {
        setStage(3);
        const p: Particle[] = [];
        const colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#ffffff', '#e0f2fe'];
        for(let i=0; i<150; i++) {
           p.push({
              id: i, x: 0, y: 0, z: 0,
              vX: (Math.random() - 0.5) * 80, 
              vY: (Math.random() - 0.5) * 80, 
              vZ: Math.random() * 400 + 100,
              scale: Math.random() * 1.5 + 0.5,
              rotX: Math.random() * 360, rotY: Math.random() * 360, rotZ: Math.random() * 360,
              color: colors[Math.floor(Math.random() * colors.length)]
           });
        }
        setParticles(p);
    }, 3200);
    const t4 = setTimeout(() => setStage(4), 5000);
    const t5 = setTimeout(() => setStage(5), 8500);
    
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); if(reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, []);

  useEffect(() => {
    if (stage >= 3 && particles.length > 0) {
      const updatePhysics = () => {
        setParticles(prev => prev.map(pt => {
          const drag = stage >= 4 ? 0.90 : 0.96;
          return {
            ...pt,
            x: pt.x + pt.vX * 0.05,
            y: pt.y + pt.vY * 0.05,
            z: pt.z + pt.vZ * 0.05,
            vX: pt.vX * drag,
            vY: (pt.vY * drag) + (stage >= 4 ? 1.2 : 0),
            vZ: pt.vZ * drag,
            rotX: pt.rotX + pt.vX * 0.2,
            rotY: pt.rotY + pt.vY * 0.2,
            rotZ: pt.rotZ + pt.vZ * 0.2
          };
        }));
        reqRef.current = requestAnimationFrame(updatePhysics);
      };
      reqRef.current = requestAnimationFrame(updatePhysics);
      return () => cancelAnimationFrame(reqRef.current!);
    }
  }, [stage, particles.length]);

  return (
    <div className={`fixed inset-0 z-[999999] flex items-center justify-center bg-[#020202] overflow-hidden select-none pointer-events-none transition-opacity duration-1000 ${stage >= 5 ? "opacity-0" : "opacity-100"}`} style={{ perspective: "1200px" }}>
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.15)_0%,transparent_70%)] transition-opacity duration-3000 ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`} />
      
      <div className={`absolute transition-all duration-[3000ms] ease-in-out transform-gpu`} 
           style={{ 
             transformStyle: 'preserve-3d',
             transform: stage === 0 ? 'translateZ(-2000px) rotateX(10deg) rotateY(-20deg)' : 
                        stage === 1 ? 'translateZ(-500px) rotateX(5deg) rotateY(-10deg)' : 
                        stage >= 2 ? 'translateZ(300px) rotateX(0deg) rotateY(0deg)' : '',
             width: '40vw', height: '120vh', top: '-10vh'
           }}>
         
         <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#111] to-[#050505] border border-[var(--eos-border)] shadow-[0_0_100px_rgba(14,165,233,0.05)] overflow-hidden" style={{ transform: 'translateZ(50px)' }}>
            <div className="w-full h-full bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4vw_4vh]" />
            <div className={`absolute top-[40%] left-[50%] ml-[-2vw] mt-[-2vh] w-[4vw] h-[4vh] transition-all duration-1000 ease-in-out transform-gpu ${stage >= 2 ? 'bg-[#0ea5e9] shadow-[0_0_100px_40px_rgba(14,165,233,0.9)] rotate-x-[85deg] scale-150' : 'bg-transparent shadow-none rotate-x-0 scale-100'}`} style={{ transformOrigin: 'top' }} />
         </div>
      </div>

      <div className="absolute inset-0 z-20" style={{ transformStyle: 'preserve-3d' }}>
         {particles.map((p) => (
           <div key={p.id} className="absolute transition-opacity duration-500" 
                style={{ 
                  left: '50%', top: '40%',
                  transform: `translate3d(${p.x}vw, ${p.y}vh, ${p.z}px) rotateX(${p.rotX}deg) rotateY(${p.rotY}deg) rotateZ(${p.rotZ}deg) scale(${p.scale})`,
                  opacity: stage >= 5 ? 0 : 1,
                  textShadow: `0 0 20px ${p.color}`
                }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px currentColor)' }}>
                    <line x1="12" y1="4" x2="12" y2="20"></line><line x1="4" y1="12" x2="20" y2="12"></line>
                </svg>
           </div>
         ))}
      </div>

      <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center text-center transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${stage >= 4 ? 'opacity-100 scale-100 backdrop-blur-sm bg-black/40' : 'opacity-0 scale-110 bg-transparent'} ${stage >= 5 ? 'opacity-0' : ''}`}>
         <div className="flex flex-col items-center gap-6 p-12 relative">
            <div className="absolute inset-0 bg-[#0ea5e9]/10 blur-[100px] rounded-full" />
            <span className="text-[14px] md:text-[18px] font-black uppercase text-[#0ea5e9] tracking-[1em] mb-4 opacity-90 relative z-10" style={{ textShadow: '0 0 20px rgba(14,165,233,0.5)' }}>{wowPlus.brand}</span>
            <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 leading-none tracking-tighter relative z-10 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
              PAKIET<span className="text-[#0ea5e9] filter drop-shadow-[0_0_50px_rgba(14,165,233,1)]">+</span>
            </h1>
            <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-[#0ea5e9]/50 to-transparent my-2" />
            <h2 className="text-3xl md:text-5xl font-light text-zinc-300 leading-none tracking-[0.2em] relative z-10">{wowPlus.activated}</h2>
         </div>
      </div>
    </div>
  );
};

export default function CRMDashboard() {
  const { dict, locale } = useLocale();
  const { resolvedTheme } = useTheme();
  const c = dict.crm;
  const { favoriteOffers, refresh: refreshFavorites } = useFavorites();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [agencyMembership, setAgencyMembership] = useState<AgencyMembershipUi | null>(null);
  const [agencyGrowthInsight, setAgencyGrowthInsight] = useState<PartnerGrowthInsight | null>(null);
  const { mode, initModeFromUser } = useUserMode();

  const [managingApp, setManagingApp] = useState<any>(null);

  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [profileReviewsOpen, setProfileReviewsOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newPropDate, setNewPropDate] = useState("");
  const [newPropTime, setNewPropTime] = useState("");
  const [rescheduleStep, setRescheduleStep] = useState(1);
  

  const [reviewsData, setReviewsData] = useState<ReviewsModalPayload | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const loadMyReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch('/api/reviews', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (res.ok && !data.error && typeof data.totalReviews === 'number') {
        setReviewsData(data as ReviewsModalPayload);
      } else if (res.ok && !data.error && Array.isArray(data.reviews)) {
        setReviewsData(buildReviewsModalPayload(data.reviews));
      } else {
        setReviewsData(EMPTY_REVIEWS_MODAL);
      }
    } catch {
      setReviewsData(EMPTY_REVIEWS_MODAL);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyReviews();
  }, [loadMyReviews]);

  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [greeting, setGreeting] = useState("");
  
  const [loading, setLoading] = useState(true);

  const [radarCatalog, setRadarCatalog] = useState<{ strictCities: string[]; strictCityDistricts: Record<string, string[]> }>({
    strictCities: [],
    strictCityDistricts: {},
  });
  const [isEditRadarOpen, setIsEditRadarOpen] = useState(false);
  const [radarCalibrationDraft, setRadarCalibrationDraft] = useState<WebRadarFilters>(
    defaultWebRadarFilters("Warszawa"),
  );
  const [radarDisplayFilters, setRadarDisplayFilters] = useState<WebRadarFilters | null>(null);
  const [isSavingRadar, setIsSavingRadar] = useState(false);
  const [isRadarUpdating, setIsRadarUpdating] = useState(false);
  const loadRadarFiltersForUser = async (
    user: any,
    pref?: RadarPreferenceDto | null,
  ): Promise<WebRadarFilters> => {
    let radarPref = pref ?? user?.radarPreference ?? null;
    if (!radarPref && user?.id) {
      try {
        const res = await fetch(`/api/radar/preferences?userId=${user.id}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) radarPref = data.radarPreference ?? data.pref ?? null;
      } catch {
        // ignore
      }
    }
    const userDistricts = String(user?.searchDistricts || "")
      .split(",")
      .map((d: string) => d.trim())
      .filter(Boolean);
    const guessedCity = (() => {
      if (radarPref?.city) return canonicalizeCity(radarPref.city) || "Warszawa";
      if (!userDistricts.length) return "Warszawa";
      const strict = radarCatalog.strictCities || [];
      for (const city of strict) {
        const allowed = getDistrictsForCity(city);
        if (userDistricts.some((d: string) => allowed.includes(d))) return city;
      }
      return "Warszawa";
    })();
    return webRadarFiltersFromPreference(radarPref, user, guessedCity);
  };

  const handleSaveRadarCalibration = async (filters: WebRadarFilters) => {
    if (!currentUser?.id) return;
    setIsSavingRadar(true);
    try {
      const legacyPayload = buildLegacyRadarUpdateBody(filters);
      const prefPayload = buildRadarPreferencesPostBody(Number(currentUser.id), filters);

      const [legacyRes, prefRes] = await Promise.all([
        fetch("/api/szukaj/aktualizuj", {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(legacyPayload),
        }),
        fetch("/api/radar/preferences", {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefPayload),
        }),
      ]);

      const prefData = await prefRes.json().catch(() => ({}));
      if (!legacyRes.ok || !prefRes.ok || prefData.success === false) {
        console.error("Radar save failed", { legacyRes, prefRes, prefData });
        return;
      }

      setRadarDisplayFilters(filters);
      setIsEditRadarOpen(false);
      setIsRadarUpdating(true);
      const refreshed = await refreshCurrentUserFromBackend();
      setRadarDisplayFilters(await loadRadarFiltersForUser(refreshed, prefData.radarPreference));
      setTimeout(async () => {
        setIsRadarUpdating(false);
        if (currentUser?.id) {
          await Promise.all([fetchData(currentUser.id), fetchRadarData()]);
        }
      }, 2200);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRadar(false);
    }
  };

  const openRadarEditor = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const filters = await loadRadarFiltersForUser(currentUser);
    setRadarCalibrationDraft(filters);
    setIsEditRadarOpen(true);
  };

  const eliteBadges = currentUser ? resolveEliteBadges(currentUser) : null;
  const isInvestorPro =
    currentUser?.role === 'ADMIN' ||
    eliteBadges?.isInvestorPro === true ||
    isInvestorProIdentity(currentUser);
  const isPremium = Boolean(isInvestorPro || currentUser?.hasMarketPro || currentUser?.officePro);
  const showDualRadarPro = Boolean(eliteBadges?.isProgramPartner);
  const radarSummary = formatRadarSummary(
    radarDisplayFilters || defaultWebRadarFilters("Warszawa"),
  );

  const mockUsers = [
    { id: 'usr-s01', role: 'SELLER', firstName: 'Michał', lastName: 'Zalewski', email: 'm.zalewski@example.com', phone: '+48 500 111 222', verificationStatus: 'VERIFIED' },
    { id: 'usr-s02', role: 'SELLER', firstName: 'Karolina', lastName: 'Wójcik', email: 'k.wojcik@example.com', phone: '+48 500 222 333', verificationStatus: 'VERIFIED' },
    { id: 'usr-s03', role: 'SELLER', firstName: 'Piotr', lastName: 'Kowalczyk', email: 'p.kowalczyk@example.com', phone: '+48 500 333 444', verificationStatus: 'VERIFIED' },
    { id: 'usr-s04', role: 'SELLER', firstName: 'Agnieszka', lastName: 'Lewandowska', email: 'a.lewandowska@example.com', phone: '+48 500 444 555', verificationStatus: 'VERIFIED' },
    { id: 'usr-s05', role: 'SELLER', firstName: 'Tomasz', lastName: 'Kamiński', email: 't.kaminski@example.com', phone: '+48 500 555 666', verificationStatus: 'VERIFIED' },
    { id: 'usr-s06', role: 'SELLER', firstName: 'Magdalena', lastName: 'Zielińska', email: 'm.zielinska@example.com', phone: '+48 500 666 777', verificationStatus: 'VERIFIED' },
    { id: 'usr-s07', role: 'SELLER', firstName: 'Krzysztof', lastName: 'Szymański', email: 'k.szymanski@example.com', phone: '+48 500 777 888', verificationStatus: 'VERIFIED' },
    { id: 'usr-s08', role: 'SELLER', firstName: 'Joanna', lastName: 'Dąbrowska', email: 'j.dabrowska@example.com', phone: '+48 500 888 999', verificationStatus: 'VERIFIED' },
    { id: 'usr-s09', role: 'SELLER', firstName: 'Marek', lastName: 'Kozłowski', email: 'm.kozlowski@example.com', phone: '+48 500 999 000', verificationStatus: 'VERIFIED' },
    { id: 'usr-s10', role: 'SELLER', firstName: 'Ewa', lastName: 'Jankowska', email: 'e.jankowska@example.com', phone: '+48 500 000 111', verificationStatus: 'VERIFIED' },
    { id: 'usr-b01', role: 'BUYER', firstName: 'Robert', lastName: 'Nowak', email: 'r.nowak@invest.com', phone: '+48 600 123 456', 
      radarSettings: { location: 'Warszawa', budgetMin: 2000000, budgetMax: 10000000, minArea: 100, propertyType: 'Apartament' } },
    { id: 'usr-b02', role: 'BUYER', firstName: 'Katarzyna', lastName: 'Wiśniewska', email: 'k.wisniewska@capital.com', phone: '+48 600 234 567', 
      radarSettings: { location: 'Kraków', budgetMin: 5000000, budgetMax: 15000000, minArea: 200, propertyType: 'Willa' } },
    { id: 'usr-b03', role: 'BUYER', firstName: 'Maciej', lastName: 'Włodarczyk', email: 'm.wlodarczyk@fund.com', phone: '+48 600 345 678', 
      radarSettings: { location: 'Gdańsk', budgetMin: 1500000, budgetMax: 4000000, minArea: 60, propertyType: 'Penthouse' } },
    { id: 'usr-b04', role: 'BUYER', firstName: 'Anna', lastName: 'Czarnecka', email: 'a.czarnecka@invest.com', phone: '+48 600 456 789', 
      radarSettings: { location: 'Wrocław', budgetMin: 1000000, budgetMax: 3000000, minArea: 80, propertyType: 'Kamienica' } },
    { id: 'usr-b05', role: 'BUYER', firstName: 'Grzegorz', lastName: 'Dudek', email: 'g.dudek@capital.com', phone: '+48 600 567 890', 
      radarSettings: { location: 'Warszawa', budgetMin: 500000, budgetMax: 2000000, minArea: 40, propertyType: 'Gotowiec Inwestycyjny' } },
    { id: 'usr-b06', role: 'BUYER', firstName: 'Sylwia', lastName: 'Adamczyk', email: 's.adamczyk@fund.com', phone: '+48 600 678 901', 
      radarSettings: { location: 'Poznań', budgetMin: 1000000, budgetMax: 2500000, minArea: 70, propertyType: 'Apartament' } },
    { id: 'usr-b07', role: 'BUYER', firstName: 'Rafał', lastName: 'Kruk', email: 'r.kruk@invest.com', phone: '+48 600 789 012', 
      radarSettings: { location: 'Mazury', budgetMin: 3000000, budgetMax: 8000000, minArea: 150, propertyType: 'Rezydencja' } },
    { id: 'usr-b08', role: 'BUYER', firstName: 'Aleksandra', lastName: 'Sikora', email: 'a.sikora@capital.com', phone: '+48 600 890 123', 
      radarSettings: { location: 'Warszawa', budgetMin: 2000000, budgetMax: 5000000, minArea: 120, propertyType: 'Segment' } }
  ];

  const relationalOffers = [
    { id: 'offer-001', sellerId: 'usr-s01', title: 'Penthouse Złota 44', price: 8500000, location: 'Warszawa, Śródmieście', area: 165, rooms: 4, imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', createdAt: '2026-03-24T00:41:34.732Z', expiresAt: '2026-04-23T00:41:34.732Z' },
    { id: 'offer-002', sellerId: 'usr-s02', title: 'Nowoczesna stodoła w lesie', price: 3200000, location: 'Konstancin-Jeziorna', area: 240, rooms: 5, imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80', createdAt: '2026-03-23T10:48:14.732Z', expiresAt: '2026-03-31T00:41:34.732Z' },
    { id: 'offer-003', sellerId: 'usr-s03', title: 'Apartament z widokiem na Motławę', price: 2800000, location: 'Gdańsk, Śródmieście', area: 85, rooms: 3, imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80', createdAt: '2026-03-24T00:41:34.732Z', expiresAt: '2026-04-23T00:41:34.732Z' },
    { id: 'offer-004', sellerId: 'usr-s04', title: 'Zrewitalizowany Loft Fabryczny', price: 1950000, location: 'Łódź, Księży Młyn', area: 110, rooms: 3, imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80', createdAt: '2026-03-22T20:54:54.732Z', expiresAt: '2026-03-25T00:41:34.732Z' },
    { id: 'offer-005', sellerId: 'usr-s05', title: 'Willa z prywatnym basenem', price: 12500000, location: 'Kraków, Wola Justowska', area: 450, rooms: 8, imageUrl: 'https://images.unsplash.com/photo-1613490908592-5d3164c4c11b?w=800&q=80', createdAt: '2026-03-21T17:08:14.732Z', expiresAt: '2026-03-22T00:41:34.732Z' },
    { id: 'offer-006', sellerId: 'usr-s06', title: 'Gotowiec Inwestycyjny (3 Pakiety)', price: 1450000, location: 'Warszawa, Wola', area: 62, rooms: 3, imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80', createdAt: '2026-03-24T00:41:34.732Z', expiresAt: '2026-04-23T00:41:34.732Z' },
    { id: 'offer-007', sellerId: 'usr-s07', title: 'Rezydencja z linią brzegową', price: 6700000, location: 'Mazury, Mikołajki', area: 320, rooms: 6, imageUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80', createdAt: '2026-03-24T00:41:34.732Z', expiresAt: '2026-03-31T00:41:34.732Z' },
    { id: 'offer-008', sellerId: 'usr-s08', title: 'Smart-Home Apartament', price: 2100000, location: 'Poznań, Jeżyce', area: 95, rooms: 4, imageUrl: 'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=800&q=80', createdAt: '2026-03-23T02:28:14.732Z', expiresAt: '2026-03-25T00:41:34.732Z' },
    { id: 'offer-009', sellerId: 'usr-s09', title: 'Kamienica Premium (Top Floor)', price: 3400000, location: 'Wrocław, Stare Miasto', area: 130, rooms: 4, imageUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80', createdAt: '2026-03-24T00:41:34.732Z', expiresAt: '2026-04-23T00:41:34.732Z' },
    { id: 'offer-010', sellerId: 'usr-s10', title: 'Ekskluzywny segment z ogrodem', price: 4100000, location: 'Warszawa, Wilanów', area: 180, rooms: 5, imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', createdAt: '2026-03-22T07:01:34.732Z', expiresAt: '2026-03-31T00:41:34.732Z' }
  ];

  const [crmData, setCrmData] = useState<any>({ offers: [], contacts: [], appointments: [], bids: [], leadTransfers: [] });
  
  useEffect(() => {
     if (typeof window !== 'undefined' && crmData?.appointments) {
        const urlParams = new URLSearchParams(window.location.search);
        const appIdFromUrl = urlParams.get('appId');
        
        if (appIdFromUrl) {
           const foundApp = crmData.appointments.find((a: any) => String(a.id) === appIdFromUrl || String(a.offerId) === appIdFromUrl);
           if (foundApp) {
              setManagingApp(foundApp);
              const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
              window.history.replaceState({path: newUrl}, '', newUrl);
           }
        }
     }
  }, [crmData]);

  const [activeTab, setActiveTab] = useState<CrmTab>("radar");
  const [offerSectionFilter, setOfferSectionFilter] = useState<'ACTIVE' | 'PENDING' | 'COMPLETED'>('ACTIVE');
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [pinnedDealIds, setPinnedDealIds] = useState<number[]>([]);
  const [profileModalUser, setProfileModalUser] = useState<any>(null);
  const [profileModalLoading, setProfileModalLoading] = useState(false);
  const [profileModalData, setProfileModalData] = useState<any>(null);
  
  const [radarResults, setRadarResults] = useState<any[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [sentVipOffers, setSentVipOffers] = useState<string[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [wowType, setWowType] = useState<string | null>(null);
  const [wowPlusType, setWowPlusType] = useState<boolean>(false);
  const crmPollingRef = useRef<number | null>(null);

  const [offerToArchive, setOfferToArchive] = useState<any>(null);
  const [renewModalOffer, setRenewModalOffer] = useState<{ id: string; title?: string } | null>(null);
  const [commentModalOffer, setCommentModalOffer] = useState<{ id: number; title?: string } | null>(null);
  const [transferModalOffer, setTransferModalOffer] = useState<{ id: number; title?: string } | null>(null);

  // === ESTATEOS ELITE: NIEZALEŻNY SILNIK POKOI (NIE RUSZA WYGLĄDU) ===
  const [isolatedDeals, setIsolatedDeals] = useState<any[]>([]);
  useEffect(() => {
      const loadDeals = async () => {
          try {
              const res = await fetch('/api/deals/my');
              const data = await res.json();
              if (data.success && data.deals) setIsolatedDeals(data.deals);
          } catch(e) {}
      };
      if (currentUser?.id) { loadDeals(); const i = setInterval(loadDeals, 10000); return () => clearInterval(i); }
  }, [currentUser?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('crm_pinned_deals');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPinnedDealIds(parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
      }
    } catch {
      // ignore invalid local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('crm_pinned_deals', JSON.stringify(pinnedDealIds));
  }, [pinnedDealIds]);
  // ===================================================================

  
  const handleBidResponse = async (
    e: React.MouseEvent,
    bid: { id: number | string; dealId?: number | string },
    decision: 'ACCEPT' | 'REJECT'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const dealId = Number(bid.dealId);
    const bidId = Number(bid.id);
    if (!Number.isFinite(dealId) || dealId <= 0 || !Number.isFinite(bidId) || bidId <= 0) {
      alert(c.alerts.bidUseDealRoom);
      setActiveTab('transakcje');
      return;
    }
    try {
      const res = await fetch(`/api/deals/${dealId}/bids/${bidId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        if (currentUser?.id) fetchData(currentUser.id);
        setActiveTab('transakcje');
        setSelectedDealId(dealId);
      } else {
        alert(`${c.alerts.bidError} ${data?.error || ""}`.trim());
      }
    } catch {
      alert(c.alerts.network);
    }
  };

  const handleArchiveSubmit = async () => {
    if(!offerToArchive) return;
    try {
      const res = await fetch(`/api/offers/${offerToArchive.id}/archive`, { method: 'POST' });
      if (res.ok) {
        setOfferToArchive(null);
        if (currentUser?.id) fetchData(currentUser.id); 
      } else {
        alert(c.alerts.archiveError);
      }
    } catch {
      alert(c.alerts.network);
    }
  };

  const handleDeleteOfferSubmit = async () => {
    if (!offerToArchive) return;
    try {
      const res = await fetch(`/api/offers/${offerToArchive.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOfferToArchive(null);
        if (currentUser?.id) fetchData(currentUser.id);
        if (data?.archived) {
          alert(c.alerts.deleteArchived);
        }
      } else {
        alert(data?.error || c.alerts.deleteError);
      }
    } catch {
      alert(c.alerts.network);
    }
  };

  const handleRefreshOffer = (offer: { id: string; title?: string }) => {
    setRenewModalOffer({ id: String(offer.id), title: offer.title });
  };

  const handleRenewalCompleted = () => {
    setWowType("renewal");
    if (currentUser?.id) void fetchData(currentUser.id);
    window.setTimeout(() => setWowType(null), 5500);
  };

  const handleSendVip = async (offerId: number, buyerIds: number[]) => {
    try { 
      const res = await fetch('/api/crm/radar/send', { credentials: 'include',  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ offerId, buyerIds }) }); 
      if (res.ok) setSentVipOffers(prev => [...prev, String(offerId)]); 
    } catch(e) {}
  };


  
  const fetchData = async (uid: number | string) => {
    if (!uid) return;
    try {
      const res = await fetch('/api/crm/data?userId=' + uid);
      const data = await res.json();
      if (!data.error) {
        setCrmData({ deals: data.deals || [], 
          offers: data.myOffers || data.offers || [],
          contacts: data.contacts || [],
          appointments: data.appointments || [],
          bids: data.bids || [],
          leadTransfers: data.leads || []
        });
      }
      try { const dRes = await fetch('/api/crm/deals'); if(dRes.ok) { const dData = await dRes.json(); setDeals(dData.deals || []); } } catch(e){}
    } catch(e) {}
  };

  const fetchRadarData = async () => {
    setRadarLoading(true);
    try { const res = await fetch('/api/crm/radar'); const data = await res.json(); if (!data.error) setRadarResults(data); } catch(e) {} finally { setRadarLoading(false); }
  };

  const fetchRadarCatalog = async () => {
    try {
      const res = await fetch('/api/location/districts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setRadarCatalog({
        strictCities: Array.isArray(data?.strictCities) ? data.strictCities : [],
        strictCityDistricts: data?.strictCityDistricts || {},
      });
    } catch {
      // ignore
    }
  };

  const syncRenewalAfterPayment = async (params: URLSearchParams) => {
    const offerId = params.get('renewalOfferId');
    const sessionId = params.get('session_id');
    if (!offerId) return;
    try {
      await fetch('/api/stripe/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'renewal',
          offerId,
          sessionId,
        }),
      });
    } catch {
      // ignore; polling + webhook can still catch up
    }
  };

  const refreshCurrentUserFromBackend = async () => {
    const profileRes = await fetch('/api/user/profile', { cache: 'no-store' });
    const profileData = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok || !profileData?.id) {
      throw new Error(profileData?.error || 'Nie udało się odświeżyć profilu.');
    }
    setCurrentUser(profileData);
    initModeFromUser(profileData);
    return profileData;
  };

  const initCrm = async () => {
    try {
      const authRes = await fetch('/api/auth/check');
      const authData = await authRes.json();
      
      if (!authData.loggedIn) {
        window.location.href = '/login';
        return;
      }
      
      const uData = await refreshCurrentUserFromBackend();
      await fetchRadarCatalog();
      setRadarDisplayFilters(await loadRadarFiltersForUser(uData));

      if (isAgentOrAgencySeller(uData)) {
        try {
          const meRes = await fetch('/api/agency-company/me', { credentials: 'include', cache: 'no-store' });
          const meJson = await meRes.json().catch(() => ({}));
          if (meRes.ok && meJson?.membership) {
            setAgencyMembership(meJson.membership as AgencyMembershipUi);
            if (
              meJson.membership.role === 'ADMIN' &&
              meJson.membership.status === 'ACTIVE'
            ) {
              try {
                const growthRes = await fetch('/api/agency-company/growth-insight', {
                  credentials: 'include',
                  cache: 'no-store',
                });
                const growthJson = await growthRes.json().catch(() => ({}));
                setAgencyGrowthInsight(
                  growthRes.ok && growthJson?.growthInsight
                    ? (growthJson.growthInsight as PartnerGrowthInsight)
                    : null,
                );
              } catch {
                setAgencyGrowthInsight(null);
              }
            } else {
              setAgencyGrowthInsight(null);
            }
          } else {
            setAgencyMembership(null);
            setAgencyGrowthInsight(null);
          }
        } catch {
          setAgencyMembership(null);
          setAgencyGrowthInsight(null);
        }
      } else {
        setAgencyMembership(null);
        setAgencyGrowthInsight(null);
      }

      await Promise.all([fetchData(uData.id), fetchRadarData()]);

      if (uData.isPro && !sessionStorage.getItem('pro_booted')) {
        setIsBooting(true);
        sessionStorage.setItem('pro_booted', 'true');
        const rawName = uData.firstName || uData.name || (uData.email ? uData.email.split('@')[0] : 'Inwestorze');
        const bootGreetings = dict.crm.boot.greetings;
        const randGreet = bootGreetings[Math.floor(Math.random() * bootGreetings.length)].replace("{name}", rawName);
        setGreeting(randGreet);
        setTimeout(() => setIsBooting(false), 3000);
      }
      
    } catch(err) {
       console.error(err);
    } finally {
       setLoading(false); // GWARANCJA że zdejmiemy kółko
    }
  };

  useEffect(() => {
    if (activeTab === 'offers') {
      void refreshFavorites();
    }
  }, [activeTab, refreshFavorites]);

  const isAgencyWorkspace = isAgentOrAgencySeller(currentUser);
  const isEmeraldTab = activeTab === "radar" || activeTab === "klienci";

  useEffect(() => {
    if (!currentUser) return;
    if (!isAgencyWorkspace) return;
    const sParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const t = sParams?.get("tab");
    if (t === "radar" || (!t && activeTab === "radar")) {
      setActiveTab("klienci");
    }
  }, [currentUser, isAgencyWorkspace, activeTab]);

  useEffect(() => {
    // Czytamy zakładkę z powiadomienia
    const sParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (sParams && sParams.get('tab')) {
        const t = sParams.get('tab');
        if (['klienci', 'radar', 'my_offers', 'offers', 'planowanie', 'transakcje'].includes(t as string)) {
            setActiveTab(t as CrmTab);
        }
    }
    if (sParams && sParams.get('dealId')) {
      const dealIdFromUrl = Number(sParams.get('dealId'));
      if (Number.isFinite(dealIdFromUrl) && dealIdFromUrl > 0) {
        setActiveTab('transakcje');
        setSelectedDealId(dealIdFromUrl);
      }
    }
    // Odpalamy liniowe ładowanie danych!
    initCrm();
    
    // Sprawdzamy czy był sukces płatności
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (searchParams && searchParams.get('payment_success') === 'true') {
       const plan = searchParams.get('plan_activated');
       if (!plan) {
         window.history.replaceState({}, document.title, window.location.pathname);
         return;
       }
       if (plan === 'pakiet_plus') setWowType('plus');
       else if (plan === 'agency' || plan?.startsWith('partner_')) setWowType('agency');
       else if (plan === 'renewal') setWowType('renewal');
       else setWowType('investor');
       
       setIsBooting(false);
       
       const syncPromise = plan === 'renewal'
         ? syncRenewalAfterPayment(searchParams)
         : fetch('/api/stripe/force-sync', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               plan,
               sessionId: searchParams.get('session_id'),
             }),
           }).then(async () => {
             const renewalOfferId = searchParams.get('renewalOfferId');
             if (plan === 'pakiet_plus' && renewalOfferId) {
               await fetch(`/api/offers/${renewalOfferId}/activate`, {
                 method: 'POST',
                 credentials: 'include',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   publication: { kind: 'PLUS_CREDIT', consumePlusPublication: true },
                 }),
               });
             }
           });
       syncPromise.finally(() => { initCrm(); });
       
       const animDuration = plan === 'pakiet_plus' ? 9500 : 5500;
       setTimeout(() => {
           window.history.replaceState({}, document.title, window.location.pathname);
           setWowType(null);
       }, animDuration);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (crmPollingRef.current) {
      window.clearInterval(crmPollingRef.current);
    }
    crmPollingRef.current = window.setInterval(() => {
      fetchData(currentUser.id);
    }, 10000);
    return () => {
      if (crmPollingRef.current) {
        window.clearInterval(crmPollingRef.current);
        crmPollingRef.current = null;
      }
    };
  }, [currentUser?.id]);

  const activeOffersForProTools = useMemo(
    () =>
      (crmData.offers || [])
        .filter((o: any) => String(o?.status || '').toUpperCase() === 'ACTIVE')
        .map((o: any) => ({
          id: Number(o.id),
          title: String(o.title || ''),
          city: String(o.city || ''),
          district: String(o.district || ''),
        }))
        .filter((o: { id: number }) => Number.isFinite(o.id) && o.id > 0),
    [crmData.offers],
  );

  const crmTabLabels = useMemo(
    () => ({
      klienci: { full: c.tabClients, short: isAgencyWorkspace ? "Agenci" : "Klienci" },
      radar: { full: c.tabRadar, short: "Radar" },
      my_offers: { full: c.tabMyOffers, short: "Ogłoszenia" },
      offers: { full: c.tabFavorites, short: "Ulubione" },
      planowanie: { full: c.tabPlanning, short: "Plan" },
      transakcje: { full: c.tabDeals, short: "Deale" },
    }),
    [c.tabClients, c.tabRadar, c.tabMyOffers, c.tabFavorites, c.tabPlanning, c.tabDeals, isAgencyWorkspace],
  );

  if (loading) return <div className="min-h-screen bg-[var(--eos-bg)] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  
  if (isBooting) {
    return (
        <div className="fixed inset-0 z-[999999] bg-[var(--eos-bg)] flex flex-col items-center justify-center font-sans overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#D4AF37]/5 to-emerald-500/5 rounded-full blur-[100px] opacity-50 animate-pulse"></div>
           
           <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, ease: "easeOut" }} className="relative z-10 flex flex-col items-center">
              
              <div className="mb-12 scale-150 shadow-[0_0_100px_rgba(255,255,255,0.05)] rounded-full">
                 <AppleClock isBooting={true} />
              </div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="text-center">
                 <div className="flex items-center justify-center gap-3 mb-4">
                    <Loader2 size={16} className="text-[#D4AF37] animate-spin" />
                    <span className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em]">{c.boot.initLabel}</span>
                 </div>
                 
                 <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter max-w-2xl px-4 !leading-tight">
                    {greeting.split(',').map((part, i, arr) => (
                       <span key={i}>
                          {part}
                          {i !== arr.length - 1 && <span className="text-emerald-500">,</span>}
                       </span>
                    ))}
                 </h1>
              </motion.div>
              
              <motion.div className="w-64 h-1 bg-white/10 rounded-full mt-12 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                 <motion.div className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "easeInOut" }} />
              </motion.div>
              
           </motion.div>
        </div>
    );
  }

  const personName = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
    : (currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : c.welcome));
  const accountHeadlines = (() => {
    const base = resolveProfileHeadlines(currentUser);
    const agencyCompany =
      agencyMembership?.companyName || agencyMembership?.company?.name || null;
    if (!agencyCompany) return base;
    const secondaryParts = [
      personName && personName !== agencyCompany ? personName : null,
      agencyMembership?.titleLabel || null,
    ].filter(Boolean);
    return {
      primary: agencyCompany,
      secondary: secondaryParts.length ? secondaryParts.join(' · ') : base.secondary,
    };
  })();
  const avatarSrcRaw =
    agencyMembership?.displayAvatarUrl ||
    agencyMembership?.team?.find((m) => m.isSelf)?.image ||
    currentUser?.image ||
    '';
  const avatarSrc = avatarSrcRaw
    ? (avatarSrcRaw.startsWith('http') ? avatarSrcRaw : avatarSrcRaw)
    : '';
  const avatarInitial = (personName || accountHeadlines.primary || 'U').trim().charAt(0).toUpperCase();
  const isDarkTheme = resolvedTheme !== "light";
  const verificationStatus: "verified" | "email" | "sms" =
    currentUser?.isEmailVerified && currentUser?.isVerifiedPhone
      ? "verified"
      : currentUser?.isVerifiedPhone
        ? "email"
        : "sms";
  const sortedIsolatedDeals = [...isolatedDeals].sort((a: any, b: any) => {
    const aPinned = pinnedDealIds.includes(Number(a.dealId));
    const bPinned = pinnedDealIds.includes(Number(b.dealId));
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aTs = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
    const bTs = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
    return bTs - aTs;
  });
  const formatDealLastMessage = (raw: unknown) => {
    const text = String(raw || "").trim();
    if (!text) return c.deals.msgNone;
    const event = parseDealEvent(text);
    if (event?.entity === "APPOINTMENT") {
      if (event.action === "ACCEPTED") return c.deals.msgApptAccepted;
      if (event.action === "PROPOSED") return c.deals.msgApptProposed;
      if (event.action === "DECLINED" || event.action === "REJECTED") return c.deals.msgApptDeclined;
      if (event.action === "COUNTERED") return c.deals.msgApptCountered;
      return c.deals.msgGeneric;
    }
    if (event?.entity === "BID") {
      if (event.action === "ACCEPTED") return c.deals.msgBidAccepted;
      if (event.action === "PROPOSED") return c.deals.msgBidProposed;
      if (event.action === "REJECTED" || event.action === "DECLINED") return c.deals.msgBidRejected;
      if (event.action === "COUNTERED") return c.deals.msgBidCountered;
      return c.deals.msgGeneric;
    }
    if (text.startsWith("[[DEAL_EVENT]]") || text.startsWith("[SYSTEM_BID:")) {
      return c.deals.msgGeneric;
    }
    return text;
  };

  const togglePinDeal = (dealId: number) => {
    setPinnedDealIds((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [dealId, ...prev]
    );
  };

  const goToAddOffer = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/dodaj-oferte";
  };

  const handleTabSwitch = (tab: CrmTab) => {
    if (tab === activeTab) return;
    const currentY = typeof window !== 'undefined' ? window.scrollY : 0;
    setActiveTab(tab);
    setSelectedDealId(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: currentY, left: 0, behavior: 'auto' });
    });
  };

  const openUserProfileModal = async (user: any) => {
    if (!user?.id) return;
    setProfileModalUser(user);
    setProfileModalLoading(true);
    setProfileModalData(null);
    try {
      const res = await fetch(`/api/users/${user.id}/public`);
      const data = await res.json();
      if (res.ok) setProfileModalData(data);
    } catch {
      // ignore
    } finally {
      setProfileModalLoading(false);
    }
  };

  const openCounterpartyProfile = async (user: { id?: number; name?: string; email?: string }) => {
    if (!user?.id) return;
    setViewingProfile({ ...user, profileLoading: true });
    setProfileReviewsOpen(false);
    try {
      const res = await fetch(`/api/users/${user.id}/public`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error('profile');
      const reviewsPayload = buildReviewsModalPayload(data.reviews || []);
      setViewingProfile({
        id: data.user?.id ?? user.id,
        name: data.user?.name ?? user.name,
        email: data.user?.email ?? user.email,
        image: data.user?.image,
        companyName: data.user?.companyName,
        role: data.user?.role,
        planType: data.user?.planType,
        displayName: data.user?.displayName ?? data.user?.publicName,
        buyerType: data.user?.planType,
        badges: data.user?.badges,
        reviewsData: reviewsPayload,
        publicOffers: data.offers || [],
        stats: data.stats,
        profileLoading: false,
      });
    } catch {
      setViewingProfile({
        ...user,
        reviewsData: EMPTY_REVIEWS_MODAL,
        profileLoading: false,
      });
    }
  };

  const isListingsTab = activeTab === 'my_offers';
  const isFavoritesTab = activeTab === 'offers';
  const showAddOfferTile = isListingsTab && offerSectionFilter !== 'COMPLETED';

  const baseOffersForView = isListingsTab
    ? (crmData.offers || [])
    : favoriteOffers;

  const isOfferAwaitingReview = (offer: any): boolean => {
    const status = String(offer?.status || '').toUpperCase();
    if (['PENDING', 'PENDING_APPROVAL', 'IN_REVIEW'].includes(status)) return true;
    if (offer?.awaitingModeration || offer?.pendingPublicationKind) return true;
    if (String(offer?.legalCheckStatus || '').toUpperCase() === 'PENDING') return true;
    return false;
  };

  const classifyOfferSection = (offer: any): 'ACTIVE' | 'PENDING' | 'COMPLETED' => {
    const now = new Date();
    const status = String(offer?.status || '').toUpperCase();
    const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : Number.NaN;
    const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < now.getTime();
    const isCompleted = isExpired || ['ARCHIVED', 'SOLD', 'REJECTED', 'EXPIRED', 'INACTIVE', 'PAUSED', 'CANCELLED'].includes(status);
    if (isOfferAwaitingReview(offer)) return 'PENDING';
    if (isCompleted) return 'COMPLETED';
    return 'ACTIVE';
  };

  const sortOffersBySection = (offers: any[]) => {
    const withTs = (offer: any) => {
      const createdAtMs = offer?.createdAt ? new Date(offer.createdAt).getTime() : 0;
      const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : 0;
      return { createdAtMs, expiresAtMs };
    };

    return [...offers].sort((a: any, b: any) => {
      const sectionA = classifyOfferSection(a);
      const sectionB = classifyOfferSection(b);
      const tsA = withTs(a);
      const tsB = withTs(b);

      if (sectionA === 'COMPLETED' && sectionB === 'COMPLETED') {
        return tsB.expiresAtMs - tsA.expiresAtMs;
      }
      return tsB.createdAtMs - tsA.createdAtMs;
    });
  };

  const offersBySection = {
    ACTIVE: sortOffersBySection(baseOffersForView.filter((offer: any) => classifyOfferSection(offer) === 'ACTIVE')),
    PENDING: sortOffersBySection(baseOffersForView.filter((offer: any) => classifyOfferSection(offer) === 'PENDING')),
    COMPLETED: sortOffersBySection(baseOffersForView.filter((offer: any) => classifyOfferSection(offer) === 'COMPLETED')),
  };

  const offersVisibleInSection = isFavoritesTab ? baseOffersForView : offersBySection[offerSectionFilter];
  const profileTabs: CrmTab[] = isAgencyWorkspace
    ? ["klienci", "my_offers", "offers", "planowanie", "transakcje"]
    : ["radar", "my_offers", "offers", "planowanie", "transakcje"];

  return (
    <div className="theme-aware-dashboard crm-dashboard-shell eos-page-shell min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] px-3 sm:px-6 pb-24 sm:pb-40 font-sans relative overflow-x-hidden">
      {currentUser?.id ? (
        <Suspense fallback={null}>
          <PortalImportProfileGuide profileUserId={Number(currentUser.id)} />
        </Suspense>
      ) : null}
      <AnimatePresence>
        {wowPlusType && <WowPlusOverlay wowPlus={c.wowPlus} />}
        {wowType && wowType !== "plus" && (
          <WowOverlay type={wowType as "investor" | "agency" | "renewal"} wow={c.wow} />
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        <PresentationFlowBanner variant="crm" />

        {!isAgencyWorkspace ? <DelegatedOffersPanel /> : null}
        <CrmLeadInbox
          leads={crmData.leadTransfers || []}
          isAgency={!!isAgencyWorkspace}
          currentUserId={currentUser?.id}
          onRefresh={() => {
            if (currentUser?.id) void fetchData(currentUser.id);
          }}
        />

        {currentUser &&
        (!currentUser.isEmailVerified || !currentUser.isVerifiedPhone) &&
        currentUser.role !== 'ADMIN' ? (
          <div className="mb-6 rounded-[1.75rem] border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">{c.verification.bannerTitle}</p>
              <p className="text-sm text-[var(--eos-muted)] max-w-xl">
                {!currentUser.isVerifiedPhone && !currentUser.isEmailVerified
                  ? c.verification.both
                  : !currentUser.isVerifiedPhone
                    ? c.verification.phoneOnly
                    : c.verification.emailOnly}
              </p>
            </div>
            <Link
              href="/moje-konto/weryfikacja"
              className="shrink-0 py-3 px-6 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 text-center"
            >
              Zweryfikuj teraz
            </Link>
          </div>
        ) : null}

        {isAgencyWorkspace && agencyGrowthInsight ? (
          <AgencyGrowthBanner insight={agencyGrowthInsight} compact />
        ) : null}

        <CrmIdentityHeader
          personName={personName}
          accountPrimary={accountHeadlines.primary}
          accountSecondary={accountHeadlines.secondary}
          avatarSrc={avatarSrc}
          avatarInitial={avatarInitial}
          currentUser={currentUser}
          userId={currentUser?.id}
          isDarkTheme={isDarkTheme}
          verificationStatus={verificationStatus}
          verificationLabels={{
            verifiedBadge: c.verification.verifiedBadge,
            confirmEmail: c.verification.confirmEmail,
            confirmPhone: c.verification.confirmPhone,
            seeProfile: c.seeProfile,
            reviewsNone: c.reviewsNone,
            userIdLabel: c.userIdLabel,
          }}
          reviewsData={reviewsData}
          reviewsLoading={reviewsLoading}
          onOpenReviews={() => setIsReviewsModalOpen(true)}
          membership={agencyMembership}
          isAgencyWorkspace={!!isAgencyWorkspace}
          onPasskeyRefresh={refreshCurrentUserFromBackend}
        />

        <CrmDayBrief
          personName={personName}
          onAddClient={() => {
            handleTabSwitch('klienci' as CrmTab);
            window.setTimeout(() => window.dispatchEvent(new Event('crm-open-add-client')), 50);
          }}
          onOpenClients={() => handleTabSwitch('klienci' as CrmTab)}
          onOpenPlanning={() => handleTabSwitch('planowanie' as CrmTab)}
        />

        {isPremium ? (
          <ProWidget
            currentUser={currentUser}
            activeOffers={activeOffersForProTools}
            onProToolsChanged={() => {
              if (currentUser?.id) void fetchData(currentUser.id);
            }}
          />
        ) : (
          <div className="mb-8 grid max-w-md grid-cols-1 gap-4">
            <OpenHouseProCard
              activeOffers={activeOffersForProTools}
              onChanged={() => {
                if (currentUser?.id) void fetchData(currentUser.id);
              }}
            />
          </div>
        )}

        <CrmSectionTabBar
          tabs={profileTabs as CrmSectionTabId[]}
          activeTab={activeTab as CrmSectionTabId}
          labels={crmTabLabels}
          onChange={(tab) => handleTabSwitch(tab as CrmTab)}
        />

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
        <motion.div
          className={`bg-[#111] border rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 md:p-12 mb-8 flex flex-col md:flex-row items-center gap-5 sm:gap-8 relative overflow-hidden transition-colors duration-700
            ${isEmeraldTab ? 'border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.05)]' :
              activeTab === 'planowanie' ? 'border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.05)]' :
              'border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.05)]'
            }`}
        >
          <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-colors duration-700
            ${isEmeraldTab ? 'bg-emerald-500/10' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'bg-blue-500/10' :
              activeTab === 'planowanie' ? 'bg-purple-500/10' :
              'bg-yellow-500/10'
            }`}></div>

          <div className={`relative w-20 h-20 sm:w-24 sm:h-24 bg-black/50 border rounded-full flex items-center justify-center shrink-0 transition-colors duration-700
            ${isEmeraldTab ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' :
              activeTab === 'planowanie' ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' :
              'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]'
            }`}>
              
             {activeTab === 'klienci' && (
               <div className="relative w-full h-full flex items-center justify-center">
                 <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(16,185,129,0.25)] bg-gradient-to-tr from-emerald-950/40 to-transparent" />
                 <Users size={38} className="relative z-10 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" strokeWidth={1.5} />
                 <motion.div animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-t-emerald-500/40 border-b-emerald-500/10 rounded-full" />
               </div>
             )}

             {activeTab === 'radar' && (
  showDualRadarPro ? (
  <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full perspective-1000">
    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(16,185,129,0.25),inset_0_0_24px_rgba(251,146,60,0.15)] bg-gradient-to-tr from-emerald-950/35 via-black/40 to-amber-950/35" />
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full">
      <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_72%,rgba(16,185,129,0.55)_100%)]" />
      <div className="absolute top-0 right-1/2 w-[2px] h-1/2 bg-emerald-300 shadow-[0_0_12px_2px_rgba(16,185,129,1)] origin-bottom" />
    </motion.div>
    <motion.div animate={{ rotate: -360 }} transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }} className="absolute inset-3 rounded-full">
      <div className="w-full h-full bg-[conic-gradient(from_180deg,transparent_72%,rgba(251,146,60,0.5)_100%)]" />
      <div className="absolute bottom-0 right-1/2 w-[2px] h-1/2 bg-amber-300 shadow-[0_0_12px_2px_rgba(251,146,60,0.95)] origin-top" />
    </motion.div>
    <div className="relative z-10 flex items-center shrink-0" style={{ marginLeft: -2 }}>
      <Radar size={28} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.85)] -mr-2" strokeWidth={1.5} />
      <Radar size={28} className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.85)]" strokeWidth={1.5} />
    </div>
    <motion.div animate={{ rotate: -360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} className="absolute inset-1 border border-emerald-500/25 border-dashed rounded-full" />
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 11, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-t-amber-500/45 border-b-emerald-500/20 rounded-full" />
  </div>
  ) : (
  <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full perspective-1000">
    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(16,185,129,0.4)] bg-gradient-to-tr from-emerald-950/40 to-transparent" />
    <Radar size={34} className="text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)] relative z-10" strokeWidth={1.5} />
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full">
      <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_70%,rgba(16,185,129,0.6)_100%)]" />
      <div className="absolute top-0 right-1/2 w-[2px] h-1/2 bg-emerald-300 shadow-[0_0_15px_2px_rgba(16,185,129,1)] origin-bottom" />
    </motion.div>
    <motion.div animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} className="absolute inset-1 border border-emerald-500/30 border-dashed rounded-full" />
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-t-emerald-500/60 border-b-emerald-500/10 rounded-full" />
  </div>
  )
)}
             
             {(activeTab === 'offers' || activeTab === 'my_offers') && (
  <div className="relative w-full h-full flex items-center justify-center perspective-[800px]">
    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(59,130,246,0.4)] bg-gradient-to-tr from-blue-950/40 to-transparent" />
    <motion.div animate={{ y: [-3, 3, -3], rotateX: [0, 15, 0], rotateY: [-10, 10, -10] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative z-10">
      {isFavoritesTab ? 
        <Wallet size={38} className="text-blue-400 drop-shadow-[0_10px_10px_rgba(59,130,246,0.6)]" strokeWidth={1.5} /> : 
        <LayoutGrid size={38} className="text-blue-400 drop-shadow-[0_10px_10px_rgba(59,130,246,0.6)]" strokeWidth={1.5} />
      }
    </motion.div>
    <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute -inset-1 border border-blue-500/50 rounded-full" />
    <motion.div animate={{ rotate: 180 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-l-blue-500/50 border-r-blue-500/50 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
  </div>
)}
             
             
        {activeTab === 'planowanie' && (
  <div className="relative w-full h-full flex items-center justify-center perspective-1000">
    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(168,85,247,0.4)] bg-gradient-to-tr from-purple-950/40 to-transparent" />
    <motion.div animate={{ rotateY: [-5, 5, -5] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 w-12 h-12 bg-[#1a1a1a] border border-purple-500/40 rounded flex flex-col items-center pt-1 drop-shadow-[0_8px_10px_rgba(0,0,0,0.8)]">
      <div className="flex gap-1.5 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
      </div>
      <motion.div animate={{ rotateX: [0, 0, -110, -110], opacity: [1, 1, 0, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 w-full h-[70%] bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border-t border-purple-500/30 origin-top flex items-center justify-center overflow-hidden rounded-b z-20">
        <motion.svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-400 drop-shadow-[0_0_3px_rgba(168,85,247,1)]">
          <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} d="M20 6L9 17l-5-5" />
        </motion.svg>
      </motion.div>
      <div className="absolute bottom-0 w-full h-[70%] bg-[#111] border-t border-purple-900/50 rounded-b flex items-center justify-center z-10">
        <span className="text-xs text-purple-600 font-black">24</span>
      </div>
    </motion.div>
    <motion.div animate={{ x: [12, -2, 8, 16, 12], y: [-12, -2, 4, -8, -12], rotateZ: [-10, -30, -10, 10, -10] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute z-30 text-amber-400 drop-shadow-[0_5px_8px_rgba(0,0,0,0.7)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-[-45deg] fill-amber-500/30">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        <path d="m15 5 4 4"/>
      </svg>
    </motion.div>
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-t-purple-500/40 border-b-purple-500/10 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.2)]" />
  </div>
)}

             {activeTab === 'transakcje' && (
  <div className="relative w-full h-full flex items-center justify-center perspective-[800px]">
    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(234,179,8,0.4)] bg-gradient-to-tr from-yellow-950/40 to-transparent" />
    <motion.div animate={{ rotateY: [-10, 10, -10], y: [-2, 2, -2] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative z-10">
       <Briefcase size={38} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" strokeWidth={1.5} />
    </motion.div>
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border-2 border-transparent border-t-yellow-500/40 border-b-yellow-500/10 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.2)]" />
  </div>
)}
          </div>

          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-2 transition-colors">
              {activeTab === 'klienci' && (
                <>
                  {c.clientsTitle} <span className="text-emerald-500">{c.clientsTitleHighlight}</span>
                </>
              )}
              {activeTab === 'radar' && (
                showDualRadarPro ? (
                  <>
                    {c.radarTitle} <span className="text-amber-400">{c.radarTitlePro}</span>
                  </>
                ) : locale === 'en' ? (
                  <>
                    {c.radarTitle} <span className="text-emerald-500">Radar</span>
                  </>
                ) : (
                  <>
                    Radar <span className="text-emerald-500">inwestycji</span>
                  </>
                )
              )}
              {activeTab === 'my_offers' && (
                <>
                  {c.myOffersTitle} <span className="text-blue-500">{c.myOffersTitleHighlight}</span>
                </>
              )}
              {activeTab === 'offers' && (
                <>
                  {c.favoritesTitle} <span className="text-blue-500">{c.favoritesTitleHighlight}</span>
                </>
              )}
              {activeTab === 'planowanie' && (
                <>
                  {c.planningTitle} <span className="text-purple-500">{c.planningTitleHighlight}</span>
                </>
              )}
              {activeTab === 'transakcje' && (
                <>
                  {c.dealsTitle} <span className="text-amber-500">{c.dealsTitleHighlight}</span>
                </>
              )}
            </h2>
            <p className="text-[var(--eos-muted)] text-xs sm:text-sm max-w-2xl leading-relaxed">
               {activeTab === 'klienci' && c.clientsDesc}
               {activeTab === 'radar' && (showDualRadarPro ? c.radarDescPro : c.radarDesc)}
               {activeTab === 'my_offers' && c.myOffersDesc}
               {activeTab === 'offers' && c.favoritesDesc}
               {activeTab === 'planowanie' && c.planningDesc}
               {activeTab === 'transakcje' && c.dealsDesc}
            </p>
          </div>
        </motion.div>

        {activeTab === 'klienci' && <CrmClientsWorkspace />}

        {activeTab === 'radar' && (
          <div className="flex flex-col gap-8 mb-12">
            
            <>
            <div className="eos-crm-radar-panel eos-radar-widget relative w-full mb-12 p-8 md:p-10 rounded-[3rem] border border-[var(--eos-border)] bg-gradient-to-br from-[#111111] to-[#050505] shadow-[var(--eos-shadow-strong)] overflow-hidden group transition-all duration-700">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen transition-opacity duration-1000 group-hover:opacity-100 opacity-50" />
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 mix-blend-overlay pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center border-b border-[var(--eos-border)] pb-8">
                <div className="flex items-center gap-6">
                  <div className="relative flex items-center justify-center w-[4.75rem] h-[4.75rem] rounded-full bg-black border border-[var(--eos-border)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] overflow-hidden">
                     <div className="absolute inset-0 rounded-full border border-emerald-500/25 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                     {showDualRadarPro ? (
                       <>
                         <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute inset-2 rounded-full">
                           <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_75%,rgba(16,185,129,0.45)_100%)]" />
                         </motion.div>
                         <motion.div animate={{ rotate: -360 }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} className="absolute inset-5 rounded-full">
                           <div className="w-full h-full bg-[conic-gradient(from_180deg,transparent_75%,rgba(251,146,60,0.4)_100%)]" />
                         </motion.div>
                         <span className="relative z-10 flex items-center -space-x-2">
                           <Radar size={26} className="text-emerald-400 shrink-0" strokeWidth={1} />
                           <Radar size={26} className="text-amber-400 shrink-0" strokeWidth={1} />
                         </span>
                       </>
                     ) : (
                       <Radar size={28} className="relative z-10 text-emerald-500 animate-[spin_4s_linear_infinite]" strokeWidth={1} />
                     )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter text-[var(--eos-text)]">
                      {showDualRadarPro ? (
                        <>
                          {c.radarTitle} <span className="text-amber-400">{c.radarTitlePro}</span>
                        </>
                      ) : (
                        c.activeScanning
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px] ${showDualRadarPro ? 'bg-amber-400 shadow-amber-500/60' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                      <span className={`text-[10px] uppercase font-bold tracking-[0.3em] ${showDualRadarPro ? 'text-amber-500/85' : 'text-emerald-500/80'}`}>
                        {showDualRadarPro
                          ? c.radarProDual
                          : radarDisplayFilters?.pushNotifications === false
                            ? c.radarOff
                            : c.radarActive}
                      </span>
                    </div>
                  </div>
                </div>

                <button onClick={openRadarEditor} className="eos-outline-btn relative flex items-center gap-2 px-5 py-3 bg-transparent border border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 text-white/80 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-pointer group">
                  <SlidersHorizontal size={14} className="text-emerald-500 transition-colors" />
                  <span>{c.calibrate}</span>
                </button>
              </div>

              <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
                 <div className="eos-radar-stat-card flex flex-col justify-center">
                    <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2">{c.location}</span>
                    <span className="eos-radar-value font-black text-sm truncate">{radarSummary.location}</span>
                 </div>
                 <div className="eos-radar-stat-card flex flex-col justify-center">
                    <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2">Przeznaczenie</span>
                    <span className="eos-radar-value font-black text-sm truncate">{radarSummary.transactionType}</span>
                 </div>
                 <div className="eos-radar-stat-card flex flex-col justify-center">
                    <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2">{c.propertyType}</span>
                    <span className="eos-radar-value font-black text-sm truncate">{radarSummary.propertyType}</span>
                 </div>
                 <div className="eos-radar-stat-card flex flex-col justify-center">
                    <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2">{c.minArea}</span>
                    <span className="eos-radar-value font-black text-sm truncate">{radarSummary.minArea}</span>
                 </div>
                 <div className="eos-radar-stat-card eos-radar-stat-card--budget flex flex-col justify-center relative overflow-hidden group/price col-span-2 md:col-span-1">
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none group-hover/price:w-full transition-all duration-700" />
                    <span className="eos-radar-budget-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2 relative z-10">{c.budget}</span>
                    <span className="eos-radar-value text-emerald-600 dark:text-emerald-400 font-black text-sm truncate relative z-10">{radarSummary.maxBudget}</span>
                 </div>
              </div>
              
              <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
                <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold">{c.matchThreshold}:</span>
                <span className="eos-radar-threshold-pill rounded-xl border border-[var(--eos-border)] bg-[#161616] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  {radarSummary.threshold}
                </span>
              </div>
            </div>

            <CrmRadarCalibrationModal
              open={isEditRadarOpen}
              onClose={() => setIsEditRadarOpen(false)}
              initialFilters={radarCalibrationDraft}
              catalog={radarCatalog}
              saving={isSavingRadar}
              onSave={handleSaveRadarCalibration}
            />

            <AnimatePresence>
              {isRadarUpdating && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
                    <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, 120, 240, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-48 h-48 rounded-full border border-emerald-500/30 flex items-center justify-center shadow-[0_0_150px_rgba(16,185,129,0.2)] mb-10 relative overflow-hidden">
                       <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 animate-[ping_3s_linear_infinite]" />
                       <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent animate-[pulse_2s_linear_infinite]" />
                       <Radar size={80} className="text-emerald-500 drop-shadow-[0_0_20px_#10b981]" strokeWidth={1} />
                    </motion.div>
                    <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-4xl md:text-7xl font-black text-white tracking-tighter text-center">
                       {c.radar.recalibratingTitle}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-emerald-500 font-bold uppercase tracking-[0.5em] text-[11px] md:text-sm mt-8 animate-pulse text-center">
                       {c.radar.recalibratingSub}
                    </motion.p>
                 </motion.div>
              )}
            </AnimatePresence>
            </>

            
            {/* WYNIKI RADARU */}
            {currentUser?.matchedOffers && currentUser.matchedOffers.length > 0 ? (
              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                 {currentUser.matchedOffers.map((offer: any) => {
                   const card = shapeMatchedOfferForCrm(offer);
                   const thumb =
                     resolveOfferPrimaryImage(card) || "/placeholder.jpg";
                   const txRent = card.transactionType === "rent";
                   return (
                     <div key={offer.id} className="bg-[var(--eos-bg-elevated)] border border-emerald-500/30 rounded-[2.5rem] p-6 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)] hover:border-emerald-500 transition-all">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-black font-black px-4 py-1 rounded-bl-2xl rounded-tr-[2.5rem] text-xs z-20 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                           {c.matchLabel} {offer.matchScore || 100}%
                        </div>
                        <div className="flex gap-4 mb-4 relative z-10">
                           <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-emerald-500/30 bg-[#111]">
                              <img src={thumb} className="w-full h-full object-cover" alt={offer.title || c.offers.thumbAlt} onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }} />
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className={`self-start px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest mb-1 ${txRent ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>{txRent ? c.rent : c.sale}</span>
                              <a href={`/oferta/${offer.id}`} target="_blank" className="font-bold text-[var(--eos-text)] text-sm truncate hover:text-emerald-400 transition-colors">
                                 {offer.title}
                              </a>
                              
                              <div className="flex flex-col mt-1">
                                {txRent ? (
                                    <>
                                        <p className="font-black text-xs text-blue-400">{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL')} PLN <span className="text-[9px] text-[var(--eos-muted)]">{c.perMonth}</span></p>
                                        <p className="text-[8px] font-bold text-[var(--eos-muted)] uppercase tracking-widest mt-0.5 flex gap-1">
                                            {offer.deposit && <span>{c.radar.deposit} {offer.deposit}</span>} 
                                            {offer.rentAdminFee && <span>| {c.radar.adminFee} {offer.rentAdminFee}</span>}
                                        </p>
                                    </>
                                ) : (
                                    <p className="font-black text-xs text-emerald-500">{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL')} PLN</p>
                                )}
                              </div>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--eos-muted)] uppercase tracking-widest font-bold mb-4">
                           <span className="bg-[var(--eos-input)] px-3 py-2 rounded-xl border border-[var(--eos-border)] truncate flex items-center gap-1"><MapPin size={12}/> {offer.district || offer.city || '—'}</span>
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-[var(--eos-border)] truncate flex items-center gap-1"><Target size={12}/> {offer.area} m²</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--eos-muted)] uppercase tracking-widest font-bold mb-4">
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-[var(--eos-border)] truncate flex items-center gap-1"><Building2 size={12}/> {offer.rooms} {c.rooms}</span>
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-[var(--eos-border)] truncate flex items-center gap-1"><span className="text-emerald-500 animate-pulse">●</span> {c.statusActive}</span>
                        </div>
                        <button onClick={() => window.open(`/oferta/${offer.id}`, '_blank')} className="w-full mt-2 py-3 bg-transparent border border-emerald-500/50 text-emerald-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-black transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer">
                           {c.viewOffer}
                        </button>
                     </div>
                   );
                 })}
              </div>
            ) : ( /* Przestrzeń na zmatchowane wyniki (Pusty stan) */
            <div className={`col-span-full flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-[var(--eos-bg)] relative overflow-hidden ${showDualRadarPro ? 'border-amber-500/25' : 'border-emerald-500/20'}`}>
                <div className={`flex items-center gap-4 mb-6 relative z-10`}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                  >
                  <Radar size={48} className={showDualRadarPro ? 'text-emerald-500/25' : 'text-emerald-500/20'} />
                  </motion.div>
                  {showDualRadarPro && (
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    >
                      <Radar size={48} className="text-amber-500/25" />
                    </motion.div>
                  )}
                </div>
                <p className="text-[var(--eos-muted)] font-bold uppercase tracking-widest text-sm relative z-10 text-center px-4 max-w-lg">
                  {c.radar.emptyHint}
                </p>
                <div className="mt-6 flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75" />
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
                </div>
            </div>
            )}
    

          </div>
        )}

        {(activeTab === 'offers' || activeTab === 'my_offers') && (
          <>
          {isListingsTab && (
            <div className="mb-6">
              <div className="flex bg-[#111] border border-[var(--eos-border)] rounded-full p-1.5 shadow-inner relative w-full max-w-[560px]">
                <div
                  className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.33%-4px)] bg-[var(--eos-bg-elevated)] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    offerSectionFilter === 'ACTIVE'
                      ? 'translate-x-0'
                      : offerSectionFilter === 'PENDING'
                        ? 'translate-x-[calc(100%+4px)]'
                        : 'translate-x-[calc(200%+8px)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setOfferSectionFilter('ACTIVE')}
                  className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${
                    offerSectionFilter === 'ACTIVE' ? 'text-emerald-400' : 'text-[var(--eos-subtle)] hover:text-white/80'
                  }`}
                >
                  {fmtDict(c.offerFilter.active, { n: offersBySection.ACTIVE.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setOfferSectionFilter('PENDING')}
                  className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${
                    offerSectionFilter === 'PENDING' ? 'text-emerald-400' : 'text-[var(--eos-subtle)] hover:text-white/80'
                  }`}
                >
                  {fmtDict(c.offerFilter.pending, { n: offersBySection.PENDING.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setOfferSectionFilter('COMPLETED')}
                  className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${
                    offerSectionFilter === 'COMPLETED' ? 'text-emerald-400' : 'text-[var(--eos-subtle)] hover:text-white/80'
                  }`}
                >
                  {fmtDict(c.offerFilter.completed, { n: offersBySection.COMPLETED.length })}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(offersVisibleInSection.length === 0) ? (
              <div className="eos-surface-card col-span-full flex flex-col items-center justify-center py-24 border border-dashed border-[var(--eos-border)] rounded-[2.5rem] bg-[var(--eos-bg-elevated)] relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/5 pointer-events-none" />
                <p className="text-[var(--eos-subtle)] font-bold uppercase tracking-widest text-sm mb-8 relative z-10">
                  {isFavoritesTab
                    ? c.favoritesEmpty
                    : offerSectionFilter === 'ACTIVE'
                      ? c.offers.emptyActive
                      : offerSectionFilter === 'PENDING'
                        ? c.offers.emptyPending
                        : c.offers.emptyCompleted}
                </p>
                {isListingsTab && (
                  <motion.button
                    animate={{ scale: [1, 1.05, 1], boxShadow: ['0px 0px 0px rgba(59,130,246,0)', '0px 0px 30px rgba(59,130,246,0.3)', '0px 0px 0px rgba(59,130,246,0)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    onClick={goToAddOffer} className="relative z-10 flex items-center gap-3 px-8 py-4 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600 hover:border-blue-500 text-white rounded-full font-black uppercase tracking-wider text-sm transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.4)] cursor-pointer group hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                    <span className="text-xl leading-none text-blue-400 group-hover:text-white">+</span> {c.offers.addProperty}
                  </motion.button>
                )}
                {isFavoritesTab && (
                  <button
                    type="button"
                    onClick={() => { window.location.href = '/oferty'; }}
                    className="relative z-10 px-8 py-4 bg-white/5 border border-[var(--eos-border)] hover:bg-white/10 text-white rounded-full font-black uppercase tracking-wider text-sm transition-all duration-300 cursor-pointer"
                  >
                    {c.favoritesDiscoverMarket}
                  </button>
                )}
              </div>
            ) : (
              [...(showAddOfferTile ? [{ id: 'ADD_NEW_BTN', isDummy: true }] : []), ...offersVisibleInSection].map((offer: any) => {
                if (offer.isDummy) return (
                  <motion.button
                    type="button"
                    key="add-new-btn"
                    whileHover={{ scale: 0.98 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={goToAddOffer}
                    className="eos-surface-card bg-[var(--eos-bg-elevated)] border border-dashed border-white/25 hover:border-blue-400/80 rounded-[2.5rem] p-6 flex flex-col items-center justify-center min-h-[300px] cursor-pointer transition-colors group relative overflow-hidden shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                  >
                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors duration-500" />
                    <div className="w-16 h-16 rounded-full border border-blue-400/40 group-hover:border-blue-300 flex items-center justify-center mb-4 transition-colors shadow-[0_0_18px_rgba(59,130,246,0.25)]">
                      <Plus size={28} className="text-blue-300 group-hover:text-blue-200 transition-colors" />
                    </div>
                    <p className="text-white/75 font-bold uppercase tracking-widest text-xs group-hover:text-white transition-colors">{c.offers.addAnother}</p>
                  </motion.button>
                );
                
                const now = new Date();
                const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : Number.NaN;
                const hasValidExpiry = Number.isFinite(expiresAtMs);
                const createdAt = new Date(offer.createdAt || now);
                const status = String(offer?.status || '').toUpperCase();
                const isPending = isOfferAwaitingReview(offer);
                const isArchived = classifyOfferSection(offer) === 'COMPLETED';
                const daysLeft = hasValidExpiry
                  ? Math.max(0, Math.ceil((expiresAtMs - now.getTime()) / (1000 * 60 * 60 * 24)))
                  : null;
                const isNew = (now.getTime() - createdAt.getTime()) < (1000 * 60 * 60 * 24);
                const offerBids = (crmData?.bids || []).filter((b: any) => b.offerId === offer.id && b.status === 'PENDING');
                const offerPrimaryImage = resolveOfferPrimaryImage(offer);

                return (
                  <div key={offer.id} className={`eos-surface-card bg-[var(--eos-bg-elevated)] border rounded-[2.5rem] p-6 relative overflow-hidden transition-all duration-300 shadow-xl group ${isArchived ? 'border-red-500/20 opacity-90' : 'border-[var(--eos-border)] hover:border-emerald-500/30 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.2)] hover:-translate-y-1'}`}>
                    
                    {!isArchived && <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}

                    
                    {isFavoritesTab && !offer.isDummy && (
                      <OfferFavoriteButton
                        offerId={offer.id}
                        variant="icon"
                        size={20}
                        className="absolute top-6 right-6 z-30 shadow-[0_4px_15px_rgba(0,0,0,0.5)]"
                        onRequireAuth={() => {
                          window.location.href = `/login?redirect=${encodeURIComponent('/moje-konto/crm')}`;
                        }}
                      />
                    )}
                    
                    <div className="flex gap-4 mb-6 relative z-10">
                      <div className={`w-16 h-16 rounded-2xl overflow-hidden shrink-0 border ${isArchived ? 'border-red-500/30 grayscale' : 'border-[var(--eos-border)]'}`}>
                         {offerPrimaryImage ? (
                           <img
                             src={offerPrimaryImage}
                             alt={offer.title || c.offers.thumbAlt}
                             className="w-full h-full object-cover"
                             onError={(e) => {
                               e.currentTarget.style.display = 'none';
                               const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                               if (fallback) fallback.style.display = 'flex';
                             }}
                           />
                         ) : null}
                         <div className={`w-full h-full ${offerPrimaryImage ? 'hidden' : 'flex'} items-center justify-center bg-gradient-to-br from-[#141414] to-[#0b0b0b]`}>
                           <Building2 size={18} className={isArchived ? 'text-white/35' : 'text-emerald-300/80'} />
                         </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <Link href={`/oferta/${offer.id}`} className="font-bold text-white text-sm truncate hover:text-emerald-400 transition-colors flex items-center gap-1 group/link">
                             {offer.title} <ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 transition-opacity text-emerald-400" />
                          </Link>
                          
                          <div className="shrink-0">
                            {isArchived ? (
                              <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-red-500/20">{c.offers.badgeExpired}</span>
                            ) : isPending ? (
                              <span className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse">{c.offers.badgeInReview}</span>
                            ) : isNew ? (
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)] animate-pulse">{c.offers.badgeNew}</span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">{c.offers.badgeActive}</span>
                            )}
                          </div>
                        </div>
                        
                          
                          <span className={`self-start px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border mb-2 ${offer.transactionType === 'rent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>{offer.transactionType === 'rent' ? c.rent : c.sale}</span>
                          <div className="flex flex-col mt-0.5">
                            {offer.transactionType === 'rent' ? (
                              <>
                                <p className={`font-black text-xs ${isArchived ? 'text-[var(--eos-subtle)]' : 'text-blue-400'}`}>{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN <span className="text-[9px] text-[var(--eos-subtle)]">/ miesiąc</span></p>
                                {!isArchived && (
                                  <div className="flex flex-col gap-0.5 mt-1 text-[8px] font-bold text-[var(--eos-subtle)] uppercase tracking-widest">
                                    {offer.deposit && <span>{c.radar.deposit} <span className="text-white/70">{offer.deposit} PLN</span></span>}
                                    {offer.rentAdminFee && <span>Czynsz adm: <span className="text-white/70">{offer.rentAdminFee} PLN</span></span>}
                                    {offer.petsAllowed && <span className="text-emerald-500/80">Zwierzęta akceptowane</span>}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className={`font-black text-xs ${isArchived ? 'text-[var(--eos-subtle)]' : 'text-emerald-500'}`}>{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN</p>
                            )}
                          </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-4 text-center border mb-6 relative overflow-hidden transition-colors duration-300 ${isArchived ? 'bg-black border-red-500/10' : 'bg-[#111] border-[var(--eos-border)] group-hover:border-emerald-500/20 group-hover:bg-[#111]/80'}`}>
                      <p className="text-[10px] text-[var(--eos-subtle)] font-bold uppercase tracking-widest mb-1">{c.offers.reach}</p>
                      <p className={`text-3xl font-black ${isArchived ? 'text-[var(--eos-subtle)]' : 'text-white'}`}>{offer.views || 0}</p>
                    </div>

                    
                    {/* MODUŁ NEGOCJACJI (BIDS) */}
                    {offerBids.length > 0 && isListingsTab && !isArchived && (
                        <div className="mb-6 bg-gradient-to-br from-amber-500/10 to-amber-700/5 border border-amber-500/30 rounded-[1.5rem] p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none"></div>
                            <h4 className="text-[10px] uppercase tracking-widest font-black text-amber-500 mb-3 flex items-center gap-2"><DollarSign size={14} /> {c.offers.bidsPendingTitle}</h4>
                            <div className="flex flex-col gap-3 relative z-10">
                                {offerBids.map((bid: any) => (
                                    <div key={bid.id} className="bg-[var(--eos-bg)]/60 border border-[var(--eos-border)] rounded-xl p-4 flex flex-col gap-3 backdrop-blur-md hover:border-amber-500/30 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-lg font-black text-amber-400">{Number(bid.amount).toLocaleString('pl-PL')} PLN</p>
                                                <p className="text-[9px] uppercase tracking-widest text-[var(--eos-subtle)] font-bold">{bid.financing === 'CASH' ? `💰 ${c.offers.bidCash}` : `🏦 ${c.offers.bidMortgage}`}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <button onClick={(e) => handleBidResponse(e, bid, 'ACCEPT')} className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300">{c.offers.bidAccept}</button>
                                            <button onClick={(e) => handleBidResponse(e, bid, 'REJECT')} className="py-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300">{c.offers.bidReject}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
        
                    <div className="relative z-10 flex flex-col gap-2">
                      {isArchived ? (
                        <button 
                          onClick={() => handleRefreshOffer(offer)}
                          className="group relative w-full py-4 rounded-[1.5rem] overflow-visible transition-all duration-500 flex items-center justify-center gap-3 border border-blue-500/50 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:scale-[1.04] z-10"
                        >
                          <div className="absolute inset-0 w-full h-full rounded-[1.5rem] overflow-hidden pointer-events-none" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e40af 100%)" }}>
                            <div className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-30deg] pointer-events-none group-hover:animate-[luxurySweep_1.5s_ease-in-out_infinite]" style={{ left: '-100%' }} />
                          </div>
                          <RefreshCcw className="text-white relative z-10 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] group-hover:rotate-180" size={18} />
                          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                            {c.offers.renewCta}
                          </span>
                        </button>
                      ) : (
                        <div className="w-full py-4 rounded-[1.5rem] bg-white/5 border border-[var(--eos-border)] text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)] flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className={isPending ? 'text-yellow-500' : (daysLeft != null && daysLeft <= 5 ? 'text-yellow-500' : 'text-emerald-500')} /> 
                            <div className="flex flex-col text-left">
                              {isPending ? (
                                <>
                                  <span className="block text-[var(--eos-muted)] text-[8px]">{c.offers.pubStatus}</span>
                                  <span className="block font-black text-xs text-yellow-500">{c.offers.pubAwaiting}</span>
                                </>
                              ) : hasValidExpiry ? (
                                <>
                                  <span className="block text-[var(--eos-muted)] text-[8px]">{c.offers.pubValidUntil} {new Date(expiresAtMs).toLocaleDateString('pl-PL')}</span>
                                  <span className={`block font-black text-xs ${daysLeft != null && daysLeft <= 5 ? 'text-yellow-500' : 'text-emerald-500'}`}>{c.offers.pubDaysLeft.replace('{n}', String(daysLeft ?? 0))}</span>
                                </>
                              ) : (
                                <>
                                  <span className="block text-[var(--eos-muted)] text-[8px]">{c.offers.pubLabel}</span>
                                  <span className="block font-black text-xs text-emerald-500">{c.offers.pubLive}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 mt-2 relative z-20">
                        <div className="relative group/edit">
                          <Link href={`/edytuj-oferte/${offer.id}`} className="w-full py-3 rounded-[1.5rem] bg-transparent border border-white/15 text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all">
                             <Edit2 size={14} className="text-emerald-300" /> {c.offers.edit}
                          </Link>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-yellow-500/30 text-[9px] text-yellow-500 px-3 py-1.5 rounded-lg opacity-0 group-hover/edit:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.2)] z-50">
                             {c.offers.editHint}
                          </div>
                        </div>
                        <button onClick={() => setOfferToArchive(offer)} className="w-full py-3 rounded-[1.5rem] bg-transparent border border-red-500/30 text-[10px] font-black uppercase tracking-widest text-red-300 flex items-center justify-center gap-2 hover:bg-red-500/12 hover:text-red-200 transition-all cursor-pointer">
                           <ArchiveX size={14} className="text-red-300" /> {c.offers.pause}
                        </button>
                      </div>
                      {isListingsTab && !isAgencyWorkspace && offerSectionFilter === 'ACTIVE' && !isArchived ? (
                        <button
                          type="button"
                          onClick={() => setTransferModalOffer({ id: Number(offer.id), title: String(offer.title || '') })}
                          className="mt-2 w-full py-3 rounded-[1.5rem] bg-transparent border border-amber-500/35 text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center justify-center gap-2 hover:bg-amber-500/12 hover:text-amber-200 transition-all cursor-pointer"
                        >
                          <Building2 size={14} className="text-amber-300" /> Oddaj do agencji
                        </button>
                      ) : null}
                      {isListingsTab ? (
                        <button
                          type="button"
                          onClick={() => setCommentModalOffer({ id: Number(offer.id), title: String(offer.title || '') })}
                          className="mt-2 w-full py-3 rounded-[1.5rem] bg-transparent border border-blue-500/30 text-[10px] font-black uppercase tracking-widest text-blue-300 flex items-center justify-center gap-2 hover:bg-blue-500/12 hover:text-blue-200 transition-all cursor-pointer"
                        >
                          <MessageSquare size={14} className="text-blue-300" /> Komentarz
                        </button>
                      ) : null}

                    </div>
                  </div>
                )
              })
            )}
          </div>
          </>
        )}
        {/* --- TRANSAKCJE / DEAL ROOMY --- */}
        {activeTab === 'transakcje' && (
          <div className="flex flex-col gap-6">
            {selectedDealId ? (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <button
            onClick={() => setSelectedDealId(null)}
            className="mb-6 px-5 py-2.5 bg-[#111] border border-[var(--eos-border)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-white hover:border-amber-500/50 transition-all flex items-center gap-2 w-fit shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          >
            {c.deals.back}
          </button>
          <DealRoom dealId={selectedDealId} currentUserId={currentUser?.id} />
        </div>
      ) : isolatedDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[var(--eos-border)] rounded-[2.5rem] bg-[var(--eos-bg-elevated)] relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/5 pointer-events-none" />
                <p className="text-[var(--eos-subtle)] font-bold uppercase tracking-widest text-sm mb-4 relative z-10">{c.deals.emptyTitle}</p>
                <p className="text-[var(--eos-subtle)] text-xs text-center max-w-sm relative z-10">{c.deals.emptyDesc}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sortedIsolatedDeals.map((deal: any) => (
                  <div key={deal.dealId} onClick={() => setSelectedDealId(deal.dealId)} className="cursor-pointer block">
                    <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[var(--eos-border)] hover:border-amber-500/30 rounded-[2rem] p-6 transition-all duration-300 group cursor-pointer shadow-xl hover:shadow-[0_10px_30px_rgba(245,158,11,0.1)]">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex gap-4 items-center min-w-0">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[var(--eos-border)] group-hover:border-amber-500/50 transition-colors">
                            <img src={resolveOfferPrimaryImage(deal.offer) || '/placeholder.jpg'} className="w-full h-full object-cover" alt={deal.offer?.title || c.deals.fallbackTitle} />
                          </div>
                          <div className="flex flex-col justify-center min-w-0">
                            <p className="text-white font-bold text-sm leading-snug break-words">{deal.offer?.title || c.deals.fallbackTitle}</p>
                            <p className="text-emerald-500 font-black text-xs">{Number(String(deal.offer?.price || 0).replace(/\D/g,'')).toLocaleString('pl-PL')} PLN</p>
                            <p className="text-[9px] text-white/35 uppercase tracking-widest font-black mt-1">{c.deals.dealId.replace('{id}', String(deal.dealId))}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {deal.unreadCount > 0 && (
                            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              {c.deals.unread.replace('{n}', String(deal.unreadCount))}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePinDeal(Number(deal.dealId)); }}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                              pinnedDealIds.includes(Number(deal.dealId))
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-white/5 border-[var(--eos-border)] text-[var(--eos-subtle)] hover:text-white/80'
                            }`}
                          >
                            {pinnedDealIds.includes(Number(deal.dealId)) ? c.deals.pinned : c.deals.pin}
                          </button>
                        </div>
                      </div>
                      <div className="bg-black/50 rounded-xl p-4 border border-[var(--eos-border)] relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50 group-hover:bg-amber-500 transition-colors" />
                        <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest mb-1 ml-2">
                          {c.deals.lastMessage} {deal.lastMessageSenderName ? `• ${deal.lastMessageSenderName}` : ''}
                        </p>
                        <p className="text-white/70 text-xs leading-relaxed break-words ml-2">{formatDealLastMessage(deal.lastMessage)}</p>
                        <div className="mt-2 ml-2 flex items-center gap-2 text-[9px] text-[var(--eos-subtle)] uppercase tracking-widest font-black">
                          <span>{new Date(deal.lastMessageAt || deal.updatedAt || deal.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          {(deal.pendingBidCount > 0 || deal.pendingAppointmentCount > 0) && (
                            <span className="text-emerald-400">
                              {deal.pendingBidCount > 0 ? c.deals.pendingBids.replace('{n}', String(deal.pendingBidCount)) : ''}{deal.pendingBidCount > 0 && deal.pendingAppointmentCount > 0 ? ' • ' : ''}{deal.pendingAppointmentCount > 0 ? c.deals.pendingAppointments.replace('{n}', String(deal.pendingAppointmentCount)) : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {deal.otherParty?.id && (
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openUserProfileModal(deal.otherParty); }}
                            className="text-[10px] uppercase tracking-widest font-black text-blue-300 hover:text-white transition-colors flex items-center gap-2"
                          >
                            <span>{c.deals.profile.replace('{name}', deal.otherParty.name)}</span>
                            <EliteStatusBadges subject={deal.otherParty} isDark compact />
                          </button>
                          <Link
                            href={`/profil/${deal.otherParty.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] uppercase tracking-widest font-black text-[var(--eos-muted)] hover:text-white transition-colors"
                          >
                            {c.deals.openProfile}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


      
        {activeTab === 'planowanie' && currentUser?.id && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <PlanningPresentationCalendar
              appointments={crmData.appointments || []}
              contacts={crmData.contacts || []}
              currentUserId={Number(currentUser.id)}
              onManage={(app) => {
                if (String(app.type || "").toUpperCase() === "ACQUISITION" && app.clientId) {
                  setActiveTab("klienci");
                  window.dispatchEvent(new CustomEvent("crm-open-client", { detail: { clientId: app.clientId } }));
                  return;
                }
                setManagingApp(app);
              }}
              onViewProfile={(user) => void openCounterpartyProfile(user)}
            />
          </motion.div>
        )}
        </motion.div>
</div>
    
          <AnimatePresence>
            {managingApp && (() => {
               const dates = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
               const hours = [];
               for (let h = 8; h <= 20; h++) { hours.push(`${h.toString().padStart(2, '0')}:00`); if (h !== 20) hours.push(`${h.toString().padStart(2, '0')}:30`); }
               const myId = Number(currentUser?.id || 0);
               const enriched = enrichAppointmentForUi(managingApp, myId, crmData.contacts || []);
               const statusUpper = String(managingApp.status || '').toUpperCase();
               const isAccepted = statusUpper === 'ACCEPTED';
               const isPending = statusUpper === 'PENDING';
               const cp = enriched.counterpartyDisplay;
               const cpLabel = cp?.name || (cp?.email ? String(cp.email).split('@')[0] : c.planning.counterparty);
               const refreshPlanning = () => { if (currentUser?.id) void fetchData(currentUser.id); };

               return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                 <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2.5rem', width: '100%', maxWidth: '500px', boxShadow: '0 50px 100px rgba(0,0,0,1)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '140px', opacity: 0.15, pointerEvents: 'none', filter: 'blur(40px)', backgroundColor: managingApp.status === 'ACCEPTED' ? '#10b981' : '#eab308', transition: 'background-color 0.5s ease' }}></div>

                    <div style={{ padding: '32px', position: 'relative', zIndex: 10, flexShrink: 0 }}>
                       
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             {isRescheduling && rescheduleStep > 1 ? (
                                 <button onClick={(e) => { e.preventDefault(); setRescheduleStep(rescheduleStep - 1); }} style={{ width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#fff' }}>
                                    <ChevronLeft size={24} />
                                 </button>
                             ) : (
                                 <div style={{ width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: managingApp.status === 'ACCEPTED' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)', border: `1px solid ${managingApp.status === 'ACCEPTED' ? 'rgba(16,185,129,0.3)' : 'rgba(234,179,8,0.3)'}`, transition: 'all 0.5s ease' }}>
                                    <span style={{ fontSize: '24px', color: managingApp.status === 'ACCEPTED' ? '#10b981' : '#eab308' }}>{managingApp.status === 'ACCEPTED' ? '✓' : '⏱️'}</span>
                                 </div>
                             )}
                             <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', margin: 0, letterSpacing: '-0.05em' }}>
                                    {isRescheduling ? (rescheduleStep === 1 ? c.planning.stepDay : rescheduleStep === 2 ? c.planning.stepTime : c.planning.stepSend) : (isAccepted ? c.planning.confirmed : c.planning.proposed)}
                                </h3>
                                <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: isAccepted ? '#10b981' : '#D4AF37', margin: '4px 0 0 0' }}>{isRescheduling ? c.planning.stepOf.replace('{n}', String(rescheduleStep)) : enriched.offerTitle}</p>
                             </div>
                          </div>
                          <motion.button whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setManagingApp(null); setIsRescheduling(false); setRescheduleStep(1); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px', transition: 'background-color 0.2s' }}>✕</motion.button>
                       </div>

                       <AnimatePresence>
                          {!isRescheduling && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                   <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.4)' }}>{c.planning.dateTime}</span>
                                   <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>{new Date(managingApp.proposedDate).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: '16px' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                   <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{c.planning.property}</span>
                                   <div style={{ textAlign: 'right', maxWidth: '70%' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{enriched.offerTitle}</span>
                                      <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: '4px' }}>
                                        {isAccepted || enriched.offerAddress ? enriched.offerAddress || '—' : c.planning.addressHidden}
                                      </span>
                                      {enriched.offer?.apartmentNumber ? (
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', display: 'block', marginTop: '4px' }}>{c.planning.unitNo} {enriched.offer.apartmentNumber}</span>
                                      ) : null}
                                      {enriched.offerId ? (
                                        <span style={{ fontSize: '10px', fontWeight: '900', color: '#10b981', display: 'block', marginTop: '6px' }}>{c.planning.offerId.replace('{id}', String(enriched.offerId))}</span>
                                      ) : null}
                                   </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                   <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{enriched.needsMyResponse ? c.planning.proposedBy : c.planning.counterparty}</span>
                                   <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{cpLabel}</span>
                                      {cp?.email ? <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: '4px' }}>{cp.email}</span> : null}
                                   </div>
                                </div>
                             </motion.div>
                          )}
                       </AnimatePresence>
                    </div>

                    <div className="custom-scrollbar" style={{ padding: '0 32px 32px 32px', overflowY: 'auto', flex: 1 }}>
                       <AnimatePresence mode="wait">
                          {isAccepted && !isRescheduling ? (
                             <motion.div key="accepted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <motion.button whileHover={{ scale: 1.02, backgroundColor: '#7f1d1d', borderColor: '#ef4444' }} whileTap={{ scale: 0.98 }} onClick={async () => {
    if(!confirm(c.confirms.cancelAppointment)) return;
    try {
        const res = await fetch('/api/appointments/respond', { credentials: 'include', 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: managingApp.id, status: 'DECLINED', message: 'Prezentacja odwołana przez CRM.' })
        });
        if(res.ok) {
            setManagingApp(null);
            refreshPlanning();
        } else alert(c.alerts.cancelApptError);
    } catch(err) { alert(c.alerts.network); }
}} style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ⚠️ {c.planning.cancelPresentation}
                                </motion.button>
                             </motion.div>
                          ) : enriched.waitingOnOther && !isRescheduling ? (
                             <motion.div key="waiting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', textAlign: 'center' }}>
                                <p style={{ color: '#eab308', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{c.planning.waiting}</p>
                             </motion.div>
                          ) : isPending && enriched.needsMyResponse && !isRescheduling ? (
                             <motion.div key="buttons" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', gap: '12px' }}>
                                <motion.button whileHover={{ scale: 1.03, filter: 'brightness(1.15)' }} whileTap={{ scale: 0.95 }} onClick={async (e) => {
    e.preventDefault(); e.stopPropagation();
    try {
        const res = await fetch('/api/appointments/respond', { credentials: 'include', 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: managingApp.id, status: 'ACCEPTED' })
        });
        if(res.ok) {
            const next = enrichAppointmentForUi({ ...managingApp, status: 'ACCEPTED' }, myId, crmData.contacts || []);
            setManagingApp(next);
            refreshPlanning();
        } else alert(c.alerts.saveError);
    } catch(err) { alert('Błąd połączenia z serwerem.'); }
}} style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#10b981', color: '#000', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 10px 20px rgba(16,185,129,0.3)' }}>
                                    ✓ {c.planning.confirm.toUpperCase()}
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.03, backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.2)' }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsRescheduling(true); setRescheduleStep(1); }} style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer' }}>
                                    {c.planning.reschedule.toUpperCase()}
                                </motion.button>
                             </motion.div>
                          ) : !isRescheduling ? (
                             <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 600 }}>{c.planning.noActions}</motion.div>
                          ) : (
                             <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                
                                {rescheduleStep === 1 && (
                                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                                      {dates.map((d, i) => {
                                        const isSelected = newPropDate === d.toISOString();
                                        return ( 
                                          <button key={i} onClick={(e) => { e.preventDefault(); setNewPropDate(d.toISOString()); setTimeout(() => setRescheduleStep(2), 200); }} className={`relative w-full aspect-square rounded-[1.2rem] border flex flex-col items-center justify-center transition-all duration-300 group ${isSelected ? 'bg-[var(--eos-bg-elevated)] border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-[var(--eos-border)] hover:border-white/20 hover:bg-white/5'}`}>
                                            <span className={`text-[9px] font-black uppercase mb-1 tracking-widest ${isSelected ? 'text-emerald-500/80' : 'text-[var(--eos-subtle)]'}`}>{d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}</span>
                                            <span className={`text-xl font-black ${isSelected ? 'text-emerald-500' : 'text-white/90'}`}>{d.getDate()}</span>
                                            <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${isSelected ? 'text-emerald-500/80' : 'text-[var(--eos-subtle)]'}`}>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</span>
                                          </button> 
                                        )
                                      })}
                                    </div>
                                )}

                                {rescheduleStep === 2 && (
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                      {hours.map((h) => {
                                         const isSelected = newPropTime === h;
                                         return ( 
                                          <button key={h} onClick={(e) => { e.preventDefault(); setNewPropTime(h); setTimeout(() => setRescheduleStep(3), 200); }} className={`py-4 rounded-xl border text-sm font-black tracking-widest transition-all duration-300 ${isSelected ? 'bg-[var(--eos-bg-elevated)] text-emerald-500 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-[var(--eos-border)] hover:border-white/20 hover:bg-white/5 text-white/80'}`}>{h}</button> 
                                        )
                                      })}
                                    </div>
                                )}

                                {rescheduleStep === 3 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                                            <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', marginBottom: '8px' }}>{c.planning.newSlot}</p>
                                            <p style={{ color: '#10b981', fontSize: '18px', fontWeight: '900', margin: 0 }}>{new Date(newPropDate).toLocaleDateString('pl-PL')} o {newPropTime}</p>
                                        </div>
                                        <button onClick={async (e) => {
    e.preventDefault();
    const finalIso = new Date(newPropDate);
    const [h, m] = newPropTime.split(':');
    finalIso.setHours(parseInt(h), parseInt(m), 0, 0);
    const newIsoString = finalIso.toISOString();

    try {
        const res = await fetch('/api/appointments/respond', { credentials: 'include', 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: managingApp.id, status: 'COUNTER', proposedDate: newIsoString })
        });
        if(res.ok) {
            const next = enrichAppointmentForUi({ ...managingApp, status: 'PENDING', proposedDate: newIsoString }, myId, crmData.contacts || []);
            setManagingApp(next);
            setIsRescheduling(false);
            setRescheduleStep(1);
            refreshPlanning();
        } else alert(c.alerts.proposalError);
    } catch(err) { alert('Błąd połączenia z serwerem.'); }
}} className="relative overflow-hidden w-full group flex items-center justify-center gap-3 rounded-[2rem] border-2 px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-[var(--eos-bg-elevated)] hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                                            <ShieldCheck size={18} className="relative z-10 transition-colors duration-300 text-emerald-500 group-hover:text-white" /> 
                                            <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-[0.2em] transition-colors duration-300 text-emerald-500 group-hover:text-white">{c.planning.sendCounter}</span>
                                        </button>
                                    </div>
                                )}
                             </motion.div>
                          )}
                       </AnimatePresence>
                    </div>

                 </motion.div>
              </motion.div>
            );
            })()}
          </AnimatePresence>

          <AnimatePresence>
            {viewingProfile && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setViewingProfile(null)}>
                 <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 50px 100px rgba(0,0,0,1)', overflow: 'hidden', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                    
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '120px', background: 'linear-gradient(to bottom, rgba(234,179,8,0.15), transparent)' }}></div>
                    
                    <button onClick={() => setViewingProfile(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px', zIndex: 20, transition: 'background 0.2s' }}>✕</button>

                    <div className="custom-scrollbar" style={{ padding: '40px 32px 32px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                        
                        {(() => {
                          const avatarUrl = getBestUserAvatarUrl(viewingProfile);
                          return (
                            <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: '#111', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 0 30px rgba(234,179,8,0.1)', flexShrink: 0, overflow: 'hidden' }}>
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '28px', fontWeight: 900, color: 'rgba(255,255,255,0.35)' }}>
                                  {(viewingProfile.name || viewingProfile.email || '?').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {(() => {
                          const headlines = resolveProfileHeadlines(viewingProfile);
                          return (
                            <>
                              <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.05em' }}>{headlines.primary}</h3>
                              {headlines.secondary ? (
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', margin: '0 0 8px 0' }}>{headlines.secondary}</p>
                              ) : null}
                            </>
                          );
                        })()}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', padding: '4px 12px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '100px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 10px #10b981' }}></span>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#10b981', fontWeight: '900' }}>{c.profile.verified}</span>
                        </div>

                        {viewingProfile.profileLoading ? (
                          <div style={{ padding: '32px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700 }}>{c.profile.loading}</div>
                        ) : (
                        <div onClick={() => setProfileReviewsOpen(true)} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '24px', width: '100%', marginBottom: '16px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(234,179,8,0.3)'; e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                            {(() => {
                              const rd = viewingProfile.reviewsData || EMPTY_REVIEWS_MODAL;
                              const hasReviews = rd.totalReviews > 0;
                              const avg = hasReviews ? rd.averageRating : 0;
                              return (
                                <>
                            <div style={{ fontSize: '48px', fontWeight: '900', color: hasReviews ? '#eab308' : 'rgba(255,255,255,0.2)', lineHeight: '1', marginBottom: '8px', textShadow: hasReviews ? '0 0 30px rgba(234,179,8,0.3)' : 'none' }}>{hasReviews ? avg.toFixed(1) : '—'}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '10px' }}>
                                {[1,2,3,4,5].map(i => <span key={i} style={{ color: hasReviews && i <= Math.round(avg) ? '#eab308' : 'rgba(255,255,255,0.1)', fontSize: '18px' }}>★</span>)}
                            </div>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: hasReviews ? '#eab308' : 'rgba(255,255,255,0.35)', fontWeight: '900' }}>{hasReviews ? c.profile.reviewsDetail.replace('{n}', String(rd.totalReviews)) : c.profile.reviewsEmpty}</span>
                                </>
                              );
                            })()}
                        </div>
                        )}

                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <span style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: '#fff' }}>{(() => {
                                  const pt = String(viewingProfile.planType || viewingProfile.buyerType || '').toUpperCase();
                                  if (pt === 'AGENCY' || pt === 'AGENT') return c.profile.planAgency;
                                  if (pt.includes('PRO') || pt.includes('INVESTOR')) return c.profile.planPro;
                                  return c.profile.planStandard;
                                })()}</span>
                                <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontWeight: 'bold' }}>{c.profile.accountType}</span>
                            </div>
                            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <span style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: '#fff' }}>
                                    {(() => {
                                        const apps = crmData?.appointments?.filter((a:any) => String(a.buyerId) === String(viewingProfile.id) || String(a.sellerId) === String(viewingProfile.id)) || [];
                                        const resolved = apps.filter((a:any) => ['ACCEPTED', 'COMPLETED', 'CANCELED', 'DECLINED'].includes(a.status));
                                        const canceled = resolved.filter((a:any) => a.status === 'CANCELED' || a.status === 'DECLINED').length;
                                        return resolved.length > 0 ? Math.round(((resolved.length - canceled) / resolved.length) * 100) + '%' : '100%';
                                    })()}
                                </span>
                                <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontWeight: 'bold' }}>{c.profile.attendance}</span>
                            </div>
                        </div>

                        {viewingProfile.publicOffers && viewingProfile.publicOffers.length > 0 && (
                            <div style={{ marginTop: '16px', width: '100%', backgroundColor: '#111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'block', marginBottom: '12px' }}>{c.profile.activeOffers.replace('{n}', String(viewingProfile.publicOffers.length))}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {viewingProfile.publicOffers.map((o:any) => (
                                        <a key={o.id} href={`/oferta/${o.id}`} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textDecoration: 'none', color: '#fff', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)'}>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{o.title || `Oferta ID: ${o.id}`}</span>
                                            <span style={{ fontSize: '9px', color: '#10b981', fontWeight: '900', backgroundColor: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}>ID: {o.id} ↗</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                 </motion.div>
                 
                 <ReviewsModal isOpen={profileReviewsOpen} onClose={() => setProfileReviewsOpen(false)} reviewsData={viewingProfile.reviewsData || EMPTY_REVIEWS_MODAL} userName={viewingProfile.name || viewingProfile.email?.split('@')[0]} subject={viewingProfile} />

              </motion.div>
            )}
          </AnimatePresence>

      <AnimatePresence>
        {profileModalUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }} className="bg-[var(--eos-bg-elevated)] border border-[var(--eos-border)] rounded-[2rem] p-6 max-w-2xl w-full shadow-2xl relative">
              <button onClick={() => { setProfileModalUser(null); setProfileModalData(null); }} className="absolute top-4 right-4 text-[var(--eos-subtle)] hover:text-white transition-colors">
                <X size={20} />
              </button>
              {(() => {
                const headlines = resolveProfileHeadlines(profileModalData?.user || profileModalUser);
                return (
                  <>
                    <h3 className="text-xl font-black tracking-tight text-white mb-1">{headlines.primary}</h3>
                    {headlines.secondary ? (
                      <p className="text-sm font-semibold text-[var(--eos-muted)] mb-1">{headlines.secondary}</p>
                    ) : null}
                  </>
                );
              })()}
              <p className="text-[10px] uppercase tracking-widest text-[var(--eos-subtle)] font-black mb-6">ID: {profileModalUser.id}</p>
              <EliteStatusBadges subject={profileModalData?.user || profileModalUser} isDark compact className="mb-5" />

              {profileModalLoading ? (
                <div className="py-12 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
              ) : profileModalData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/5 border border-[var(--eos-border)] p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--eos-subtle)] font-black">{c.profileModal.avgRating}</p>
                      <p className="text-lg font-black text-amber-300">
                        {Array.isArray(profileModalData.reviews) && profileModalData.reviews.length
                          ? (profileModalData.reviews.reduce((a: number, r: any) => a + Number(r.rating || 0), 0) / profileModalData.reviews.length).toFixed(1)
                          : '0.0'} ★
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-[var(--eos-border)] p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--eos-subtle)] font-black">{c.profileModal.comments}</p>
                      <p className="text-lg font-black text-white">{Array.isArray(profileModalData.reviews) ? profileModalData.reviews.length : 0}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-[var(--eos-border)] p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--eos-subtle)] font-black">{c.profileModal.otherOffers}</p>
                      <p className="text-lg font-black text-emerald-400">{Array.isArray(profileModalData.offers) ? profileModalData.offers.length : 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-[var(--eos-border)] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--eos-subtle)] font-black mb-3">{c.profileModal.comments}</p>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {(profileModalData.reviews || []).slice(0, 5).map((r: any) => (
                        <div key={r.id} className="rounded-lg bg-black/40 border border-[var(--eos-border)] p-3">
                          <p className="text-xs text-amber-300 font-black">{Number(r.rating || 0)} ★</p>
                          <p className="text-xs text-white/70">{r.comment || c.profileModal.noComment}</p>
                        </div>
                      ))}
                      {(!profileModalData.reviews || profileModalData.reviews.length === 0) && <p className="text-xs text-white/35">{c.profileModal.noComments}</p>}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-[var(--eos-border)] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--eos-subtle)] font-black mb-3">{c.profileModal.otherOffers}</p>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {(profileModalData.offers || []).slice(0, 10).map((o: any) => (
                        <Link key={o.id} href={`/oferta/${o.id}`} target="_blank" className="block rounded-lg bg-black/40 border border-[var(--eos-border)] p-3 hover:border-emerald-500/30 transition-colors">
                          <p className="text-xs text-white font-bold truncate">{o.title || `Oferta #${o.id}`}</p>
                          <p className="text-[10px] text-emerald-400 font-black">{Number(String(o.price || 0).replace(/\D/g, '')).toLocaleString('pl-PL')} PLN</p>
                        </Link>
                      ))}
                      {(!profileModalData.offers || profileModalData.offers.length === 0) && <p className="text-xs text-white/35">{c.profileModal.noOffers}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--eos-subtle)] text-sm">{c.profileModal.loadFailed}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {offerToArchive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[var(--eos-bg-elevated)] border border-[var(--eos-border)] rounded-[2.5rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
              
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                 <ArchiveX size={24} className="text-red-500" />
              </div>
              
              <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">{c.archive.title}</h3>
              <p className="text-[var(--eos-muted)] text-xs mb-6 leading-relaxed">
                 {c.archive.body} <br/><strong className="text-white text-sm">{offerToArchive.title}</strong>
              </p>
              
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-8 text-left">
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-red-500">{c.archive.warningTitle}</p>
                 </div>
                 <p className="text-xs text-[var(--eos-muted)] font-medium leading-relaxed">
                   {c.archive.warningBody}
                 </p>
              </div>
              
              <div className="flex gap-3">
                 <button onClick={() => setOfferToArchive(null)} className="flex-1 py-4 rounded-[1.5rem] border border-[var(--eos-border)] text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:bg-white/5 hover:text-white transition-all cursor-pointer">{c.archive.cancel}</button>
                 <button onClick={handleArchiveSubmit} className="flex-1 py-4 rounded-[1.5rem] bg-gradient-to-r from-red-600 to-red-500 text-[10px] font-black uppercase tracking-widest text-white hover:scale-[1.02] shadow-[0_10px_20px_rgba(239,68,68,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <ArchiveX size={14} /> {c.archive.confirm}
                 </button>
              </div>
              <button onClick={handleDeleteOfferSubmit} className="mt-3 w-full py-3 rounded-[1.2rem] border border-red-500/35 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10 transition-all cursor-pointer">
                {c.archive.deletePermanent}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReviewsModal 
          isOpen={isReviewsModalOpen} 
          onClose={() => setIsReviewsModalOpen(false)} 
          reviewsData={reviewsData ?? EMPTY_REVIEWS_MODAL} 
          userName={currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : (currentUser?.name || 'Inwestor')}
          subject={currentUser}
      />

      <OfferRenewalModal
        offerId={renewModalOffer?.id ?? null}
        offerTitle={renewModalOffer?.title}
        isOpen={Boolean(renewModalOffer)}
        onClose={() => setRenewModalOffer(null)}
        onRenewed={handleRenewalCompleted}
      />
      <OfferPrivateCommentModal
        open={Boolean(commentModalOffer)}
        offerId={commentModalOffer?.id ?? null}
        offerTitle={commentModalOffer?.title}
        onClose={() => setCommentModalOffer(null)}
      />
      <AgencyTransferModal
        open={Boolean(transferModalOffer)}
        offerId={transferModalOffer?.id ?? 0}
        offerTitle={transferModalOffer?.title}
        onClose={() => setTransferModalOffer(null)}
        onSent={() => {
          if (currentUser?.id) void fetchData(currentUser.id);
        }}
      />
</div>
  );
}
