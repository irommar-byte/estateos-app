'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from "@simplewebauthn/browser";
import { Loader2, Fingerprint } from 'lucide-react';

export default function PasskeyToggle({ user }: { user: any }) {
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const checkPasskey = async () => {
      try {
        const res = await fetch('/api/passkeys/check');
        if (res.ok) {
          const data = await res.json();
          setHasPasskey(data.hasPasskey);
        }
      } catch (e) {
        console.error("Passkey check error");
      } finally {
        setIsCheckingPasskey(false);
      }
    };
    checkPasskey();
  }, []);

  const handleRegisterPasskey = async () => {
    

    setIsRegistering(true);
    setIsScanning(true);

    try {
      const resp = await fetch('/api/passkeys/register-options');
      const options = await resp.json();

      const attResp = await startRegistration(options);

      const verifyResp = await fetch('/api/passkeys/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });

      const verifyResult = await verifyResp.json();
      if (verifyResult.success) {
        setHasPasskey(true);
      }
    } catch (error) {
      console.error("Passkey register error:", error);
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setIsRegistering(false);
      }, 1200);
    }
  };

  const handleDeletePasskey = async () => {
    setIsRegistering(true);
    try {
      const res = await fetch('/api/passkeys/delete', { method: 'DELETE' });
      if (res.ok) setHasPasskey(false);
    } catch (e) {
      console.error("Passkey delete error");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isCheckingPasskey) {
      return (
          <div className="w-full md:w-[480px] rounded-[2.5rem] p-6 bg-gradient-to-b from-[#151515] to-[#0a0a0a] border border-[#222] flex items-center justify-center h-[100px] shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
              <Loader2 className="animate-spin text-white/20" size={24} />
          </div>
      );
  }

  return (
    <div className="relative w-full md:w-[480px] group cursor-default mt-4">
      
      {/* GLOW ZEWNĘTRZNY KARTY (TŁO) */}
      {hasPasskey ? (
        <div className="absolute -inset-3 bg-[#10b981]/10 rounded-[3rem] blur-[25px] animate-[pulse_4s_ease-in-out_infinite] pointer-events-none transition-opacity duration-1000"></div>
      ) : (
        <div className="absolute -inset-3 bg-[#ef4444]/5 rounded-[3rem] blur-[20px] pointer-events-none transition-opacity duration-1000"></div>
      )}

      {/* SREBRNA RAMKA ZEWNĘTRZNA (Delikatny border-wrap dla efektu cięcia CNC) */}
      <div className={`relative p-[1px] rounded-[2.5rem] bg-gradient-to-b transition-colors duration-1000 shadow-[0_30px_60px_rgba(0,0,0,0.8)]
        ${hasPasskey ? 'from-[#10b981]/30 via-[#222] to-[#000]' : 'from-[#333] via-[#111] to-[#000]'}
      `}>
        
        {/* GŁÓWNY KONTENER KARTY (Ciemne szkło) */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#161616] to-[#080808] rounded-[calc(2.5rem-1px)] p-5 px-6 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] flex items-center justify-between">
          
          {/* ODBLASK GÓRNY KARTY */}
          <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>

          {/* === LEWA STRONA (Ikona i Teksty) === */}
          <div className="flex items-center gap-5 relative z-10">
            
            {/* WKLĘSŁE GNIAZDO IKONY 3D */}
            <div className={`relative w-[52px] h-[52px] rounded-[1.1rem] flex items-center justify-center transition-all duration-1000 shrink-0 overflow-hidden
              border-t border-[#000] border-b border-white/10
              shadow-[inset_0_4px_12px_rgba(0,0,0,1),inset_0_0_15px_rgba(0,0,0,0.8)]
              ${hasPasskey ? 'bg-[#031208]' : 'bg-[#090909]'}
            `}>
               {/* Poświata wewnątrz gniazda. 
                 Warstwy naprawione: overflow-hidden na rodzicu obcina gradient do zaokrąglonych krawędzi. 
               */}
               {hasPasskey && !isScanning && (
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.3)_0%,transparent_70%)] animate-[pulse_4s_ease-in-out_infinite]"></div>
               )}
               
               {isScanning ? (
                  <Fingerprint size={26} className="text-[#10b981] animate-pulse relative z-10 drop-shadow-[0_0_12px_rgba(16,185,129,1)]" />
               ) : hasPasskey ? (
                   <Fingerprint size={26} className="text-[#10b981] relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
               ) : (
                   <Fingerprint size={26} className="text-[#333] relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,0.05)]" />
               )}
            </div>

            {/* TEKSTY I SZKLANA DIODA */}
            <div className="flex flex-col justify-center gap-1">
              <h3 className="text-white/90 font-extrabold tracking-tight text-[16px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Face ID / Touch ID</h3>
              
              <div className="flex items-center gap-2 mt-0.5">
                {/* Wypukła Szklana Dioda LED */}
                <div className="relative w-2 h-2 rounded-full bg-[#000] shadow-[inset_0_1px_2px_rgba(0,0,0,1),0_1px_1px_rgba(255,255,255,0.08)] flex items-center justify-center">
                  <span className={`block w-1.5 h-1.5 rounded-full transition-all duration-1000 
                    ${hasPasskey 
                      ? 'bg-[#10b981] shadow-[0_0_8px_1px_rgba(16,185,129,0.8),inset_0_1px_1px_rgba(255,255,255,0.8)] animate-[pulse_4s_ease-in-out_infinite]' 
                      : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                    }`}>
                  </span>
                </div>
                
                <p className={`text-[10px] font-black tracking-[0.15em] uppercase transition-colors duration-1000 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]
                  ${hasPasskey ? 'text-[#10b981]' : 'text-[#ef4444]/70'}
                `}>
                  {hasPasskey ? "Aktywne • Secure Enclave" : "Nieaktywne"}
                </p>
              </div>
            </div>
          </div>

          {/* === PRAWA STRONA - SUWAK W STYLU iOS (Skeumorfizm) === */}
          <button
            onClick={hasPasskey ? handleDeletePasskey : handleRegisterPasskey}
            disabled={isRegistering}
            className={`relative w-[64px] h-[34px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none shrink-0 z-10
              ${hasPasskey 
                // Zielona aktywna ścieżka (styl Apple) z głębokim cieniem wewnętrznym
                ? 'bg-[#34c759] shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)] border border-[#2db14e]' 
                // Czarna, pusta ścieżka z mocnym wyżłobieniem
                : 'bg-[#111111] shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] border border-[#000] hover:bg-[#151515]'
              }
            `}
          >
            {/* Fizyczna Kula (Knob) */}
            <span
              className={`absolute top-[2px] left-[2px] w-[28px] h-[28px] rounded-full flex items-center justify-center
                transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                bg-gradient-to-b from-[#ffffff] to-[#e0e0e0]
                shadow-[0_3px_6px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(0,0,0,0.1)]
                ${hasPasskey 
                  ? 'translate-x-[30px]' 
                  : 'translate-x-0'
                }
              `}
            >
               {/* Ładowanie z wycentrowanym spinnerem w środku białej kulki */}
               {isRegistering && <Loader2 className="text-[#666] animate-spin" size={14} strokeWidth={3} />}
            </span>
          </button>

        </div>
      </div>
    </div>
  );
}
