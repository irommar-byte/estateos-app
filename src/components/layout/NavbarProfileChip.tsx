"use client";

import { User } from "lucide-react";
import { useRouter } from "next/navigation";

function formatProfileChipLabel(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();
  if (first && last) return `${first} ${last}`;
  const full = String(user.name || "").trim();
  if (full) return full;
  return "Profil";
}

type Props = {
  user: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};

export default function NavbarProfileChip({ user }: Props) {
  const router = useRouter();
  const label = formatProfileChipLabel(user);

  return (
    <button
      type="button"
      onClick={() => router.push("/moje-konto")}
      aria-label={`Profil: ${label}`}
      className="group relative flex h-11 max-w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border border-emerald-500/25 bg-black/55 px-2 py-1 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all hover:border-emerald-400/45 hover:bg-black/70 sm:max-w-[108px] sm:px-2.5"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent opacity-80" />
      <div className="relative flex items-center gap-1">
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400/80 blur-[3px] opacity-80" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]" />
        </span>
        <User size={13} className="shrink-0 text-emerald-400" aria-hidden />
      </div>
      <span className="max-w-full truncate text-[8px] font-bold normal-case leading-none tracking-[0.02em] text-emerald-100/90 sm:text-[9px]">
        {label}
      </span>
    </button>
  );
}
