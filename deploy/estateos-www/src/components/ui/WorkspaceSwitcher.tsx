"use client";
import { motion } from "framer-motion";

interface WorkspaceSwitcherProps {
  currentMode: string; // np. 'BUYER', 'AGENCY', 'SELLER'
  onModeChange: (mode: string) => void;
}

export default function WorkspaceSwitcher({ currentMode, onModeChange }: WorkspaceSwitcherProps) {
  // Mapowanie ról na etykiety
  const modes = [
    { id: 'BUYER', label: 'Inwestor' },
    { id: 'AGENCY', label: 'EstateOS™Partner' },
    { id: 'SELLER', label: 'Właściciel' }
  ];

  return (
    <div className="relative inline-flex items-center p-1.5 bg-[#121212]/60 backdrop-blur-2xl border border-white/5 rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`relative flex items-center gap-2.5 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-500 focus:outline-none ${
              isActive
                ? "text-white"
                : "text-white/40 hover:text-white/90 hover:bg-white/5"
            }`}
          >
            {/* Apple-style 3D Glass Pill dla aktywnego elementu */}
            {isActive && (
              <motion.div
                layoutId="activeWorkspaceBubble"
                className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/5 rounded-full border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.2)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}

            {/* Status Diode */}
            <div className="relative flex items-center justify-center w-2.5 h-2.5 z-10">
              {isActive ? (
                <>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full blur-[5px] opacity-80 animate-pulse" />
                  <div className="relative w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,1)]" />
                </>
              ) : (
                <div className="relative w-1 h-1 bg-white/20 rounded-full" />
              )}
            </div>

            {/* Label */}
            <span className="relative z-10 tracking-wide drop-shadow-md">
              {mode.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
