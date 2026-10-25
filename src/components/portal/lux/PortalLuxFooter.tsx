import { Globe, Lock, Mail, MapPin, Phone } from "lucide-react";

/**
 * Stopka panelu: podpis agenta i biura, dane kontaktowe oraz jasna informacja,
 * kto widzi dokumenty i rozmowę — to buduje zaufanie bardziej niż logo.
 */
export default function PortalLuxFooter({
  agencyName,
  partner,
  agentName,
  agentTitle,
  agentPhoto,
  agentPhone,
  agencyEmail,
  agencyWebsite,
  agencyAddress,
}: {
  agencyName: string;
  partner?: boolean;
  agentName?: string;
  agentTitle?: string | null;
  agentPhoto?: string | null;
  agentPhone?: string | null;
  agencyEmail?: string | null;
  agencyWebsite?: string | null;
  agencyAddress?: string | null;
}) {
  const phone = agentPhone ? agentPhone.replace(/[^\d+]/g, "") : "";
  const agentFirst = (agentName || "").split(" ")[0] || "agent";
  const website = agencyWebsite ? (agencyWebsite.startsWith("http") ? agencyWebsite : `https://${agencyWebsite}`) : null;
  return (
    <footer className="rounded-[28px] bg-black px-5 py-7 text-[#F6F3EE] sm:px-7">
      {agentName ? (
        <div className="flex items-center gap-3.5">
          {agentPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agentPhoto} alt="" className="size-14 rounded-full border border-[#D8C3A0] object-cover" />
          ) : (
            <span className="lux-serif flex size-14 items-center justify-center rounded-full border border-[#D8C3A0] text-[22px] text-[#D8C3A0]">
              {agentName.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="lux-serif text-[20px] leading-tight">{agentName}</p>
            <p className="mt-0.5 text-[12.5px] text-[#BDB6AA]">
              {agentTitle || "Twój agent"}, {agencyName}
            </p>
          </div>
        </div>
      ) : null}

      <ul className="mt-5 space-y-2.5 text-[13px] text-[#E9E3D8]">
        {phone ? (
          <li>
            <a href={`tel:${phone}`} className="inline-flex items-center gap-2.5 hover:text-[#D8C3A0]">
              <Phone className="size-4 text-[#D8C3A0]" /> {agentPhone}
            </a>
          </li>
        ) : null}
        {agencyEmail ? (
          <li>
            <a href={`mailto:${agencyEmail}`} className="inline-flex items-center gap-2.5 break-all hover:text-[#D8C3A0]">
              <Mail className="size-4 shrink-0 text-[#D8C3A0]" /> {agencyEmail}
            </a>
          </li>
        ) : null}
        {website ? (
          <li>
            <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 hover:text-[#D8C3A0]">
              <Globe className="size-4 text-[#D8C3A0]" /> {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </li>
        ) : null}
        {agencyAddress ? (
          <li className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#D8C3A0]" /> {agencyAddress}
          </li>
        ) : null}
      </ul>

      <div className="mt-6 flex items-start gap-2.5 rounded-[18px] border border-[#D8C3A0]/20 p-3.5 text-[12px] leading-relaxed text-[#BDB6AA]">
        <Lock className="mt-0.5 size-4 shrink-0 text-[#D8C3A0]" />
        <p>
          Połączenie jest szyfrowane. Twoje dokumenty i rozmowę widzisz tylko Ty i {agentFirst}
          {partner ? " — w dostępie dla drugiej osoby dokumenty są ukryte." : "."}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="h-[18px] w-auto opacity-80" />
        <span className="text-[11px] text-[#8C877D]">{partner ? "Dostęp dla drugiej osoby" : "Panel prywatny"}</span>
      </div>
    </footer>
  );
}
