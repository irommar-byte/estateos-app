"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Eye, MessageSquareText, MousePointerClick, Users } from "lucide-react";

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

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return <span ref={ref}>{(reduce ? value : shown).toLocaleString("pl-PL")}</span>;
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) : "";

/**
 * Zasięg promocji dla właściciela: tylko liczby z publikacji EstateOS i z linków śledzących.
 * Każda liczba ma podpis, co dokładnie znaczy (np. członkowie grup ≠ wyświetlenia).
 */
export default function PortalReachCard({ reach, agentFirst }: { reach: PortalReach | null | undefined; agentFirst: string }) {
  if (!reach || !reach.items.length) return null;
  const t = reach.totals;
  const tiles = [
    t.pageViews != null && t.pagePosts
      ? { key: "views", icon: Eye, value: t.pageViews, label: "wyświetleń posta na stronie biura", hint: "dane z Facebooka" }
      : null,
    t.groups ? { key: "members", icon: Users, value: t.groupMembers, label: `osób w ${t.groups} ${t.groups === 1 ? "grupie" : "grupach"}, gdzie jest ogłoszenie`, hint: "liczba członków grup" } : null,
    { key: "visits", icon: MousePointerClick, value: t.visits, label: "wejść na ogłoszenie z promocji", hint: "jedna osoba liczona raz dziennie" },
    { key: "inq", icon: MessageSquareText, value: t.inquiries, label: t.inquiries === 1 ? "zapytanie od kupującego" : "zapytań od kupujących", hint: "wysłane z ogłoszenia" },
  ].filter(Boolean) as Array<{ key: string; icon: typeof Eye; value: number; label: string; hint: string }>;

  return (
    <section className="reach-card" aria-label="Zasięg promocji">
      <p className="reach-card__title">Zasięg promocji</p>
      <p className="reach-card__sub">
        {agentFirst} opublikował ogłoszenie {t.publications} {t.publications === 1 ? "raz" : "razy"}
        {t.pagePosts ? ` — na stronie biura${t.groups ? ` i w ${t.groups} ${t.groups === 1 ? "grupie" : "grupach"}` : ""}` : t.groups ? ` — w ${t.groups} ${t.groups === 1 ? "grupie" : "grupach"}` : ""}.
      </p>
      <div className="reach-card__tiles">
        {tiles.map(({ key, icon: Icon, value, label, hint }) => (
          <div key={key} className="reach-tile">
            <Icon className="reach-tile__icon" aria-hidden />
            <span className="reach-tile__value">
              <CountUp value={value} />
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
                    item.channel === "fb_page" ? "strona biura" : "grupa",
                    item.members ? `${item.members.toLocaleString("pl-PL")} ${item.channel === "fb_page" ? "obserwujących" : "członków"}` : null,
                    shortDate(item.publishedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="reach-list__nums">
                {item.stats?.views != null ? <span>{item.stats.views.toLocaleString("pl-PL")} wyśw.</span> : null}
                <span>{item.visits.toLocaleString("pl-PL")} wejść</span>
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
