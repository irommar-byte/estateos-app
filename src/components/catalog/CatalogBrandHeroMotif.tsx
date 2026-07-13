type CatalogBrandHeroMotifProps = {
  variant: "home" | "car";
  accent?: "sale" | "rent";
  className?: string;
};

export default function CatalogBrandHeroMotif({
  variant,
  accent = "sale",
  className = "",
}: CatalogBrandHeroMotifProps) {
  if (variant === "car") {
    return (
      <svg
        viewBox="0 0 520 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden
      >
        <defs>
          <linearGradient id="carMotifFade" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(14,165,233,0.18)" />
            <stop offset="0.55" stopColor="rgba(56,189,248,0.1)" />
            <stop offset="1" stopColor="rgba(14,165,233,0.02)" />
          </linearGradient>
        </defs>
        <rect width="520" height="320" fill="url(#carMotifFade)" />
        <path
          d="M48 228 H472"
          stroke="rgba(56,189,248,0.28)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="7 10"
        />
        <path
          d="M108 196 C128 158 168 138 214 132 H334 C386 138 424 162 442 196 L468 228 H88 L108 196 Z"
          stroke="rgba(56,189,248,0.42)"
          strokeWidth="2"
          fill="rgba(14,165,233,0.07)"
        />
        <path d="M142 196 H406" stroke="rgba(56,189,248,0.22)" strokeWidth="1.25" />
        <path
          d="M168 132 C196 108 236 96 278 96 C318 96 354 108 378 132"
          stroke="rgba(56,189,248,0.26)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="156" cy="228" r="28" stroke="rgba(56,189,248,0.4)" strokeWidth="2" fill="rgba(14,165,233,0.08)" />
        <circle cx="156" cy="228" r="11" stroke="rgba(56,189,248,0.32)" strokeWidth="1.25" />
        <circle cx="392" cy="228" r="28" stroke="rgba(56,189,248,0.4)" strokeWidth="2" fill="rgba(14,165,233,0.08)" />
        <circle cx="392" cy="228" r="11" stroke="rgba(56,189,248,0.32)" strokeWidth="1.25" />
        <path
          d="M214 168 H308"
          stroke="rgba(56,189,248,0.18)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const stroke =
    accent === "rent" ? "rgba(56,189,248,0.36)" : "rgba(16,185,129,0.38)";
  const fill = accent === "rent" ? "rgba(56,189,248,0.07)" : "rgba(16,185,129,0.08)";
  const fillStrong = accent === "rent" ? "rgba(56,189,248,0.13)" : "rgba(16,185,129,0.14)";

  return (
    <svg
      viewBox="0 0 520 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="homeMotifFade" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={fillStrong} />
          <stop offset="0.6" stopColor={fill} />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
      <rect width="520" height="320" fill="url(#homeMotifFade)" />
      <path d="M36 252 H484" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

      <path
        d="M72 252 V128 C72 116 82 108 98 108 H132 C148 108 158 116 158 128 V252"
        stroke={stroke}
        strokeWidth="1.85"
        fill={fill}
      />
      <path d="M98 252 V182 H132 V252" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
      {[142, 164, 186, 208].map((y) => (
        <g key={`tower-${y}`}>
          <rect x="88" y={y} width="16" height="12" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
          <rect x="118" y={y} width="16" height="12" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
        </g>
      ))}
      <path d="M84 108 L115 78 L146 108" stroke={stroke} strokeWidth="1.6" fill={fillStrong} />

      <path
        d="M186 252 V96 C186 84 198 76 218 76 H292 C312 76 324 84 324 96 V252"
        stroke={stroke}
        strokeWidth="1.85"
        fill={fill}
      />
      {[112, 136, 160, 184, 208, 232].map((y) => (
        <g key={`mid-${y}`}>
          <rect x="204" y={y} width="20" height="13" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
          <rect x="236" y={y} width="20" height="13" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
          <rect x="268" y={y} width="20" height="13" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
        </g>
      ))}

      <path
        d="M352 252 V162 C352 150 364 142 386 142 H448 C470 142 482 150 482 162 V252"
        stroke={stroke}
        strokeWidth="1.85"
        fill={fill}
      />
      <path d="M340 162 L400 112 L460 162" stroke={stroke} strokeWidth="1.85" fill={fillStrong} />
      <rect x="388" y="198" width="44" height="54" rx="3" fill={fillStrong} stroke={stroke} strokeWidth="1.2" />
      <rect x="424" y="176" width="18" height="18" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />
      <rect x="360" y="176" width="18" height="18" rx="2" fill={fillStrong} stroke={stroke} strokeWidth="0.75" />

      <circle cx="412" cy="62" r="24" stroke={stroke} strokeWidth="1.5" fill={fillStrong} />
      <path
        d="M412 50 V74 M400 62 H424"
        stroke={stroke}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
