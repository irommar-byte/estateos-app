"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  Home,
  Globe,
  Eye,
  BarChart3,
  Monitor,
  Smartphone,
  Tablet,
  Bot,
  Shield,
  UserPlus,
  Users,
  Loader2,
  Calendar,
  Clock,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { flagEmojiFromCountryCode } from "@/lib/visitGeo";
import { ESTATEOS_TIMEZONE, formatWarsawDateTime } from "@/lib/warsawDateTime";
import {
  TIMELINE_TABS,
  TIMELINE_PERIODS,
  buildTimelineChart,
  buildTimelineInsights,
  type TimelineTabId,
  type TimelinePeriod,
} from "@/lib/adminTimelineAnalytics";
import AdminMarketAnalyticsPanel from "@/components/admin/AdminMarketAnalyticsPanel";

const TAB_ICONS: Record<TimelineTabId, React.ReactNode> = {
  pageViews: <Eye size={16} />,
  uniqueViews: <Users size={16} />,
  offers: <Home size={16} />,
  users: <UserPlus size={16} />,
};

const deviceIcon = (deviceType: string) => {
  switch (String(deviceType || "").toLowerCase()) {
    case "mobile":
      return <Smartphone size={14} className="text-blue-500" />;
    case "tablet":
      return <Tablet size={14} className="text-violet-500" />;
    case "bot":
      return <Bot size={14} className="text-amber-500" />;
    default:
      return <Monitor size={14} className="text-emerald-500" />;
  }
};

export default function Statystyki() {
  const [stats, setStats] = useState<any>(null);
  const [activeTabId, setActiveTabId] = useState<TimelineTabId>("pageViews");
  const [activePeriod, setActivePeriod] = useState<TimelinePeriod>("Ostatnie 30 Dni");
  const [showVisitors, setShowVisitors] = useState(false);
  const [showMarket, setShowMarket] = useState(true);
  const [chartPending, startChartTransition] = useTransition();
  const router = useRouter();

  const activeTab = TIMELINE_TABS.find((t) => t.id === activeTabId) || TIMELINE_TABS[0];

  useEffect(() => {
    void fetch("/api/admin/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  const insights = useMemo(() => buildTimelineInsights(stats?.timeline), [stats]);
  const chartData = useMemo(() => buildTimelineChart(activePeriod, stats?.timeline), [activePeriod, stats]);

  const visitorsList = useMemo(() => {
    if (Array.isArray(stats?.timeline?.visitors) && stats.timeline.visitors.length > 0) {
      return stats.timeline.visitors;
    }
    return [];
  }, [stats]);

  const visitorCountries = useMemo(() => {
    if (Array.isArray(stats?.timeline?.visitorCountries)) return stats.timeline.visitorCountries;
    return [];
  }, [stats]);

  const visitorInsight = stats?.timeline?.visitorGeoInsight ?? null;
  const marketOffers = stats?.timeline?.offers ?? [];

  const selectPeriod = (period: TimelinePeriod) => {
    startChartTransition(() => setActivePeriod(period));
  };

  const selectTab = (id: TimelineTabId) => {
    startChartTransition(() => setActiveTabId(id));
  };

  if (!stats) {
    return (
      <div className="theme-aware-dashboard flex min-h-screen items-center justify-center bg-[var(--eos-bg)]">
        <div className="size-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] px-4 pb-16 pt-28 text-[var(--eos-text)] sm:px-6 md:px-10 md:pt-32">
      <div className="mx-auto max-w-[1400px]">
        <button
          type="button"
          onClick={() => router.push("/centrala")}
          className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          <ArrowLeft size={14} /> Centrala
        </button>

        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--eos-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Analityka<span className="text-emerald-500">.</span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
              <TrendingUp size={12} className="text-emerald-500" />
              Raport systemowy EstateOS · {ESTATEOS_TIMEZONE.replace("_", " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMarket(true);
                setShowVisitors(false);
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                showMarket
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              <BarChart3 size={14} /> Analiza rynku
            </button>
            <button
              type="button"
              onClick={() => {
                setShowVisitors(true);
                setShowMarket(false);
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                showVisitors
                  ? "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              <Globe size={14} /> Live IP
            </button>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "Użytkownicy", value: stats.kpis?.users ?? 0 },
            { label: "Oferty", value: stats.kpis?.offers ?? 0 },
            { label: "Aktywne", value: stats.kpis?.active ?? 0 },
            { label: "Odsłony", value: stats.kpis?.pageViews ?? 0 },
            { label: "Unikalne IP", value: stats.kpis?.uniqueViews ?? 0 },
            { label: "Wartość portfela", value: `${Math.round((stats.kpis?.totalValue ?? 0) / 1_000_000)}M` },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{kpi.label}</p>
              <p className="text-xl font-black tabular-nums">{typeof kpi.value === "number" ? Number(kpi.value).toLocaleString("pl-PL") : kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <InsightCard
            icon={<Calendar size={16} className="text-emerald-500" />}
            title="Wizyty — dni tygodnia"
            best={insights.visits.best ? `${insights.visits.best.day} (${insights.visits.best.visits})` : "—"}
            worst={insights.visits.worst ? `${insights.visits.worst.day} (${insights.visits.worst.visits})` : "—"}
            extra={
              insights.visits.peakHour != null
                ? `Szczyt godzinowy: ${String(insights.visits.peakHour).padStart(2, "0")}:00`
                : undefined
            }
          />
          <InsightCard
            icon={<Home size={16} className="text-pink-500" />}
            title="Oferty — dni tygodnia"
            best={insights.offers.best ? `${insights.offers.best.day} (${insights.offers.best.offers})` : "—"}
            worst={insights.offers.worst ? `${insights.offers.worst.day} (${insights.offers.worst.offers})` : "—"}
          />
          <InsightCard
            icon={<Clock size={16} className="text-violet-500" />}
            title="Wolumen ofert"
            best={
              insights.yearlyOffers.length
                ? `Rok ${insights.yearlyOffers[insights.yearlyOffers.length - 1]?.year}: ${insights.yearlyOffers[insights.yearlyOffers.length - 1]?.count}`
                : "—"
            }
            worst={
              insights.monthlyOffers.length
                ? `${insights.monthlyOffers[insights.monthlyOffers.length - 1]?.label}: ${insights.monthlyOffers[insights.monthlyOffers.length - 1]?.count}`
                : "Brak w tym roku"
            }
            extra={`Łącznie w próbce: ${insights.totals.offers} ofert`}
          />
        </div>

        <AnimatePresence mode="wait">
          {showMarket ? (
            <motion.div key="market" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-8">
              <AdminMarketAnalyticsPanel offers={marketOffers} />
            </motion.div>
          ) : null}

          {showVisitors ? (
            <motion.div
              key="visitors"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]"
            >
              <div className="border-b border-[var(--eos-border)] p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-black">
                  <Globe className="text-sky-500" size={18} /> Rejestr odwiedzających
                </h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--eos-muted)]">
                  Top 50 adresów IP. Czas w strefie {ESTATEOS_TIMEZONE.replace("_", " ")} (zapis serwera = czas polski).
                </p>
                {visitorInsight ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Unikalni IP", visitorInsight.uniqueVisitors],
                      ["Kraje", visitorInsight.countriesDetected],
                      ["PL (wizyty)", `${visitorInsight.polandPageViewSharePct}%`],
                      ["Lookup IP", visitorInsight.geoFromLookup],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{label}</p>
                        <p className="text-lg font-black tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {visitorInsight?.note ? (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 sm:mx-6">
                  <Shield size={14} className="mt-0.5 shrink-0" />
                  <span>{visitorInsight.note}</span>
                </div>
              ) : null}

              {visitorCountries.length > 0 ? (
                <div className="border-b border-[var(--eos-border)] px-4 py-3 sm:px-6">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Rozkład krajów</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visitorCountries.map((c: any) => (
                      <span
                        key={c.countryCode}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-1 text-xs"
                      >
                        <span>{c.flag || flagEmojiFromCountryCode(c.countryCode)}</span>
                        <span className="font-semibold">{c.countryName}</span>
                        <span className="text-[var(--eos-muted)]">
                          {c.pageViews} · {c.sharePct}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--eos-border)] bg-[var(--eos-bg)] text-[10px] uppercase tracking-widest text-[var(--eos-subtle)]">
                      <th className="px-3 py-2.5">Kraj</th>
                      <th className="px-3 py-2.5">Lokalizacja</th>
                      <th className="px-3 py-2.5">IP</th>
                      <th className="px-3 py-2.5">Urządzenie</th>
                      <th className="px-3 py-2.5">Ostatnia aktywność</th>
                      <th className="px-3 py-2.5 text-center">Odsłony</th>
                      <th className="px-3 py-2.5 text-center">Mapa</th>
                      <th className="px-3 py-2.5">Ścieżki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[var(--eos-muted)]">
                          Brak zarejestrowanych wizyt.
                        </td>
                      </tr>
                    ) : (
                      visitorsList.map((v: any) => (
                        <tr key={v.ip} className="border-b border-[var(--eos-border)] hover:bg-[var(--eos-bg)]">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{v.flag || flagEmojiFromCountryCode(v.countryCode)}</span>
                              <div>
                                <p className="font-semibold">{v.countryName}</p>
                                <p className="font-mono text-[10px] text-[var(--eos-subtle)]">{v.countryCode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[140px] px-3 py-2.5 text-[var(--eos-muted)]">
                            <p>{[v.city, v.regionName].filter(Boolean).join(", ") || "—"}</p>
                            {v.isRelay ? <p className="text-[10px] text-amber-600 dark:text-amber-400">VPN / relay</p> : null}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">{v.ip}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 capitalize text-[var(--eos-muted)]">
                              {deviceIcon(v.deviceType)}
                              {v.deviceType || "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--eos-muted)]">
                            {formatWarsawDateTime(v.lastVisit)}
                            <p className="text-[10px] text-[var(--eos-subtle)]">pierwsze: {formatWarsawDateTime(v.firstVisit)}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold">{v.count}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{v.mainPageViews}</td>
                          <td className="max-w-[180px] px-3 py-2.5 text-[10px] text-[var(--eos-muted)]">
                            {(v.topPaths || []).map((p: string) => (
                              <p key={p} className="truncate" title={p}>
                                {p}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {insights.monthlyOffers.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:p-6">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
              Oferty w bieżącym roku (miesięcznie)
            </p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.monthlyOffers} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--eos-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--eos-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--eos-muted)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 shadow-lg">
                          <p className="text-[10px] font-bold uppercase text-[var(--eos-subtle)]">{label}</p>
                          <p className="text-lg font-black">{payload[0]?.value} ofert</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:p-6"
        >
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {TIMELINE_TABS.map((tab) => {
                const isActive = tab.id === activeTabId;
                const total = chartData.reduce((sum, item) => sum + Number(item[tab.id] || 0), 0);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      isActive
                        ? "border-[var(--eos-border-strong)] bg-[var(--eos-bg)] text-[var(--eos-text)]"
                        : "border-transparent text-[var(--eos-muted)] hover:bg-[var(--eos-bg)]"
                    }`}
                    style={{ borderColor: isActive ? tab.color : undefined }}
                  >
                    <span style={{ color: isActive ? tab.color : undefined }}>{TAB_ICONS[tab.id]}</span>
                    {tab.label}
                    {total > 0 ? ` (${total})` : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] p-1">
              {TIMELINE_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => selectPeriod(period)}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    activePeriod === period
                      ? "bg-[var(--eos-card)] text-[var(--eos-text)] shadow-sm"
                      : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-[360px] w-full">
            {chartPending ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-[var(--eos-card)]/80 backdrop-blur-sm">
                <Loader2 className="size-8 animate-spin text-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">Przeliczanie…</p>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeTab.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={activeTab.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--eos-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--eos-muted)", fontSize: 10, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--eos-muted)", fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 shadow-lg">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{label}</p>
                        <p className="text-2xl font-black tabular-nums text-[var(--eos-text)]">
                          {Number(payload[0]?.value || 0).toLocaleString("pl-PL")}
                          <span className="ml-2 text-[10px] font-bold text-[var(--eos-muted)]">{activeTab.label}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={activeTabId}
                  stroke={activeTab.color}
                  strokeWidth={2.5}
                  fill="url(#analyticsGradient)"
                  animationDuration={chartPending ? 0 : 600}
                  isAnimationActive={!chartPending}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {activePeriod === "Dni Szczytu" ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {insights.weekdays.map((row) => (
                <div key={row.day} className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase text-[var(--eos-subtle)]">{row.day.slice(0, 3)}</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{row.visits}</p>
                  <p className="text-[10px] text-[var(--eos-muted)]">{row.offers} ofert</p>
                </div>
              ))}
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  best,
  worst,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  best: string;
  worst: string;
  extra?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
        {icon}
        {title}
      </div>
      <p className="text-xs text-[var(--eos-muted)]">
        Najlepszy: <span className="font-bold text-[var(--eos-text)]">{best}</span>
      </p>
      <p className="text-xs text-[var(--eos-muted)]">
        Najgorszy: <span className="font-bold text-[var(--eos-text)]">{worst}</span>
      </p>
      {extra ? <p className="mt-2 text-[10px] text-[var(--eos-subtle)]">{extra}</p> : null}
    </div>
  );
}
