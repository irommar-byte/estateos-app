"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, CheckCircle, BellRing, Phone, Lock, User, Sparkles, Shield, Star, AlertTriangle, Check, XCircle } from "lucide-react";
import Link from "next/link";
import RadarActivationEffect from "@/components/RadarActivationEffect";

const ALL_DISTRICTS = ["Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów", "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz"];
const PROPERTY_TYPES = ["Mieszkanie", "Segment", "Dom Wolnostojący", "Lokal Użytkowy", "Działka"];
const AMENITIES = ["Balkon", "Garaż/Miejsce park.", "Piwnica/Pom. gosp.", "Ogródek", "Dwupoziomowe", "Winda"];

export default function SzukajNieruchomosci() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", phone: "", type: "Mieszkanie",
    districts: [] as string[], maxPrice: "", areaFrom: "", areaTo: "", plotArea: "", buyerType: "private", amenities: [] as string[], rooms: "",
  });
  
  // LIVE VERIFICATION STATES
  const [emailStatus, setEmailStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isVerification, setIsVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/user/profile').then(res => res.json()).then(data => {
      if (data && !data.error && data.email) {
        setIsLoggedIn(true);
        setTermsAccepted(true);
        setFormData(prev => ({ 
          ...prev, 
          name: data.name || 'Użytkownik', 
          email: data.email, 
          phone: data.phone || '000000000', 
          password: 'session_active', 
          buyerType: data.buyerType || 'private',
          type: data.searchType || "Mieszkanie",
          districts: data.searchDistricts ? data.searchDistricts.split(',') : [],
          maxPrice: data.searchMaxPrice ? String(data.searchMaxPrice) : "",
          areaFrom: data.searchAreaFrom || "",
          rooms: data.searchRooms || "",
          amenities: data.searchAmenities ? data.searchAmenities.split(',') : []
        }));
      }
      setIsLoadingSession(false);
    }).catch(() => setIsLoadingSession(false));
  }, []);

  // LIVE E-MAIL CHECK
  useEffect(() => {
    if (!isLoggedIn && formData.email.includes('@')) {
      const delayDebounceFn = setTimeout(() => {
        setEmailStatus('checking');
        fetch('/api/auth/check-exists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'email', value: formData.email }) })
          .then(res => res.json()).then(d => setEmailStatus(d.exists ? 'taken' : 'available')).catch(() => setEmailStatus('idle'));
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else if (!formData.email) {
      setEmailStatus('idle');
    }
  }, [formData.email, isLoggedIn]);

  // LIVE PHONE CHECK
  useEffect(() => {
    if (!isLoggedIn && formData.phone.length >= 9) {
      const delayDebounceFn = setTimeout(() => {
        setPhoneStatus('checking');
        fetch('/api/auth/check-exists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'phone', value: formData.phone.replace(/\D/g, '') }) })
          .then(res => res.json()).then(d => setPhoneStatus(d.exists ? 'taken' : 'available')).catch(() => setPhoneStatus('idle'));
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else if (formData.phone.length < 9) {
      setPhoneStatus('idle');
    }
  }, [formData.phone, isLoggedIn]);

  const formatNumber = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  
  // VALIDATION BLOCKS 'TAKEN' ACCOUNTS
  const isFormValid = formData.name.length > 2 && formData.email.includes("@") && formData.password.length >= 6 && formData.phone.length >= 9 && formData.maxPrice.length > 0 && formData.districts.length > 0 && termsAccepted && emailStatus !== 'taken' && phoneStatus !== 'taken';

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 9);
    if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1 $2 $3');
    else if (val.length > 3) val = val.replace(/(\d{3})(\d{1,3})/, '$1 $2');
    setFormData({ ...formData, phone: val });
  };

  const toggleDistrict = (d: string) => setFormData({ ...formData, districts: formData.districts.includes(d) ? formData.districts.filter(x => x !== d) : [...formData.districts, d] });

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length > 1) {
      const newOtp = cleanValue.substring(0, 6);
      setOtp(newOtp);
      if (newOtp.length === 6) inputRefs.current[5]?.focus();
      else inputRefs.current[newOtp.length]?.focus();
      return;
    }
    const newOtpArray = otp.split('');
    newOtpArray[index] = cleanValue.slice(-1);
    setOtp(newOtpArray.join(''));
    if (cleanValue && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault(); setVerifying(true);
    try {
      const res = await fetch("/api/szukaj/weryfikacja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: formData.email, otp }) });
      if (res.ok) { 
          // AUTOMATIC LOGIN AFTER VERIFICATION
          await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email, password: formData.password }) });
          window.location.href = '/moje-konto';
          
          setIsVerification(false); 
          setIsSuccess(true); 
          if (typeof window !== 'undefined') localStorage.setItem('radar_active', 'true'); 
      } else { 
          alert("Nieprawidłowy kod SMS."); 
      }
    } catch (error) { alert("Błąd serwera"); } finally { setVerifying(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!isFormValid) return; 
    setIsSubmitting(true);
    try {
      if (isLoggedIn) {
        await fetch("/api/szukaj/aktualizuj", { method: "POST", body: JSON.stringify(formData) }).catch(() => {});
        // Ciche odpytanie ile ofert pasuje do radaru po zmianie
        fetch("/api/user/profile").then(res => res.json()).then(data => {
            if(data && data.matchedOffers) setMatchedCount(data.matchedOffers.length);
        }).catch(()=>{});
        
        setIsSuccess(true); if (typeof window !== 'undefined') localStorage.setItem('radar_active', 'true');
      } else {
        const res = await fetch("/api/szukaj/rejestracja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        if (res.ok) { 
            const data = await res.json(); 
            if (data.requiresVerification) setIsVerification(true); 
            else setIsSuccess(true); 
            if (typeof window !== 'undefined') localStorage.setItem('radar_active', 'true'); 
        }
        else {
             const errData = await res.json();
             alert(errData.error || "Wystąpił błąd podczas rejestracji.");
        }
      }
    } catch (error) { alert("Błąd połączenia z serwerem."); } finally { setIsSubmitting(false); }
  };

  if (isLoadingSession) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <main className="bg-[#050505] text-white min-h-screen p-6 pt-32 pb-40 relative">
      <AnimatePresence>
        {isSuccess && (
          <RadarActivationEffect 
             matchedCount={matchedCount} 
             onComplete={() => window.location.href = '/moje-konto'} 
          />
        )}
        
        {isVerification && !isLoggedIn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999999] bg-[#050505]/95 backdrop-blur-xl flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 md:p-10 rounded-[3rem] max-w-lg w-full shadow-2xl relative overflow-hidden">
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">Weryfikacja <span className="text-emerald-500">SMS</span></h2>
              <p className="text-sm text-white/50 mb-8">Wysłaliśmy 6-cyfrowy kod na podany numer <br/><b className="text-white tracking-widest text-lg mt-1 block">+48 {formData.phone}</b></p>
              
              <form onSubmit={handleVerifyOTP} className="space-y-8">
                <div className="flex justify-between gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={6}
                      autoFocus={index === 0}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-black bg-[#111] border border-white/10 rounded-xl sm:rounded-2xl text-emerald-500 outline-none focus:border-emerald-500/50 focus:bg-[#151515] transition-all shadow-inner"
                      value={otp[index] || ""}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>
                
                <button type="submit" disabled={verifying || otp.length !== 6} style={{ backgroundColor: (verifying || otp.length !== 6) ? "rgba(255,255,255,0.05)" : "#10b981", color: (verifying || otp.length !== 6) ? "rgba(255,255,255,0.3)" : "#000000", boxShadow: (verifying || otp.length !== 6) ? "none" : "0 0 30px rgba(16,185,129,0.5)" }} className="w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:cursor-not-allowed">
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {verifying ? <Loader2 className="animate-spin" size={24} /> : "Potwierdź Kod"}
                  </span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto">
        <button onClick={() => window.history.back()} className="text-white/40 hover:text-white mb-10 inline-block text-[10px] uppercase tracking-widest font-bold transition-colors">← Wróć</button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/5 text-white rounded-2xl flex items-center justify-center"><Search size={32} /></div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-tight">Kupujesz? <br/><span className="text-emerald-500">Znajdziemy to.</span></h1>
          </div>
          <p className="text-lg text-white/40 mb-10 font-medium">Zdefiniuj parametry. Nasz inteligentny system prześle Ci priorytetowe powiadomienie, gdy tylko pojawi się idealna oferta.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {isLoggedIn ? (
                <div className="bg-[#0a0a0a] border border-emerald-500/30 rounded-[2rem] p-8 md:col-span-2 shadow-[0_0_30px_rgba(16,185,129,0.1)] flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Zalogowano jako</p>
                    <p className="text-3xl font-black text-white mb-1">{formData.name}</p>
                    <p className="text-white/50 font-medium">{formData.email}</p>
                  </div>
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex hidden sm:flex items-center justify-center">
                     <CheckCircle className="text-emerald-500" size={32} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-white/30 transition-colors md:col-span-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3 flex items-center gap-2"><User size={14}/> Imię i Nazwisko</label>
                    <input type="text" placeholder="np. Jan Kowalski" required className="w-full text-2xl font-bold placeholder:text-white/10 bg-transparent outline-none text-white" onChange={(e) => setFormData({...formData, name: e.target.value})} value={formData.name} />
                  </div>
                  
                  {/* LIVE VERIFICATION E-MAIL */}
                  <div className={`bg-[#0a0a0a] border rounded-[2rem] p-6 transition-colors ${emailStatus === 'taken' ? 'border-red-500/50' : 'border-white/10 focus-within:border-emerald-500/50'}`}>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3 flex items-center justify-between">
                       <span className="flex items-center gap-2"><BellRing size={14}/> E-mail (do logowania)</span>
                       {emailStatus === 'checking' && <Loader2 size={12} className="animate-spin text-white/40" />}
                       {emailStatus === 'available' && <span className="flex items-center gap-1 text-emerald-500 text-[9px]"><Check size={12}/> WOLNY</span>}
                       {emailStatus === 'taken' && <span className="flex items-center gap-1 text-red-500 text-[9px]"><XCircle size={12}/> ZAJĘTY</span>}
                    </label>
                    <input type="email" placeholder="jan@kowalski.pl" required className={`w-full text-2xl font-bold placeholder:text-white/10 bg-transparent outline-none ${emailStatus === 'taken' ? 'text-red-500' : 'text-white'}`} onChange={(e) => setFormData({...formData, email: e.target.value})} value={formData.email} />
                    {emailStatus === 'taken' && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase tracking-widest">Konto z tym adresem już istnieje. Zaloguj się.</p>}
                  </div>
                  
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-white/30 transition-colors">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3 flex items-center gap-2"><Lock size={14}/> Hasło (min. 6 znaków)</label>
                    <input type="password" placeholder="••••••••" required className="w-full text-2xl font-bold placeholder:text-white/10 bg-transparent outline-none text-white" onChange={(e) => setFormData({...formData, password: e.target.value})} value={formData.password} />
                  </div>
                  
                  {/* LIVE VERIFICATION PHONE */}
                  <div className={`bg-[#0a0a0a] border rounded-[2rem] p-6 transition-colors md:col-span-2 ${phoneStatus === 'taken' ? 'border-red-500/50' : 'border-white/10 focus-within:border-emerald-500/50'}`}>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3 flex items-center justify-between">
                       <span className="flex items-center gap-2"><Phone size={14}/> Numer telefonu</span>
                       {phoneStatus === 'checking' && <Loader2 size={12} className="animate-spin text-white/40" />}
                       {phoneStatus === 'available' && <span className="flex items-center gap-1 text-emerald-500 text-[9px]"><Check size={12}/> WOLNY</span>}
                       {phoneStatus === 'taken' && <span className="flex items-center gap-1 text-red-500 text-[9px]"><XCircle size={12}/> ZAJĘTY</span>}
                    </label>
                    <div className={`flex items-center text-2xl font-bold ${phoneStatus === 'taken' ? 'text-red-500' : 'text-white'}`}>
                      <span className="text-white/20 mr-2">+48</span>
                      <input type="text" placeholder="000 000 000" required className="w-full placeholder:text-white/10 bg-transparent outline-none" onChange={handlePhoneChange} value={formData.phone} />
                    </div>
                    {phoneStatus === 'taken' && <p className="text-[9px] text-red-500 font-bold mt-2 uppercase tracking-widest">Ten numer jest przypisany do innego konta. Zaloguj się.</p>}
                  </div>
                </>
              )}

              <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 md:col-span-2 mt-4">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-5">Zaznacz dzielnice</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DISTRICTS.map(d => (
                    <div key={d} onClick={() => toggleDistrict(d)} className={`px-5 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all border ${formData.districts.includes(d) ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-transparent text-white/30 border-white/10 hover:border-white/30 hover:text-white'}`}>{d}</div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Typ Nieruchomości</label>
                <select className="w-full text-xl font-bold bg-transparent text-white outline-none" onChange={(e) => setFormData({...formData, type: e.target.value})} value={formData.type}>
                  {PROPERTY_TYPES.map(d => <option key={d} className="bg-[#050505] text-white">{d}</option>)}
                </select>
              </div>
              
              <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-emerald-500/50">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] block mb-3">Maksymalny Budżet (PLN)</label>
                <input type="text" placeholder="2 000 000" className="w-full text-2xl font-bold text-emerald-500 placeholder:text-emerald-500/20 bg-transparent outline-none mb-3" onChange={(e) => setFormData({...formData, maxPrice: formatNumber(e.target.value)})} value={formData.maxPrice} />
                <p className="text-[9px] text-white/30 font-medium uppercase tracking-widest leading-relaxed">Podaj ostateczną, górną granicę inwestycji. Zaniżenie kwoty choćby o 1 PLN wykluczy z systemu potencjalnie idealne oferty.</p>
              </div>

              {['Mieszkanie', 'Segment', 'Dom Wolnostojący', 'Lokal Użytkowy'].includes(formData.type) && (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-white/30 transition-colors">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Minimalny metraż (m²)</label>
                  <input type="text" placeholder="np. 45" className="w-full text-2xl font-bold placeholder:text-white/10 bg-transparent outline-none text-white" onChange={(e) => setFormData({...formData, areaFrom: e.target.value.replace(/[^0-9.,]/g, '')})} value={formData.areaFrom || ''} />
                </div>
              )}
              {['Mieszkanie', 'Dom Wolnostojący'].includes(formData.type) && (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-white/30 transition-colors">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Min. Liczba Pokoi</label>
                  <select className="w-full text-xl font-bold bg-transparent text-white outline-none cursor-pointer" onChange={(e) => setFormData({...formData, rooms: e.target.value})} value={formData.rooms || ""}>
                    <option value="" className="bg-[#050505] text-white">Dowolna</option>
                    <option value="1" className="bg-[#050505] text-white">1 (Kawalerka)</option>
                    <option value="2" className="bg-[#050505] text-white">2 pokoje</option>
                    <option value="3" className="bg-[#050505] text-white">3 pokoje</option>
                    <option value="4" className="bg-[#050505] text-white">4 pokoje</option>
                    <option value="5" className="bg-[#050505] text-white">5+ pokoi</option>
                  </select>
                </div>
              )}
              {['Segment', 'Dom Wolnostojący', 'Działka'].includes(formData.type) && (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 focus-within:border-white/30 transition-colors">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-3">Min. pow. działki (m²)</label>
                  <input type="text" placeholder="np. 500" className="w-full text-2xl font-bold placeholder:text-white/10 bg-transparent outline-none text-white" onChange={(e) => setFormData({...formData, plotArea: e.target.value.replace(/[^0-9.,]/g, '')})} value={formData.plotArea || ''} />
                </div>
              )}

              <div className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 md:col-span-2 shadow-2xl mb-4">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Absolutne Priorytety</label>
                <p className="text-xs text-white/40 mb-6 font-medium leading-relaxed">Zaznacz wyłącznie te udogodnienia, bez których nie wyobrażasz sobie zakupu. Każde dodatkowe kryterium drastycznie zawęża pulę dostępnych nieruchomości. Im mniej warunków, tym więcej unikalnych propozycji zaprezentuje Ci inteligentny system.</p>
                <div className="flex flex-wrap gap-3 pb-4">
                  {AMENITIES.map(a => {
                    const isSelected = formData.amenities.includes(a);
                    return (
                      <button 
                        type="button" 
                        key={a} 
                        onClick={() => {
                          const newAmenities = isSelected 
                            ? formData.amenities.filter((item: string) => item !== a) 
                            : [...formData.amenities, a];
                          setFormData({...formData, amenities: newAmenities});
                        }} 
                        style={isSelected ? { backgroundColor: '#10b981', color: '#000000', borderColor: '#34d399', boxShadow: '0 0 25px rgba(16,185,129,0.4)' } : {}}
                        className={`px-6 py-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3 ${
                          isSelected 
                          ? 'scale-105' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:bg-white/10'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-black' : 'bg-white/20'}`} />
                        {a}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="bg-[#050505] border border-white/5 rounded-[2rem] p-6 md:p-8 flex flex-col gap-6 shadow-inner">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 hover:opacity-100 transition-opacity duration-500">
                  <div className="flex flex-col gap-2">
                     <Shield className="text-emerald-500" size={20} />
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Pełna Kontrola Danych</h4>
                     <p className="text-[10px] text-white/50 leading-relaxed font-medium">To Ty decydujesz, komu i kiedy udostępniasz swój numer telefonu lub e-mail. Dane przekazywane są wyłącznie wybranym osobom po umówieniu prezentacji. Nigdy wcześniej.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                     <AlertTriangle className="text-yellow-500" size={20} />
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Prawdziwe Informacje</h4>
                     <p className="text-[10px] text-white/50 leading-relaxed font-medium">Podanie prawidłowych i działających danych kontaktowych jest kluczowe. Usprawnia to proces rezerwacji i gwarantuje sprawne zarządzanie terminami.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                     <Star className="text-orange-500 fill-orange-500" size={20} />
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white">System Jakości</h4>
                     <p className="text-[10px] text-white/50 leading-relaxed font-medium">Platforma monitoruje rzetelność użytkowników. Po odbytej prezentacji obie strony wystawiają sobie wzajemne opinie, budując zaufanie całej społeczności.</p>
                  </div>
               </div>

               <div className="pt-6 border-t border-white/5 flex items-start gap-4 cursor-pointer" onClick={() => setTermsAccepted(!termsAccepted)}>
                 <button type="button" className={`estate-checkbox ${termsAccepted ? 'checked' : ''}`}>
                    <Check size={16} strokeWidth={4} />
                 </button>
                 <label className="text-xs text-white/70 font-medium cursor-pointer leading-relaxed">
                   Zgadzam się na warunki korzystania z platformy. Oświadczam, że wprowadzone przeze mnie dane są prawdziwe. Rozumiem, że system weryfikuje użytkowników w trosce o najwyższy standard obsługi.
                 </label>
               </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !isFormValid} 
              style={{
                backgroundColor: (!isSubmitting && isFormValid) ? "#10b981" : "rgba(255,255,255,0.05)",
                color: (!isSubmitting && isFormValid) ? "#000000" : "rgba(255,255,255,0.3)",
                boxShadow: (!isSubmitting && isFormValid) ? "0 0 40px rgba(16,185,129,0.5)" : "none"
              }}
              className="w-full mt-4 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:cursor-not-allowed"
            >
              <span className="relative flex items-center justify-center gap-3 z-10">
                {isSubmitting ? <><Loader2 className="animate-spin" size={24} /> Aktywacja systemu...</> : 
                  (!isFormValid ? "Wypełnij i Zaakceptuj Warunki" : <><Sparkles className="animate-pulse" style={{ color: "#000000" }} size={24}/> Uruchom Inteligentny System Dopasowań</>)}
              </span>
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
