"use client";
import PublicProfileModal from "@/components/PublicProfileModal";
import { useEffect, useState, useRef, use } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MapPin, ArchiveX, Eye, Shield, Briefcase, Phone, MessageCircle, Video, CheckCircle2, CalendarPlus, Star, Lock, Timer, FileImage, X, Maximize2 , ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import AppointmentModal from "@/components/AppointmentModal";
import BiddingModal from "@/components/BiddingModal";

function OfferDetails({ offer, currentUser }: { offer: any, currentUser: any }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  
  const rawImages = (() => { if (!offer.images) return []; try { const p = JSON.parse(offer.images); return Array.isArray(p) ? p : offer.images.split(','); } catch(e) { return offer.images.split(','); } })();
  const allImages = [offer.imageUrl, ...rawImages].filter((v: string, i: number, a: string[]) => v && v.length > 5 && a.indexOf(v) === i);
  const images = allImages.length > 0 ? allImages : ["/placeholder.jpg"];

  const isArchived = offer.status === 'ARCHIVED' || (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now());
  const isAgency = offer?.user?.buyerType === 'agency' || offer?.advertiserType === 'agency';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBiddingOpen, setIsBiddingOpen] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      if (e.key === 'Escape') setIsGalleryOpen(false);
      if (e.key === 'ArrowRight') setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      if (e.key === 'ArrowLeft') setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, images.length]);

  const openGallery = (index: number) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const [negotiatorsCount, setNegotiatorsCount] = useState(0);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);

  // 🔥 SILNIK FOMO: LOGIKA CZASU I BLOKADY 🔥
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const isOwner = currentUser && (currentUser.id === offer.userId || currentUser.email === offer.user?.email || currentUser.email === offer.contactEmail);
  const isPro = offer._viewerIsPro || currentUser?.role === 'ADMIN';
  
  const createdAtTime = offer.createdAt ? new Date(offer.createdAt).getTime() : Date.now();
  const unlockTime = createdAtTime + (12 * 60 * 60 * 1000); // 12 Godzin

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = unlockTime - now;
      setTimeLeft(diff > 0 ? diff : 0);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockTime]);

  // Kłódka zatrzaskuje się, jeśli nie minęło 12h, user nie jest PRO i nie jest właścicielem
  const isLocked = timeLeft > 0 && !isPro && !isOwner;

  // Formatowanie zegara (HH:MM:SS)
  const h = Math.floor(timeLeft / (1000 * 60 * 60));
  const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  useEffect(() => {
    const fetchNegotiations = async () => {
      const offerId = offer.id || offer._id;
      if (!offerId) return;
      try {
        const res = await fetch(`/api/offers/${offerId}/negotiations`);
        if (res.ok) {
          const data = await res.json();
          setNegotiatorsCount(data.count || 0);
        }
      } catch (error) {}
    };
    fetchNegotiations();
  }, [offer]);

  const rawPriceStr = String(offer.price || '0').replace(/\D/g, '');
  const rawAreaStr = String(offer.area || '0').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const numericPrice = parseInt(rawPriceStr) || 0;
  const numericArea = parseFloat(rawAreaStr) || 0;
  
  const priceDisplay = numericPrice > 0 ? numericPrice.toLocaleString('pl-PL') : 'Brak Danych';
  const pricePerSqm = (numericPrice > 0 && numericArea > 0) ? Math.round(numericPrice / numericArea).toLocaleString('pl-PL') : 'Brak';

    // Sekcje Specyfikacji Luksusowej
  
  const ensureAuthenticated = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      alert('Musisz być zalogowany, aby rozpocząć negocjacje.');
      window.location.href = '/login';
      return false;
    }
    return true;
  };

  const openBidFlow = (e: React.MouseEvent) => {
    if (!ensureAuthenticated(e)) return;
    setIsBiddingOpen(true);
  };

  const openAppointmentFlow = (e: React.MouseEvent) => {
    if (!ensureAuthenticated(e)) return;
    setIsModalOpen(true);
  };

  const locationParams = [
    { label: "Miejscowość", value: offer.city || 'Warszawa' },
    { label: "Dzielnica", value: isLocked ? 'Ukryta (Off-Market)' : offer.district },
    { label: "Adres (Ulica)", value: isLocked ? 'Ukryta (Off-Market)' : offer.address }
  ].filter(p => p.value);

  const mainParams = [
    { label: "Powierzchnia", value: numericArea > 0 ? `${numericArea} m²` : null },
    { label: "Cena za m²", value: pricePerSqm !== 'Brak' && !isLocked ? `${pricePerSqm} PLN` : (isLocked ? 'Ukryta' : null) },
    { label: "Liczba pokoi", value: offer.rooms },
    { label: "Piętro", value: offer.floor },
    { label: "Stan wykończenia", value: offer.condition || offer.finishCondition }
  ].filter(p => p.value);

  const buildingParams = [
    { label: "Typ obiektu", value: offer.propertyType },
    { label: "Rok budowy", value: offer.buildYear },
    { label: "Ogrzewanie", value: offer.heating },
    { label: "Umeblowane", value: offer.furnished },
    { label: "Czynsz", value: offer.rent ? `${String(offer.rent).replace(/\D/g, '')} PLN` : null },
    { label: "Dostępność", value: offer.availabilityDate ? new Date(offer.availabilityDate).toLocaleDateString('pl-PL') : null }
  ].filter(p => p.value);

  return (
    <main className="bg-[#050505] min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black pb-32">
      
      <div ref={ref} className="relative w-full h-[100vh] overflow-hidden bg-black">
        <div className="absolute top-24 sm:top-32 left-4 sm:left-6 right-4 sm:right-6 z-40 flex flex-col sm:flex-row justify-between items-start gap-4 pointer-events-none">
          
          {/* Lewa strona: Guzik powrotu */}
          <div className="flex flex-wrap gap-2 sm:gap-4 pointer-events-auto">
            <Link href="/" className="px-4 sm:px-6 py-2 sm:py-3 bg-black/40 backdrop-blur-2xl rounded-full border border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all shadow-2xl flex items-center gap-2">
              ← Powrót do mapy
            </Link>
          </div>
          
        </div>

        {/* Tło pod zdjęciem */}
        <motion.div style={{ y: bgY, backgroundImage: `url('${images[0]}')` }} className={`absolute inset-0 z-0 bg-cover bg-center opacity-60 ${isLocked ? 'blur-sm' : ''} ${isArchived ? 'grayscale' : ''}`} />
        
        {/* Warstwa interaktywna dla kliknięcia w galerię (oprócz paska na dole) */}
        <div onClick={() => !isLocked && openGallery(0)} className="absolute inset-0 flex flex-col items-center justify-end pb-32 z-10 px-4 cursor-pointer hover:bg-black/10 transition-colors">
            
            {/* --- JEDEN FENOMENALNY DASHBOARD INFORMACYJNY (UX PREMIUM) --- */}
            <div className="flex justify-center mb-6 relative z-20 w-full px-4 sm:px-8 max-w-5xl mx-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 px-5 py-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl hover:border-white/20 transition-all duration-300">
                
                {/* 1. Kapsuła Tożsamości i Zaufania (Klikalna) */}
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPublicProfileId(String(offer?.user?.id || offer?.userId)); }} 
                  className="flex items-center gap-3 shrink-0 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full px-4 py-2 transition-all duration-300 group cursor-pointer shadow-inner"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/30 group-hover:border-emerald-500/50 transition-colors">
                     {offer?.user?.buyerType === 'AGENCY' ? <Briefcase size={14} className="text-blue-400" /> : <span className="text-[14px] group-hover:scale-110 transition-transform">👤</span>}
                  </div>
                  
                  <div className="flex flex-col items-start leading-tight">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black tracking-widest text-white/90 uppercase group-hover:text-white transition-colors">{offer?.user?.name || (offer?.user?.buyerType === 'AGENCY' ? 'Agencja' : 'Właściciel Prywatny')}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(i => <Star key={i} size={10} className={i <= Math.round(offer?.user?.reviewsData?.averageRating || 5) ? "text-yellow-500 fill-yellow-500" : "text-white/20"} />)}
                          <span className="text-[9px] font-bold text-yellow-500/80 tracking-widest ml-1">{offer?.user?.reviewsData?.averageRating?.toFixed(1) || '5.0'}</span>
                      </div>
                  </div>
                </button>

                <span className="w-px h-6 bg-white/10 shrink-0 hidden sm:block"></span>
                
                {/* 2. Kapsuła Danych Operacyjnych (Odsłony, Data, ID) */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0 px-2">
                  <div className="flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">ID Oferty</span>
                      <span className="text-[11px] font-black text-emerald-500 tracking-[0.2em] px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">{offer?.id || offer?._id}</span>
                  </div>
                  
                  <span className="w-px h-6 bg-white/10"></span>

                  <div className="flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Wyświetleń</span>
                      <div className="flex items-center gap-1.5">
                          <Eye size={12} className="text-white/70" />
                          <span className="text-[11px] font-black text-white/90 tracking-widest">{offer?.views || 0}</span>
                      </div>
                  </div>

                  <span className="w-px h-6 bg-white/10 hidden sm:block"></span>

                  <div className="flex flex-col items-center justify-center hidden sm:flex">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Na Rynku Od</span>
                      <span className="text-[11px] font-black text-white/70 tracking-widest">{offer?.createdAt ? new Date(offer.createdAt).toLocaleDateString('pl-PL') : 'Brak danych'}</span>
                  </div>
                </div>

              </div>
            </div>
            
            
<h1 className="text-4xl sm:text-[7vw] font-bold tracking-tighter text-center leading-tight drop-shadow-2xl px-4 sm:px-8 max-w-7xl mx-auto [text-wrap:balance]">
              {isLocked ? "Oferta Off-Market" : offer.title}
            </h1>
        </div>
        <div className="absolute bottom-0 w-full h-1/2 z-20 bg-gradient-to-t from-[#050505] to-transparent" />
        {isArchived && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
             <div className="bg-[#050505]/90 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                   <ArchiveX size={32} className="text-white/50" />
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white mb-2 uppercase tracking-tighter opacity-50">Nieaktualne</h2>
                <p className="text-white/30 text-xs sm:text-sm font-bold uppercase tracking-widest">Ta oferta została zarchiwizowana</p>
             </div>
          </div>
        )}
      </div>

      <div className="relative">
        {/* 🔥 POTEŻNA NAKŁADKA FOMO (WYŚWIETLA SIĘ TYLKO ZABLOKOWANYM) 🔥 */}
        {isLocked && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4 pb-20">
            <div className="bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[3rem] max-w-2xl w-full shadow-[0_0_100px_rgba(0,0,0,0.9)] text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50"></div>
              
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-black border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 relative z-10 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                <Lock size={40} className="text-emerald-500" />
              </div>
              
              <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 relative z-10 tracking-tighter">Oferta Zablokowana</h2>
              <p className="text-white/50 text-xs sm:text-sm mb-8 relative z-10 max-w-md mx-auto leading-relaxed">Ta nieruchomość jest świeżo dodana i widoczna wyłącznie dla zweryfikowanych Inwestorów PRO i Agencji. Zostanie publicznie odblokowana za:</p>
              
              <div className="text-4xl sm:text-6xl font-mono font-black text-emerald-500 mb-10 tracking-widest drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] relative z-10 flex items-center justify-center gap-4">
                <Timer size={36} className="text-emerald-500/50" />
                {timeString}
              </div>
              
              <Link href="/cennik" className="btn-action w-full block py-5 sm:py-6 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest relative z-10 shadow-[0_20px_40px_rgba(16,185,129,0.2)] bg-emerald-500 text-black hover:bg-emerald-400 transition-colors">
                Przejdź na PRO i Odblokuj Teraz
              </Link>
              <p className="mt-6 text-[10px] uppercase tracking-widest text-white/30 font-bold relative z-10">Omiń kolejkę i zobacz dokładny adres, zdjęcia oraz kontakt do właściciela.</p>
            </div>
          </div>
        )}

        {/* ORYGINALNA ZAWARTOŚĆ (ZAMAZANA JEŚLI ZABLOKOWANA) */}
        <div className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-30 flex flex-col xl:flex-row gap-8 transition-all duration-1000 ${isLocked ? 'blur-2xl opacity-20 pointer-events-none select-none h-[850px] overflow-hidden' : ''}`}>
          
          <div className="xl:w-2/3 flex flex-col gap-10 sm:gap-16">
            {images.length > 1 && (
              <div className={`grid grid-cols-4 gap-2 sm:gap-3 md:gap-4 auto-rows-[80px] sm:auto-rows-[120px] md:auto-rows-[180px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-black/20 p-2 sm:p-3 border border-white/5 backdrop-blur-3xl shadow-2xl ${isArchived ? 'grayscale opacity-50' : ''}`}>
                {images[1] && <div className="col-span-4 row-span-2 md:row-span-3 rounded-[1.2rem] sm:rounded-[1.8rem] overflow-hidden"><img onClick={() => openGallery(1)} src={images[1]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[2] && <div className="col-span-2 row-span-1 md:row-span-2 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(2)} src={images[2]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[3] && <div className="col-span-2 row-span-1 md:row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(3)} src={images[3]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[4] && <div className="col-span-1 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(4)} src={images[4]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[5] && <div className="col-span-1 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(5)} src={images[5]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[6] && <div className="col-span-2 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(6)} src={images[6]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
              </div>
            )}

            <div>
                <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-6 sm:mb-8">{priceDisplay} PLN</h2>
                
                <div className="bg-white/5 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 backdrop-blur-md shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-6">O Nieruchomości</h3>
                  <p className="text-sm sm:text-base text-white/80 leading-loose font-light whitespace-pre-line break-words">{offer.description}</p>
                </div>

                {offer.amenities && offer.amenities.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 md:p-10 backdrop-blur-md mt-6 sm:mt-8 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-6">Atuty i Udogodnienia</h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {offer.amenities.split(',').filter(Boolean).map((amenity: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-black/40 border border-emerald-500/30 px-3 sm:px-4 py-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-xs sm:text-sm font-bold text-white/90">{amenity.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {offer.floorPlan && !isLocked && (
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 md:p-10 backdrop-blur-md mt-6 sm:mt-8 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
                    <FileImage size={14} /> Rzut Nieruchomości
                  </h3>
                  <div 
                    onClick={() => setIsFloorplanModalOpen(true)}
                    className="relative w-full h-[300px] sm:h-[400px] rounded-[1.5rem] overflow-hidden border border-white/10 cursor-pointer group bg-[#111]"
                  >
                    <img src={offer.floorPlan} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" alt="Rzut Lokalu" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       <span className="px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white font-bold text-[10px] uppercase tracking-widest border border-white/20 flex items-center gap-2 shadow-2xl">
                         <Maximize2 size={14} /> Powiększ
                       </span>
                    </div>
                  </div>
                </div>
                )}

            </div>
          </div>

          <div className="xl:w-1/3 flex flex-col relative mt-8 xl:mt-0">
            <div className="xl:sticky top-32 space-y-6 pt-2">
              
                            <div className="space-y-6">
                {/* SEKCJA LOKALIZACJI */}
                {locationParams.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-md shadow-2xl flex flex-col gap-5">
                    <h4 className="text-[9px] uppercase tracking-widest text-emerald-500 font-black mb-1">Lokalizacja</h4>
                    {locationParams.map((param, idx) => (
                      <div key={idx} className={`flex justify-between items-center ${idx !== locationParams.length - 1 ? 'border-b border-white/5 pb-5' : ''}`}>
                        <span className="text-white/40 uppercase tracking-widest text-[10px] sm:text-xs font-bold">{param.label}</span>
                        <span className="font-bold text-right text-sm sm:text-base max-w-[65%]">{param.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SEKCJA PARAMETRÓW GŁÓWNYCH */}
                {mainParams.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-md shadow-2xl flex flex-col gap-5">
                    <h4 className="text-[9px] uppercase tracking-widest text-emerald-500 font-black mb-1">Główne Parametry</h4>
                    {mainParams.map((param, idx) => (
                      <div key={idx} className={`flex justify-between items-center ${idx !== mainParams.length - 1 ? 'border-b border-white/5 pb-5' : ''}`}>
                        <span className="text-white/40 uppercase tracking-widest text-[10px] sm:text-xs font-bold">{param.label}</span>
                        <span className="font-bold text-right text-sm sm:text-base max-w-[65%]">{param.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SEKCJA BUDYNKU */}
                {buildingParams.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-md shadow-2xl flex flex-col gap-5">
                    <h4 className="text-[9px] uppercase tracking-widest text-emerald-500 font-black mb-1">Budynek & Koszty</h4>
                    {buildingParams.map((param, idx) => (
                      <div key={idx} className={`flex justify-between items-center ${idx !== buildingParams.length - 1 ? 'border-b border-white/5 pb-5' : ''}`}>
                        <span className="text-white/40 uppercase tracking-widest text-[10px] sm:text-xs font-bold">{param.label}</span>
                        <span className="font-bold text-right text-sm sm:text-base max-w-[65%]">{param.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {negotiatorsCount > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-4 bg-[#0a0a0a] border border-red-500/20 rounded-full px-6 py-3 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)] justify-center relative overflow-hidden group cursor-default mt-6">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_#ef4444]"></span>
                    </span>
                    <span className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em] relative z-10">
                      {negotiatorsCount === 1 ? '1 osoba złożyła ofertę' : `${negotiatorsCount} osoby złożyły ofertę`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-2.5 backdrop-blur-3xl shadow-2xl mt-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                
                <div className="flex flex-col gap-2.5 relative z-10">
                  {isArchived ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center border-t border-white/5 mt-4">
                     <ArchiveX size={24} className="text-white/20 mb-3" />
                     <p className="text-white/40 font-black uppercase tracking-widest text-[10px]">Kontakt Wyłączony</p>
                     <p className="text-white/20 text-[8px] mt-1 uppercase tracking-widest">Oferta znajduje się w archiwum</p>
                  </div>
                ) : (
                  <>
                    <button
                    onClick={openBidFlow}
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    className="relative overflow-hidden w-full group flex flex-col items-center justify-center gap-1 rounded-[2rem] px-4 py-6 transition-all duration-500 hover:scale-[1.03] active:scale-[0.98] shadow-[0_15px_40px_rgba(255,255,255,0.15)] hover:shadow-[0_20px_60px_rgba(255,255,255,0.3)] cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    
                    <span className="relative z-10 flex items-center gap-3 text-lg sm:text-xl font-black tracking-tight" style={{ color: '#000000' }}>
                      <><Briefcase size={22} style={{ color: "#000000" }} /> Złóż Ofertę / Negocjuj</>
                    </span>
                    <span className="relative z-10 text-[9px] font-black uppercase tracking-[0.3em] mt-0.5" style={{ color: 'rgba(0,0,0,0.6)' }}>
                      Rozpocznij Negocjacje
                    </span>
                  </button>

                  <button
                    onClick={openAppointmentFlow}
                    className="relative overflow-hidden w-full group flex items-center justify-center gap-3 rounded-[2rem] border-2 px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer !bg-[#0a0a0a] hover:!bg-emerald-950/40 !border-emerald-500/30 hover:!border-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                    <CalendarPlus size={18} className="relative z-10 transition-all duration-300 !text-emerald-500 group-hover:!text-white group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:rotate-[-5deg]" />
                    <span className="relative z-10 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-colors duration-300 !text-emerald-500 group-hover:!text-white">
                      Zaproponuj Termin Prezentacji
                    </span>
                  </button>

                  <div className="mt-1.5 mb-2.5 flex items-center justify-center gap-1.5 opacity-40 select-none">
                    <Shield size={10} className="text-white" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Zabezpieczone przez EstateOS™</span>
                  </div>
                  </>
                )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} offerId={offer.id || offer._id} sellerId={offer.userId || offer.user?.id || ""} />
      
      {isBiddingOpen && (
         <BiddingModal offerId={offer.id || offer._id} currentPrice={numericPrice} onClose={() => setIsBiddingOpen(false)} />
      )}

      <AnimatePresence>
        {isFloorplanModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-8"
            onClick={() => setIsFloorplanModalOpen(false)}
          >
            <button onClick={() => setIsFloorplanModalOpen(false)} className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50">
              <X size={24} />
            </button>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-5xl max-h-screen flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img src={offer.floorPlan} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 bg-[#0a0a0a]" alt="Rzut Powiększony" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    
      {/* 🔥 GALERIA ZDJĘĆ LIGHTBOX 🔥 */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-xl flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center"
            onClick={() => setIsGalleryOpen(false)}
          >
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3 px-5 py-2.5 bg-white/10 rounded-full backdrop-blur-md border border-white/10 shadow-2xl">
                <ImageIcon size={16} className="text-emerald-500" />
                <span className="text-white font-black text-[10px] tracking-widest uppercase">{currentImageIndex + 1} / {images.length}</span>
              </div>
              <button onClick={() => setIsGalleryOpen(false)} className="p-4 bg-white/10 hover:bg-red-500 rounded-full text-white transition-all shadow-2xl group">
                <X size={20} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-4 sm:left-8 p-4 sm:p-5 bg-black/50 hover:bg-emerald-500 border border-white/10 rounded-full text-white hover:text-black transition-all hover:scale-110 z-50 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <button onClick={nextImage} className="absolute right-4 sm:right-8 p-4 sm:p-5 bg-black/50 hover:bg-emerald-500 border border-white/10 rounded-full text-white hover:text-black transition-all hover:scale-110 z-50 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  <ChevronRight size={24} strokeWidth={3} />
                </button>
              </>
            )}

            <div className="w-full h-full flex items-center justify-center p-4 sm:p-20 pb-32 sm:pb-40" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence mode="wait">
                <motion.img 
                  key={currentImageIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  src={images[currentImageIndex]} 
                  className="max-w-full max-h-full object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl" 
                  alt="Galeria" 
                />
              </AnimatePresence>
            </div>

            {images.length > 1 && (
              <div className="absolute bottom-6 w-full flex justify-center px-4 z-50">
                <div className="flex gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-x-auto max-w-2xl w-full custom-scrollbar shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  {images.map((img, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setCurrentImageIndex(idx)} 
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden cursor-pointer shrink-0 border-2 transition-all duration-300 ${currentImageIndex === idx ? 'border-emerald-500 scale-105 shadow-[0_0_20px_rgba(16,185,129,0.5)] brightness-110' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-95'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    
      <PublicProfileModal 
        isOpen={!!publicProfileId} 
        userId={publicProfileId} 
        onClose={() => setPublicProfileId(null)} 
      />
    </main>
  );
}

export default function SingleOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [offer, setOffer] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const fetchUserAndOffer = async () => {
      // 1. Sprawdzamy, czy użytkownik jest PRO / Zalogowany
      try {
        const userRes = await fetch('/api/user/profile');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData && userData.email) setCurrentUser(userData);
        }
      } catch (e) {}

      // 2. Pobieramy ofertę
      const id = resolvedParams.id;
      if (!id) return;
      try {
        fetch(`/api/offers/${id}/view`, {
          method: 'POST',
          headers: { 'x-client-source': 'web' }
        }).catch(() => console.log("View count error"));
        const res = await fetch(`/api/offers/${id}`);
        if(res.ok) {
           const data = await res.json();
           setOffer(data);
        }
      } catch (error) {
        console.error("Błąd ładowania oferty:", error);
      }
    };
    fetchUserAndOffer();
  }, [resolvedParams]);

  if (!offer) return <div className="bg-black min-h-screen" />;
  
  return <OfferDetails offer={offer} currentUser={currentUser} />;
}
