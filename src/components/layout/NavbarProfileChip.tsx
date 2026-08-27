"use client";

import { Crown, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";
import { isAgentOrAgencySeller } from "@/lib/sellerDisplay";

function formatProfileChipLabel(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  const full = String(user.name || "").trim();
  if (full) return full;
  return "Profil";
}

export type NavbarProfileUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  planType?: string | null;
  plan?: string | null;
  isPro?: boolean | null;
  officePro?: boolean | null;
  hasMarketPro?: boolean | null;
  image?: string | null;
  avatar?: string | null;
};

type Props = {
  user: NavbarProfileUser;
};

export default function NavbarProfileChip({ user }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const label = formatProfileChipLabel(user);
  const isAgent = isAgentOrAgencySeller(user);
  const isPro = Boolean(user.isPro || user.hasMarketPro || user.officePro);
  const avatarSrc = String(user.image || user.avatar || "").trim();
  const roleLabel = isAgent
    ? locale === "uk"
      ? "Агент"
      : "Agent"
    : locale === "en"
      ? "User"
      : locale === "uk"
        ? "Користувач"
        : "Użytkownik";

  return (
    <button
      type="button"
      onClick={() => router.push("/moje-konto")}
      aria-label={`Profil: ${label}, ${roleLabel}${isPro ? ", Pro" : ""}`}
      title={label}
      className={`eos-nav-identity group relative flex h-[42px] shrink-0 items-center overflow-hidden rounded-full py-0.5 pl-0.5 text-left transition-all gap-0 pr-0.5 sm:gap-2 sm:pr-2.5 md:pr-3 ${
        isPro ? "eos-nav-identity--pro" : "eos-nav-identity--standard"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-3 top-0 hidden h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-70 sm:block" />
      {isPro ? <span className="eos-nav-identity__sheen hidden sm:block" aria-hidden /> : null}

      <span
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
          isPro ? "border-amber-400/50 bg-[#1a1408]" : "border-emerald-400/35 bg-black/50"
        }`}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={14} className={isPro ? "text-amber-200" : "text-emerald-300"} aria-hidden />
        )}
        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-black/40 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.95)]" />
      </span>

      <span className="hidden min-w-0 max-w-[9.5rem] pr-0.5 sm:block md:max-w-[11rem]">
        <span
          className={`eos-nav-identity__name block truncate text-[11px] font-semibold leading-none tracking-tight ${
            isPro ? "text-amber-50" : "text-white"
          }`}
        >
          {label}
        </span>
        <span className="mt-1 hidden items-center gap-1.5 md:flex">
          <span
            className={`eos-nav-identity__role text-[8px] font-black uppercase tracking-[0.16em] ${
              isPro ? "text-amber-200/80" : "text-emerald-200/75"
            }`}
          >
            {roleLabel}
          </span>
          {isPro ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/45 bg-gradient-to-r from-amber-500/25 to-yellow-600/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-amber-100 shadow-[0_0_10px_rgba(212,175,55,0.35)]">
              <Crown size={8} className="text-amber-300" aria-hidden />
              Pro
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
