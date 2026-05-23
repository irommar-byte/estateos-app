"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Crown, Loader2, CheckCircle, X, ShieldCheck } from "lucide-react";

export default function UnifiedSmsModal({ show, phoneNumber, onClose, onVerifySuccess }: any) {
  const [smsCode, setSmsCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<any>(null); // { type: 'success' | 'error', message: string }
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // 🔥 AUTOFOCUS w pierwszym kwadracie i WebOTP API
  useEffect(() => {
    if (show && inputRefs[0].current) {
      inputRefs[0].current.focus();
      if ('credentials' in navigator) {
        navigator.credentials.get({ otp: { transport: ['sms'] } } as any)
          .then((otp: any) => {
             console.log("🔥 SMS CODE AUTO-FILLED:", otp.code);
             setSmsCode(otp.code);
             // Automatyczna weryfikacja po wypełnieniu
             setTimeout(handleVerifySms, 200); 
          })
          .catch(err => { console.error("WebOTP API error:", err); });
      }
    }
  }, [show]);

  const handleVerifySms = async () => {
    setIsSubmitting(true);
    setNotification(null); // Reset powiadomienia
    try {
      const res = await fetch('/api/auth/verify-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber, smsCode }) });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'KOD SMS POPRAWNY!' });
        onVerifySuccess(); // Przejdź do następnego kroku
      } else {
        setNotification({ type: 'error', message: 'KOD SMS NIEPRAWIDŁOWY.' });
      }
    } catch(e) {
        setNotification({ type: 'error', message: 'Błąd połączenia z serwerem.' });
    } finally { setIsSubmitting(false); }
  };

  if (!show) return null;

  const modalContent = (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(20px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} className="fixed inset-0 z-[999999] bg-black/60 flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
          <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 p-10 md:p-14 rounded-[3rem] max-w-lg w-full text-center shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col items-center">
            
            {/* Luksusowe poświaty w tle szklanego panelu */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            {/* Minimalistyczna Ikona Autoryzacji */}
            <div className="w-24 h-24 bg-black/50 border border-white/5 rounded-full flex items-center justify-center mx-auto mb-8 relative z-10 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] backdrop-blur-md">
              <ShieldCheck size={40} className="text-emerald-400" strokeWidth={1.5} />
            </div>

            {/* Szlachetna Typografia */}
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tighter text-white relative z-10">Weryfikacja Tożsamości</h2>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-2 text-white/40 relative z-10">Kod wysłano na numer</p>
            <p className="text-lg md:text-xl font-black tracking-widest text-emerald-400 mb-10 relative z-10">{phoneNumber}</p>
            
            {/* SZKLANE KWADRATY PIN */}
            <div className="flex justify-center gap-2 md:gap-4 mb-10 relative z-10 w-full px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="text"
                  maxLength={1}
                  value={smsCode[i] || ""}
                  onChange={(e) => {
                      const val = e.target.value.replace(/\D/g,'');
                      const newCode = smsCode.split('');
                      newCode[i] = val;
                      setSmsCode(newCode.join(''));
                      if (val && i < 5) inputRefs[i+1].current?.focus(); // Auto-focus next
                  }}
                  onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !smsCode[i] && i > 0) {
                          inputRefs[i-1].current?.focus(); // Auto-focus prev on backspace
                      }
                  }}
                  className="w-12 h-14 md:w-16 md:h-20 rounded-2xl bg-black/40 border border-white/5 text-white text-center text-2xl md:text-4xl font-black outline-none focus:border-emerald-500 focus:bg-[#111] focus:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 transform focus:-translate-y-1"
                />
              ))}
            </div>

            {/* Panel Przycisku i Powiadomień */}
            <div className="space-y-6 relative z-10 flex flex-col items-center w-full max-w-[320px]">
              
              <AnimatePresence mode="wait">
                {notification && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className={`w-full p-4 rounded-2xl flex items-center justify-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                     {notification.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
                     <p className="font-bold text-[10px] uppercase tracking-widest">{notification.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={handleVerifySms} 
                disabled={isSubmitting || smsCode.length < 6} 
                style={{ backgroundColor: (isSubmitting || smsCode.length < 6) ? 'rgba(255,255,255,0.05)' : '#10b981', color: (isSubmitting || smsCode.length < 6) ? 'rgba(255,255,255,0.3)' : '#000000', boxShadow: (isSubmitting || smsCode.length < 6) ? 'none' : '0 0 50px rgba(16,185,129,0.4)', border: (isSubmitting || smsCode.length < 6) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                className="w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] disabled:scale-100"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Crown size={18} />} 
                {isSubmitting ? 'Weryfikacja...' : 'Potwierdź Kod'}
              </button>
              
              <button onClick={onClose} disabled={isSubmitting} className="font-bold uppercase tracking-widest text-[9px] md:text-[10px] transition-colors text-white/30 hover:text-white mt-4">
                Anuluj Logowanie
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return modalContent;
}
