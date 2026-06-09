"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight, DoorOpen, Sparkles } from "lucide-react";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";

type Props = {
  copy: CrmExtendedDictionary["proTools"];
  onImport: () => void;
  onOpenHouse: () => void;
};

function ToolTile({
  title,
  subtitle,
  tag,
  onPress,
  icon,
  accentClass,
}: {
  title: string;
  subtitle: string;
  tag: string;
  onPress: () => void;
  icon: ReactNode;
  accentClass: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      className={`group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a0a0a] p-5 text-left shadow-[inset_0_2px_16px_rgba(0,0,0,0.8)] transition hover:border-white/20 ${accentClass}`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/40">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</p>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/45">
              {tag}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-white/50">{subtitle}</p>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-white/25 transition group-hover:text-white/60" />
      </div>
    </motion.button>
  );
}

export default function ProProfileToolsCard({ copy, onImport, onOpenHouse }: Props) {
  return (
    <div className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#050505] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.9)] md:p-8">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500/70">{copy.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{copy.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/45">{copy.lead}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ToolTile
          title={copy.importTitle}
          subtitle={copy.importSubtitle}
          tag={copy.importTag}
          onPress={onImport}
          accentClass="hover:shadow-[0_0_40px_rgba(16,185,129,0.08)]"
          icon={<Sparkles size={22} className="text-emerald-400" />}
        />
        <ToolTile
          title={copy.openHouseTitle}
          subtitle={copy.openHouseSubtitle}
          tag={copy.openHouseTag}
          onPress={onOpenHouse}
          accentClass="hover:shadow-[0_0_40px_rgba(245,158,11,0.1)]"
          icon={<DoorOpen size={22} className="text-amber-400" />}
        />
      </div>

      <p className="mt-4 text-center text-[11px] text-white/30">{copy.footer}</p>
    </div>
  );
}
