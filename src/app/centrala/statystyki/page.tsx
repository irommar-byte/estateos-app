"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, TrendingUp, Users, Building, Banknote, Briefcase, User, 
  Eye, UserCheck, UserPlus, Home, Building2, Globe, Map as MapIcon, Calculator, BarChart3
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode === 'UNKNOWN') return '🌍';
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
};

const TABS = [
  { id: 'pageViews', label: 'Wizyty', icon: <Eye size={16}/>, color: '#10b981' },
  { id: 'uniqueViews', label: 'Unikalni', icon: <UserCheck size={16}/>, color: '#3b82f6' },
  { id: 'buyers', label: 'Kupujący', icon: <Users size={16}/>, color: '#8b5cf6' },
  { id: 'sellers', label: 'Sprzedający', icon: <UserPlus size={16}/>, color: '#f59e0b' },
  { id: 'offers', label: 'Oferty', icon: <Home size={16}/>, color: '#ec4899' },
  { id: 'agencies', label: 'Agencje', icon: <Building2 size={16}/>, color: '#06b6d4' },
];

const PERIODS = ['Ostatnie 30 Dni', 'Ten Rok', 'Godziny Szczytu', 'Dni Szczytu'];
const PROPERTY_TYPES = ['Wszystkie', 'Mieszkanie', 'Dom', 'Działka', 'Komercyjne'];

const processChartData = (period: string, timeline: any) => {
  if (!timeline) return [];
  const now = new Date();
  const buckets: any[] = [];
  
  if (period === 'Godziny Szczytu') {
    for (let i = 0; i < 24; i++) buckets.push({ name: `${i}:00`, hourMatch: i, pageViews: 0, uniqueViews: 0, offers: 0, agencies: 0, privateUsers: 0, buyers: 0, sellers: 0, uniqueIps: new Set() });
  } else if (period === 'Dni Szczytu') {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    for (let i = 0; i < 7; i++) buckets.push({ name: days[i], dayMatch: i, pageViews: 0, uniqueViews: 0, offers: 0, agencies: 0, privateUsers: 0, buyers: 0, sellers: 0, uniqueIps: new Set() });
  } else if (period === 'Ostatnie 30 Dni') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      buckets.push({ name: d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' }), dateMatch: d.toISOString().split('T')[0], pageViews: 0, uniqueViews: 0, offers: 0, agencies: 0, privateUsers: 0, buyers: 0, sellers: 0, uniqueIps: new Set() });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ name: d.toLocaleDateString('pl-PL', { month: 'short' }), dateMatch: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`, pageViews: 0, uniqueViews: 0, offers: 0, agencies: 0, privateUsers: 0, buyers: 0, sellers: 0, uniqueIps: new Set() });
    }
  }

  const assignToBucket = (dateStr: string, callback: (bucket: any) => void) => {
    const d = new Date(dateStr);
    let match: any;
    if (period === 'Godziny Szczytu') match = buckets.find(b => b.hourMatch === d.getHours());
    else if (period === 'Dni Szczytu') match = buckets.find(b => b.dayMatch === d.getDay());
    else if (period === 'Ostatnie 30 Dni') match = buckets.find(b => b.dateMatch === d.toISOString().split('T')[0]);
    else match = buckets.find(b => b.dateMatch === d.toISOString().substring(0, 7));
    if (match) callback(match);
  };

  timeline.visits?.forEach((v: any) => assignToBucket(v.createdAt, b => { b.pageViews++; b.uniqueIps.add(v.ip); }));
  timeline.offers?.forEach((o: any) => assignToBucket(o.createdAt, b => { b.offers++; if (o.advertiserType === 'agency') b.agencies++; else b.privateUsers++; }));
  timeline.users?.forEach((u: any) => assignToBucket(u.createdAt, b => { if (u.isBuyer) b.buyers++; if (u.isSeller) b.sellers++; }));

  return buckets.map(b => ({ ...b, uniqueViews: b.uniqueIps.size }));
};

export default function Statystyki() {
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activePeriod, setActivePeriod] = useState(PERIODS[0]);
  const [showVisitors, setShowVisitors] = useState(false);
  
  // Stany dla modułu Analizy Rynku
  const [showMarket, setShowMarket] = useState(false);
  const [marketFilter, setMarketFilter] = useState('Wszystkie');
  
  const router = useRouter();

  useEffect(() => { fetch('/api/admin/stats').then(res => res.json()).then(data => setStats(data)); }, []);

  const chartData = useMemo(() => processChartData(activePeriod, stats?.timeline), [activePeriod, stats]);
  
  const visitorsList = useMemo(() => {
    if (!stats?.timeline?.visits) return [];
    const vMap = new Map();
    stats.timeline.visits.forEach((v: any) => {
      const existing = vMap.get(v.ip);
      if (!existing || new Date(v.createdAt) > existing.lastVisit) {
        vMap.set(v.ip, { ip: v.ip, country: v.country, count: (existing?.count || 0) + 1, mainPageViews: (existing?.mainPageViews || 0) + (v.path === '/' ? 1 : 0), lastVisit: new Date(v.createdAt), path: v.path });
      } else {
        existing.count++;
        if (v.path === '/') existing.mainPageViews++;
      }
    });
    return Array.from(vMap.values()).sort((a: any, b: any) => b.lastVisit - a.lastVisit).slice(0, 50);
  }, [stats]);

  // SILNIK ANALIZY RYNKU (Liczy cenę za m2 na bieżąco)
  const marketData = useMemo(() => {
    if (!stats?.timeline?.offers) return null;
    
    // Bierzemy tylko aktywne lub weryfikowane oferty
    let filtered = stats.timeline.offers.filter((o: any) => o.status !== 'rejected');
    if (marketFilter !== 'Wszystkie') filtered = filtered.filter((o: any) => o.propertyType === marketFilter);

    let totalWarsawPrice = 0;
    let totalWarsawArea = 0;
    const districtMap = new Map();

    filtered.forEach((o: any) => {
      const price = parseInt((o.price || '0').replace(/\D/g, '')) || 0;
      const areaStr = (o.area || '0').replace(',', '.').replace(/[^\d.]/g, '');
      const area = parseFloat(areaStr) || 0;

      if (price > 0 && area > 0) {
        totalWarsawPrice += price;
        totalWarsawArea += area;

        const d = o.district || 'Inna';
        if (!districtMap.has(d)) districtMap.set(d, { totalPrice: 0, totalArea: 0, count: 0 });
        const dStats = districtMap.get(d);
        dStats.totalPrice += price;
        dStats.totalArea += area;
        dStats.count += 1;
      }
    });

    const avgWarsawSqm = totalWarsawArea > 0 ? Math.round(totalWarsawPrice / totalWarsawArea) : 0;
    const districts = Array.from(districtMap.entries()).map(([name, data]) => ({
      name,
      avgSqm: data.totalArea > 0 ? Math.round(data.totalPrice / data.totalArea) : 0,
      count: data.count
    })).sort((a, b) => b.avgSqm - a.avgSqm);

    const maxDistrictPrice = districts.length > 0 ? districts[0].avgSqm : 1;
    return { avgWarsawSqm, districts, maxDistrictPrice };
  }, [stats, marketFilter]);

  if (!stats) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 md:p-12 font-sans selection:bg-emerald-500 selection:text-white">
      <button onClick={() => router.push('/centrala')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-12 text-[10px] font-black uppercase tracking-[0.4em] transition-all">
        <ArrowLeft size={14}/> Centrala
      </button>
      
      <div className="max-w-7xl mx-auto">
        {/* NAGŁÓWEK I PRZYCISKI MODUŁÓW */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h1 className="text-6xl font-black tracking-tighter italic mb-4">Analityka<span className="text-emerald-500">.</span></h1>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500"/> Raport Systemowy EstateOS
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => { setShowMarket(!showMarket); setShowVisitors(false); }} className={`border px-6 py-3 rounded-xl flex items-center gap-3 transition-all ${showMarket ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}`}>
              <MapIcon size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Analiza Rynku</span>
            </button>
            <button onClick={() => { setShowVisitors(!showVisitors); setShowMarket(false); }} className={`border px-6 py-3 rounded-xl flex items-center gap-3 transition-all ${showVisitors ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}`}>
              <Globe size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Live IP Tracker</span>
            </button>
          </div>
        </div>

        {/* MODUŁ 1: ANALIZA RYNKU WARSZAWA (NOWOŚĆ) */}
        <AnimatePresence>
          {showMarket && marketData && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-16">
              <div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-[32px] p-8 shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                
                <div className="flex flex-col lg:flex-row gap-12">
                  {/* Lewa strona: Cała Warszawa */}
                  <div className="lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/10 pb-8 lg:pb-0 lg:pr-12">
                    <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2"><Calculator size={14} className="text-emerald-500"/> Średnia w Warszawie</h3>
                    <p className="text-5xl font-black tracking-tight text-white mb-2">
                      {marketData.avgWarsawSqm.toLocaleString('pl-PL')} <span className="text-xl text-emerald-500">PLN/m²</span>
                    </p>
                    <p className="text-gray-500 text-sm mb-12">Na podstawie wszystkich zgromadzonych ofert w systemie.</p>
                    
                    {/* Filtry typów */}
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Typ Nieruchomości</p>
                    <div className="flex flex-col gap-2">
                      {PROPERTY_TYPES.map(type => (
                        <button key={type} onClick={() => setMarketFilter(type)} className={`text-left px-4 py-3 rounded-xl transition-all text-xs font-bold tracking-wider ${marketFilter === type ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prawa strona: Ranking Dzielnic (Apple Health Style Progress Bars) */}
                  <div className="lg:w-2/3">
                    <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-8 flex items-center gap-2"><BarChart3 size={14} className="text-emerald-500"/> Ranking Dzielnic (PLN/m²)</h3>
                    <div className="flex flex-col gap-6">
                      {marketData.districts.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">Brak danych dla wybranego filtru.</p>
                      ) : (
                        marketData.districts.map((d: any, index: number) => {
                          const percentage = Math.max((d.avgSqm / marketData.maxDistrictPrice) * 100, 5); // Minimum 5% paska
                          return (
                            <div key={d.name} className="relative group">
                              <div className="flex justify-between items-end mb-2">
                                <span className="font-bold text-sm tracking-wide text-white group-hover:text-emerald-500 transition-colors">{index + 1}. {d.name}</span>
                                <div className="text-right">
                                  <span className="font-black text-lg text-white">{d.avgSqm.toLocaleString('pl-PL')} <span className="text-xs text-gray-500 font-normal">PLN</span></span>
                                  <span className="text-[10px] text-gray-600 ml-3 hidden sm:inline-block">({d.count} ofert)</span>
                                </div>
                              </div>
                              {/* Pasek postępu */}
                              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }} 
                                  animate={{ width: `${percentage}%` }} 
                                  transition={{ duration: 1, ease: "easeOut", delay: index * 0.05 }}
                                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODUŁ 2: LIVE IP TRACKER */}
        <AnimatePresence>
          {showVisitors && (
            // ... (tutaj kod trackera, pozostaje bez zmian)
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-16">
              <div className="bg-[#0a0a0a] border border-blue-500/20 rounded-[32px] p-8 shadow-[0_0_50px_rgba(59,130,246,0.05)]">
                <h3 className="text-xl font-black mb-6 flex items-center gap-3"><Globe className="text-blue-500"/> Rejestr Odwiedzających (Top 50 powracających)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500 text-[10px] uppercase tracking-widest">
                        <th className="pb-4 pl-4">Kraj</th>
                        <th className="pb-4">Adres IP</th>
                        <th className="pb-4">Ostatnia Aktywność</th>
                        <th className="pb-4 text-center">Wszystkie Wejścia</th>
                        <th className="pb-4 text-center text-emerald-500">Wejścia Główne (Mapa)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorsList.map((v: any, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-4 text-2xl">{getFlagEmoji(v.country)}</td>
                          <td className="py-4 font-mono text-sm tracking-wider">{v.ip}</td>
                          <td className="py-4 text-gray-400 text-xs">{v.lastVisit.toLocaleString('pl-PL')}</td>
                          <td className="py-4 text-center font-black text-lg">{v.count}</td>
                          <td className="py-4 text-center font-black text-lg text-emerald-500">{v.mainPageViews}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GŁÓWNY WYKRES CZASOWY (Pozostaje na dole) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[32px]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const isActive = activeTab.id === tab.id;
                const total = chartData.reduce((sum, item) => sum + (item[tab.id as keyof typeof item] as number), 0);
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300 text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-white/5 text-white shadow-lg' : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-white'}`} style={{ borderColor: isActive ? tab.color : 'transparent' }}>
                    <div style={{ color: isActive ? tab.color : 'inherit' }}>{tab.icon}</div>
                    {tab.label} {total > 0 && `(${total})`}
                  </button>
                );
              })}
            </div>
            <div className="flex bg-[#050505] p-1 rounded-xl border border-white/5 overflow-x-auto">
              {PERIODS.map((period) => (
                <button key={period} onClick={() => setActivePeriod(period)} className={`whitespace-nowrap px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${activePeriod === period ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs><linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={activeTab.color} stopOpacity={0.4}/><stop offset="95%" stopColor={activeTab.color} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }} dy={15}/>
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}/>
                <Tooltip content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) return (
                    <div className="bg-[#050505]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl"><p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{label}</p><p className="text-white text-3xl font-black tracking-tight">{payload[0].value.toLocaleString('pl-PL')}<span className="text-[10px] font-bold text-gray-500 ml-2 uppercase tracking-widest">{activeTab.label}</span></p></div>
                  );
                  return null;
                }} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey={activeTab.id} stroke={activeTab.color} strokeWidth={3} fillOpacity={1} fill="url(#colorGradient)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
