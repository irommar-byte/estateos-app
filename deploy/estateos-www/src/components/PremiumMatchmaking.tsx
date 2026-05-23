"use client";
import { motion } from "framer-motion";
import { Radar, Send, CheckCircle, Shield, Loader2, Activity } from "lucide-react";
import { useState, useEffect } from "react";

export default function PremiumMatchmaking({ offerId, onComplete }: { offerId: string, onComplete: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [matchCount, setMatchCount] = useState(0);
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch(`/api/offers/${offerId}/match`)
      .then(res => res.json())
      .then(data => {
        setMatchCount(data.count || 0);
        setTimeout(() => setScanning(false), 2000);
      })
      .catch(() => {
        setMatchCount(0);
        setScanning(false);
      });
  }, [offerId]);

  const handleAction = async () => {
    setIsSending(true);
    try {
      if (matchCount > 0) {
        await fetch(`/api/offers/${offerId}/match`, { method: 'POST' });
        setSent(true);
        setTimeout(onComplete, 3000);
      } else {
        // Dla zera dopasowań po prostu kończymy proces i włączamy radar w tle (UI)
        setTimeout(onComplete, 800);
      }
    } catch(e) {
      setTimeout(onComplete, 1000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-2xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-6">
      <div className="max-w-xl w-full flex flex-col items-center text-center">
        {scanning ? (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center">
            <div className="relative w-40 h-40 flex items-center justify-center mb-8">
              <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[ping_2s_linear_infinite]"></div>
              <div className="absolute inset-4 rounded-full border border-emerald-500/20 animate-[ping_3s_linear_infinite]"></div>
              <Radar size={60} className="text-emerald-500 animate-[spin_4s_linear_infinite]" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">Algorytm pracuje</h2>
            <p className="text-white/40 text-sm uppercase tracking-widest font-bold">Skanowanie profili inwestorskich...</p>
          </motion.div>
        ) : sent ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
            <CheckCircle size={80} className="text-emerald-500 mb-6 drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]" />
            <h2 className="text-3xl font-black text-white tracking-tighter mb-4">Wysłano priorytetowo</h2>
            <p className="text-white/40 text-sm leading-relaxed">Wybrani inwestorzy otrzymali E-mail na ułamek sekundy przed publiczną publikacją oferty.</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full">
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-6 py-2 rounded-full mb-8 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              {matchCount > 0 ? <Shield size={16} className="text-emerald-500" /> : <Activity size={16} className="text-emerald-500 animate-pulse" />}
              <span className="text-emerald-500 font-black uppercase tracking-widest text-xs">
                {matchCount > 0 ? "Skan Zakończony" : "Monitoring Włączony"}
              </span>
            </div>
            
            {matchCount > 0 ? (
              <>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
                  Wykryto <span className="text-emerald-500">{matchCount}</span> zainteresowanych
                </h2>
                <p className="text-white/50 text-sm md:text-base leading-relaxed mb-10 max-w-md">
                  Znaleźliśmy w systemie osoby, których profil zakupowy idealnie pasuje do parametrów Twojej nieruchomości.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-4">
                  Radar <span className="text-emerald-500">Aktywny 24/7</span>
                </h2>
                <p className="text-white/50 text-sm md:text-base leading-relaxed mb-10 max-w-md">
                  W tej sekundzie brak idealnych dopasowań, ale algorytm nie śpi. Będziemy stale monitorować bazę i wyślemy Ci powiadomienie, gdy tylko pojawi się odpowiedni kupiec.
                </p>
              </>
            )}

            <div className="flex flex-col gap-4 w-full">
              <button 
                onClick={handleAction} 
                disabled={isSending}
                style={{
                   background: matchCount > 0 ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)" : "rgba(16, 185, 129, 0.1)",
                   color: matchCount > 0 ? "#000000" : "#10b981",
                   boxShadow: matchCount > 0 ? "0 0 30px rgba(16,185,129,0.4)" : "0 0 15px rgba(16,185,129,0.1)",
                   border: matchCount > 0 ? "none" : "1px solid rgba(16, 185, 129, 0.4)"
                }}
                className={`w-full py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] flex items-center justify-center gap-3 disabled:cursor-not-allowed ${matchCount === 0 ? 'hover:bg-emerald-500/20' : ''}`}
              >
                {isSending ? <><Loader2 size={18} className="animate-spin" /> Przetwarzanie...</> : 
                 matchCount > 0 ? <><Send size={18} /> Powiadom ich teraz</> : <><Radar size={18} /> Uruchom w tle i Kontynuuj</>}
              </button>
              
              {matchCount > 0 && (
                <button 
                  onClick={onComplete} 
                  disabled={isSending}
                  style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }}
                  className="w-full py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:border-white hover:text-white text-xs disabled:opacity-50"
                >
                  Pomiń i idź do profilu
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
