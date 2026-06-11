"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  UserCheck,
  UserPlus,
  Home,
  Building2,
  Globe,
  Eye,
  BarChart3,
  Monitor,
  Smartphone,
  Tablet,
  Bot,
  Shield,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { flagEmojiFromCountryCode } from "@/lib/visitGeo";
import {
  ESTATEOS_TIMEZONE,
  formatWarsawDateTime,
  getWarsawDateKey,
  getWarsawHour,
  getWarsawMonthKey,
  getWarsawWeekday,
  parseEventDate,
} from "@/lib/warsawDateTime";
import AdminMarketAnalyticsPanel from "@/components/admin/AdminMarketAnalyticsPanel";

const TABS = [
  { id: "pageViews", label: "Wizyty", icon: <Eye size={16} />, color: "#10b981" },
  { id: "uniqueViews", label: "Unikalni", icon: <UserCheck size={16} />, color: "#3b82f6" },
  { id: "buyers", label: "Kupujący", icon: <Users size={16} />, color: "#8b5cf6" },
  { id: "sellers", label: "Sprzedający", icon: <UserPlus size={16} />, color: "#f59e0b" },
  { id: "offers", label: "Oferty", icon: <Home size={16} />, color: "#ec4899" },
  { id: "agencies", label: "Agencje", icon: <Building2 size={16} />, color: "#06b6d4" },
];

const PERIODS = ["Ostatnie 30 Dni", "Ten Rok", "Godziny Szczytu", "Dni Szczytu"];

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

const processChartData = (period: string, timeline: any) => {
  if (!timeline) return [];
  const now = new Date();
  const buckets: any[] = [];

  if (period === "Godziny Szczytu") {
    for (let i = 0; i < 24; i++) {
      buckets.push({
        name: `${String(i).padStart(2, "0")}:00`,
        hourMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set(),
      });
    }
  } else if (period === "Dni Szczytu") {
    const days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
    for (let i = 0; i < 7; i++) {
      buckets.push({
        name: days[i],
        dayMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set(),
      });
    }
  } else if (period === "Ostatnie 30 Dni") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        name: d.toLocaleDateString("pl-PL", { timeZone: ESTATEOS_TIMEZONE, day: "2-digit", month: "short" }),
        dateMatch: getWarsawDateKey(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set(),
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleDateString("pl-PL", { timeZone: ESTATEOS_TIMEZONE, month: "short" }),
        dateMatch: getWarsawMonthKey(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set(),
      });
    }
  }

  const assignToBucket = (dateStr: string, callback: (bucket: any) => void) => {
    const d = parseEventDate(dateStr);
    if (Number.isNaN(d.getTime())) return;
    let match: any;
    if (period === "Godziny Szczytu") match = buckets.find((b) => b.hourMatch === getWarsawHour(d));
    else if (period === "Dni Szczytu") match = buckets.find((b) => b.dayMatch === getWarsawWeekday(d));
    else if (period === "Ostatnie 30 Dni") match = buckets.find((b) => b.dateMatch === getWarsawDateKey(d));
    else match = buckets.find((b) => b.dateMatch === getWarsawMonthKey(d));
    if (match) callback(match);
  };

  timeline.visits?.forEach((v: any) =>
    assignToBucket(v.createdAt, (b) => {
      b.pageViews++;
      b.uniqueIps.add(v.ip);
    }),
  );
  timeline.offers?.forEach((o: any) =>
    assignToBucket(o.createdAt, (b) => {
      b.offers++;
      if (o.advertiserType === "agency") b.agencies++;
      else b.privateUsers++;
    }),
  );
  timeline.users?.forEach((u: any) =>
    assignToBucket(u.createdAt, (b) => {
      if (u.isBuyer) b.buyers++;
      if (u.isSeller) b.sellers++;
    }),
  );

  return buckets.map((b) => ({ ...b, uniqueViews: b.uniqueIps.size }));
};

export default function Statystyki() {
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activePeriod, setActivePeriod] = useState(PERIODS[0]);
  const [showVisitors, setShowVisitors] = useState(false);
  const [showMarket, setShowMarket] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/admin/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  const chartData = useMemo(() => processChartData(activePeriod, stats?.timeline), [activePeriod, stats]);

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
              Raport systemowy EstateOS
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

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Użytkownicy", value: stats.kpis?.users ?? 0 },
            { label: "Oferty", value: stats.kpis?.offers ?? 0 },
            { label: "Aktywne", value: stats.kpis?.active ?? 0 },
            { label: "Odsłony", value: stats.kpis?.pageViews ?? 0 },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{kpi.label}</p>
              <p className="text-xl font-black tabular-nums">{Number(kpi.value).toLocaleString("pl-PL")}</p>
            </div>
          ))}
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
                  Top 50 adresów IP. Czas wyświetlany w strefie {ESTATEOS_TIMEZONE.replace("_", " ")} (zapis serwera UTC →
                  konwersja na czas polski).
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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:p-6"
        >
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const isActive = activeTab.id === tab.id;
                const total = chartData.reduce((sum, item) => sum + (item[tab.id as keyof typeof item] as number), 0);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      isActive
                        ? "border-[var(--eos-border-strong)] bg-[var(--eos-bg)] text-[var(--eos-text)]"
                        : "border-transparent text-[var(--eos-muted)] hover:bg-[var(--eos-bg)]"
                    }`}
                    style={{ borderColor: isActive ? tab.color : undefined }}
                  >
                    <span style={{ color: isActive ? tab.color : undefined }}>{tab.icon}</span>
                    {tab.label}
                    {total > 0 ? ` (${total})` : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] p-1">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setActivePeriod(period)}
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

          <div className="h-[360px] w-full">
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
                  dataKey={activeTab.id}
                  stroke={activeTab.color}
                  strokeWidth={2.5}
                  fill="url(#analyticsGradient)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
