"use client";

import { BadgeCheck, Mail, Phone, Target } from "lucide-react";
import type { AgencyClientListItem } from "@/lib/agencyClientShape";

function clientEmailVerified(client: Pick<AgencyClientListItem, "linkedUserId" | "emailVerifiedAt">) {
  return Boolean(client.linkedUserId || client.emailVerifiedAt);
}

function clientPhoneVerified(client: Pick<AgencyClientListItem, "linkedUserId" | "phoneVerifiedAt">) {
  return Boolean(client.linkedUserId || client.phoneVerifiedAt);
}

function clientMatchLit(client: Pick<AgencyClientListItem, "type" | "matchCount" | "sellerCity" | "sellerPrice">) {
  if (client.type === "BUYER") return client.matchCount > 0;
  return Boolean(client.sellerCity || client.sellerPrice);
}

const LAMPS = [
  {
    id: "email",
    Icon: Mail,
    title: "E-mail zweryfikowany",
    lit: clientEmailVerified,
  },
  {
    id: "phone",
    Icon: Phone,
    title: "Telefon zweryfikowany",
    lit: clientPhoneVerified,
  },
  {
    id: "account",
    Icon: BadgeCheck,
    title: "Konto EstateOS powiązane",
    lit: (client: AgencyClientListItem) => Boolean(client.linkedUserId),
  },
  {
    id: "match",
    Icon: Target,
    title: "Profil kompletny / dopasowania",
    lit: clientMatchLit,
  },
] as const;

export function clientHasUpcomingMeeting(
  client: Pick<AgencyClientListItem, "upcomingMeetingStartsAt">,
  nowMs = Date.now(),
) {
  if (!client.upcomingMeetingStartsAt) return false;
  const start = new Date(client.upcomingMeetingStartsAt).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + 60 * 60 * 1000;
  return nowMs <= end;
}

export default function CrmClientStatusLamps({ client }: { client: AgencyClientListItem }) {
  return (
    <div className="eos-crm-client-lamps" role="list" aria-label="Status klienta">
      {LAMPS.map(({ id, Icon, title, lit }) => {
        const active = lit(client);
        return (
          <span
            key={id}
            role="listitem"
            title={title}
            aria-label={`${title}${active ? " — aktywne" : " — brak"}`}
            className={`eos-crm-client-lamp${active ? " eos-crm-client-lamp--on" : ""}`}
          >
            <Icon className="eos-crm-client-lamp__icon" strokeWidth={2} aria-hidden />
            {active ? <span className="eos-crm-client-lamp__glow" aria-hidden /> : null}
          </span>
        );
      })}
    </div>
  );
}
