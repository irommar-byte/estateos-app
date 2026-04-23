"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, Key, Loader2, X, Smartphone } from "lucide-react";

const propertyTypes = ["Mieszkanie", "Apartament", "Penthouse", "Dom wolnostojący", "Segment", "Willa"];
// PEŁNA LISTA DZIELNIC
const districtsList = ["Śródmieście", "Mokotów", "Żoliborz", "Wola", "Ochota", "Wilanów", "Praga-Południe", "Praga-Północ", "Ursynów", "Bielany", "Bemowo", "Białołęka", "Targówek", "Rembertów", "Wesoła", "Wawer", "Ursus", "Włochy"];

export default function WelcomeGate() {
  const [showGate, setShowGate] = useState(false);
  const [mode, setMode] = useState<"choice" | "form">("choice");
  const [loading, setLoading] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyType, setPropertyType] = useState<string[]>([]);
  const [district, setDistrict] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState("");

  const formatNumber = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const toggleSelection = (setter: any, current: string[], item: string) => {
    if (current.includes(item)) setter(current.filter((i) => i !== item));
    else setter([...current, item]);
  };

  useEffect(() => {
    if (!localStorage.getItem("luxestate_path_chosen")) setShowGate(true);
    else setCanClose(true);

    const handleOpenGate = () => { setMode("form"); setShowGate(true); setCanClose(true); };
    window.addEventListener("open-welcome-gate", handleOpenGate);
    return () => window.removeEventListener("open-welcome-gate", handleOpenGate);
  }, []);

  const handleSellerPath = () => {
    localStorage.setItem("luxestate_path_chosen", "seller");
    setShowGate(false);
    router.push("/dodaj-oferte");
  };

  const handleSeekerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, propertyType, district, maxPrice })
      });
      localStorage.setItem("luxestate_user", email);
      localStorage.setItem("luxestate_path_chosen", "seeker");
      setShowGate(false);
      window.location.reload(); 
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!showGate) return null;

  return (
    // ZMIANA TUTAJ: overflow-y-auto i flex-col pozwalają na swobodne przewijanie na małych laptopach
    <div className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-3xl overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 py-12 relative">
        {canClose && (
          <button onClick={() => setShowGate(false)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-50 p-2 bg-black/50 rounded-full cursor-pointer">
            <X size={28} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {mode === "choice" && (
            <motion.div key="choice" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
              <div onClick={() => setMode("form")} className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 hover:bg-[#111] transition-all cursor-pointer group flex flex-col justify-center text-center items-center gap-6 min-h-[40vh] md:min-h-[50vh]">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Search size={32} className="text-white" /></div>
                <div><h2 className="text-4xl font-bold tracking-tighter mb-4">Szukam <br/><span className="text-white/30 italic">wnętrza.</span></h2><p className="text-white/40">Określ preferencje, załóż darmowe konto i bądź pierwszy.</p></div>
              </div>
              <div onClick={handleSellerPath} className="bg-white rounded-[3rem] p-12 hover:bg-gray-200 transition-all cursor-pointer group flex flex-col justify-center text-center items-center gap-6 min-h-[40vh] md:min-h-[50vh]">
                <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Key size={32} className="text-black" /></div>
                <div><h2 className="text-4xl font-bold tracking-tighter text-black mb-4">Sprzedaję <br/><span className="text-black/30 italic">nieruchomość.</span></h2><p className="text-black/50">Wystaw swoją ofertę, dotrzyj do zamożnych klientów.</p></div>
              </div>
            </motion.div>
          )}

          {mode === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl bg-[#050505] border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-2">Czego <span className="text-white/30 italic">szukasz?</span></h2>
              <p className="text-white/40 mb-8 text-sm md:text-base">Wypełnienie formularza automatycznie założy Twoje konto. Wyślemy Ci hasło na e-mail.</p>
              
              <form onSubmit={handleSeekerSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#111] p-4 rounded-2xl border border-white/5 focus-within:border-white/30 transition-colors">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Twój E-mail *</label>
                    <input type="email" required placeholder="jan@kowalski.pl" className="w-full text-xl md:text-2xl bg-transparent outline-none text-white appearance-none" onChange={(e) => setEmail(e.target.value)} value={email} />
                  </div>
                  <div className="bg-[#111] p-4 rounded-2xl border border-white/5 focus-within:border-white/30 transition-colors">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Budżet do (PLN) *</label>
                    <input type="text" required placeholder="np. 3 000 000" className="w-full text-xl md:text-2xl bg-transparent outline-none text-white appearance-none" onChange={(e) => setMaxPrice(formatNumber(e.target.value))} value={maxPrice} />
                  </div>
                </div>

                <div className="bg-[#111] p-4 rounded-2xl border border-white/5 focus-within:border-white/30 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Smartphone size={60} /></div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Numer Telefonu (Opcjonalnie)</label>
                  <input type="tel" placeholder="+48 XXX XXX XXX" className="w-full text-xl bg-transparent outline-none text-white appearance-none relative z-10" onChange={(e) => setPhone(e.target.value)} value={phone} />
                  <p className="text-xs text-emerald-500/70 mt-2 font-medium flex items-center gap-1 relative z-10">Będziemy też powiadamiać SMS-em o najpilniejszych ofertach.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Typ Wnętrza (Zaznacz wiele)</label>
                  <div className="flex flex-wrap gap-2">
                    {propertyTypes.map(pt => (
                      <button type="button" key={pt} onClick={() => toggleSelection(setPropertyType, propertyType, pt)} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border ${propertyType.includes(pt) ? '!bg-white !text-black border-white' : 'bg-transparent text-white/50 border-white/10 hover:border-white/30'}`}>
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Dzielnica (Zaznacz wiele)</label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {districtsList.map(dist => (
                      <button type="button" key={dist} onClick={() => toggleSelection(setDistrict, district, dist)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border ${district.includes(dist) ? '!bg-white !text-black border-white' : 'bg-[#111] text-white/60 border-transparent hover:border-white/20'}`}>
                        {dist}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex flex-col md:flex-row gap-4 border-t border-white/10 mt-8">
                   <button type="button" onClick={() => setMode("choice")} className="px-8 py-5 rounded-full font-bold !text-white/60 hover:!bg-white/10 transition-colors border border-white/10 cursor-pointer w-full md:w-auto">Wróć</button>
                   <button type="submit" disabled={loading} className="flex-1 !bg-emerald-500 !text-black py-5 rounded-full font-bold text-xl hover:!bg-emerald-400 transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                     {loading ? <Loader2 className="animate-spin text-black" /> : "Utwórz Konto i Odkryj Mapę"}
                   </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
