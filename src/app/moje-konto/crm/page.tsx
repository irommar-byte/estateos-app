"use client";
import PasskeyToggle from "@/components/PasskeyToggle";
import DealRoom from "@/components/crm/DealRoom";

const ProStatusBar = ({ user }: any) => {
  if (!user?.isPro || !user?.proExpiresAt) return null;

  const now = new Date();
  const expiry = new Date(user.proExpiresAt);
  const total = 30;
  const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000*60*60*24)));
  const progress = Math.min(100, Math.max(0, (daysLeft / total) * 100));
  const ratio = Math.min(1, Math.max(0, daysLeft / total));
  const hue = Math.round(120 * ratio);
  const tone = `hsl(${hue} 95% 52%)`;
  const toneSoft = `hsl(${hue} 90% 42%)`;

  return (
    <div className="mb-5 sm:mb-6 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] sm:text-xs tracking-[0.22em] sm:tracking-[0.3em] font-black mb-1" style={{ color: tone }}>PRO STATUS</p>
          <p className="text-sm sm:text-base text-white font-bold">Ważny do: {expiry.toLocaleDateString()}</p>
          <p className="text-xs sm:text-sm text-white/60">Pozostało {daysLeft} dni</p>
        </div>
      </div>
      <div className="relative w-full h-3 sm:h-3.5 rounded-full overflow-hidden border border-white/10 bg-black/40">
        <div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(90deg, ${toneSoft}, ${tone})` }} />
        <div
          className="relative h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${toneSoft}, ${tone})`,
            boxShadow: `0 0 24px color-mix(in srgb, ${tone} 70%, transparent)`
          }}
        />
      </div>
    </div>
  );
};

import { Check } from "lucide-react";
import { useUserMode } from '@/contexts/UserModeContext';
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ProWidget, { AppleClock } from "@/components/ProWidget";
import ReviewsModal from "@/components/ReviewsModal";
import EliteStatusBadges from "@/components/ui/EliteStatusBadges";
import { Briefcase, ArrowRight, ShieldCheck, ChevronLeft, ArchiveX, Calendar, Crown, Plus, Phone, CheckCircle, Loader2, Star, ChevronDown, Building2, DollarSign, Wallet, X, Radar, Send, Clock, FileText, Lock, Unlock, Activity, TrendingUp, Wifi, RefreshCcw, Sparkles, Edit2, ExternalLink, Home, Key, LayoutGrid, CalendarDays, SlidersHorizontal, MapPin, Target, Heart } from 'lucide-react';
import AppointmentManager from "@/components/AppointmentManager";
import { canonicalizeCity, getDistrictsForCity } from "@/lib/location/locationCatalog";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";

const WowOverlay = ({ type }: { type: 'investor' | 'agency' | 'plus' | 'renewal' }) => {
  if (type === 'plus') return <WowPlusOverlay />;

  const [step, setStep] = useState(0);
  useEffect(() => {
    setTimeout(() => setStep(1), 500);
    setTimeout(() => setStep(2), 1500);
  }, []);
  
  const config = {
     investor: { color: 'yellow', text: 'ZŁOTY INWESTOR', sub: 'Eksplozja możliwości! Radar z opóźnieniem 0s jest Twój.' },
     agency: { color: 'yellow', text: 'AGENCJA PRO', sub: 'Pełen dostęp. Limit ogłoszeń zniesiony.' },
     plus: { color: 'emerald', text: 'PAKIET +', sub: 'Twoje ogłoszenie zostało odblokowane i trafia na rynek.' },
     renewal: { color: 'blue', text: 'RYNEK ZDOBYTY', sub: 'Oferta odnowiona. Czas na dominację.' }
  };
  
  const c = config[type];
  const isGold = type === 'investor' || type === 'agency';
  const isBlue = type === 'renewal';
  const glowColor = isGold ? '#facc15' : isBlue ? '#3b82f6' : '#10b981';
  const textColor = isGold ? 'text-yellow-500' : isBlue ? 'text-blue-500' : 'text-emerald-500';
  const bgGlow = isGold ? 'bg-yellow-500' : isBlue ? 'bg-blue-500' : 'bg-emerald-500';
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-3xl overflow-hidden">
      <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", bounce: 0.6, duration: 1 }} className="text-center relative">
         {step >= 2 && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 4, 0], opacity: [1, 0] }} transition={{ duration: 1.5, ease: "easeOut" }} className={`absolute inset-0 rounded-full blur-[100px] pointer-events-none z-0 ${bgGlow}`} />
         )}
         
         <div className={`w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-8 relative transition-all duration-700 z-10 ${step >= 2 ? (isGold ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-[0_0_150px_rgba(250,204,21,0.8)] scale-110' : isBlue ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_150px_rgba(59,130,246,0.8)] scale-110' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_150px_rgba(16,185,129,0.8)] scale-110') : 'bg-[#111] border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]'}`}>
            {step >= 2 ? (
               type === 'investor' ? <Home size={80} className="text-black relative z-10" /> :
               type === 'agency' ? <Unlock size={80} className="text-black relative z-10" /> :
               type === 'renewal' ? <Activity size={80} className="text-white relative z-10" /> :
               <Sparkles size={80} className="text-black relative z-10" />
            ) : <Lock size={80} className="text-white/30 relative z-10" />}
            
            {type === 'investor' && step >= 2 && Array.from({ length: 6 }).map((_, i) => (
                <motion.div key={i} className="absolute z-20 text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }} animate={{ x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 600 - 100, scale: [0, 1.5, 0], opacity: [1, 1, 0], rotate: Math.random() * 720 }} transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}>
                    <Key size={30} />
                </motion.div>
            ))}
         </div>
         
         <motion.h1 animate={step >= 2 ? { textShadow: [`0px 0px 0px ${glowColor}`, `0px 0px 50px ${glowColor}`, `0px 0px 0px ${glowColor}`] } : {}} transition={{ duration: 2, repeat: Infinity }} className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter relative z-10">
            {step >= 2 ? <>{c.text} <span className={textColor}>POTWIERDZONY</span></> : 'AUTORYZACJA...'}
         </motion.h1>
         
         <p className={`text-sm md:text-xl font-bold uppercase tracking-widest transition-colors duration-700 relative z-10 ${step >= 2 ? textColor : 'text-white/30'}`}>
            {step >= 2 ? c.sub : 'Weryfikacja płatności Stripe...'}
         </p>
      </motion.div>
    </motion.div>
  );
};

interface Particle { id: number; x: number; y: number; z: number; vX: number; vY: number; vZ: number; scale: number; rotX: number; rotY: number; rotZ: number; color: string; }

const WowPlusOverlay = () => {
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
         
         <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#111] to-[#050505] border border-white/5 shadow-[0_0_100px_rgba(14,165,233,0.05)] overflow-hidden" style={{ transform: 'translateZ(50px)' }}>
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
            <span className="text-[14px] md:text-[18px] font-black uppercase text-[#0ea5e9] tracking-[1em] mb-4 opacity-90 relative z-10" style={{ textShadow: '0 0 20px rgba(14,165,233,0.5)' }}>EstateOS Ultra</span>
            <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 leading-none tracking-tighter relative z-10 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
              PAKIET<span className="text-[#0ea5e9] filter drop-shadow-[0_0_50px_rgba(14,165,233,1)]">+</span>
            </h1>
            <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-[#0ea5e9]/50 to-transparent my-2" />
            <h2 className="text-3xl md:text-5xl font-light text-zinc-300 leading-none tracking-[0.2em] relative z-10">AKTYWOWANY</h2>
         </div>
      </div>
    </div>
  );
};

export default function CRMDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { mode, initModeFromUser } = useUserMode();

  const [managingApp, setManagingApp] = useState<any>(null);

  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [profileReviewsOpen, setProfileReviewsOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newPropDate, setNewPropDate] = useState("");
  const [newPropTime, setNewPropTime] = useState("");
  const [rescheduleStep, setRescheduleStep] = useState(1);
  

  const [reviewsData, setReviewsData] = useState<any>({ averageRating: 4.9, totalReviews: 28, distribution: { 5: 24, 4: 3, 3: 1, 2: 0, 1: 0 }, reviews: [ { id: 1, author: "System", avatar: "S", rating: 5, date: "Dzisiaj", text: "Konto gotowe do działania." } ] });
  
  useEffect(() => {
    fetch('/api/reviews', { credentials: 'include' }).then(r => r.json()).then(d => {
      if (!d.error) setReviewsData(d);
    }).catch(e => console.log("Błąd pobierania opinii:", e));
  }, []);

  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [greeting, setGreeting] = useState("");
  
  const greetings = [
      "System gotowy. Twój ruch, {name}.",
      "Witaj {name}, rynek czeka na Twoje inwestycje.",
      "Dzień dobry, {name}. Kolejny dzień, nowe możliwości.",
      "Zabezpieczenie PRO aktywne. Miłego dnia, {name}."
  ];
  const [loading, setLoading] = useState(true);

  const [radarCatalog, setRadarCatalog] = useState<{ strictCities: string[]; strictCityDistricts: Record<string, string[]> }>({
    strictCities: [],
    strictCityDistricts: {},
  });
  const [radarCity, setRadarCity] = useState("Warszawa");
  const [isEditRadarOpen, setIsEditRadarOpen] = useState(false);
  const [radarFormData, setRadarFormData] = useState({ searchDistricts: [] as string[], searchRooms: '', searchAreaFrom: '', searchMaxPrice: '', searchTransactionType: 'all' });
  const [isSavingRadar, setIsSavingRadar] = useState(false);
  const [isRadarUpdating, setIsRadarUpdating] = useState(false);
  const [marketOffers, setMarketOffers] = useState<any[]>([]);

  const toggleDistrict = (district: string) => {
    setRadarFormData(prev => ({
        ...prev,
        searchDistricts: prev.searchDistricts.includes(district)
            ? prev.searchDistricts.filter((d: string) => d !== district)
            : [...prev.searchDistricts, district]
    }));
  };

  const handleSaveRadar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRadar(true);
    
    const formattedData = {
        districts: radarFormData.searchDistricts,
        rooms: radarFormData.searchRooms ? parseInt(String(radarFormData.searchRooms).replace(/\D/g, '')) : null,
        areaFrom: radarFormData.searchAreaFrom ? parseInt(String(radarFormData.searchAreaFrom).replace(/\D/g, '')) : null,
        maxPrice: radarFormData.searchMaxPrice ? parseInt(String(radarFormData.searchMaxPrice).replace(/\D/g, '')) : null,
        transactionType: radarFormData.searchTransactionType
    };

    try {
        const legacyPayload = {
          ...formattedData,
          city: radarCity,
          districts: radarFormData.searchDistricts,
        };

        const [legacyRes, mobileRes] = await Promise.all([
          fetch('/api/szukaj/aktualizuj', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(legacyPayload)
          }),
          currentUser?.id
            ? fetch('/api/radar/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: currentUser.id,
                  transactionType: radarFormData.searchTransactionType,
                  city: radarCity,
                  selectedDistricts: radarFormData.searchDistricts,
                  maxPrice: radarFormData.searchMaxPrice || null,
                  minArea: radarFormData.searchAreaFrom || null,
                  minMatchThreshold: 70,
                }),
              })
            : Promise.resolve(new Response(null, { status: 200 })),
        ]);

        if (legacyRes.ok && mobileRes.ok) {
          setIsEditRadarOpen(false);
          setIsRadarUpdating(true);
          setTimeout(async () => {
            setIsRadarUpdating(false);
            if (currentUser?.id) {
              await Promise.all([fetchData(currentUser.id), fetchRadarData(), fetchMarketOffers()]);
            }
          }, 2200);
        }
    } catch(err) {
        console.error(err);
    }
    setIsSavingRadar(false);
  };

  const openRadarEditor = (e: React.MouseEvent) => {
    e.preventDefault(); 
    const userDistricts = (currentUser?.searchDistricts || '').split(',').map((d: string) => d.trim()).filter(Boolean);
    const guessedCity = (() => {
      if (!userDistricts.length) return "Warszawa";
      const strict = radarCatalog.strictCities || [];
      for (const city of strict) {
        const allowed = getDistrictsForCity(city);
        if (userDistricts.some((d: string) => allowed.includes(d))) return city;
      }
      return "Warszawa";
    })();
    setRadarCity(canonicalizeCity(guessedCity) || "Warszawa");
    setRadarFormData({ 
       searchDistricts: userDistricts,
       searchRooms: currentUser?.searchRooms || '', 
       searchAreaFrom: currentUser?.searchAreaFrom || '', 
       searchMaxPrice: currentUser?.searchMaxPrice || '',
      searchTransactionType: currentUser?.searchTransactionType || 'all'
    }); 
    setIsEditRadarOpen(true);
  };

  const isPartnerPlan = currentUser?.planType === 'AGENCY' || currentUser?.advertiserType === 'agency';
  const isPremium =
    currentUser?.isPro === true ||
    currentUser?.isPro === 'true' ||
    currentUser?.role === 'ADMIN' ||
    isPartnerPlan;
  const isPartnerMode = mode === 'AGENCY';

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
  
  const [likedOfferIds, setLikedOfferIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('crm_liked_offers');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setLikedOfferIds(parsed.map((id) => String(id)));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('crm_liked_offers', JSON.stringify(likedOfferIds));
  }, [likedOfferIds]);
  
  const [activeTab, setActiveTab] = useState<'radar' | 'my_offers' | 'offers' | 'planowanie' | 'transakcje'>('radar');
  const [offerSectionFilter, setOfferSectionFilter] = useState<'ACTIVE' | 'PENDING' | 'COMPLETED'>('ACTIVE');
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [pinnedDealIds, setPinnedDealIds] = useState<number[]>([]);
  const [profileModalUser, setProfileModalUser] = useState<any>(null);
  const [profileModalLoading, setProfileModalLoading] = useState(false);
  const [profileModalData, setProfileModalData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [radarResults, setRadarResults] = useState<any[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [sentVipOffers, setSentVipOffers] = useState<string[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [wowType, setWowType] = useState<string | null>(null);
  const [wowPlusType, setWowPlusType] = useState<boolean>(false);
  const crmPollingRef = useRef<number | null>(null);

  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [offerToArchive, setOfferToArchive] = useState<any>(null);

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

  
  const handleBidResponse = async (e: React.MouseEvent, bidId: string, status: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch('/api/bids/respond', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, status })
      });
      if (res.ok) {
        if (currentUser?.id) fetchData(currentUser.id);
      } else {
        const err = await res.json();
        alert('Błąd: ' + (err.error || 'Wystąpił błąd przy przetwarzaniu.'));
      }
    } catch(err) {
      alert('Błąd sieci.');
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
        alert("Błąd podczas wstrzymywania oferty.");
      }
    } catch(e) {
      alert("Błąd połączenia z serwerem.");
    }
  };

  const handleRefreshOffer = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch('/api/stripe/checkout', { credentials: 'include', 
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/moje-konto/crm?tab=my_offers&renewalOfferId=${id}`,
          plan: 'renewal',
          offerId: id
        })
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch(e) {
      alert("Błąd połączenia z operatorem płatności");
    } finally {
      setRefreshingId(null);
    }
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

  const fetchMarketOffers = async () => {
    try {
      const res = await fetch('/api/offers', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setMarketOffers(data.filter((o: any) => String(o?.status || '').toUpperCase() === 'ACTIVE'));
      }
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

  const initCrm = async () => {
    try {
      const authRes = await fetch('/api/auth/check');
      const authData = await authRes.json();
      
      if (!authData.loggedIn) {
        window.location.href = '/login';
        return;
      }
      
      const profileRes = await fetch('/api/user/profile');
      const uData = await profileRes.json();
      setCurrentUser(uData);
      initModeFromUser(uData);

      // Mamy usera! Odpalamy dane ofert i radaru z jego ID
      await Promise.all([fetchData(uData.id), fetchRadarData(), fetchRadarCatalog(), fetchMarketOffers()]);

      if (uData.isPro && !sessionStorage.getItem('pro_booted')) {
        setIsBooting(true);
        sessionStorage.setItem('pro_booted', 'true');
        const rawName = uData.firstName || uData.name || (uData.email ? uData.email.split('@')[0] : 'Inwestorze');
        const randGreet = greetings[Math.floor(Math.random() * greetings.length)].replace('{name}', rawName);
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
    // Czytamy zakładkę z powiadomienia
    const sParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (sParams && sParams.get('tab')) {
        const t = sParams.get('tab');
        if (['radar', 'my_offers', 'offers', 'planowanie', 'transakcje'].includes(t as string)) {
            setActiveTab(t as any);
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
       if (plan === 'pakiet_plus') setWowType('plus');
       else if (plan === 'agency') setWowType('agency');
       else if (plan === 'renewal') setWowType('renewal');
       else setWowType('investor');
       
       setIsBooting(false);
       
       const syncPromise = plan === 'renewal'
         ? syncRenewalAfterPayment(searchParams)
         : fetch('/api/stripe/force-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) }).then(() => undefined);
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


  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  
  if (isBooting) {
    return (
        <div className="fixed inset-0 z-[999999] bg-[#050505] flex flex-col items-center justify-center font-sans overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#D4AF37]/5 to-emerald-500/5 rounded-full blur-[100px] opacity-50 animate-pulse"></div>
           
           <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, ease: "easeOut" }} className="relative z-10 flex flex-col items-center">
              
              <div className="mb-12 scale-150 shadow-[0_0_100px_rgba(255,255,255,0.05)] rounded-full">
                 <AppleClock isBooting={true} />
              </div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="text-center">
                 <div className="flex items-center justify-center gap-3 mb-4">
                    <Loader2 size={16} className="text-[#D4AF37] animate-spin" />
                    <span className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em]">Inicjalizacja Systemów PRO</span>
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

  const displayName = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
    : (currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Witaj'));
  const avatarSrcRaw = currentUser?.image || '';
  const avatarSrc = avatarSrcRaw
    ? (avatarSrcRaw.startsWith('http') ? avatarSrcRaw : avatarSrcRaw)
    : '';
  const avatarInitial = (displayName || 'U').trim().charAt(0).toUpperCase();
  const sortedIsolatedDeals = [...isolatedDeals].sort((a: any, b: any) => {
    const aPinned = pinnedDealIds.includes(Number(a.dealId));
    const bPinned = pinnedDealIds.includes(Number(b.dealId));
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aTs = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
    const bTs = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
    return bTs - aTs;
  });

  const togglePinDeal = (dealId: number) => {
    setPinnedDealIds((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [dealId, ...prev]
    );
  };

  const goToAddOffer = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/dodaj-oferte";
  };

  const handleTabSwitch = (tab: 'radar' | 'my_offers' | 'offers' | 'planowanie' | 'transakcje') => {
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

  const isListingsTab = activeTab === 'my_offers';
  const isFavoritesTab = activeTab === 'offers';
  const showAddOfferTile = isListingsTab && offerSectionFilter !== 'COMPLETED';
  const availableRadarDistricts =
    radarCatalog.strictCityDistricts?.[radarCity] ||
    getDistrictsForCity(radarCity) ||
    [];

  const baseOffersForView = isListingsTab
    ? (crmData.offers || [])
    : (marketOffers || []).filter((o: any) => likedOfferIds.includes(String(o.id)));

  const classifyOfferSection = (offer: any): 'ACTIVE' | 'PENDING' | 'COMPLETED' => {
    const now = new Date();
    const status = String(offer?.status || '').toUpperCase();
    const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : Number.NaN;
    const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < now.getTime();
    const isPending = ['PENDING', 'PENDING_APPROVAL', 'IN_REVIEW'].includes(status);
    const isCompleted = isExpired || ['ARCHIVED', 'SOLD', 'REJECTED', 'EXPIRED', 'INACTIVE', 'PAUSED', 'CANCELLED'].includes(status);
    if (isPending) return 'PENDING';
    if (isCompleted) return 'COMPLETED';
    return 'ACTIVE';
  };

  const isSameCalendarDay = (left: Date, right: Date) => (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );

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
  const profileTabs: Array<'radar' | 'my_offers' | 'offers' | 'planowanie' | 'transakcje'> = ['radar', 'my_offers', 'offers', 'planowanie', 'transakcje'];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#111] via-[#050505] to-black text-white px-3 sm:px-6 pt-14 sm:pt-16 pb-24 sm:pb-40 font-sans relative overflow-x-hidden">
      <AnimatePresence>
        {wowPlusType && <WowPlusOverlay />}
        {wowType && <WowOverlay type={wowType as "investor" | "agency" | "plus"} />}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        <ProStatusBar user={currentUser} />
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 px-1 sm:px-2 md:px-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">{isPartnerMode ? 'Panel Partnera' : 'Panel Inwestora'}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border border-white/15 bg-white/5 shadow-[0_0_18px_rgba(0,0,0,0.35)] shrink-0">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`Awatar ${displayName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-400">
                    {avatarInitial}
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter text-white break-words max-w-full">
                {displayName}
              </h1>
              <EliteStatusBadges subject={currentUser} isDark compact className="mt-1" />
              {currentUser?.id && (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-gradient-to-r from-white/5 to-transparent border border-white/10 rounded-xl shadow-inner mt-2 md:mt-0 transition-all hover:border-emerald-500/30">
                   <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold">ID Użytkownika</span>
                   <span className="text-xs sm:text-sm md:text-base font-black text-emerald-500 tracking-widest drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{currentUser.id}</span>
                </div>
              )}
            </div>
            {reviewsData && (
              <>
                <button onClick={() => setIsReviewsModalOpen(true)} className="mt-3 flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 px-3 py-1.5 rounded-full transition-colors group cursor-pointer">
                   <Star size={14} className="text-yellow-500 fill-yellow-500 group-hover:animate-pulse" />
                   <span className="text-[10px] font-black text-yellow-500">{reviewsData.averageRating?.toFixed(1)} / 5.0</span>
                   <span className="text-[9px] text-yellow-500/50 uppercase tracking-widest border-l border-yellow-500/20 pl-2 ml-1">Zobacz Profil ({reviewsData.totalReviews})</span>
                </button>
                <EliteStatusBadges subject={currentUser} isDark compact className="mt-2" />
                <div className="mt-3 w-full max-w-[420px]">
                  <PasskeyToggle user={currentUser} />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center shrink-0 mb-1 md:mb-0 self-start md:self-auto">
            {isPartnerPlan ? (
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/15 to-[#D4AF37]/10 border border-amber-500/35 flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
                <Crown size={14} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200/90">EstateOS Partner</span>
              </div>
            ) : currentUser?.isPro ? (
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37]/10 to-[#AA771C]/10 border border-[#D4AF37]/30 flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <Crown size={14} className="text-[#D4AF37]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">PRO</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Zwykły Użytkownik</span>
              </div>
            )}
          </div>
        </motion.div>

        {isPremium && <ProWidget currentUser={currentUser} />}

        <div className="flex justify-center mb-8 sm:mb-10 relative z-20">
          <div className="w-full md:w-auto max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-[#111] border border-white/5 p-1.5 rounded-full inline-flex md:flex relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] min-w-max md:min-w-0">
            {profileTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabSwitch(tab)}
                className={`relative px-4 sm:px-5 md:px-10 py-3 sm:py-3.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-colors z-10 whitespace-nowrap ${activeTab === tab ? 'text-black' : 'text-white/40 hover:text-white/80'}`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    initial={false}
                    transition={{ type: "spring" as any, stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-20">
                    {tab === 'radar'
                        ? 'Radar Inwestycji'
                        : tab === 'my_offers'
                        ? 'Moje Ogłoszenia'
                        : tab === 'offers'
                        ? 'Ulubione'
                        : tab === 'planowanie' ? 'Planowanie' : 'Transakcje'}
                 </span>
              </button>
            ))}
          </div>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={`bg-[#111] border rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 md:p-12 mb-8 flex flex-col md:flex-row items-center gap-5 sm:gap-8 relative overflow-hidden transition-colors duration-700
            ${activeTab === 'radar' ? 'border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.05)]' :
              activeTab === 'planowanie' ? 'border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.05)]' :
              'border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.05)]'
            }`}
        >
          <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-colors duration-700
            ${activeTab === 'radar' ? 'bg-emerald-500/10' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'bg-blue-500/10' :
              activeTab === 'planowanie' ? 'bg-purple-500/10' :
              'bg-yellow-500/10'
            }`}></div>

          <div className={`relative w-20 h-20 sm:w-24 sm:h-24 bg-black/50 border rounded-full flex items-center justify-center shrink-0 transition-colors duration-700
            ${activeTab === 'radar' ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]' :
              (activeTab === 'offers' || activeTab === 'my_offers') ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' :
              activeTab === 'planowanie' ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' :
              'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]'
            }`}>
              
             {activeTab === 'radar' && (
  isPartnerMode ? (
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
               {activeTab === 'radar' && <>Radar <span className="text-emerald-500">Inwestycyjny</span></>}
              {activeTab === 'my_offers' && <>Moje <span className="text-blue-500">Ogłoszenia</span></>}
              {activeTab === 'offers' && <>Moje <span className="text-blue-500">Ulubione</span></>}
               {activeTab === 'planowanie' && <>Centrum <span className="text-purple-500">Planowania</span></>}
                {activeTab === 'transakcje' && <>Szyfrowane <span className="text-amber-500">Deal Roomy</span></>}
            </h2>
            <p className="text-white/60 text-xs sm:text-sm max-w-2xl leading-relaxed">
               {activeTab === 'radar' && 'Ustaw kryteria dokładnie jak w aplikacji mobilnej: lokalizacja, metraż, budżet i tryb transakcji. Po zapisaniu radar natychmiast przelicza dopasowania.'}
               {activeTab === 'my_offers' && 'Zarządzaj własnymi ogłoszeniami w jednym miejscu: statusy, odświeżenia, negocjacje i statystyki wyświetleń.'}
               {activeTab === 'offers' && 'Twoja lista obserwowanych ofert z rynku. Szybko wrócisz do kluczowych nieruchomości i sprawdzisz ich aktualny status.'}
               {activeTab === 'planowanie' && 'Kalendarz działa jako centrum ustaleń: prezentacje, negocjacje i priorytety dnia, zsynchronizowane z Twoimi transakcjami.'}
               {activeTab === 'transakcje' && 'Szyfrowane Deal Roomy do finalizacji spraw: wiadomości, oferty cenowe, dokumenty i kontakt ze stroną transakcji.'}
            </p>
          </div>
        </motion.div>

        {activeTab === 'radar' && (
          <div className="flex flex-col gap-8 mb-12">
            
            <>
            <div className="relative w-full mb-12 p-8 md:p-10 rounded-[3rem] border border-white/5 bg-gradient-to-br from-[#111111] to-[#050505] shadow-[inset_0_0_80px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden group transition-all duration-700 hover:shadow-[inset_0_0_80px_rgba(0,0,0,0.9),0_30px_60px_rgba(16,185,129,0.1)]">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen transition-opacity duration-1000 group-hover:opacity-100 opacity-50" />
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 mix-blend-overlay pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center border-b border-white/5 pb-8">
                <div className="flex items-center gap-6">
                  <div className="relative flex items-center justify-center w-[4.75rem] h-[4.75rem] rounded-full bg-black border border-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] overflow-hidden">
                     <div className="absolute inset-0 rounded-full border border-emerald-500/25 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                     {isPartnerMode ? (
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
                    <h3 className="text-white text-2xl font-black tracking-tighter">Aktywne Skanowanie</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px] ${isPartnerMode ? 'bg-amber-400 shadow-amber-500/60' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                      <span className={`text-[10px] uppercase font-bold tracking-[0.3em] ${isPartnerMode ? 'text-amber-500/85' : 'text-emerald-500/80'}`}>
                        {isPartnerMode ? 'Podwójny radar w toku' : 'Radar w toku'}
                      </span>
                    </div>
                  </div>
                </div>

                <button onClick={openRadarEditor} className="relative flex items-center gap-2 px-5 py-3 bg-transparent border border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 text-white/80 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-pointer group">
                  <SlidersHorizontal size={14} className="text-emerald-500 transition-colors" />
                  <span>KALIBRUJ RADAR</span>
                </button>
              </div>

              <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-black/50 border border-white/5 rounded-[1.5rem] p-5 shadow-inner flex flex-col justify-center transition-all hover:bg-black/80">
                    <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mb-2">Lokalizacja</span>
                    <span className="text-white font-black text-sm truncate">{currentUser?.searchDistricts ? currentUser.searchDistricts.split(',').length + ' Dzielnic' : 'Wszystkie'}</span>
                 </div>
                 <div className="bg-black/50 border border-white/5 rounded-[1.5rem] p-5 shadow-inner flex flex-col justify-center transition-all hover:bg-black/80">
                    <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mb-2">Minimalny Metraż</span>
                    <span className="text-white font-black text-sm truncate">{currentUser?.searchAreaFrom ? 'Od ' + currentUser.searchAreaFrom + ' m²' : 'Dowolny metraż'}</span>
                 </div>
                 <div className="bg-black/50 border border-white/5 rounded-[1.5rem] p-5 shadow-inner flex flex-col justify-center transition-all hover:bg-black/80">
                    <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mb-2">Pokoje</span>
                    <span className="text-white font-black text-sm truncate">{currentUser?.searchRooms ? currentUser.searchRooms + ' Pok.' : 'Wszystkie'}</span>
                 </div>
                 <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[1.5rem] p-5 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] flex flex-col justify-center relative overflow-hidden group/price">
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none group-hover/price:w-full transition-all duration-700" />
                    <span className="text-emerald-500/50 text-[9px] uppercase tracking-[0.2em] font-bold mb-2 relative z-10">Maks. Budżet</span>
                    <span className="text-emerald-500 font-black text-sm truncate relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{currentUser?.searchMaxPrice ? 'Do ' + new Intl.NumberFormat('pl-PL').format(currentUser.searchMaxPrice) + ' PLN' : 'Bez limitu'}</span>
                 </div>
              </div>
              
              {currentUser?.searchAmenities && (
                 <div className="relative z-10 mt-6 pt-6 border-t border-white/5 flex gap-3 flex-wrap items-center">
                    <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mr-2">Zaznaczone Udogodnienia:</span>
                    {currentUser.searchAmenities.split(',').map((a: string) => (
                       <span key={a} className="px-4 py-2 bg-[#161616] border border-white/10 rounded-xl text-white/70 text-[10px] font-black uppercase tracking-widest shadow-inner">{a.trim()}</span>
                    ))}
                 </div>
              )}
            </div>

            {/* MODAL KONFIGURACJI RADARU */}
            <AnimatePresence>
            {isEditRadarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
                        <button onClick={() => setIsEditRadarOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer z-50"><X size={20}/></button>
                        
                        <div className="flex items-center gap-4 mb-8 z-10 relative">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                <Radar className="text-emerald-500" size={20} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white">Konfiguracja Radaru</h3>
                                <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Ustawienia Matchmakingu</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveRadar} className="space-y-6 z-10 relative">

                            {/* PRZEŁĄCZNIK KUPNO / WYNAJEM DLA RADARU */}
                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-3">Cel Poszukiwań</label>
                                <div className="flex bg-[#111] border border-white/10 rounded-full p-1.5 shadow-inner relative w-full">
                                    <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.33%-4px)] bg-[#0a0a0a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${radarFormData.searchTransactionType === 'sale' ? 'translate-x-[calc(100%+4px)]' : (radarFormData.searchTransactionType === 'rent' ? 'translate-x-[calc(200%+8px)]' : 'translate-x-0')}`}></div>
                                    
                                    <button type="button" onClick={() => setRadarFormData({...radarFormData, searchTransactionType: 'all'})} className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${radarFormData.searchTransactionType === 'all' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>Wszystkie</button>
                                    <button type="button" onClick={() => setRadarFormData({...radarFormData, searchTransactionType: 'sale'})} className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${radarFormData.searchTransactionType === 'sale' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>Na Kupno</button>
                                    <button type="button" onClick={() => setRadarFormData({...radarFormData, searchTransactionType: 'rent'})} className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${radarFormData.searchTransactionType === 'rent' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>Na Najem</button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-3">Miasto bazowe</label>
                                <select
                                  className="w-full bg-[#111] border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                                  value={radarCity}
                                  onChange={(e) => {
                                    const nextCity = canonicalizeCity(e.target.value) || "Warszawa";
                                    setRadarCity(nextCity);
                                    setRadarFormData((prev) => ({ ...prev, searchDistricts: [] }));
                                  }}
                                >
                                  {(radarCatalog.strictCities.length ? radarCatalog.strictCities : ["Warszawa"]).map((city) => (
                                    <option key={city} value={city}>{city}</option>
                                  ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-3">Preferowane Dzielnice / Miasta</label>
                                <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-500/30 scrollbar-track-white/5 p-2 bg-[#111] border border-white/10 rounded-2xl grid grid-cols-2 gap-2">
                                    {availableRadarDistricts.map((d) => (
                                        <div key={d} onClick={() => toggleDistrict(d)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 cursor-pointer transition-all hover:bg-black/80 hover:border-emerald-500/30 ${radarFormData.searchDistricts.includes(d) ? 'bg-emerald-500/10 border-emerald-500/50' : ''}`}>
                                            <div className={`w-4 h-4 rounded border border-white/20 transition-all flex items-center justify-center ${radarFormData.searchDistricts.includes(d) ? 'bg-emerald-500 border-emerald-500' : ''}`}>
                                                {radarFormData.searchDistricts.includes(d) && <Check size={12} className="text-black" strokeWidth={3} />}
                                            </div>
                                            <span className={`text-[11px] font-bold uppercase tracking-widest transition-all ${radarFormData.searchDistricts.includes(d) ? 'text-white' : 'text-white/60'}`}>{d}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-2">Minimalny Metraż (m²)</label>
                                    <div className="relative">
                                        <Target size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none" />
                                        <input type="text" className="w-full bg-[#111] border border-white/10 rounded-xl px-5 pl-12 py-4 text-white font-black text-lg outline-none focus:border-emerald-500 transition-colors" placeholder="np. 40" value={radarFormData.searchAreaFrom || ''} onChange={e => setRadarFormData({...radarFormData, searchAreaFrom: e.target.value.replace(/\D/g, '')})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-2">Liczba Pokoi (Select)</label>
                                    <div className="relative">
                                        <SlidersHorizontal size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none" />
                                        <select className="w-full bg-[#111] border border-white/10 rounded-xl px-5 pl-12 py-4 text-white font-black text-lg outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer" value={radarFormData.searchRooms || ''} onChange={e => setRadarFormData({...radarFormData, searchRooms: e.target.value})}>
                                            <option value="">Wszystkie</option>
                                            <option value="1">1 Pokój</option>
                                            <option value="2">2 Pokoje</option>
                                            <option value="3">3 Pokoje</option>
                                            <option value="4">4+ Pokoje</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold block mb-2">Maksymalny Budżet (PLN)</label>
                                <div className="relative">
                                    <DollarSign size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none" />
                                    <input type="text" className="w-full bg-[#111] border border-white/10 rounded-xl px-5 pl-12 py-4 text-emerald-500 font-black outline-none focus:border-emerald-500 transition-colors text-2xl" placeholder="2 500 000" value={radarFormData.searchMaxPrice || ''} onChange={e => setRadarFormData({...radarFormData, searchMaxPrice: e.target.value.replace(/\D/g, '')})} />
                                </div>
                            </div>

                            <button type="submit" disabled={isSavingRadar} className="group relative w-full mt-4 py-5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 cursor-pointer overflow-hidden border border-emerald-300/50">
                                <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out skew-x-12" />
                                <div className="relative z-10 flex items-center justify-center gap-3">
                                    <Radar size={20} className={`text-black ${isSavingRadar ? 'animate-spin' : 'group-hover:animate-spin'}`} />
                                    <span className="drop-shadow-sm">{isSavingRadar ? 'SKANOWANIE RYNKU...' : 'ZAKTUALIZUJ RADAR'}</span>
                                </div>
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
              {isRadarUpdating && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
                    <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, 120, 240, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-48 h-48 rounded-full border border-emerald-500/30 flex items-center justify-center shadow-[0_0_150px_rgba(16,185,129,0.2)] mb-10 relative overflow-hidden">
                       <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 animate-[ping_3s_linear_infinite]" />
                       <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent animate-[pulse_2s_linear_infinite]" />
                       <Radar size={80} className="text-emerald-500 drop-shadow-[0_0_20px_#10b981]" strokeWidth={1} />
                    </motion.div>
                    <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-4xl md:text-7xl font-black text-white tracking-tighter text-center">
                       Rekalibracja Radaru...
                    </motion.h2>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-emerald-500 font-bold uppercase tracking-[0.5em] text-[11px] md:text-sm mt-8 animate-pulse text-center">
                       Aktualizujemy kryteria • Przeszukujemy bazę ukrytych ofert
                    </motion.p>
                 </motion.div>
              )}
            </AnimatePresence>
            </>

            
            {/* WYNIKI RADARU */}
            {currentUser?.matchedOffers && currentUser.matchedOffers.length > 0 ? (
              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                 {currentUser.matchedOffers.map((offer: any) => (
                     <div key={offer.id} className="bg-[#0a0a0a] border border-emerald-500/30 rounded-[2.5rem] p-6 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)] hover:border-emerald-500 transition-all">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-black font-black px-4 py-1 rounded-bl-2xl rounded-tr-[2.5rem] text-xs z-20 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                           DOPASOWANIE {offer.matchScore || 100}%
                        </div>
                        <div className="flex gap-4 mb-4 relative z-10">
                           <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-emerald-500/30">
                              <img src={offer.imageUrl || '/placeholder.jpg'} className="w-full h-full object-cover" alt={offer.title || 'Oferta radaru'} />
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className={`self-start px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest mb-1 ${offer.transactionType === 'rent' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>{offer.transactionType === 'rent' ? 'Wynajem' : 'Sprzedaż'}</span>
                              <span className={`self-start px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest mb-1 ${offer.transactionType === 'rent' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>{offer.transactionType === 'rent' ? 'Wynajem' : 'Sprzedaż'}</span>
                              <a href={`/oferta/${offer.id}`} target="_blank" className="font-bold text-white text-sm truncate hover:text-emerald-400 transition-colors">
                                 {offer.title}
                              </a>
                              
                              <div className="flex flex-col mt-1">
                                {offer.transactionType === 'rent' ? (
                                    <>
                                        <p className="font-black text-xs text-blue-400">{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN <span className="text-[9px] text-white/40">/ mc</span></p>
                                        <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5 flex gap-1">
                                            {offer.deposit && <span>Kaucja: {offer.deposit}</span>} 
                                            {offer.rentAdminFee && <span>| Admin: {offer.rentAdminFee}</span>}
                                        </p>
                                    </>
                                ) : (
                                    <p className="font-black text-xs text-emerald-500">{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN</p>
                                )}
                              </div>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/50 uppercase tracking-widest font-bold mb-4">
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-white/5 truncate flex items-center gap-1"><MapPin size={12}/> {offer.district || 'Warszawa'}</span>
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-white/5 truncate flex items-center gap-1"><Target size={12}/> {offer.area} m²</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/50 uppercase tracking-widest font-bold mb-4">
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-white/5 truncate flex items-center gap-1"><Building2 size={12}/> {offer.rooms} Pokoje</span>
                           <span className="bg-[#111] px-3 py-2 rounded-xl border border-white/5 truncate flex items-center gap-1"><span className="text-emerald-500 animate-pulse">●</span> Aktywna</span>
                        </div>
                        <button onClick={() => window.open(`/oferta/${offer.id}`, '_blank')} className="w-full mt-2 py-3 bg-transparent border border-emerald-500/50 text-emerald-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-black transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer">
                           ZOBACZ OFERTĘ
                        </button>
                     </div>
                 ))}
              </div>
            ) : ( /* Przestrzeń na zmatchowane wyniki (Pusty stan) */
            <div className={`col-span-full flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-[#050505] relative overflow-hidden ${isPartnerMode ? 'border-amber-500/25' : 'border-emerald-500/20'}`}>
                <div className={`flex items-center gap-4 mb-6 relative z-10`}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                  >
                  <Radar size={48} className={isPartnerMode ? 'text-emerald-500/25' : 'text-emerald-500/20'} />
                  </motion.div>
                  {isPartnerMode && (
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    >
                      <Radar size={48} className="text-amber-500/25" />
                    </motion.div>
                  )}
                </div>
                <p className="text-white/40 font-bold uppercase tracking-widest text-sm relative z-10 text-center px-4">
                  {mode === 'BUYER'
                    ? 'Radar skanuje oferty w okresie premiery i po niej. Wyniki pojawią się tutaj.'
                    : isPartnerMode
                      ? 'Gdy pojawią się dopasowane preferencje kupujących i dopasowane oferty pod Twój profil prowadzenia, rekordy pokażemy tutaj jako leady Radar Pro.'
                    : 'Czekamy na dopasowanie zweryfikowanych kupców do Twoich ogłoszeń.'}
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
              <div className="flex bg-[#111] border border-white/10 rounded-full p-1.5 shadow-inner relative w-full max-w-[560px]">
                <div
                  className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.33%-4px)] bg-[#0a0a0a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
                    offerSectionFilter === 'ACTIVE' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  Aktywne ({offersBySection.ACTIVE.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOfferSectionFilter('PENDING')}
                  className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${
                    offerSectionFilter === 'PENDING' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  Oczekujące ({offersBySection.PENDING.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOfferSectionFilter('COMPLETED')}
                  className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 text-center ${
                    offerSectionFilter === 'COMPLETED' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  Zakończone ({offersBySection.COMPLETED.length})
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(offersVisibleInSection.length === 0) ? (
              <div className="col-span-full flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-[2.5rem] bg-[#0a0a0a] relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/5 pointer-events-none" />
                <p className="text-white/40 font-bold uppercase tracking-widest text-sm mb-8 relative z-10">
                  {isFavoritesTab
                    ? 'Nie obserwujesz jeszcze żadnych ofert.'
                    : offerSectionFilter === 'ACTIVE'
                      ? 'Brak aktywnych ogłoszeń.'
                      : offerSectionFilter === 'PENDING'
                        ? 'Brak ogłoszeń oczekujących.'
                        : 'Brak zakończonych ogłoszeń.'}
                </p>
                {isListingsTab && (
                  <motion.button
                    animate={{ scale: [1, 1.05, 1], boxShadow: ['0px 0px 0px rgba(59,130,246,0)', '0px 0px 30px rgba(59,130,246,0.3)', '0px 0px 0px rgba(59,130,246,0)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    onClick={goToAddOffer} className="relative z-10 flex items-center gap-3 px-8 py-4 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600 hover:border-blue-500 text-white rounded-full font-black uppercase tracking-wider text-sm transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.4)] cursor-pointer group hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                    <span className="text-xl leading-none text-blue-400 group-hover:text-white">+</span> DODAJ SWOJĄ NIERUCHOMOŚĆ
                  </motion.button>
                )}
                {isFavoritesTab && (
                  <button
                    type="button"
                    onClick={() => { window.location.href = '/szukaj'; }}
                    className="relative z-10 px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-black uppercase tracking-wider text-sm transition-all duration-300 cursor-pointer"
                  >
                    Odkryj Rynek
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
                    className="bg-[#0a0a0a] border border-dashed border-white/25 hover:border-blue-400/80 rounded-[2.5rem] p-6 flex flex-col items-center justify-center min-h-[300px] cursor-pointer transition-colors group relative overflow-hidden shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                  >
                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors duration-500" />
                    <div className="w-16 h-16 rounded-full border border-blue-400/40 group-hover:border-blue-300 flex items-center justify-center mb-4 transition-colors shadow-[0_0_18px_rgba(59,130,246,0.25)]">
                      <Plus size={28} className="text-blue-300 group-hover:text-blue-200 transition-colors" />
                    </div>
                    <p className="text-white/75 font-bold uppercase tracking-widest text-xs group-hover:text-white transition-colors">Dodaj Kolejną</p>
                  </motion.button>
                );
                
                const now = new Date();
                const expiresAt = new Date(offer.expiresAt);
                const createdAt = new Date(offer.createdAt || now);
                const status = String(offer?.status || '').toUpperCase();
                const isPending = ['PENDING', 'PENDING_APPROVAL', 'IN_REVIEW'].includes(status);
                const isArchived = classifyOfferSection(offer) === 'COMPLETED';
                const diffTime = Math.abs(expiresAt.getTime() - now.getTime());
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isNew = (now.getTime() - createdAt.getTime()) < (1000 * 60 * 60 * 24);
                const offerBids = (crmData?.bids || []).filter((b: any) => b.offerId === offer.id && b.status === 'PENDING');
                const offerPrimaryImage = resolveOfferPrimaryImage(offer);

                return (
                  <div key={offer.id} className={`bg-[#0a0a0a] border rounded-[2.5rem] p-6 relative overflow-hidden transition-all duration-300 shadow-xl group ${isArchived ? 'border-red-500/20 opacity-90' : 'border-white/10 hover:border-emerald-500/30 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.2)] hover:-translate-y-1'}`}>
                    
                    {!isArchived && <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}

                    
                    {isFavoritesTab && !offer.isDummy && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLikedOfferIds(prev => prev.includes(offer.id.toString()) ? prev.filter(id => id !== offer.id.toString()) : [...prev, offer.id.toString()]);
                        }}
                        className="absolute top-6 right-6 z-30 p-2.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md hover:scale-110 transition-all duration-300 group/heart shadow-[0_4px_15px_rgba(0,0,0,0.5)]"
                      >
                        <Heart 
                          size={20} 
                          className={`transition-all duration-500 ${likedOfferIds.includes(offer.id.toString()) ? 'fill-emerald-500 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110' : 'text-white/40 group-hover/heart:text-emerald-400'}`} 
                        />
                      </button>
                    )}
                    
                    <div className="flex gap-4 mb-6 relative z-10">
                      <div className={`w-16 h-16 rounded-2xl overflow-hidden shrink-0 border ${isArchived ? 'border-red-500/30 grayscale' : 'border-white/10'}`}>
                         {offerPrimaryImage ? (
                           <img
                             src={offerPrimaryImage}
                             alt={offer.title || 'Miniatura oferty'}
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
                              <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-red-500/20">Wygasło</span>
                            ) : isPending ? (
                              <span className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse">W Weryfikacji</span>
                            ) : isNew ? (
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)] animate-pulse">Nowe!</span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Aktywne</span>
                            )}
                          </div>
                        </div>
                        
                          
                          <span className={`self-start px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border mb-2 ${offer.transactionType === 'rent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>{offer.transactionType === 'rent' ? 'Wynajem' : 'Sprzedaż'}</span>
                          <div className="flex flex-col mt-0.5">
                            {offer.transactionType === 'rent' ? (
                              <>
                                <p className={`font-black text-xs ${isArchived ? 'text-white/40' : 'text-blue-400'}`}>{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN <span className="text-[9px] text-white/30">/ miesiąc</span></p>
                                {!isArchived && (
                                  <div className="flex flex-col gap-0.5 mt-1 text-[8px] font-bold text-white/40 uppercase tracking-widest">
                                    {offer.deposit && <span>Kaucja: <span className="text-white/70">{offer.deposit} PLN</span></span>}
                                    {offer.rentAdminFee && <span>Czynsz adm: <span className="text-white/70">{offer.rentAdminFee} PLN</span></span>}
                                    {offer.petsAllowed && <span className="text-emerald-500/80">Zwierzęta akceptowane</span>}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className={`font-black text-xs ${isArchived ? 'text-white/40' : 'text-emerald-500'}`}>{Number(String(offer.price).replace(/\D/g,'') || 0).toLocaleString('pl-PL')} PLN</p>
                            )}
                          </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-4 text-center border mb-6 relative overflow-hidden transition-colors duration-300 ${isArchived ? 'bg-black border-red-500/10' : 'bg-[#111] border-white/5 group-hover:border-emerald-500/20 group-hover:bg-[#111]/80'}`}>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Zasięg (Wyświetlenia)</p>
                      <p className={`text-3xl font-black ${isArchived ? 'text-white/20' : 'text-white'}`}>{offer.views || 0}</p>
                    </div>

                    
                    {/* MODUŁ NEGOCJACJI (BIDS) */}
                    {offerBids.length > 0 && isListingsTab && !isArchived && (
                        <div className="mb-6 bg-gradient-to-br from-amber-500/10 to-amber-700/5 border border-amber-500/30 rounded-[1.5rem] p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none"></div>
                            <h4 className="text-[10px] uppercase tracking-widest font-black text-amber-500 mb-3 flex items-center gap-2"><DollarSign size={14} /> Oczekujące Propozycje</h4>
                            <div className="flex flex-col gap-3 relative z-10">
                                {offerBids.map((bid: any) => (
                                    <div key={bid.id} className="bg-[#050505]/60 border border-white/5 rounded-xl p-4 flex flex-col gap-3 backdrop-blur-md hover:border-amber-500/30 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-lg font-black text-amber-400">{Number(bid.amount).toLocaleString('pl-PL')} PLN</p>
                                                <p className="text-[9px] uppercase tracking-widest text-white/40 font-bold">{bid.financing === 'CASH' ? '💰 Gotówka' : '🏦 Kredyt Bankowy'}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <button onClick={(e) => handleBidResponse(e, bid.id, 'ACCEPTED')} className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300">Akceptuj</button>
                                            <button onClick={(e) => handleBidResponse(e, bid.id, 'DECLINED')} className="py-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300">Odrzuć</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
        
                    <div className="relative z-10 flex flex-col gap-2">
                      {isArchived ? (
                        <button 
                          onClick={() => handleRefreshOffer(offer.id)}
                          disabled={refreshingId === offer.id}
                          className="group relative w-full py-4 rounded-[1.5rem] overflow-visible transition-all duration-500 flex items-center justify-center gap-3 border border-blue-500/50 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:scale-[1.04] z-10 disabled:opacity-70 disabled:hover:scale-100"
                        >
                          <div className="absolute inset-0 w-full h-full rounded-[1.5rem] overflow-hidden pointer-events-none" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e40af 100%)" }}>
                            <div className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-30deg] pointer-events-none group-hover:animate-[luxurySweep_1.5s_ease-in-out_infinite]" style={{ left: '-100%' }} />
                          </div>
                          <RefreshCcw className={`text-white relative z-10 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${refreshingId === offer.id ? 'animate-spin' : 'group-hover:rotate-180'}`} size={18} />
                          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                            {refreshingId === offer.id ? 'Przetwarzam...' : 'Odnów Ofertę (24 PLN)'}
                          </span>
                        </button>
                      ) : (
                        <div className="w-full py-4 rounded-[1.5rem] bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className={daysLeft <= 5 ? 'text-yellow-500' : 'text-emerald-500'} /> 
                            <div className="flex flex-col text-left">
                              <span className="block text-white/50 text-[8px]">Ważne do: {new Date(offer.expiresAt).toLocaleDateString('pl-PL')}</span>
                              <span className={`block font-black text-xs ${daysLeft <= 5 ? 'text-yellow-500' : 'text-emerald-500'}`}>Pozostało {daysLeft} Dni</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 mt-2 relative z-20">
                        <div className="relative group/edit">
                          <Link href={`/edytuj-oferte/${offer.id}`} className="w-full py-3 rounded-[1.5rem] bg-transparent border border-white/15 text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all">
                             <Edit2 size={14} className="text-emerald-300" /> Edytuj
                          </Link>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-yellow-500/30 text-[9px] text-yellow-500 px-3 py-1.5 rounded-lg opacity-0 group-hover/edit:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.2)] z-50">
                             Edycja cofa do weryfikacji.
                          </div>
                        </div>
                        <button onClick={() => setOfferToArchive(offer)} className="w-full py-3 rounded-[1.5rem] bg-transparent border border-red-500/30 text-[10px] font-black uppercase tracking-widest text-red-300 flex items-center justify-center gap-2 hover:bg-red-500/12 hover:text-red-200 transition-all cursor-pointer">
                           <ArchiveX size={14} className="text-red-300" /> Wstrzymaj
                        </button>
                      </div>

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
            className="mb-6 px-5 py-2.5 bg-[#111] border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white hover:border-amber-500/50 transition-all flex items-center gap-2 w-fit shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          >
            ← Wróć do listy transakcji
          </button>
          <DealRoom dealId={selectedDealId} currentUserId={currentUser?.id} />
        </div>
      ) : isolatedDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-[2.5rem] bg-[#0a0a0a] relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/5 pointer-events-none" />
                <p className="text-white/40 font-bold uppercase tracking-widest text-sm mb-4 relative z-10">Brak aktywnych transakcji</p>
                <p className="text-white/20 text-xs text-center max-w-sm relative z-10">Złóż ofertę zakupu lub zaakceptuj propozycję od kupca, aby otworzyć szyfrowany Deal Room.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sortedIsolatedDeals.map((deal: any) => (
                  <div key={deal.dealId} onClick={() => setSelectedDealId(deal.dealId)} className="cursor-pointer block">
                    <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 hover:border-amber-500/30 rounded-[2rem] p-6 transition-all duration-300 group cursor-pointer shadow-xl hover:shadow-[0_10px_30px_rgba(245,158,11,0.1)]">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex gap-4 items-center min-w-0">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/5 group-hover:border-amber-500/50 transition-colors">
                            <img src={resolveOfferPrimaryImage(deal.offer) || '/placeholder.jpg'} className="w-full h-full object-cover" alt={deal.offer?.title || 'Oferta'} />
                          </div>
                          <div className="flex flex-col justify-center min-w-0">
                            <p className="text-white font-bold text-sm truncate">{deal.offer?.title || 'Nieruchomość'}</p>
                            <p className="text-emerald-500 font-black text-xs">{Number(String(deal.offer?.price || 0).replace(/\D/g,'')).toLocaleString('pl-PL')} PLN</p>
                            <p className="text-[9px] text-white/35 uppercase tracking-widest font-black mt-1">Deal #{deal.dealId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {deal.unreadCount > 0 && (
                            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              +{deal.unreadCount} nieodczytane
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePinDeal(Number(deal.dealId)); }}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                              pinnedDealIds.includes(Number(deal.dealId))
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/80'
                            }`}
                          >
                            {pinnedDealIds.includes(Number(deal.dealId)) ? 'Przypięte' : 'Przypnij'}
                          </button>
                        </div>
                      </div>
                      <div className="bg-black/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50 group-hover:bg-amber-500 transition-colors" />
                        <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest mb-1 ml-2">
                          Ostatnia wiadomość {deal.lastMessageSenderName ? `• ${deal.lastMessageSenderName}` : ''}
                        </p>
                        <p className="text-white/70 text-xs truncate ml-2">{deal.lastMessage}</p>
                        <div className="mt-2 ml-2 flex items-center gap-2 text-[9px] text-white/40 uppercase tracking-widest font-black">
                          <span>{new Date(deal.lastMessageAt || deal.updatedAt || deal.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          {(deal.pendingBidCount > 0 || deal.pendingAppointmentCount > 0) && (
                            <span className="text-emerald-400">
                              {deal.pendingBidCount > 0 ? `${deal.pendingBidCount} oczek. ofert` : ''}{deal.pendingBidCount > 0 && deal.pendingAppointmentCount > 0 ? ' • ' : ''}{deal.pendingAppointmentCount > 0 ? `${deal.pendingAppointmentCount} oczek. terminów` : ''}
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
                            <span>Profil: {deal.otherParty.name}</span>
                            <EliteStatusBadges subject={deal.otherParty} isDark compact />
                          </button>
                          <Link
                            href={`/profil/${deal.otherParty.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] uppercase tracking-widest font-black text-white/45 hover:text-white transition-colors"
                          >
                            Otwórz profil
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


      
        {activeTab === 'planowanie' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            <div className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                <div>
                   <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                     <Calendar className="text-emerald-500" /> Kalendarz Prezentacji
                   </h2>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Podgląd rezerwacji i negocjacji</p>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.6)]"></div>
                    <span className="text-[9px] uppercase tracking-widest font-black text-white/50">Negocjacje</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                    <span className="text-[9px] uppercase tracking-widest font-black text-white/50">Zatwierdzone</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 14 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  
                  const dayAppointments = (crmData.appointments || []).filter((app: any) => {
                      const appDate = new Date(app.proposedDate);
                      return isSameCalendarDay(appDate, d);
                  });
                  
                  const hasNegotiation = dayAppointments.some((a:any) => ['PROPOSED', 'COUNTER'].includes(a.status));
                  const hasAccepted = dayAppointments.some((a:any) => a.status === 'ACCEPTED');

                  const isToday = i === 0;

                  return (
                    <div key={i} onClick={() => setSelectedDate(d)} className={`relative bg-[#111] rounded-2xl p-4 flex flex-col items-center justify-center border transition-all duration-300 hover:scale-[1.05] cursor-pointer ${isToday ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-white/20'}`}>
                      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-emerald-500' : 'text-white/30'}`}>
                        {d.toLocaleDateString('pl-PL', { weekday: 'short' })}
                      </span>
                      <span className={`text-3xl font-black mb-3 ${isToday ? 'text-emerald-500' : 'text-white'}`}>
                        {d.getDate()}
                      </span>
                      
                      <div className="flex gap-1.5 h-2">
                         {hasNegotiation && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>}
                         {hasAccepted && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>}
                         {!hasNegotiation && !hasAccepted && <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>}
                      </div>

                      {isToday && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-8 text-center border-t border-white/5 pt-6">
                 <p className="text-white/30 text-xs italic">Kliknij dzień, aby zobaczyć szczegóły prezentacji lub zatwierdzić przychodzące negocjacje.</p>
              </div>

            </div>
          </motion.div>
        )}

      
        <AnimatePresence>
          {selectedDate && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedDate(null)}>
                <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                   <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-emerald-500/10 to-transparent">
                      <div>
                         <h3 className="text-2xl font-black text-white tracking-tighter">Plan Dnia</h3>
                         <p className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">{selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <button onClick={() => setSelectedDate(null)} className="p-3 bg-white/5 hover:bg-red-500 hover:text-white rounded-full transition-colors text-white/50"><X size={20}/></button>
                   </div>
                   
                   <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                      {(() => {
                         const dayApps = (crmData.appointments || []).filter((a: any) => {
                            const appDate = new Date(a.proposedDate);
                            return isSameCalendarDay(appDate, selectedDate);
                         });
                         
                         if (dayApps.length === 0) return <div className="text-center py-10 text-white/30 font-bold uppercase tracking-widest text-xs">Brak zaplanowanych spotkań i negocjacji na ten dzień.</div>;
                         
                         return dayApps.map((app: any, idx: number) => (
                            <div key={idx} className="bg-[#111] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                               <div>
                                  <div className="flex items-center gap-2 mb-1">
                                     <Clock size={14} className="text-emerald-500" />
                                     <span className="font-black text-lg text-white">{new Date(app.proposedDate).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                                     {['PROPOSED', 'COUNTER'].includes(app.status) && <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-[8px] font-black uppercase tracking-widest rounded border border-yellow-500/30 animate-pulse">W Negocjacji</span>}
                                     {app.status === 'ACCEPTED' && <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest rounded border border-emerald-500/30">Zatwierdzone</span>}
                                  </div>
                                  <p className="text-xs text-white/50 font-bold flex items-center gap-2 mt-1">Oferta: <Link href={`/oferta/${app.offerId}`} target="_blank" onClick={(e) => e.stopPropagation()} className="px-2 py-0.5 bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 rounded-md text-emerald-500 transition-all cursor-pointer inline-flex items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">ID {app.offerId} <span className="text-[10px] font-black">↗</span></Link></p>
                                  <div className="mt-2 flex items-center gap-2">
    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
        <span className="text-[8px] text-emerald-500 font-black">👤</span>
    </div>
    <div className="flex flex-col">
        {(() => {
            const client = crmData?.contacts?.find((c: any) => String(c.id) === String(app.buyerId) || c.email === app.buyerId);
            if (client) {
                return (
                    <>
                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">{client.name || client.email.split('@')[0]}</span>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewingProfile(client); }} className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mt-1.5 cursor-pointer hover:text-yellow-400 transition-colors inline-flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 px-2.5 py-1 rounded-full border border-yellow-500/20 w-fit shadow-[0_0_10px_rgba(234,179,8,0.1)]"><span className="text-[10px]">★</span> Zobacz Profil</button>
                    </>
                );
            }
            return <span className="text-[10px] text-white/50 uppercase tracking-widest">Wczytywanie profilu...</span>;
        })()}
    </div>
</div>
                               </div>
                               <motion.button whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setManagingApp(app); }} style={{ backgroundColor: '#10b981', color: '#000', fontWeight: '900', padding: '12px 24px', borderRadius: '12px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: '0 10px 20px rgba(16,185,129,0.3)' }}>ZARZĄDZAJ</motion.button>
                            </div>
                         ));
                      })()}
                   </div>
                </motion.div>
             </motion.div>
          )}
        </AnimatePresence>
</div>
    
          <AnimatePresence>
            {managingApp && (() => {
               const dates = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
               const hours = [];
               for (let h = 8; h <= 20; h++) { hours.push(`${h.toString().padStart(2, '0')}:00`); if (h !== 20) hours.push(`${h.toString().padStart(2, '0')}:30`); }

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
                                    {isRescheduling ? (rescheduleStep === 1 ? 'Wybierz Dzień' : rescheduleStep === 2 ? 'Wybierz Godzinę' : 'Wyślij') : (managingApp.status === 'ACCEPTED' ? 'Zatwierdzone' : 'Propozycja Terminu')}
                                </h3>
                                <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: managingApp.status === 'ACCEPTED' ? '#10b981' : '#D4AF37', margin: '4px 0 0 0' }}>{isRescheduling ? `KROK ${rescheduleStep} Z 3` : 'Negocjacje EstateOS'}</p>
                             </div>
                          </div>
                          <motion.button whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setManagingApp(null); setIsRescheduling(false); setRescheduleStep(1); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px', transition: 'background-color 0.2s' }}>✕</motion.button>
                       </div>

                       <AnimatePresence>
                          {!isRescheduling && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                   <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.4)' }}>{managingApp.status === 'COUNTER' ? 'Nowa Propozycja' : 'Data i Czas'}</span>
                                   <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>{new Date(managingApp.proposedDate).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: '16px' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                   <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Adres</span>
                                   <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{managingApp.status === 'ACCEPTED' ? (managingApp.offer?.address || 'Złota 44, Warszawa') : 'Ukryty przed akceptacją'}</span>
                                      {managingApp.status === 'ACCEPTED' ? (
                                          <span style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', display: 'block', marginTop: '4px' }}>Mieszkanie nr {managingApp.offer?.apartmentNumber || '12B'}</span>
                                      ) : (
                                          <span style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', display: 'block', marginTop: '4px' }}>ID oferty: {managingApp.offerId || managingApp.id}</span>
                                      )}
                                   </div>
                                </div>
                             </motion.div>
                          )}
                       </AnimatePresence>
                    </div>

                    <div className="custom-scrollbar" style={{ padding: '0 32px 32px 32px', overflowY: 'auto', flex: 1 }}>
                       <AnimatePresence mode="wait">
                          {managingApp.status === 'ACCEPTED' && !isRescheduling ? (
                             <motion.div key="accepted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <motion.button whileHover={{ scale: 1.02, backgroundColor: '#7f1d1d', borderColor: '#ef4444' }} whileTap={{ scale: 0.98 }} onClick={async () => {
    if(!confirm('Czy na pewno chcesz odwołać to spotkanie? Kupujący otrzyma powiadomienie.')) return;
    try {
        const res = await fetch('/api/appointments/respond', { credentials: 'include', 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: managingApp.id, status: 'CANCELED', message: 'Sprzedający odwołał prezentację przez CRM.' })
        });
        if(res.ok) {
            setManagingApp(null);
            window.location.reload();
        } else alert('Błąd: Nie udało się odwołać spotkania.');
    } catch(err) { alert('Błąd połączenia z serwerem.'); }
}} style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ⚠️ Odwołaj Prezentację
                                </motion.button>
                             </motion.div>
                          ) : !isRescheduling ? (
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
            setManagingApp({...managingApp, status: 'ACCEPTED'});
            setTimeout(() => window.location.reload(), 1500); 
        } else alert('Błąd: Nie udało się zapisać w bazie.');
    } catch(err) { alert('Błąd połączenia z serwerem.'); }
}} style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#10b981', color: '#000', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 10px 20px rgba(16,185,129,0.3)' }}>
                                    ✓ POTWIERDŹ
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.03, backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.2)' }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsRescheduling(true); setRescheduleStep(1); }} style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer' }}>
                                    ZMIEŃ TERMIN
                                </motion.button>
                             </motion.div>
                          ) : (
                             <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                
                                {rescheduleStep === 1 && (
                                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                                      {dates.map((d, i) => {
                                        const isSelected = newPropDate === d.toISOString();
                                        return ( 
                                          <button key={i} onClick={(e) => { e.preventDefault(); setNewPropDate(d.toISOString()); setTimeout(() => setRescheduleStep(2), 200); }} className={`relative w-full aspect-square rounded-[1.2rem] border flex flex-col items-center justify-center transition-all duration-300 group ${isSelected ? 'bg-[#0a0a0a] border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5'}`}>
                                            <span className={`text-[9px] font-black uppercase mb-1 tracking-widest ${isSelected ? 'text-emerald-500/80' : 'text-white/40'}`}>{d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}</span>
                                            <span className={`text-xl font-black ${isSelected ? 'text-emerald-500' : 'text-white/90'}`}>{d.getDate()}</span>
                                            <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${isSelected ? 'text-emerald-500/80' : 'text-white/30'}`}>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</span>
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
                                          <button key={h} onClick={(e) => { e.preventDefault(); setNewPropTime(h); setTimeout(() => setRescheduleStep(3), 200); }} className={`py-4 rounded-xl border text-sm font-black tracking-widest transition-all duration-300 ${isSelected ? 'bg-[#0a0a0a] text-emerald-500 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5 text-white/80'}`}>{h}</button> 
                                        )
                                      })}
                                    </div>
                                )}

                                {rescheduleStep === 3 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ backgroundColor: '#111', padding: '16px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                                            <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', marginBottom: '8px' }}>Twój Nowy Termin</p>
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
            setManagingApp({...managingApp, status: 'COUNTER', proposedDate: newIsoString});
            setIsRescheduling(false);
            setRescheduleStep(1);
            setTimeout(() => window.location.reload(), 1500);
        } else alert('Błąd: Nie udało się wysłać propozycji.');
    } catch(err) { alert('Błąd połączenia z serwerem.'); }
}} className="relative overflow-hidden w-full group flex items-center justify-center gap-3 rounded-[2rem] border-2 px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-[#0a0a0a] hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                                            <ShieldCheck size={18} className="relative z-10 transition-colors duration-300 text-emerald-500 group-hover:text-white" /> 
                                            <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-[0.2em] transition-colors duration-300 text-emerald-500 group-hover:text-white">Wyślij Kontrofertę</span>
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
                        
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: '#111', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 0 30px rgba(234,179,8,0.1)', flexShrink: 0 }}>
                            <span style={{ fontSize: '40px' }}>👤</span>
                        </div>
                        
                        <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.05em' }}>{viewingProfile.name || viewingProfile.email?.split('@')[0]}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', padding: '4px 12px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '100px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 10px #10b981' }}></span>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#10b981', fontWeight: '900' }}>Tożsamość Zweryfikowana</span>
                        </div>

                        <div onClick={() => setProfileReviewsOpen(true)} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '24px', width: '100%', marginBottom: '16px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(234,179,8,0.3)'; e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                            <div style={{ fontSize: '48px', fontWeight: '900', color: '#eab308', lineHeight: '1', marginBottom: '8px', textShadow: '0 0 30px rgba(234,179,8,0.3)' }}>{viewingProfile.reviewsData?.averageRating?.toFixed(1) || '5.0'}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '10px' }}>
                                {[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= (viewingProfile.reviewsData?.averageRating || 5) ? '#eab308' : 'rgba(255,255,255,0.1)', fontSize: '18px' }}>★</span>)}
                            </div>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#eab308', fontWeight: '900' }}>{viewingProfile.reviewsData?.totalReviews > 0 ? `${viewingProfile.reviewsData.totalReviews} Opinii • Zobacz szczegóły` : 'Brak Ocen'}</span>
                        </div>

                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <span style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: '#fff' }}>{viewingProfile.buyerType === 'AGENCY' ? 'Agencja' : viewingProfile.buyerType === 'PRO' ? 'PRO' : 'Standard'}</span>
                                <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontWeight: 'bold' }}>Typ Konta</span>
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
                                <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontWeight: 'bold' }}>Stawiennictwo</span>
                            </div>
                        </div>

                        {viewingProfile.publicOffers && viewingProfile.publicOffers.length > 0 && (
                            <div style={{ marginTop: '16px', width: '100%', backgroundColor: '#111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'block', marginBottom: '12px' }}>Aktywne Oferty ({viewingProfile.publicOffers.length})</span>
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
                 
                 <ReviewsModal isOpen={profileReviewsOpen} onClose={() => setProfileReviewsOpen(false)} reviewsData={viewingProfile.reviewsData} userName={viewingProfile.name || viewingProfile.email?.split('@')[0]} subject={viewingProfile} />

              </motion.div>
            )}
          </AnimatePresence>

      <AnimatePresence>
        {profileModalUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }} className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 max-w-2xl w-full shadow-2xl relative">
              <button onClick={() => { setProfileModalUser(null); setProfileModalData(null); }} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
              <h3 className="text-xl font-black tracking-tight text-white mb-1">{profileModalUser.name || 'Profil użytkownika'}</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-6">ID: {profileModalUser.id}</p>
              <EliteStatusBadges subject={profileModalData?.user || profileModalUser} isDark compact className="mb-5" />

              {profileModalLoading ? (
                <div className="py-12 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
              ) : profileModalData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">Średnia ocen</p>
                      <p className="text-lg font-black text-amber-300">
                        {Array.isArray(profileModalData.reviews) && profileModalData.reviews.length
                          ? (profileModalData.reviews.reduce((a: number, r: any) => a + Number(r.rating || 0), 0) / profileModalData.reviews.length).toFixed(1)
                          : '0.0'} ★
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">Komentarze</p>
                      <p className="text-lg font-black text-white">{Array.isArray(profileModalData.reviews) ? profileModalData.reviews.length : 0}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">Inne oferty</p>
                      <p className="text-lg font-black text-emerald-400">{Array.isArray(profileModalData.offers) ? profileModalData.offers.length : 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-3">Ostatnie komentarze</p>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {(profileModalData.reviews || []).slice(0, 5).map((r: any) => (
                        <div key={r.id} className="rounded-lg bg-black/40 border border-white/5 p-3">
                          <p className="text-xs text-amber-300 font-black">{Number(r.rating || 0)} ★</p>
                          <p className="text-xs text-white/70">{r.comment || 'Bez komentarza'}</p>
                        </div>
                      ))}
                      {(!profileModalData.reviews || profileModalData.reviews.length === 0) && <p className="text-xs text-white/35">Brak komentarzy.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-3">Pozostałe oferty użytkownika</p>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {(profileModalData.offers || []).slice(0, 10).map((o: any) => (
                        <Link key={o.id} href={`/oferta/${o.id}`} target="_blank" className="block rounded-lg bg-black/40 border border-white/5 p-3 hover:border-emerald-500/30 transition-colors">
                          <p className="text-xs text-white font-bold truncate">{o.title || `Oferta #${o.id}`}</p>
                          <p className="text-[10px] text-emerald-400 font-black">{Number(String(o.price || 0).replace(/\D/g, '')).toLocaleString('pl-PL')} PLN</p>
                        </Link>
                      ))}
                      {(!profileModalData.offers || profileModalData.offers.length === 0) && <p className="text-xs text-white/35">Brak innych ofert.</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-white/40 text-sm">Nie udało się pobrać profilu.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {offerToArchive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
              
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                 <ArchiveX size={24} className="text-red-500" />
              </div>
              
              <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Wstrzymać Sprzedaż?</h3>
              <p className="text-white/50 text-xs mb-6 leading-relaxed">
                 Ta akcja jest natychmiastowa. Ogłoszenie <br/><strong className="text-white text-sm">{offerToArchive.title}</strong><br/> zniknie z rynku i trafi do archiwum.
              </p>
              
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-8 text-left">
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-red-500">Ważna Informacja</p>
                 </div>
                 <p className="text-xs text-white/60 font-medium leading-relaxed">
                   Obecny opłacony czas wyświetlania zostanie <span className="text-white font-bold">bezpowrotnie zakończony</span>. Aby przywrócić ofertę na mapę w przyszłości, konieczne będzie jej standardowe odnowienie (24 PLN).
                 </p>
              </div>
              
              <div className="flex gap-3">
                 <button onClick={() => setOfferToArchive(null)} className="flex-1 py-4 rounded-[1.5rem] border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all cursor-pointer">Anuluj</button>
                 <button onClick={handleArchiveSubmit} className="flex-1 py-4 rounded-[1.5rem] bg-gradient-to-r from-red-600 to-red-500 text-[10px] font-black uppercase tracking-widest text-white hover:scale-[1.02] shadow-[0_10px_20px_rgba(239,68,68,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <ArchiveX size={14} /> Zdejmij z rynku
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReviewsModal 
          isOpen={isReviewsModalOpen} 
          onClose={() => setIsReviewsModalOpen(false)} 
          reviewsData={reviewsData} 
          userName={currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : (currentUser?.name || 'Inwestor')}
          subject={currentUser}
      />
</div>
  );
}
