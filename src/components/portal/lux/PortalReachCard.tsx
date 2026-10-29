"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Eye, MessageSquareText, MousePointerClick, Users } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";

export type PortalReach = {
  items: Array<{
    id: number;
    channel: "fb_page" | "fb_group";
    name: string;
    members: number | null;
    postUrl: string | null;
    publishedAt: string | null;
    visits: number;
    inquiries: number;
    stats: { views: number | null; reactions: number; comments: number; shares: number } | null;
  }>;
  totals: {
    publications: number;
    pagePosts: number;
    groups: number;
    groupMembers: number;
    pageViews: number | null;
    engagements: number;
    visits: number;
    inquiries: number;
  };
};

function CountUp({ value, dateLocale }: { value: number; dateLocale: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return <span ref={ref}>{(reduce ? value : shown).toLocaleString(dateLocale)}</span>;
}

/**
 * Zasięg promocji dla właściciela: tylko liczby z publikacji EstateOS i z linków śledzących.
 * Każda liczba ma podpis, co dokładnie znaczy (np. członkowie grup ≠ wyświetlenia).
 */
export default function PortalReachCard({ reach, agentFirst }: { reach: PortalReach | null | undefined; agentFirst: string }) {
  const { t, p, dateLocale } = usePortalLocale();
  if (!reach || !reach.items.length) return null;
  const totals = reach.totals;
  const num = (n: number) => n.toLocaleString(dateLocale);
  const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) : "");
  const groups = totals.groups ? `${totals.groups} ${p(totals.groups, "grupa|grupy|grup")}` : "";
  const tiles = [
    totals.pageViews != null && totals.pagePosts
      ? { key: "views", icon: Eye, value: totals.pageViews, label: t("wyświetleń posta na stronie biura"), hint: t("dane z Facebooka") }
      : null,
    totals.groups
      ? { key: "members", icon: Users, value: totals.groupMembers, label: t("osób w grupach z ogłoszeniem ({groups})", { groups }), hint: t("liczba członków grup") }
      : null,
    { key: "visits", icon: MousePointerClick, value: totals.visits, label: t("wejść na ogłoszenie z promocji"), hint: t("jedna osoba liczona raz dziennie") },
    { key: "inq", icon: MessageSquareText, value: totals.inquiries, label: p(totals.inquiries, "zapytanie od kupującego|zapytania od kupujących|zapytań od kupujących"), hint: t("wysłane z ogłoszenia") },
  ].filter(Boolean) as Array<{ key: string; icon: typeof Eye; value: number; label: string; hint: string }>;
  const where = totals.pagePosts
    ? totals.groups
      ? t("na stronie biura i w: {groups}", { groups })
      : t("na stronie biura")
    : groups;

  return (
    <section className="reach-card" aria-label={t("Zasięg promocji")}>
      <p className="reach-card__title">{t("Zasięg promocji")}</p>
      <p className="reach-card__sub">
        {t("{agent} opublikował ogłoszenie {n} {times}", {
          agent: agentFirst,
          n: totals.publications,
          times: p(totals.publications, "raz|razy|razy"),
        })}
        {where ? ` — ${where}` : ""}.
      </p>
      <div className="reach-card__tiles">
        {tiles.map(({ key, icon: Icon, value, label, hint }) => (
          <div key={key} className="reach-tile">
            <Icon className="reach-tile__icon" aria-hidden />
            <span className="reach-tile__value">
              <CountUp value={value} dateLocale={dateLocale} />
            </span>
            <span className="reach-tile__label">{label}</span>
            <span className="reach-tile__hint">{hint}</span>
          </div>
        ))}
      </div>
      <ul className="reach-list">
        {reach.items.slice(0, 12).map((item) => {
          const inner = (
            <>
              <span className={`reach-list__mark ${item.channel === "fb_page" ? "reach-list__mark--page" : ""}`} aria-hidden>
                f
              </span>
              <span className="min-w-0 flex-1">
                <span className="reach-list__name">{item.name}</span>
                <span className="reach-list__meta">
                  {[
                    item.channel === "fb_page" ? t("strona biura") : t("grupa"),
                    item.members ? `${num(item.members)} ${item.channel === "fb_page" ? t("obserwujących") : t("członków")}` : null,
                    shortDate(item.publishedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="reach-list__nums">
                {item.stats?.views != null ? <span>{num(item.stats.views)} {t("wyśw.")}</span> : null}
                <span>{num(item.visits)} {t("wejść")}</span>
              </span>
              {item.postUrl ? <ArrowUpRight className="reach-list__go" aria-hidden /> : null}
            </>
          );
          return (
            <li key={item.id}>
              {item.postUrl ? (
                <a href={item.postUrl} target="_blank" rel="noreferrer" className="reach-list__row reach-list__row--link">
                  {inner}
                </a>
              ) : (
                <div className="reach-list__row">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
