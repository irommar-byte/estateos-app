"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface Props {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export default function PremiumButton({ onClick, disabled, children, className = "" }: Props) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative group overflow-hidden bg-gradient-to-r from-yellow-500 to-yellow-400 border border-yellow-300/50 text-black font-black uppercase tracking-[0.2em] rounded-full py-5 px-8 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_60px_rgba(250,204,21,0.8)] hover:from-yellow-400 hover:to-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-10 ${className}`}
    >
      {/* Animacja połysku "światła" */}
      <motion.div 
        className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-12"
        initial={{ x: "-250%" }}
        animate={{ x: "350%" }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
      />
      
      <span className="relative z-10 flex items-center gap-3 w-full justify-center">
        {children}
      </span>
    </motion.button>
  );
}
