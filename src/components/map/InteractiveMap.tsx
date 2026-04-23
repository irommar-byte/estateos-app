"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Building2, SlidersHorizontal, MapPin, Maximize, Lock, UserCheck, ShieldCheck, Crown, User, Eye, CalendarDays, Handshake, MessageSquare } from "lucide-react";
import OffMarketModal from "@/components/OffMarketModal";
import { AnimatePresence, motion } from "framer-motion";

const ALL_DISTRICTS = ["Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów", "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz"];
const PROPERTY_TYPES = ["Mieszkanie", "Segment", "Dom Wolnostojący", "Lokal Użytkowy", "Działka"];

export default function InteractiveMap() {
  const mapContainer = useRef(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  
  // NOWY STAN: Tryb Rynku (all, private, agency)
  const [marketMode, setMarketMode] = useState<'all' | 'private' | 'agency'>('all');
  const [transactionMode, setTransactionMode] = useState<'all' | 'sale' | 'rent'>('sale');
  
  const [filterDistrict, setFilterDistrict] = useState("Wybierz");
  const [filterType, setFilterType] = useState("Wybierz");
  const [filterPrice, setFilterPrice] = useState("Wybierz");
  const [filterPlotArea, setFilterPlotArea] = useState("");
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
    const [offMarketOffer, setOffMarketOffer] = useState<any>(null);
    const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).isLoggedIn = isLoggedIn;
      (window as any).triggerTeaser = () => setShowTeaser(true);
        (window as any).triggerOffMarket = (offer: any) => setOffMarketOffer(offer);
        (window as any).isPro = isPro;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetch('/api/user/profile').then(res => res.json()).then(user => { if (user && user.email) { setIsLoggedIn(true); setIsPro(user.role === 'PRO' || user.role === 'ADMIN' || user.plan === 'PRO'); } }).catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    fetch('/api/offers?t=' + new Date().getTime(), { cache: 'no-store' }).then(res => res.json()).then(data => {
      setAllOffers([...data]); setFilteredOffers([...data]);
    });
  }, []);

  // LOGIKA FILTROWANIA Z UWZGLĘDNIENIEM RYNKU
  useEffect(() => {
    let result = [...allOffers];
    
    if (marketMode === 'private') result = result.filter(o => o.advertiserType !== 'agency');
    if (marketMode === 'agency') result = result.filter(o => o.advertiserType === 'agency');

    if (filterDistrict !== "Wybierz" && filterDistrict !== "Wszystkie") result = result.filter(o => o.district === filterDistrict);
    if (filterType !== "Wybierz" && filterType !== "Wszystkie") result = result.filter(o => o.propertyType === filterType);
    
    if (filterPrice !== "Wybierz" && filterPrice !== "Wszystkie") {
      result = result.filter(o => {
        const p = parseInt(o.price?.replace(/\D/g, '')) || 0;
        if (filterPrice === "do 1 mln") return p <= 1000000;
        if (filterPrice === "1 - 3 mln") return p > 1000000 && p <= 3000000;
        if (filterPrice === "3 - 5 mln") return p > 3000000 && p <= 5000000;
        if (filterPrice === "5+ mln") return p > 5000000;
        return true;
      });
    }

    if (["Segment", "Dom Wolnostojący", "Działka"].includes(filterType) && filterPlotArea) {
      result = result.filter(o => {
        const pa = parseInt(o.plotArea?.replace(/\D/g, '')) || 0;
        const searchPa = parseInt(filterPlotArea.replace(/\D/g, '')) || 0;
        return pa >= searchPa;
      });
    }
    setFilteredOffers([...result]); 
  }, [marketMode, filterDistrict, filterType, filterPrice, filterPlotArea, allOffers]);

  // INICJALIZACJA MAPY
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!map.current) {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      map.current = new mapboxgl.Map({
        container: mapContainer.current, style: 'mapbox://styles/mapbox/dark-v11',
        center: [21.0122, 52.2297], zoom: 12, pitch: 60, bearing: -17, antialias: true
      });

      map.current.on('load', () => {
        const layers = map.current!.getStyle().layers;
        const labelLayerId = layers?.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
        
        map.current!.addLayer({
          'id': '3d-buildings', 'source': 'composite', 'source-layer': 'building', 'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#111',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.8
          }
        }, labelLayerId);
        map.current!.addSource('offers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
        map.current!.addLayer({ id: 'clustered-point', type: 'circle', source: 'offers', filter: ['has', 'point_count'], paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
        map.current!.addLayer({ id: 'unclustered-point', type: 'circle', source: 'offers', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
        
        map.current!.on('render', updateMarkers);
        map.current!.on('idle', updateMarkers);
        setMapLoaded(true);
      });
    }

    if (map.current && map.current.getSource('offers') && map.current.isStyleLoaded()) {
      const features = filteredOffers.filter(o => o.lng && o.lat).map((offer: any) => ({
        type: 'Feature' as const, properties: { ...offer }, geometry: { type: 'Point' as const, coordinates: [offer.lng, offer.lat] }
      }));
      const source = map.current.getSource('offers') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
        map.current.triggerRepaint(); 
      }
    }
  }, [filteredOffers, mapLoaded]);

  // LOGIKA PINÓW Z KOLORAMI RYNKU
  const updateMarkers = () => {
    if (!map.current) return;
    const newMarkers: { [key: string]: boolean } = {};
    const features = map.current.queryRenderedFeatures({ layers: ['clustered-point', 'unclustered-point'] });

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number];
      const isCluster = feature.properties.cluster;
      const id = isCluster ? `cluster-${feature.properties.cluster_id}` : `offer-${feature.properties.id}`;
      newMarkers[id] = true;

      if (!markersRef.current[id]) {
        const outerEl = document.createElement("div");
        outerEl.className = "z-30 relative";
        const innerEl = document.createElement("div");

        if (isCluster) {
          // Pobieranie liści klastra aby ocenić dominujący kolor (uproszczone do zielonego dla trybu all/private, pomarańczowego dla agency)
          const isAgencyMode = marketMode === 'agency';
          const bgClass = isAgencyMode ? "bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:bg-orange-500 hover:shadow-[0_0_60px_rgba(249,115,22,0.9)]" : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-[0_0_60px_rgba(16,185,129,0.9)]";

          innerEl.className = `w-12 h-12 backdrop-blur-xl border rounded-full flex items-center justify-center font-bold text-lg cursor-pointer hover:text-white hover:scale-125 active:scale-95 transition-all duration-300 ${bgClass}`;
          innerEl.innerText = feature.properties.point_count;
          innerEl.onclick = (e) => {
            e.stopPropagation();
            const source: any = map.current!.getSource('offers');
            source.getClusterExpansionZoom(feature.properties.cluster_id, (err: any, zoom: any) => {
              if (err) return; map.current!.easeTo({ center: coords, zoom: zoom + 1 });
            });
          };
        } else {
          const isOfferAgency = feature.properties.advertiserType === 'agency';
          const baseClasses = "px-5 py-3 backdrop-blur-xl border text-xs font-bold rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] cursor-pointer hover:scale-125 hover:shadow-[0_0_50px_rgba(255,255,255,0.8)] active:scale-95 transition-all duration-300 ease-out";
          const colorClasses = isOfferAgency 
            ? "bg-orange-500/90 text-black border-orange-400/50 hover:bg-orange-400" 
            : "bg-emerald-500/90 text-black border-emerald-400/50 hover:bg-emerald-400";
          
          innerEl.className = `${baseClasses} ${colorClasses}`;
          innerEl.innerText = feature.properties.price;
          innerEl.onclick = (e) => { 
            e.stopPropagation(); 
            if ((window as any).isLoggedIn) window.location.href = `/oferta/${feature.properties.id}`;
            else (window as any).triggerTeaser();
          };
        }
        
        outerEl.appendChild(innerEl);
        markersRef.current[id] = new mapboxgl.Marker({ element: outerEl }).setLngLat(coords).addTo(map.current!);
      }
    });

    for (const id in markersRef.current) {
      if (!newMarkers[id]) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    }
  };

  const handleFocusMap = () => {
    if (filterDistrict === "Wybierz") setFilterDistrict("Wszystkie");
    if (filterType === "Wybierz") setFilterType("Wszystkie");
    if (filterPrice === "Wybierz") setFilterPrice("Wszystkie");
    if (!map.current || filteredOffers.length === 0) return;
    
    const bounds = new mapboxgl.LngLatBounds([filteredOffers[0].lng, filteredOffers[0].lat], [filteredOffers[0].lng, filteredOffers[0].lat]);
    filteredOffers.forEach(o => bounds.extend([o.lng, o.lat]));

    map.current.fitBounds(bounds, { padding: { top: 250, bottom: 150, left: 100, right: 100 }, maxZoom: 15, pitch: 45, duration: 2500, essential: true });
  };

  const showPlotArea = ["Segment", "Dom Wolnostojący", "Działka"].includes(filterType);

  return (
    <div className="w-full bg-[#050505] py-24 relative">
      <div className="max-w-7xl mx-auto px-6 relative z-30 flex flex-col items-center">
        
        {/* NOWY LUSUSOWY PRZEŁĄCZNIK RYNKU (Wojna Kolorów) */}
        <div className="relative z-50 mb-6 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
           <button onClick={() => setMarketMode('all')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all relative ${marketMode === 'all' ? 'text-white' : 'text-white/40 hover:text-white'}`}>
             {marketMode === 'all' && <motion.div layoutId="marketTab" className="absolute inset-0 bg-[#222] rounded-full -z-10" />}
             <span className="relative z-10">Wszystkie Oferty</span>
           </button>
           <button onClick={() => setMarketMode('private')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${marketMode === 'private' ? 'text-black' : 'text-emerald-500/70 hover:text-emerald-500'}`}>
             {marketMode === 'private' && <motion.div layoutId="marketTab" className="absolute inset-0 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] -z-10" />}
             <span className="relative z-10 flex items-center gap-1.5"><User size={14}/> Rynek Prywatny</span>
           </button>
           <button onClick={() => setMarketMode('agency')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${marketMode === 'agency' ? 'text-black' : 'text-orange-500/70 hover:text-orange-500'}`}>
             {marketMode === 'agency' && <motion.div layoutId="marketTab" className="absolute inset-0 bg-orange-500 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.3)] -z-10" />}
             <span className="relative z-10 flex items-center gap-1.5"><Crown size={14}/> Eksperci PRO</span>
           </button>
        </div>


        {/* NOWY PRZEŁĄCZNIK KUPNO / WYNAJEM */}
        <div className="relative z-50 mb-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full p-1 flex shadow-[0_10px_30px_rgba(0,0,0,0.5)] scale-90 sm:scale-100">
           <button onClick={() => setTransactionMode('sale')} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all relative flex items-center gap-1.5 ${transactionMode === 'sale' ? 'text-black' : 'text-emerald-500/70 hover:text-emerald-500'}`}>
             {transactionMode === 'sale' && <motion.div layoutId="transactionTab" className="absolute inset-0 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] -z-10" />}
             <span className="relative z-10">Na Sprzedaż</span>
           </button>
           <button onClick={() => setTransactionMode('rent')} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all relative flex items-center gap-1.5 ${transactionMode === 'rent' ? 'text-black' : 'text-blue-500/70 hover:text-blue-500'}`}>
             {transactionMode === 'rent' && <motion.div layoutId="transactionTab" className="absolute inset-0 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)] -z-10" />}
             <span className="relative z-10">Na Wynajem</span>
           </button>
        </div>


        {/* PASEK FILTROWANIA */}
        <div className="z-50 w-full max-w-7xl px-8 py-5 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-wrap lg:flex-nowrap items-center gap-6">
          <div className="flex items-center gap-4 flex-1 w-full lg:border-r border-white/5 lg:pr-6 hover:bg-white/5 p-2 rounded-2xl transition-colors cursor-pointer">
            <Search className={marketMode === 'agency' ? 'text-orange-500 shrink-0' : 'text-emerald-500 shrink-0'} size={20} />
            <div className="w-full">
               <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 pointer-events-none">Dzielnica</p>
               <select className="bg-transparent text-white font-bold text-lg w-full cursor-pointer outline-none appearance-none" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
                 <option className="bg-black text-white/50" value="Wybierz" disabled>Wybierz</option><option className="bg-black" value="Wszystkie">Wszystkie</option>
                 {ALL_DISTRICTS.map(d => <option key={d} value={d} className="bg-black">{d}</option>)}
               </select>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 w-full lg:border-r border-white/5 lg:pr-6 hover:bg-white/5 p-2 rounded-2xl transition-colors cursor-pointer">
            <Building2 className={marketMode === 'agency' ? 'text-orange-500 shrink-0' : 'text-emerald-500 shrink-0'} size={20} />
            <div className="w-full">
               <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 pointer-events-none">Typ Nieruchomości</p>
               <select className="bg-transparent text-white font-bold text-lg w-full cursor-pointer outline-none appearance-none" value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterPlotArea(""); }}> 
                 <option className="bg-black text-white/50" value="Wybierz" disabled>Wybierz</option><option className="bg-black" value="Wszystkie">Wszystkie</option>
                 {PROPERTY_TYPES.map(d => <option key={d} value={d} className="bg-black">{d}</option>)}
               </select>
            </div>
          </div>

          <AnimatePresence>
            {showPlotArea && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-4 flex-1 w-full lg:border-r border-white/5 lg:pr-6 hover:bg-white/5 p-2 rounded-2xl transition-colors cursor-pointer">
                <Maximize className={marketMode === 'agency' ? 'text-orange-500 shrink-0' : 'text-emerald-500 shrink-0'} size={20} />
                <div className="w-full">
                   <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 pointer-events-none">Min. pow. działki</p>
                   <input type="text" placeholder="m²" className="bg-transparent text-white font-bold text-lg w-full outline-none appearance-none placeholder:text-white/20" value={filterPlotArea} onChange={(e) => setFilterPlotArea(e.target.value.replace(/\D/g, ''))} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 flex-1 w-full lg:border-r border-white/5 lg:pr-6 hover:bg-white/5 p-2 rounded-2xl transition-colors cursor-pointer">
            <SlidersHorizontal className={marketMode === 'agency' ? 'text-orange-500 shrink-0' : 'text-emerald-500 shrink-0'} size={20} />
            <div className="w-full">
               <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1 pointer-events-none">Zakres Ceny</p>
               <select className="bg-transparent text-white font-bold text-lg w-full cursor-pointer outline-none appearance-none" value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)}>
                 <option className="bg-black text-white/50" value="Wybierz" disabled>Wybierz</option><option className="bg-black" value="Wszystkie">Wszystkie</option><option className="bg-black" value="do 1 mln">do 1 mln</option><option className="bg-black" value="1 - 3 mln">1 - 3 mln</option><option className="bg-black" value="3 - 5 mln">3 - 5 mln</option><option className="bg-black" value="5+ mln">5+ mln</option>
               </select>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 lg:pl-2 w-full lg:w-auto mt-4 lg:mt-0">
            <button onClick={handleFocusMap} className={`group w-full lg:w-auto relative flex justify-center lg:justify-start items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 active:scale-95 px-6 py-4 rounded-full transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer pointer-events-auto ${marketMode === 'agency' ? 'hover:bg-orange-500/20 hover:border-orange-500/80 hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]' : 'hover:bg-emerald-500/20 hover:border-emerald-500/80 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]'}`}>
              <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${marketMode === 'agency' ? 'via-orange-500/40' : 'via-emerald-500/40'} to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out`} />
              <MapPin size={18} className={`${marketMode === 'agency' ? 'text-orange-500' : 'text-emerald-500'} group-hover:text-white transition-colors z-10 duration-300`} />
              <div className="flex flex-col items-start z-10 pointer-events-none">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 group-hover:text-white transition-colors leading-none mb-1 duration-300">Pokaż na mapie</span>
                <span className={`text-sm font-extrabold text-white transition-colors leading-none drop-shadow-md duration-300 ${marketMode === 'agency' ? 'group-hover:text-orange-400' : 'group-hover:text-emerald-400'}`}>{filteredOffers.length} {filteredOffers.length === 1 ? 'Oferta' : (filteredOffers.length > 1 && filteredOffers.length < 5) ? 'Oferty' : 'Ofert'}</span>
              </div>
            </button>
          </div>
        </div>

        <div className="w-full h-[850px] rounded-[3rem] overflow-hidden border border-white/5 relative shadow-[0_0_100px_rgba(0,0,0,0.8)] mt-12 w-[calc(100%+2rem)] -mx-4">
          <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-[3rem] z-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
          <div ref={mapContainer} className="w-full h-full z-10" />
          
          <div className="absolute bottom-10 left-10 z-30 flex gap-4 pointer-events-none">
             <div className={`px-5 py-2.5 bg-black/80 backdrop-blur-xl rounded-full border text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-colors ${marketMode === 'agency' ? 'border-white/5 opacity-50' : 'border-emerald-500/30'}`}>
                <div className={`w-2 h-2 bg-emerald-500 rounded-full ${marketMode !== 'agency' ? 'animate-pulse shadow-[0_0_10px_#10b981]' : ''}`} /> Prywatne
             </div>
             <div className={`px-5 py-2.5 bg-black/80 backdrop-blur-xl rounded-full border text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-colors ${marketMode === 'private' ? 'border-white/5 opacity-50' : 'border-orange-500/30'}`}>
                <div className={`w-2 h-2 bg-orange-500 rounded-full ${marketMode !== 'private' ? 'animate-pulse shadow-[0_0_10px_#f97316]' : ''}`} /> Agencje PRO
             </div>
          </div>
        </div>
      </div>
    
      <AnimatePresence>
        {showTeaser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-md flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,1)] relative text-center">
              <button onClick={() => setShowTeaser(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors">✕</button>
              
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                <Lock className="text-emerald-500" size={40} />
              </div>
              
              <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Oferta <span className="text-emerald-500">Off-Market</span></h2>
              <p className="text-lg text-white/50 mb-10 leading-relaxed font-medium">Szczegóły tej nieruchomości, dokładny adres oraz bezpośredni kontakt do właściciela są dostępne wyłącznie dla zweryfikowanych użytkowników.</p>
              
              <div className="grid grid-cols-1 gap-3 mb-10 text-left">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Eye className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Odkryj szczegóły i adresy</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <MessageSquare className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Bezpośredni kontakt z klientem</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <CalendarDays className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Umawiaj terminy prezentacji</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Handshake className="text-[#D4AF37]" size={20} />
                    <span className="text-xs font-bold text-[#D4AF37]/90 uppercase tracking-widest">Negocjuj cenę i składaj propozycje</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                <Link href="/szukaj" className="btn-action py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_rgba(16,185,129,0.2)]">
                  Zarejestruj się za darmo
                </Link>
                <Link href="/login" className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2">
                  Masz już konto? Zaloguj się
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
    </div>
  );
}
