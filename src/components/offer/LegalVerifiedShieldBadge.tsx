"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

type Props = {
  label?: string;
  compact?: boolean;
};

export default function LegalVerifiedShieldBadge({
  label = "zweryfikowane",
  compact = false,
}: Props) {
  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/45 bg-emerald-500/12 ${
        compact ? "px-2.5 py-1" : "px-3 py-1.5"
      }`}
      animate={{ boxShadow: ["0 0 0 rgba(16,185,129,0)", "0 0 18px rgba(16,185,129,0.35)", "0 0 0 rgba(16,185,129,0)"] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex"
      >
        <ShieldCheck size={compact ? 14 : 16} className="text-emerald-400" strokeWidth={2.4} />
      </motion.span>
      <motion.span
        className={`font-black lowercase tracking-wide text-emerald-300/95 ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </motion.div>
  );
}
