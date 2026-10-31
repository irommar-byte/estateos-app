"use client";
import DealRoom from "@/components/crm/DealRoom";
import { Check } from "lucide-react";
import { useUserMode } from '@/contexts/UserModeContext';
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ProWidget, { AppleClock } from "@/components/ProWidget";
import OpenHouseProCard from "@/components/openHouse/OpenHouseProCard";
import { useCrmLaunchOptional } from "@/components/account/CrmLaunchProvider";
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
import CrmMyOffersBoard from "@/components/crm/CrmMyOffersBoard";
import CrmProRail, { type CrmProTab } from "@/components/crm/pro/CrmProRail";
import CrmPulpit from "@/components/crm/pro/CrmPulpit";
import ContactInboxClient from "@/components/contact/ContactInboxClient";
import CrmListingsPro from "@/components/crm/pro/CrmListingsPro";
import CrmDealsPro from "@/components/crm/pro/CrmDealsPro";
import CrmSmartAgentBoard from "@/components/crm/pro/CrmSmartAgent";
import CrmTeamLog from "@/components/crm/pro/CrmTeamLog";
import CrmPlanner from "@/components/crm/pro/CrmPlanner";
import CrmAppointmentSheet from "@/components/crm/pro/CrmAppointmentSheet";
import { greeting as crmGreeting } from "@/components/crm/pro/format";
import {
  classifyListingSection,
  groupListingsBySection,
  isOfferAwaitingReview,
  sortListingsInSection,
  type ListingSection,
} from "@/lib/offers/listingSections";
import CrmLeadInbox from "@/components/crm/CrmLeadInbox";
import DelegatedOffersPanel from "@/components/crm/DelegatedOffersPanel";
import AgencyTransferModal from "@/components/crm/AgencyTransferModal";
import { type AgencyMembershipUi } from "@/components/crm/ProfileAgencyOfficeCard";
import CrmIdentityHeader from "@/components/crm/CrmIdentityHeader";
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

type CrmTab = "pulpit" | "klienci" | "wiadomosci" | "radar" | "my_offers" | "offers" | "planowanie" | "transakcje" | "smart" | "zespol";

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
  const glowColor = isGold ? "#facc15" : isBlue ? "#3b82f6" : "#a8844c";
  const textColor = isGold ? "text-yellow-500" : isBlue ? "text-blue-500" : "text-[#a8844c]";
  const bgGlow = isGold ? "bg-yellow-500" : isBlue ? "bg-blue-500" : "bg-[#a8844c]";
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 eos-z-modal-nested flex flex-col items-center justify-center bg-[var(--eos-bg)]/95 backdrop-blur-3xl overflow-hidden">
      <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.6, duration: 1 }} className="text-center relative">
         {step >= 2 && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 4, 0], opacity: [1, 0] }} transition={{ duration: 1.5, ease: "easeOut" }} className={`absolute inset-0 rounded-full blur-[100px] pointer-events-none z-0 ${bgGlow}`} />
         )}
         
         <div className={`w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-8 relative transition-all duration-700 z-10 ${step >= 2 ? (isGold ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-[0_0_150px_rgba(250,204,21,0.8)] scale-110' : isBlue ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_150px_rgba(59,130,246,0.8)] scale-110' : 'bg-gradient-to-br from-[#c9a86a] to-[#7a5a26] shadow-[0_0_150px_rgba(168,132,76,0.8)] scale-110') : 'bg-[#111] border border-[var(--eos-border)] shadow-[0_0_30px_rgba(255,255,255,0.05)]'}`}>
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
    <div className={`fixed inset-0 eos-z-modal flex items-center justify-center bg-[#020202] overflow-hidden select-none pointer-events-none transition-opacity duration-1000 ${stage >= 5 ? "opacity-0" : "opacity-100"}`} style={{ perspective: "1200px" }}>
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
  const crmLaunch = useCrmLaunchOptional();
  const deskLaunching = Boolean(crmLaunch?.isLaunching);
  const bootRepeatRef = useRef(false);
  const currentUserRef = useRef<any>(null);
  const crmHeavyLoadedRef = useRef(false);
  
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

  const [activeTab, setActiveTab] = useState<CrmTab>("pulpit");
  const [focusOfferId, setFocusOfferId] = useState<number | null>(null);
  const [offerSectionFilter, setOfferSectionFilter] = useState<ListingSection>('ACTIVE');
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
      if (!currentUser?.id) return;
      const tick = () => {
        if (document.visibilityState === 'visible') void loadDeals();
      };
      tick();
      const i = window.setInterval(tick, 45_000);
      document.addEventListener('visibilitychange', tick);
      return () => {
        window.clearInterval(i);
        document.removeEventListener('visibilitychange', tick);
      };
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
    const params = new URLSearchParams(window.location.search);
    const commentOfferId = Number(params.get('commentOfferId') || '');
    if (!Number.isFinite(commentOfferId) || commentOfferId <= 0) return;
    setCommentModalOffer({ id: commentOfferId });
    params.delete('commentOfferId');
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', next);
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
    const profileRes = await fetch('/api/user/profile?scope=radar', { cache: 'no-store' });
    const profileData = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok || !profileData?.id) {
      throw new Error(profileData?.error || 'Nie udało się odświeżyć profilu.');
    }
    setCurrentUser(profileData);
    currentUserRef.current = profileData;
    initModeFromUser(profileData);
    return profileData;
  };

  const loadAgencyContextForUser = async (uData: { id?: number | string }) => {
    if (!isAgentOrAgencySeller(uData)) {
      setAgencyMembership(null);
      setAgencyGrowthInsight(null);
      return;
    }
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
      currentUserRef.current = uData;
      const sParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const tabFromUrl = sParams?.get('tab');
      const agencyUser = isAgentOrAgencySeller(uData);
      const clientsFirst =
        tabFromUrl === 'klienci' ||
        (agencyUser && (!tabFromUrl || tabFromUrl === 'radar'));

      const fromDesk = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'desk';
      const alreadyBooted = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('pro_booted'));
      if (uData.isPro && (!alreadyBooted || fromDesk || crmLaunch?.isLaunching) && !clientsFirst) {
        bootRepeatRef.current = alreadyBooted && !fromDesk && !crmLaunch?.isLaunching;
        setIsBooting(true);
        sessionStorage.setItem('pro_booted', 'true');
        const rawName = uData.firstName || uData.name || (uData.email ? uData.email.split('@')[0] : 'Inwestorze');
        const bootGreetings = dict.crm.boot.greetings;
        const randGreet = bootGreetings[Math.floor(Math.random() * bootGreetings.length)].replace("{name}", rawName);
        setGreeting(randGreet);
      } else if (uData.isPro && clientsFirst) {
        sessionStorage.setItem('pro_booted', 'true');
      }

      if (clientsFirst) {
        if (agencyUser) {
          void loadAgencyContextForUser(uData);
        } else {
          setAgencyMembership(null);
          setAgencyGrowthInsight(null);
        }
        setLoading(false);
        return;
      }

      await fetchRadarCatalog();
      setRadarDisplayFilters(await loadRadarFiltersForUser(uData));

      if (agencyUser) {
        await loadAgencyContextForUser(uData);
      } else {
        setAgencyMembership(null);
        setAgencyGrowthInsight(null);
      }

      crmHeavyLoadedRef.current = true;
      await Promise.all([fetchData(uData.id), fetchRadarData()]);
      
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
    if (!isAgencyWorkspace) {
      if (activeTab === "pulpit") setActiveTab("radar");
      return;
    }
    const sParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const t = sParams?.get("tab");
    if (t === "radar" || (!t && activeTab === "radar")) {
      setActiveTab("pulpit");
    }
  }, [currentUser, isAgencyWorkspace, activeTab]);

  useEffect(() => {
    // Czytamy zakładkę z powiadomienia
    const sParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (sParams && sParams.get('tab')) {
        const t = sParams.get('tab');
        if (['pulpit', 'klienci', 'wiadomosci', 'radar', 'my_offers', 'offers', 'planowanie', 'transakcje', 'smart', 'zespol'].includes(t as string)) {
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
      crmPollingRef.current = null;
    }

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeTab === 'klienci' && !crmHeavyLoadedRef.current) return;
      void fetchData(currentUser.id);
    };

    if (activeTab === 'klienci' && !crmHeavyLoadedRef.current) {
      const delay = window.setTimeout(() => {
        crmHeavyLoadedRef.current = true;
        tick();
        crmPollingRef.current = window.setInterval(tick, 45_000);
      }, 8000);
      return () => window.clearTimeout(delay);
    }

    crmHeavyLoadedRef.current = true;
    tick();
    crmPollingRef.current = window.setInterval(tick, 45_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      if (crmPollingRef.current) {
        window.clearInterval(crmPollingRef.current);
        crmPollingRef.current = null;
      }
      document.removeEventListener('visibilitychange', tick);
    };
  }, [currentUser?.id, activeTab]);

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
      radar: { full: "Radar", short: "Radar" },
      my_offers: { full: c.tabMyOffers, short: "Ogłoszenia" },
      offers: { full: c.tabFavorites, short: "Ulubione" },
      planowanie: { full: c.tabPlanning, short: "Plan" },
      transakcje: { full: c.tabDeals, short: "Deale" },
    }),
    [c.tabClients, c.tabMyOffers, c.tabFavorites, c.tabPlanning, c.tabDeals, isAgencyWorkspace],
  );

  useEffect(() => {
    if (!crmLaunch?.isLaunching) return;
    if (isBooting) {
      const id = window.requestAnimationFrame(() => crmLaunch.notifyReady());
      return () => window.cancelAnimationFrame(id);
    }
    if (!loading) crmLaunch.notifyReady();
  }, [crmLaunch, isBooting, loading]);

  useEffect(() => {
    if (!isBooting) return;
    if (deskLaunching) return;
    const ms = bootRepeatRef.current ? 1800 : 2800;
    const t = window.setTimeout(() => setIsBooting(false), ms);
    return () => window.clearTimeout(t);
  }, [isBooting, deskLaunching]);

  if (isBooting) {
    return (
        <div className="fixed inset-0 eos-z-modal bg-[var(--eos-bg)] flex flex-col items-center justify-center font-sans overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#D4AF37]/5 to-[#a8844c]/5 rounded-full blur-[100px] opacity-50 animate-pulse"></div>
           
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
                          {i !== arr.length - 1 && <span className="text-[#a8844c]">,</span>}
                       </span>
                    ))}
                 </h1>
              </motion.div>
              
              <motion.div className="w-64 h-1 bg-white/10 rounded-full mt-12 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                 <motion.div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#a8844c]" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "easeInOut" }} />
              </motion.div>
              
           </motion.div>
        </div>
    );
  }

  if (loading) {
    if (deskLaunching) return null;
    return (
      <div className="crmx crm-dashboard-shell flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin" style={{ color: "var(--x-gold)" }} />
        <p className="crmx-kicker">EstateOS™ CRM</p>
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

  const openClientFromAnywhere = (clientId: number) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('clientId', String(clientId));
      url.searchParams.set('tab', 'klienci');
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
    handleTabSwitch('klienci');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('crm-open-client', { detail: { clientId } })), 120);
  };

  const openOfferFromAnywhere = (offerId: number) => {
    setFocusOfferId(offerId);
    handleTabSwitch('my_offers');
  };

  const handleTabSwitch = (tab: CrmTab) => {
    if (tab === activeTab) return;
    const currentY = typeof window !== 'undefined' ? window.scrollY : 0;
    setActiveTab(tab);
    setSelectedDealId(null);
    if (tab !== 'klienci' && !crmHeavyLoadedRef.current) {
      const u = currentUserRef.current;
      if (u?.id) {
        crmHeavyLoadedRef.current = true;
        void (async () => {
          await fetchRadarCatalog();
          setRadarDisplayFilters(await loadRadarFiltersForUser(u));
          await Promise.all([fetchData(u.id), fetchRadarData()]);
        })();
      }
    }
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

  const classifyOfferSection = classifyListingSection;

  const sortOffersBySection = (offers: any[], section: ListingSection) =>
    sortListingsInSection(offers, section);

  const offersBySection = groupListingsBySection(baseOffersForView, classifyOfferSection);

  const offersVisibleInSection = isFavoritesTab ? baseOffersForView : offersBySection[offerSectionFilter];
  const profileTabs: CrmTab[] = isAgencyWorkspace
    ? ["pulpit", "klienci", "wiadomosci", "my_offers", "transakcje", "smart", "planowanie", "offers", "zespol"]
    : ["radar", "wiadomosci", "my_offers", "offers", "planowanie", "transakcje"];

  return (
    <div className="crmx theme-aware-dashboard crm-dashboard-shell eos-page-shell min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] px-3 sm:px-6 pb-24 sm:pb-40 font-sans relative overflow-x-hidden">
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
              className="eos-lux-btn eos-lux-btn--primary shrink-0 px-6 py-3 text-[10px]"
            >
              Zweryfikuj teraz
            </Link>
          </div>
        ) : null}

        {isAgencyWorkspace && agencyGrowthInsight ? (
          <AgencyGrowthBanner insight={agencyGrowthInsight} compact />
        ) : null}

        <header className="crmx-topbar">
          <div className="min-w-0">
            <p className="crmx-kicker">EstateOS™ CRM · {new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="crmx-display crmx-h1 mt-2">
              {crmGreeting()}, <em>{String(personName || "").split(/\s+/)[0] || "witaj"}</em>
            </h1>
            <p className="crmx-sub mt-1.5">
              {accountHeadlines.primary}
              {accountHeadlines.secondary ? ` · ${accountHeadlines.secondary}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAgencyWorkspace ? (
              <button
                type="button"
                className="crmx-btn"
                onClick={() => {
                  handleTabSwitch("klienci" as CrmTab);
                  window.setTimeout(() => window.dispatchEvent(new Event("crm-open-add-client")), 80);
                }}
              >
                <Users size={15} /> Nowy klient
              </button>
            ) : null}
            <button type="button" className="crmx-btn crmx-btn--primary" onClick={goToAddOffer}>
              <Plus size={15} /> Nowe ogłoszenie
            </button>
          </div>
        </header>

        <div className="crmx-layout">
        <CrmProRail
          active={activeTab as CrmProTab}
          tabs={profileTabs as CrmProTab[]}
          counts={{
            my_offers: (crmData.offers || []).filter((o: any) => classifyListingSection(o) === "ACTIVE").length,
            offers: favoriteOffers.length,
          }}
          onChange={(tab) => handleTabSwitch(tab as CrmTab)}
        />

        <div className="min-w-0">
        <div key={activeTab} className="crmx-fade space-y-5 sm:space-y-6">
        {activeTab !== "pulpit" ? (
          <div className="crmx-section-head">
            <div>
              <p className="crmx-kicker">
                {activeTab === "klienci" && "Klienci"}
                {activeTab === "wiadomosci" && "Wiadomości"}
                {activeTab === "radar" && "Radar"}
                {activeTab === "my_offers" && "Ogłoszenia"}
                {activeTab === "offers" && "Ulubione"}
                {activeTab === "planowanie" && "Planowanie"}
                {activeTab === "transakcje" && "Transakcje"}
                {activeTab === "smart" && "Smart Agent OS™"}
                {activeTab === "zespol" && "Dziennik zespołu"}
              </p>
              <h2 className="crmx-display crmx-h2 mt-1.5">
                {activeTab === "klienci" && <>Kupujący i <em>sprzedający</em></>}
                {activeTab === "wiadomosci" && <>Rozmowy <em>bezpośrednie</em></>}
                {activeTab === "radar" && <>Radar <em>inwestycji</em></>}
                {activeTab === "my_offers" && <>Twoje <em>nieruchomości</em></>}
                {activeTab === "offers" && <>Zapisane <em>oferty</em></>}
                {activeTab === "planowanie" && <>Kalendarz <em>spotkań</em></>}
                {activeTab === "transakcje" && <>Lejek <em>transakcji</em></>}
                {activeTab === "smart" && <>Inteligentny agent <em>poszukiwań</em></>}
                {activeTab === "zespol" && <>Co <em>zrobił zespół</em></>}
              </h2>
              <p className="crmx-sub mt-1 max-w-2xl">
                {activeTab === "wiadomosci" && "Wszystkie rozmowy z klientami, agentami i kupującymi — z załącznikami i powiadomieniami."}
                {activeTab === "klienci" && "Karty klientów, dopasowania, prezentacje i komunikacja — wszystko przy jednej osobie."}
                {activeTab === "radar" && (showDualRadarPro ? c.radarDescPro : c.radarDesc)}
                {activeTab === "my_offers" && "Każde ogłoszenie z ceną, zasięgiem i kupującymi w procesie. Kliknij wiersz, żeby zobaczyć szczegóły i działać."}
                {activeTab === "offers" && "Oferty z rynku, które zapisałeś — gotowe do wysłania klientom."}
                {activeTab === "planowanie" && "Prezentacje, spotkania pozyskania i terminy w jednym kalendarzu."}
                {activeTab === "zespol" && "Każda akcja agentów zapisana na serwerze z godziną i minutą. Kierownik biura widzi cały zespół, agent — swój dzień."}
                {activeTab === "smart" && "Oferty dopasowane automatycznie do Twoich kupujących i ich reakcje — do lejka trafiają tylko ci, których wybierzesz."}
                {activeTab === "transakcje" && "Każdy kupujący przy każdej ofercie — od zainteresowania po akt notarialny. Rozmowy z Dealroomu trafiają tu automatycznie."}
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === 'pulpit' && (
          <div className="space-y-8">
            <CrmPulpit
              offers={crmData.offers || []}
              clientsCount={null}
              onNavigate={(tab) => handleTabSwitch(tab as CrmTab)}
              onOpenClient={openClientFromAnywhere}
              onOpenOffer={openOfferFromAnywhere}
            />
          </div>
        )}

        {activeTab === 'klienci' && <CrmClientsWorkspace />}

        {activeTab === 'wiadomosci' && currentUser?.id ? (
          <Suspense fallback={<div className="crmx-card crmx-empty">Ładowanie wiadomości…</div>}>
            <ContactInboxClient
              embedded
              basePath="/moje-konto/crm?tab=wiadomosci"
              currentUser={{ id: Number(currentUser.id), name: currentUser.name || null }}
            />
          </Suspense>
        ) : null}

        {activeTab === 'radar' && (
          <div className="flex flex-col gap-8 mb-12">
            
            <>
            <div className="eos-lux-panel eos-crm-radar-panel eos-radar-widget eos-crm-section-panel relative mb-8 w-full overflow-hidden p-6 md:p-10 group">
              <div className="pointer-events-none absolute -top-16 left-1/4 h-64 w-64 rounded-full bg-[#a8844c]/10 blur-[90px]" />
              
              <div className="relative z-10 flex flex-col items-start justify-between gap-8 border-b border-[rgba(196,163,90,0.22)] pb-8 md:flex-row md:items-center">
                <div className="flex items-center gap-6">
                  <div className="eos-crm-section-hero__icon relative overflow-hidden">
                     {showDualRadarPro ? (
                       <>
                         <span className="relative z-10 flex items-center -space-x-2">
                           <Radar size={26} className="shrink-0 text-[#7a5a26]" strokeWidth={1.6} />
                           <Radar size={26} className="shrink-0 text-amber-600" strokeWidth={1.6} />
                         </span>
                       </>
                     ) : (
                       <Radar size={28} className="relative z-10 text-[#7a5a26]" strokeWidth={1.6} />
                     )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter text-[var(--eos-text)]">
                      {showDualRadarPro ? (
                        <>
                          {c.radarTitle} <span className="text-amber-600">{c.radarTitlePro}</span>
                        </>
                      ) : (
                        c.activeScanning
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px] ${showDualRadarPro ? 'bg-amber-400 shadow-amber-500/60' : 'bg-[#a8844c] shadow-[#a8844c]/50'}`} />
                      <span className={`text-[10px] uppercase font-bold tracking-[0.3em] ${showDualRadarPro ? 'text-amber-500/85' : 'text-[#a8844c]/80'}`}>
                        {showDualRadarPro
                          ? c.radarProDual
                          : radarDisplayFilters?.pushNotifications === false
                            ? c.radarOff
                            : c.radarActive}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openRadarEditor}
                  className="eos-lux-btn eos-lux-btn--platinum inline-flex items-center gap-2 px-5 py-3 text-[10px]"
                >
                  <SlidersHorizontal size={14} />
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
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#a8844c]/10 to-transparent pointer-events-none group-hover/price:w-full transition-all duration-700" />
                    <span className="eos-radar-budget-label text-[9px] uppercase tracking-[0.2em] font-bold mb-2 relative z-10">{c.budget}</span>
                    <span className="eos-radar-value text-[#7a5a26] dark:text-[#c9a86a] font-black text-sm truncate relative z-10">{radarSummary.maxBudget}</span>
                 </div>
              </div>
              
              <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
                <span className="eos-radar-label text-[9px] uppercase tracking-[0.2em] font-bold">{c.matchThreshold}:</span>
                <span className="eos-radar-threshold-pill rounded-xl border border-[var(--eos-border)] bg-[#161616] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#7a5a26] dark:text-[#c9a86a]">
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
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 eos-z-cinematic bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
                    <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, 120, 240, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-48 h-48 rounded-full border border-[#a8844c]/30 flex items-center justify-center shadow-[0_0_150px_rgba(168,132,76,0.2)] mb-10 relative overflow-hidden">
                       <div className="absolute inset-0 rounded-full border-4 border-[#a8844c]/10 animate-[ping_3s_linear_infinite]" />
                       <div className="absolute inset-0 bg-gradient-to-b from-[#a8844c]/20 to-transparent animate-[pulse_2s_linear_infinite]" />
                       <Radar size={80} className="text-[#a8844c] drop-shadow-[0_0_20px_#10b981]" strokeWidth={1} />
                    </motion.div>
                    <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-4xl md:text-7xl font-black text-white tracking-tighter text-center">
                       {c.radar.recalibratingTitle}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[#a8844c] font-bold uppercase tracking-[0.5em] text-[11px] md:text-sm mt-8 animate-pulse text-center">
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
                     <div key={offer.id} className="bg-[var(--eos-bg-elevated)] border border-[#a8844c]/30 rounded-[2.5rem] p-6 relative overflow-hidden shadow-[0_0_30px_rgba(168,132,76,0.05)] hover:border-[#a8844c] transition-all">
                        <div className="absolute top-0 right-0 bg-[#a8844c] text-black font-black px-4 py-1 rounded-bl-2xl rounded-tr-[2.5rem] text-xs z-20 shadow-[0_0_15px_rgba(168,132,76,0.5)]">
                           {c.matchLabel} {offer.matchScore || 100}%
                        </div>
                        <div className="flex gap-4 mb-4 relative z-10">
                           <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-[#a8844c]/30 bg-[#111]">
                              <img src={thumb} className="w-full h-full object-cover" alt={offer.title || c.offers.thumbAlt} onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }} />
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className={`self-start px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest mb-1 ${txRent ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-[#a8844c]/30 text-[#c9a86a] bg-[#a8844c]/10'}`}>{txRent ? c.rent : c.sale}</span>
                              <a href={`/oferta/${offer.id}`} target="_blank" className="font-bold text-[var(--eos-text)] text-sm truncate hover:text-[#c9a86a] transition-colors">
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
                                    <p className="font-black text-xs text-[#a8844c]">{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL')} PLN</p>
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
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-[var(--eos-border)] truncate flex items-center gap-1"><i className="eos-sig-dot eos-sig--ok" /> {c.statusActive}</span>
                        </div>
                        <button onClick={() => window.open(`/oferta/${offer.id}`, '_blank')} className="w-full mt-2 py-3 bg-transparent border border-[#a8844c]/50 text-[#a8844c] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#a8844c] hover:text-black transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(168,132,76,0.4)] cursor-pointer">
                           {c.viewOffer}
                        </button>
                     </div>
                   );
                 })}
              </div>
            ) : ( /* Przestrzeń na zmatchowane wyniki (Pusty stan) */
            <div className={`col-span-full flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-[var(--eos-bg)] relative overflow-hidden ${showDualRadarPro ? 'border-amber-500/25' : 'border-[#a8844c]/20'}`}>
                <div className={`flex items-center gap-4 mb-6 relative z-10`}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                  >
                  <Radar size={48} className={showDualRadarPro ? 'text-[#a8844c]/25' : 'text-[#a8844c]/20'} />
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
                   <div className="w-2 h-2 rounded-full bg-[#a8844c] animate-pulse" />
                   <div className="w-2 h-2 rounded-full bg-[#a8844c] animate-pulse delay-75" />
                   <div className="w-2 h-2 rounded-full bg-[#a8844c] animate-pulse delay-150" />
                </div>
            </div>
            )}
    

          </div>
        )}

        {(activeTab === 'offers' || activeTab === 'my_offers') && (
          <CrmListingsPro
            key={activeTab}
            mode={isListingsTab ? 'listings' : 'favorites'}
            offers={baseOffersForView}
            bids={crmData?.bids || []}
            classify={classifyOfferSection}
            isAwaitingReview={isOfferAwaitingReview}
            focusOfferId={isListingsTab ? focusOfferId : null}
            onFocusConsumed={() => setFocusOfferId(null)}
            onAdd={goToAddOffer}
            onRefresh={handleRefreshOffer}
            onArchive={setOfferToArchive}
            onComment={setCommentModalOffer}
            onTransfer={setTransferModalOffer}
            onBidResponse={handleBidResponse}
            onPriceSaved={(offerId, price) => {
              setCrmData((prev: any) => ({
                ...prev,
                offers: (prev.offers || []).map((o: any) => (Number(o.id) === offerId ? { ...o, price } : o)),
              }));
            }}
          />
        )}
        {activeTab === "smart" && <CrmSmartAgentBoard onOpenClient={openClientFromAnywhere} />}
        {activeTab === "zespol" && <CrmTeamLog onOpenClient={openClientFromAnywhere} onOpenOffer={openOfferFromAnywhere} />}
        {/* --- TRANSAKCJE / DEAL ROOMY --- */}
        {activeTab === 'transakcje' && !selectedDealId && (
          <div className="mb-8">
            <CrmDealsPro onOpenClient={openClientFromAnywhere} onOpenOffer={openOfferFromAnywhere} offers={crmData.offers || []} onOpenSmart={() => handleTabSwitch("smart")} />
            <p className="crmx-kicker mt-10 mb-3">Rozmowy w Dealroomie</p>
          </div>
        )}
        {activeTab === 'transakcje' && (
          <div className="flex flex-col gap-6">
            {selectedDealId ? (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <button
            onClick={() => setSelectedDealId(null)}
            className="crmx-btn mb-6"
          >
            {c.deals.back}
          </button>
          <DealRoom dealId={selectedDealId} currentUserId={currentUser?.id} />
        </div>
      ) : isolatedDeals.length === 0 ? (
              <div className="crmx-card crmx-empty" style={{ padding: '40px 20px' }}>
                <p className="font-semibold" style={{ color: 'var(--x-ink)' }}>{c.deals.emptyTitle}</p>
                <p className="mt-1">{c.deals.emptyDesc}</p>
              </div>
            ) : (
              <div className="crmx-card overflow-hidden">
                <div className="crmx-list">
                {sortedIsolatedDeals.map((deal: any) => {
                  const pinned = pinnedDealIds.includes(Number(deal.dealId));
                  const img = resolveOfferPrimaryImage(deal.offer);
                  return (
                  <div key={deal.dealId} role="button" tabIndex={0} onClick={() => setSelectedDealId(deal.dealId)} className="crmx-row cursor-pointer">
                    {img ? <img src={img} alt="" className="crmx-thumb" style={{ width: 56, height: 56 }} /> : <span className="crmx-thumb" style={{ width: 56, height: 56 }} />}
                    <div className="crmx-row__main">
                      <div className="flex items-center gap-2">
                        <p className="crmx-row__title">{deal.offer?.title || c.deals.fallbackTitle}</p>
                        <span className="crmx-chip crmx-muted shrink-0">#{deal.dealId}</span>
                      </div>
                      <p className="crmx-row__sub">
                        {deal.otherParty?.name ? <b className="font-semibold" style={{ color: 'var(--x-ink)' }}>{deal.otherParty.name}: </b> : null}
                        {formatDealLastMessage(deal.lastMessage)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="crmx-chip crmx-chip--gold">{Number(String(deal.offer?.price || 0).replace(/\D/g,'')).toLocaleString('pl-PL')} zł</span>
                        {deal.unreadCount > 0 ? <span className="crmx-chip crmx-chip--warn">{c.deals.unread.replace('{n}', String(deal.unreadCount))}</span> : null}
                        {deal.pendingBidCount > 0 ? <span className="crmx-chip crmx-chip--warn">{c.deals.pendingBids.replace('{n}', String(deal.pendingBidCount))}</span> : null}
                        {deal.pendingAppointmentCount > 0 ? <span className="crmx-chip crmx-chip--warn">{c.deals.pendingAppointments.replace('{n}', String(deal.pendingAppointmentCount))}</span> : null}
                        <span className="text-[11.5px] crmx-muted">{new Date(deal.lastMessageAt || deal.updatedAt || deal.createdAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {deal.otherParty?.id ? (
                        <button type="button" className="crmx-btn crmx-btn--sm" onClick={(e) => { e.stopPropagation(); openUserProfileModal(deal.otherParty); }}>Profil</button>
                      ) : null}
                      <button type="button" className={`crmx-btn crmx-btn--sm ${pinned ? 'crmx-btn--gold' : ''}`} onClick={(e) => { e.stopPropagation(); togglePinDeal(Number(deal.dealId)); }}>
                        {pinned ? c.deals.pinned : c.deals.pin}
                      </button>
                      <span className="crmx-btn crmx-btn--sm crmx-btn--primary">Otwórz</span>
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        )}


      
        {activeTab === 'planowanie' && currentUser?.id && (
          <CrmPlanner
            appointments={crmData.appointments || []}
            contacts={crmData.contacts || []}
            currentUserId={Number(currentUser.id)}
            onManage={(app) => {
              // Prezentacje i pozyskania z CRM prowadzi karta klienta (tam są ich akcje); terminy z Dealroomu — panel terminu.
              const fromCrm = app.source === "presentation" || app.source === "acquisition" || Number(app.id) < 0;
              if (fromCrm && app.clientId) {
                openClientFromAnywhere(Number(app.clientId));
                return;
              }
              setManagingApp(app);
            }}
          />
        )}
        {activeTab === 'planowanie' ? (
          <div className="mt-6 max-w-md">
            <OpenHouseProCard
              activeOffers={activeOffersForProTools}
              onChanged={() => {
                if (currentUser?.id) void fetchData(currentUser.id);
              }}
            />
          </div>
        ) : null}

        </div>
        </div>
        </div>
</div>
    
          <AnimatePresence>
            {managingApp ? (
              <CrmAppointmentSheet
                key={`${managingApp.id}-${managingApp.status}-${String(managingApp.proposedDate)}`}
                app={managingApp}
                contacts={crmData.contacts || []}
                myId={Number(currentUser?.id || 0)}
                onClose={() => setManagingApp(null)}
                onChanged={(next) => {
                  setManagingApp(next);
                  if (currentUser?.id) void fetchData(currentUser.id);
                }}
              />
            ) : null}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', padding: '4px 12px', backgroundColor: 'rgba(168,132,76,0.1)', borderRadius: '100px', border: '1px solid rgba(168,132,76,0.2)' }}>
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
                                        <a key={o.id} href={`/oferta/${o.id}`} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textDecoration: 'none', color: '#fff', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(168,132,76,0.3)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)'}>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{o.title || `Oferta ID: ${o.id}`}</span>
                                            <span style={{ fontSize: '9px', color: '#10b981', fontWeight: '900', backgroundColor: 'rgba(168,132,76,0.1)', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}>ID: {o.id} ↗</span>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 eos-z-modal bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
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
                <div className="py-12 flex items-center justify-center"><Loader2 className="animate-spin text-[#a8844c]" /></div>
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
                      <p className="text-lg font-black text-[#c9a86a]">{Array.isArray(profileModalData.offers) ? profileModalData.offers.length : 0}</p>
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
                        <Link key={o.id} href={`/oferta/${o.id}`} target="_blank" className="block rounded-lg bg-black/40 border border-[var(--eos-border)] p-3 hover:border-[#a8844c]/30 transition-colors">
                          <p className="text-xs text-white font-bold truncate">{o.title || `Oferta #${o.id}`}</p>
                          <p className="text-[10px] text-[#c9a86a] font-black">{Number(String(o.price || 0).replace(/\D/g, '')).toLocaleString('pl-PL')} PLN</p>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 eos-z-modal bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
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
