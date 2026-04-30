"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Home, 
  Building2, Rows, Castle, Briefcase, Map as MapIcon, MapPin, 
  Sparkles, Loader2, CheckCircle, Crown, Key, Upload, Trash2, 
  LayoutTemplate, X, Lock, User, Phone, Mail, Flame, AlertCircle, Check,
  Navigation, EyeOff, Bold, Italic, Underline, Heading, AlignLeft
} from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

// Luksusowe style bazowe (Glassmorphism & Apple Dark Mode)
const inputPremium = "w-full bg-white/5 border border-white/10 rounded-2xl text-[#f5f5f7] text-base md:text-lg py-4 px-5 focus:bg-white/10 focus:border-[#10b981] outline-none transition-all duration-300 placeholder:text-zinc-500 backdrop-blur-md shadow-inner";
const labelPremium = "flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-2 ml-1";
const glassPanel = "bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-500";

const PROPERTY_TYPES = [
  { id: "FLAT", label: "Mieszkanie", icon: Building2 },
  { id: "HOUSE", label: "Dom", icon: Castle },
  { id: "PLOT", label: "Działka", icon: MapIcon },
  { id: "COMMERCIAL", label: "Lokal", icon: Briefcase }
];
const AMENITIES = ["Balkon", "Garaż/Miejsce park.", "Piwnica/Pom. gosp.", "Ogródek", "Dwupoziomowe", "Winda", "Klimatyzacja"];
const HEATING_TYPES = ["Miejskie", "Gazowe", "Elektryczne", "Pompa Ciepła", "Węglowe/Pellet", "Inne"];
const CONDITION_TYPES = [
  { id: "READY", label: "Gotowe" },
  { id: "RENOVATION", label: "Do remontu" },
  { id: "DEVELOPER", label: "Deweloperski" }
];

type DistrictCatalogResponse = {
  strictCities: string[];
  strictCityDistricts: Record<string, string[]>;
};

const SortableItem = ({ id, img, idx, onRemove, progressObj }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.9 : 1,
    scale: isDragging ? '1.05' : '1',
    boxShadow: isDragging ? '0 20px 40px rgba(16,185,129,0.5)' : ''
  };

  const isUploading = progressObj && progressObj.progress < 100 && !progressObj.error;
  const isError = progressObj && progressObj.error;

  return (
    <div ref={setNodeRef} style={style} className="w-32 h-32 relative rounded-2xl overflow-hidden group border border-white/10 hover:border-[#10b981]/50 transition-all z-50 shadow-lg bg-black/40 flex-shrink-0">
      <img src={img} className={`w-full h-full object-cover pointer-events-none transition-all ${isUploading ? 'opacity-40 blur-[2px]' : ''}`} alt="Miniatura" />

      {/* Nakładka z kropeczkami (Uchwyt Drag & Drop) */}
      <div {...attributes} {...listeners} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-20">
        <div className="bg-black/60 px-3 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-xl flex gap-1 items-center">
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
        </div>
      </div>

      <button onPointerDown={(e) => { e.stopPropagation(); onRemove(idx); }} className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all z-[60] shadow-lg backdrop-blur-sm">
        <Trash2 size={14}/>
      </button>

      {idx === 0 && !isUploading && !isError && <span className="absolute bottom-0 left-0 w-full bg-[#10b981] backdrop-blur-md text-black text-[9px] font-black uppercase tracking-widest text-center py-1 z-10 shadow-[0_-5px_15px_rgba(16,185,129,0.3)] pointer-events-none">Główne</span>}

      {/* Pasek postępu */}
      {isUploading && (
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/50 overflow-hidden z-30">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-200 ease-out" style={{ width: `${progressObj.progress}%` }} />
        </div>
      )}

      {/* Błąd */}
      {isError && (
         <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 backdrop-blur-sm z-30 pointer-events-none">
            <span className="text-[9px] font-black text-white uppercase bg-red-500 px-2 py-1 rounded-md">Błąd</span>
         </div>
      )}
    </div>
  );
};

export default function ClientForm({ initialUser }: { initialUser?: any }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [data, setData] = useState<any>({
    transactionType: 'SELL', rentAdminFee: '', deposit: '', rentMinPeriod: '', rentAvailableFrom: '', petsAllowed: false, rentType: '',
    propertyType: '', title: '', 
    condition: '', locationType: 'exact', address: '', city: 'Warszawa', lng: null, lat: null, district: '', apartmentNumber: '', 
    price: '', area: '', rooms: '', floor: '', buildYear: '', plotArea: '', heating: '', furnished: '', rent: '', 
    amenities: [], description: '', 
    advertiserType: 'private', agencyName: '',
    contactName: initialUser?.name || '', contactPhone: initialUser?.phone || '', email: initialUser?.email || '', password: '' 
  });
  
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [addressError, setAddressError] = useState('');
  
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [uploadStats, setUploadStats] = useState<{[key: string]: {progress: number, error: boolean, sizeMB: number}}>({});
  const [filesMap, setFilesMap] = useState<{[key: string]: File}>({}); 
  const [totalSizeMB, setTotalSizeMB] = useState(0);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [actionModal, setActionModal] = useState<"none" | "limit" | "success" | "error" | "otp" | "payment_success" | "oferta_plus">("none");
  const [serverErrorMessage, setServerErrorMessage] = useState('');
  
  const [uploadProgress, setUploadProgress] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle');
  const [phoneStatus, setPhoneStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(1);
  const [locationCatalog, setLocationCatalog] = useState<DistrictCatalogResponse>({ strictCities: [], strictCityDistricts: {} });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const orbitFrameRef = useRef<number | null>(null);
  const orbitTimeoutRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const updateData = (newData: any) => setData((prev: any) => ({ ...prev, ...newData }));
  const strictCities = locationCatalog.strictCities || [];
  const cityOptions = strictCities.includes(data.city) ? strictCities : [data.city, ...strictCities].filter(Boolean);
  const districtOptions = locationCatalog.strictCityDistricts[data.city] || [];
  const isStrictCity = strictCities.includes(data.city);
  const finalImages = imagesList.filter((img) => typeof img === 'string' && img.length > 0);
  const finalFloorPlan = floorPlan;

  const handleAddressSearch = async (value: string) => {
    updateData({ address: value });
    setAddressError('');

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!value || value.trim().length < 3 || !token) {
      setAddressSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&autocomplete=true&limit=6&language=pl&country=pl`,
      );
      const geo = await res.json();
      setAddressSuggestions(Array.isArray(geo?.features) ? geo.features : []);
    } catch {
      setAddressSuggestions([]);
    }
  };

  const resolveLocationFromCoordinates = async (lat: number, lng: number, fallbackAddress?: string) => {
    try {
      const response = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
      if (!response.ok) return;
      const reverse = await response.json();

      updateData({
        lat,
        lng,
        city: reverse.city || data.city,
        district: reverse.district || '',
        address: reverse.addressLabel || fallbackAddress || data.address,
        street: reverse.street || data.street || null,
      });
    } catch {
      // no-op, manual selection still available
    }
  };

  const selectAddress = (feature: any) => {
    const coords = feature?.center;
    const nextLng = Array.isArray(coords) ? Number(coords[0]) : data.lng;
    const nextLat = Array.isArray(coords) ? Number(coords[1]) : data.lat;

    updateData({
      address: feature?.place_name_pl || feature?.place_name || feature?.text || data.address,
      lng: nextLng,
      lat: nextLat,
    });
    setAddressSuggestions([]);

    if (nextLat && nextLng) {
      void resolveLocationFromCoordinates(nextLat, nextLng, feature?.place_name_pl || feature?.place_name || feature?.text);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentSize = files.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024);
    setTotalSizeMB((prev) => prev + currentSize);

    const nextUrls = files.map((file) => URL.createObjectURL(file));
    const nextMap: { [key: string]: File } = {};
    const nextStats: { [key: string]: { progress: number; error: boolean; sizeMB: number } } = {};

    nextUrls.forEach((url, index) => {
      nextMap[url] = files[index];
      nextStats[url] = { progress: 100, error: false, sizeMB: +(files[index].size / (1024 * 1024)).toFixed(2) };
    });

    setFilesMap((prev) => ({ ...prev, ...nextMap }));
    setUploadStats((prev) => ({ ...prev, ...nextStats }));
    setImagesList((prev) => [...prev, ...nextUrls]);
    e.target.value = '';
  };

  const handleRemoveImage = (idx: number) => {
    setImagesList((prev) => {
      const toRemove = prev[idx];
      if (toRemove?.startsWith('blob:')) URL.revokeObjectURL(toRemove);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
  };

  const handleFloorPlanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFloorPlan(url);
    setFloorPlanFile(file);
    e.target.value = '';
  };

  const execCommand = (command: string) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const hint = `${data.propertyType || 'Nieruchomość'} w ${data.district || 'Warszawie'} o metrażu ${data.area || '?'} m2.`;
      const generated = `Przedstawiamy wyjątkową ofertę: ${hint} Komfortowy układ pomieszczeń, funkcjonalna przestrzeń oraz doskonała lokalizacja czynią tę nieruchomość idealną zarówno do zamieszkania, jak i inwestycji.`;
      updateData({ description: generated });
      if (editorRef.current) editorRef.current.innerHTML = generated;
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = e.target.value.replace(/[^\d+ ]/g, '');
    updateData({ contactPhone: normalized });
    const digits = normalized.replace(/\D/g, '');
    setPhoneStatus(digits.length >= 9 ? 'available' : 'invalid');
  };

  const getAmenityPatch = (item: string, selected: boolean) => {
    const patch: Record<string, boolean> = {};
    if (item === 'Balkon') patch.hasBalcony = selected;
    if (item === 'Garaż/Miejsce park.') patch.hasParking = selected;
    if (item === 'Piwnica/Pom. gosp.') patch.hasStorage = selected;
    if (item === 'Ogródek') patch.hasGarden = selected;
    if (item === 'Winda') patch.hasElevator = selected;
    if (item === 'Klimatyzacja') patch.airConditioning = selected;
    return patch;
  };

  useEffect(() => {
    if (!data.email) {
      setEmailStatus('idle');
      return;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    setEmailStatus(ok ? 'available' : 'invalid');
  }, [data.email]);

  useEffect(() => {
    const loadDistrictCatalog = async () => {
      try {
        const response = await fetch('/api/location/districts', { cache: 'no-store' });
        if (!response.ok) return;
        const catalog = await response.json();
        setLocationCatalog(catalog);
        if (!data.city && Array.isArray(catalog?.strictCities) && catalog.strictCities.length > 0) {
          updateData({ city: catalog.strictCities[0] });
        }
      } catch {
        // fallback to manual text flow
      }
    };

    void loadDistrictCatalog();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstance.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      setAddressError('Brak klucza mapy (NEXT_PUBLIC_MAPBOX_TOKEN).');
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [21.0122, 52.2297],
      zoom: 12.5,
      pitch: 55,
      bearing: -20,
      antialias: true,
      attributionControl: false,
    });

    mapInstance.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('style.load', () => {
      map.setFog({
        range: [0.8, 8],
        color: '#020617',
        'high-color': '#0b1220',
        'space-color': '#000000',
        'star-intensity': 0.1,
      } as any);

      const layers = map.getStyle().layers || [];
      const labelLayerId = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

      if (!map.getLayer('estateos-3d-buildings')) {
        map.addLayer(
          {
            id: 'estateos-3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': '#1e293b',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 16, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 16, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.85,
            },
          } as any,
          labelLayerId,
        );
      }
    });

    map.on('click', (e) => {
      const nextLng = +e.lngLat.lng.toFixed(6);
      const nextLat = +e.lngLat.lat.toFixed(6);
      setData((prev: any) => ({ ...prev, lng: nextLng, lat: nextLat }));
      void resolveLocationFromCoordinates(nextLat, nextLng);
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      if (orbitTimeoutRef.current) window.clearTimeout(orbitTimeoutRef.current);
      orbitFrameRef.current = null;
      orbitTimeoutRef.current = null;
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  const startLuxuryOrbit = (target: [number, number]) => {
    const map = mapInstance.current;
    if (!map) return;
    if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
    if (orbitTimeoutRef.current) window.clearTimeout(orbitTimeoutRef.current);

    const start = performance.now();
    const durationMs = 6500;
    const initialBearing = map.getBearing();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const bearing = initialBearing + eased * 115;

      map.easeTo({
        center: target,
        bearing,
        pitch: 68,
        zoom: 16.2,
        duration: 120,
        easing: (x) => x,
      });

      if (t < 1) orbitFrameRef.current = requestAnimationFrame(tick);
    };

    orbitFrameRef.current = requestAnimationFrame(tick);
    orbitTimeoutRef.current = window.setTimeout(() => {
      map.easeTo({
        center: target,
        zoom: 15.4,
        pitch: 60,
        duration: 900,
      });
    }, durationMs + 80);
  };

  useEffect(() => {
    if (!mapInstance.current || !data.lat || !data.lng) return;
    const lngLat: [number, number] = [Number(data.lng), Number(data.lat)];

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: '#10b981' }).setLngLat(lngLat).addTo(mapInstance.current);
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    mapInstance.current.flyTo({
      center: lngLat,
      zoom: 16,
      pitch: 68,
      bearing: mapInstance.current.getBearing() + 20,
      speed: 0.6,
      curve: 1.5,
      essential: true,
    });
    startLuxuryOrbit(lngLat);
  }, [data.lat, data.lng]);

  useEffect(() => {
    if (currentStep !== 2 || !mapInstance.current) return;
    const id = window.setTimeout(() => {
      mapInstance.current?.resize();
      if (data.lat && data.lng) {
        mapInstance.current?.easeTo({
          center: [Number(data.lng), Number(data.lat)],
          zoom: 14.8,
          pitch: 62,
          duration: 700,
        });
      }
    }, 120);
    return () => window.clearTimeout(id);
  }, [currentStep, data.lat, data.lng]);

  const handleSubmit = async () => {
    if (isSubmitting || !canPublish) return;
    setIsSubmitting(true);
    setUploadProgress('Wysyłanie oferty...');
    try {
      const cleanPriceValue = String(data.price || '').replace(/\D/g, "");
      const finalDesc = editorRef.current?.innerHTML || data.description || '';
      const dbCondition = data.propertyType === 'PLOT' ? 'NOT_APPLICABLE' : (data.condition || 'READY');

      const payload = {
        ...data,
        userId: initialUser?.id,
        transactionType: data.transactionType,
        propertyType: data.propertyType,
        condition: dbCondition,
        description: finalDesc,
        title: data.title || `${data.propertyType} - ${data.district || 'Polska'}`,
        price: cleanPriceValue,
        area: String(data.area).replace(',', '.'),
        images: '[]',
        imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop",
        floorPlan: null,
        amenities: Array.isArray(data.amenities) ? data.amenities.join(", ") : data.amenities,
      };

      setUploadProgress('Tworzenie oferty...');
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => ({}));
      if (response.ok) {
        const createdOfferId = responseData?.offer?.id || responseData?.id;

        if (createdOfferId) {
          const uploadableImages = finalImages.filter((img) => filesMap[img]);
          for (let i = 0; i < uploadableImages.length; i++) {
            const blobKey = uploadableImages[i];
            const file = filesMap[blobKey];
            if (!file) continue;
            setUploadProgress(`Wysyłanie zdjęcia ${i + 1}/${uploadableImages.length}...`);
            const formData = new FormData();
            formData.append('offerId', String(createdOfferId));
            formData.append('file', file);
            const uploadRes = await fetch('/api/upload/mobile', { method: 'POST', body: formData });
            if (!uploadRes.ok) throw new Error(`Upload zdjęcia ${i + 1} nie powiódł się.`);
          }

          if (floorPlanFile) {
            setUploadProgress('Wysyłanie rzutu nieruchomości...');
            const fpFormData = new FormData();
            fpFormData.append('offerId', String(createdOfferId));
            fpFormData.append('file', floorPlanFile);
            fpFormData.append('isFloorPlan', 'true');
            const fpRes = await fetch('/api/upload/mobile', { method: 'POST', body: fpFormData });
            if (!fpRes.ok) throw new Error('Upload rzutu nieruchomości nie powiódł się.');
          }
        }
        setActionModal(responseData.requiresVerification ? 'otp' : 'success');
      } else {
        setServerErrorMessage(responseData.error || responseData.message || 'Odrzucono przez serwer');
        setActionModal(response.status === 403 && responseData.limitReached ? "limit" : "error");
      }
    } catch (_error) {
      setServerErrorMessage('Błąd połączenia z serwerem API.');
      setActionModal('error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const [isProcessingPlus, setIsProcessingPlus] = useState(false);
  const handlePlusPayment = async () => {
    setIsProcessingPlus(true);
    try {
      const cleanPrice = String(data.price || '').replace(/\D/g, "");
      const finalDesc = editorRef.current?.innerHTML || data.description;
      
      const dbCondition = data.propertyType === 'PLOT' ? 'NOT_APPLICABLE' : (data.condition || 'READY');

      const payload = { 
        ...data, 
        userId: initialUser?.id,
        transactionType: data.transactionType,
        propertyType: data.propertyType,
        condition: dbCondition,
        description: finalDesc,
        title: data.title || `${data.propertyType} - ${data.district || 'Polska'}`, 
        price: cleanPrice, 
        area: String(data.area).replace(',', '.'),
        images: finalImages.length > 0 ? JSON.stringify(finalImages) : null, 
        imageUrl: finalImages[0] || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop", 
        floorPlan: finalFloorPlan,
        amenities: Array.isArray(data.amenities) ? data.amenities.join(", ") : data.amenities 
      };

      // TWARDA BLOKADA BLOBÓW - Zabezpieczenie przed utratą zdjęć
      if (finalImages.some(img => img.startsWith('blob:'))) {
        setServerErrorMessage('Błąd krytyczny: Zdjęcia nie zostały poprawnie przesłane na serwer. Spróbuj dodać je ponownie lub odśwież stronę.');
        setActionModal("error");
        setIsSubmitting(false);
        return;
      }
      const response = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseData = await response.json().catch(() => ({}));
      if (response.ok || response.status === 201 || response.status === 200) {
        if (responseData.requiresVerification) {
           setActionModal("otp");
        } else {
           setActionModal("success");
        }
      } else {
        setServerErrorMessage(responseData.error || responseData.message || 'Odrzucono przez serwer');
        setActionModal(response.status === 403 && responseData.limitReached ? "limit" : "error");
      }
    } catch (error) { 
        setServerErrorMessage('Błąd połączenia z serwerem API.'); setActionModal("error"); 
    } finally { setIsSubmitting(false); setUploadProgress(''); }
  };

  // --- Żelazna Walidacja Kroków ---
  const isTypeSelected = !!data.propertyType;
  
  const hasBuildingNumber = /\d/.test((data.address || '').split(',')[0]);
  const districtRequirementMet = isStrictCity ? !!data.district : true;
  const isLocationDone = !!data.lat && !!data.lng && !!data.city && districtRequirementMet && !addressError && hasBuildingNumber && 
                         (data.propertyType !== 'FLAT' || (data.propertyType === 'FLAT' && !!data.apartmentNumber));
  
  const cleanPrice = String(data.price || '').replace(/\D/g, "");
  const cleanArea = String(data.area || '').replace(/[^0-9.]/g, "");
  const isFinanceDone = isLocationDone && cleanPrice.length > 0 && cleanArea.length > 0;
  
  const requiresPlot = ['HOUSE', 'PLOT'].includes(data.propertyType);
  const isParameterSetDone = data.propertyType === 'PLOT'
    ? !!data.area && !!data.plotArea
    : !!data.area && !!data.rooms && !!data.floor && !!data.buildYear;
  const isTechDone = isFinanceDone && isParameterSetDone;
  
  const descriptionText = String(data.description || '').replace(/<[^>]*>/g, '').trim();
  const isMediaDone = isTechDone && imagesList.length > 0 && String(data.title || '').trim().length >= 10 && descriptionText.length >= 10;
  
  const isContactDone = initialUser?.isLoggedIn ? true : (
    !!data.email && emailStatus === 'available' &&
    !!data.contactPhone && phoneStatus === 'available' &&
    !!data.contactName && !!data.password && data.password.length >= 6 &&
    (data.advertiserType === 'private' || (data.advertiserType === 'agency' && !!data.agencyName))
  );

  const canPublish = isTypeSelected && isLocationDone && isFinanceDone && isTechDone && isMediaDone && isContactDone;
  const totalSteps = initialUser?.isLoggedIn ? 5 : 6;
  const isStep1Done = isTypeSelected && (data.propertyType === 'PLOT' || !!data.condition);
  const isStep2Done = isLocationDone;
  const isStep3Done = isTechDone;
  const isStep4Done = isMediaDone;
  const isStep5Done = initialUser?.isLoggedIn ? true : isContactDone;

  const canAdvanceStep = (step: number) => {
    if (step === 1) return isStep1Done;
    if (step === 2) return isStep2Done;
    if (step === 3) return isStep3Done;
    if (step === 4) return isStep4Done;
    if (step === 5) return isStep5Done;
    return true;
  };

  const nextStep = () => {
    if (!canAdvanceStep(currentStep)) return;
    if (initialUser?.isLoggedIn) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
      return;
    }
    setCurrentStep((prev) => Math.min(6, prev + 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };
  const stepTransition = {
    initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#f5f5f7] pt-28 pb-32 px-4 md:px-6 lg:px-8 font-sans overflow-x-hidden relative selection:bg-[#10b981]/30">
      
      {/* Dynamiczne Tło */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#10b981]/5 to-transparent blur-[150px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[#f5f5f7] text-xs font-bold tracking-widest mb-6 backdrop-blur-md">
            <Sparkles size={14} className="text-[#10b981]" /> Formularz EstateOS Premium
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter text-white">
            Dodaj <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">Ofertę.</span>
          </h1>
        </div>

        <div className="sticky top-24 z-40 mb-8 bg-white/[0.03] border border-white/10 rounded-[1.75rem] px-5 py-4 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Krok {currentStep} z {totalSteps}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-300">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="flex gap-2 h-1.5 mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  const target = i + 1;
                  if (target <= currentStep || canAdvanceStep(currentStep)) setCurrentStep(target);
                }}
                className={`flex-1 rounded-full transition-all duration-300 ${i + 1 <= currentStep ? 'bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-white/35 tracking-[0.12em] uppercase font-bold">
            EstateOS Form Experience
          </p>
        </div>

        {/* NOWY PRZEŁĄCZNIK KUPNO / WYNAJEM */}
        <div className={`flex justify-center mb-12 ${currentStep === 1 ? '' : 'hidden'}`}>
          <div className="bg-[#111] border border-white/10 rounded-full p-1.5 flex shadow-inner relative w-full max-w-[400px]">
             <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-[#0a0a0a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${data.transactionType === 'RENT' ? 'translate-x-[calc(100%+12px)]' : 'translate-x-0'}`}></div>
             
             <button type="button" onClick={() => updateData({ transactionType: 'SELL' })} className={`relative z-10 flex-1 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors duration-500 text-center ${data.transactionType === 'SELL' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>
               Sprzedaż
             </button>
             
             <button type="button" onClick={() => updateData({ transactionType: 'RENT' })} className={`relative z-10 flex-1 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors duration-500 text-center ${data.transactionType === 'RENT' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>
               Wynajem
             </button>
          </div>
        </div>


        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`step-${currentStep}`} className="space-y-6" initial={stepTransition.initial} animate={stepTransition.animate} exit={stepTransition.exit} transition={stepTransition.transition}>
            
            {/* KROK 1: TOŻSAMOŚĆ I RODZAJ */}
            <section className={`${glassPanel} ${currentStep === 1 ? '' : 'hidden'} ring-1 ring-white/5`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isTypeSelected ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>1</div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Rodzaj Nieruchomości</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {PROPERTY_TYPES.map(cat => {
                  const isActive = data.propertyType === cat.id;
                  return (
                    <button key={cat.id} onClick={() => updateData({ propertyType: cat.id, condition: cat.id === 'PLOT' ? 'NOT_APPLICABLE' : data.condition })} 
                      className={`h-36 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all duration-400 relative overflow-hidden group ${isActive ? 'bg-[#10b981] border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.4)] scale-[1.02]' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
                      <cat.icon size={36} strokeWidth={1.5} className={`transition-colors duration-400 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white'}`} />
                      <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-400 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white'}`}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {data.propertyType && data.propertyType !== 'PLOT' && (
                <div className="relative">
                  <label className={labelPremium}>Stan wykończenia</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {CONDITION_TYPES.map((condition) => {
                      const isActive = data.condition === condition.id;
                      return (
                        <button
                          key={condition.id}
                          type="button"
                          onClick={() => updateData({ condition: condition.id })}
                          className={`py-4 rounded-2xl border font-black uppercase tracking-widest text-[10px] transition-all ${isActive ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                        >
                          {condition.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* KROK 2: LOKALIZACJA I MAPA */}
            <section className={`${glassPanel} ${currentStep === 2 ? '' : 'hidden'} ring-1 ring-white/5 ${isTypeSelected ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isLocationDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isLocationDone ? <Check size={24} /> : '2'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Lokalizacja i Mapa</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button onClick={() => updateData({ locationType: 'exact' })} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${data.locationType === 'exact' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}><MapPin size={16}/> Dokładna (Szpilka)</button>
                    <button onClick={() => updateData({ locationType: 'approximate' })} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${data.locationType === 'approximate' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}><Navigation size={16}/> Przybliżona (Dysk)</button>
                  </div>
                  
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs text-zinc-400 leading-relaxed">
                    <strong className="text-white">Widoczność publiczna:</strong> Przy <em>Dokładnej lokalizacji</em> wyświetlimy nazwę ulicy (i nr budynku dla mieszkań). Przy <em>Przybliżonej</em> pokazujemy jedynie orientacyjny obszar dzielnicy.
                  </div>

                  <div className="relative z-50">
                    <label className={labelPremium}>Wyszukaj Adres *</label>
                    <input type="text" placeholder="Np. Złota 44..." className={inputPremium} onChange={(e) => handleAddressSearch(e.target.value)} value={data.address || ''} />
                    {data.address && !hasBuildingNumber && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11px] font-bold text-red-400 flex items-center gap-1"><AlertCircle size={14} /> Wymagany numer budynku przed przecinkiem.</motion.div>
                    )}
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 overflow-hidden divide-y divide-white/5">
                        {addressSuggestions.map((f, i) => (
                          <div key={i} onClick={() => selectAddress(f)} className="p-4 hover:bg-[#10b981]/20 cursor-pointer text-zinc-300 hover:text-white font-medium transition-colors">
                            {f.place_name_pl || f.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelPremium}>Miasto *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer text-sm`} value={data.city || ''} onChange={(e) => updateData({ city: e.target.value, district: '' })}>
                        {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className={labelPremium}>{isStrictCity ? "Dzielnica *" : "Obszar / osiedle"}</label>
                      {isStrictCity ? (
                        <select className={`${inputPremium} appearance-none cursor-pointer text-sm`} value={data.district || ''} onChange={(e) => updateData({ district: e.target.value })}>
                          <option value="" disabled>Wybierz...</option>
                          {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className={inputPremium}
                          placeholder="Np. osiedle / sołectwo / część miasta"
                          value={data.district || ''}
                          onChange={(e) => updateData({ district: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <AnimatePresence>
                      {data.propertyType === 'FLAT' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                          <label className={labelPremium}>Nr Lokalu *</label>
                          <input type="text" placeholder="Np. 12" className={`${inputPremium} text-sm`} value={data.apartmentNumber || ''} onChange={(e) => updateData({ apartmentNumber: e.target.value })} />
                          <p className="text-[9px] text-zinc-500 mt-2 flex items-start gap-1"><EyeOff size={12} className="shrink-0 mt-0.5"/> Pole chronione – widoczne tylko po umówieniu prezentacji.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="w-full h-full min-h-[350px] rounded-[2rem] overflow-hidden bg-[#111] border border-white/10 relative shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
                  <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />
                </div>
              </div>
            </section>

            {/* KROK 3: PARAMETRY I FINANSE */}
            <section className={`${glassPanel} ${currentStep === 3 ? '' : 'hidden'} ring-1 ring-white/5 ${isLocationDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isTechDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isTechDone ? <Check size={24} /> : '3'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Parametry Finansowe</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className={labelPremium}>{data.transactionType === 'RENT' ? 'Czynsz najmu (miesięcznie) *' : 'Cena (PLN) *'}</label>
                  <input type="text" className={inputPremium} placeholder="850 000" value={data.price || ''} 
                    onChange={(e) => updateData({ price: e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ") })} />
                </div>
                <div>
                  <label className={labelPremium}>Metraż (m²) *</label>
                  <input type="text" className={inputPremium} placeholder="45.5" value={data.area || ''} 
                    onChange={(e) => updateData({ area: e.target.value.replace(/[^0-9.,]/g, "").replace(',', '.').slice(0, 7) })} />
                </div>

                {requiresPlot && (
                  <div>
                    <label className={labelPremium}>Powierzchnia działki (m²) *</label>
                    <input type="text" className={inputPremium} placeholder="450" value={data.plotArea || ''}
                      onChange={(e) => updateData({ plotArea: e.target.value.replace(/[^0-9.,]/g, "").replace(',', '.').slice(0, 8) })} />
                  </div>
                )}

                {data.propertyType !== 'PLOT' && (
                  <>
                    <div>
                      <label className={labelPremium}>Liczba pokoi *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.rooms || ''} onChange={(e) => updateData({ rooms: e.target.value })}>
                        <option value="">-</option>
                        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(room => <option key={room} value={room}>{room}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelPremium}>Piętro *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.floor || ''} onChange={(e) => updateData({ floor: e.target.value })}>
                        <option value="">-</option>
                        <option value="0">Parter</option>
                        {Array.from({ length: 30 }, (_, i) => String(i + 1)).map(floor => <option key={floor} value={floor}>{floor}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelPremium}>Rok budowy *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.buildYear || ''} onChange={(e) => updateData({ buildYear: e.target.value })}>
                        <option value="">-</option>
                        {Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i)).map(year => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </div>
                  </>
                )}
                
                {data.propertyType !== 'PLOT' && (
                  <>
                    <div className={requiresPlot ? 'lg:col-span-2' : ''}>
                      <label className={labelPremium}>Rodzaj Ogrzewania</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.heating || ''} onChange={(e) => updateData({ heating: e.target.value })}>
                        <option value="">Wybierz...</option>
                        {HEATING_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    {/* Luksusowe przyciski Umeblowania */}
                    <div>
                      <label className={labelPremium}>Umeblowane</label>
                      <div className="flex gap-4">
                        <button type="button" onClick={(e) => { e.preventDefault(); updateData({ isFurnished: true }); }} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === true ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5'}`}>Tak</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); updateData({ isFurnished: false }); }} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === false ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5'}`}>Nie</button>
                      </div>
                    </div>

                    {/* Pole Czynszu */}
                    <div>
                      <label className={labelPremium}>Czynsz administracyjny <span className="text-white/30 font-normal ml-1 text-[10px]">(Opcjonalnie)</span></label>
                      <div className="relative group">
                        <input type="text" placeholder="Np. 1500" className={`${inputPremium} pr-12`} value={data.rent || ''} onChange={(e) => updateData({ rent: e.target.value.replace(/[^0-9]/g, '') })} />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-black tracking-widest uppercase">PLN</div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* AI Monitor Przelicznik */}
                {(() => {
                  const p = parseInt(String(data.price || '').replace(/\D/g, ''));
                  const a = parseFloat(String(data.area || '').replace(',', '.'));
                  if (!p || !a || a === 0) return null;
                  const ppm = Math.round(p / a);
                  let config = { color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/30', label: 'Okazja Rynkowa', icon: <CheckCircle size={20} /> };
                  if (ppm > 18000) config = { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Standard Premium', icon: <Flame size={20} /> };
                  if (ppm > 25000) config = { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Segment Luksusowy', icon: <Crown size={20} /> };
                  return (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 lg:col-span-4 flex items-center justify-between p-6 rounded-2xl border ${config.bg} ${config.border} backdrop-blur-md`}>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-zinc-400 font-black uppercase tracking-widest mb-1">EstateOS AI: Wycena za m²</span>
                        <span className={`text-3xl font-black tracking-tight ${config.color}`}>{ppm.toLocaleString('pl-PL')} <span className="text-base font-bold opacity-80">PLN</span></span>
                      </div>
                      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${config.border} bg-black/40 shadow-inner`}>
                        <span className={`${config.color}`}>{config.icon}</span>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>
            </section>

            {/* KROK 4: GALERIA I PREZENTACJA */}
            <section className={`${glassPanel} ${currentStep === 4 ? '' : 'hidden'} ring-1 ring-white/5 ${isTechDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isMediaDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isMediaDone ? <Check size={24} /> : '4'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Galeria i Prezentacja</h2>
              </div>

              <div className="mb-10">
                <label className={labelPremium}>Tytuł Oferty *</label>
                <input
                  type="text"
                  placeholder="np. Luksusowy apartament z widokiem na skyline"
                  className={inputPremium}
                  maxLength={70}
                  onChange={(e) => updateData({ title: e.target.value })}
                  value={data.title || ''}
                />
                <p className={`text-[10px] mt-2 ml-1 font-bold ${String(data.title || '').length >= 10 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  Minimum 10 znaków, tak jak w aplikacji mobilnej.
                </p>
              </div>

              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelPremium}>Galeria Zdjęć (Min. 1) *</label>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${totalSizeMB > 25 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-zinc-400'}`}>Użyto: {totalSizeMB.toFixed(1)} / 30 MB</span>
                </div>
                <div className="flex flex-wrap gap-4 p-6 rounded-[2rem] bg-white/5 border border-white/10 shadow-inner min-h-[180px]">
                  <label className="w-32 h-32 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all bg-black/20 hover:border-[#10b981] hover:bg-[#10b981]/5 hover:text-[#10b981] text-zinc-500 group">
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Upload size={28} className="mb-3 transition-transform group-hover:-translate-y-1" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">Dodaj<br/>Zdjęcia</span>
                  </label>
                  
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { const { active, over } = e; if (active.id !== over?.id && over) { setImagesList((items) => arrayMove(items, items.indexOf(active.id as string), items.indexOf(over.id as string))); } }}>
                    <SortableContext items={imagesList} strategy={rectSortingStrategy}>
                      {imagesList.map((img, idx) => <SortableItem key={img} id={img} img={img} idx={idx} onRemove={handleRemoveImage} progressObj={uploadStats[img]} />)}
                    </SortableContext>
                  </DndContext>
                </div>
                <p className="text-[10px] text-zinc-500 mt-3 text-center">Możesz dodać dowolną liczbę zdjęć, przeciągnij je aby ułożyć kolejność. Łączna waga plików to max 30 MB.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <label className={labelPremium}>Ekskluzywny Opis</label>
                    <button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#10b981]/20 to-emerald-900/40 border border-[#10b981]/50 text-[#10b981] text-[11px] font-black uppercase tracking-widest hover:bg-[#10b981] hover:text-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      {isGeneratingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isGeneratingAI ? 'Generowanie...' : 'Asystent AI'}
                    </button>
                  </div>
                  
                  {/* Edytor Premium */}
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden focus-within:border-[#10b981] transition-colors shadow-inner">
                    <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-black/40">
                      <button onClick={() => execCommand('bold')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Bold size={16}/></button>
                      <button onClick={() => execCommand('italic')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Italic size={16}/></button>
                      <button onClick={() => execCommand('underline')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Underline size={16}/></button>
                      <div className="w-px h-4 bg-white/10 mx-2"></div>
                      <button onClick={() => execCommand('formatBlock')} onMouseDown={(e) => { e.preventDefault(); document.execCommand('formatBlock', false, 'H3'); }} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Heading size={16}/></button>
                    </div>
                    <div 
                      ref={editorRef}
                      contentEditable
                      className="w-full h-64 p-6 outline-none text-[#f5f5f7] leading-relaxed overflow-y-auto"
                      style={{ minHeight: '16rem' }}
                      onInput={(e) => updateData({ description: e.currentTarget.innerHTML })}
                      data-placeholder="Rozpocznij tworzenie luksusowego opisu..."
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <label className={labelPremium}>Plan Nieruchomości</label>
                    {!floorPlan ? (
                      <label className="w-full h-24 border-2 border-dashed border-white/20 rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all bg-white/5 hover:border-[#10b981] hover:text-[#10b981] text-zinc-500 group">
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFloorPlanUpload} />
                        <LayoutTemplate size={24} className="group-hover:scale-110 transition-transform"/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Wgraj Rzut</span>
                      </label>
                    ) : (
                      <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-[#10b981]/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] group">
                        <img src={floorPlan} className="w-full h-full object-cover opacity-80" alt="Rzut" />
                        <button onClick={() => { setFloorPlan(null); setFloorPlanFile(null); }} className="absolute top-2 right-2 p-2 bg-red-500/90 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>

                  
                  {/* --- NOWA SEKCJA: WARUNKI NAJMU --- */}
                  <AnimatePresence>
                    {data.transactionType === 'RENT' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        className="col-span-full overflow-hidden mb-4"
                      >
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] p-6 md:p-8 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                          <h3 className="text-emerald-400 font-black text-[11px] uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <Key size={14} /> Szczegóły Wynajmu
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className={labelPremium}>Typ umowy / Dostępność</label>
                              <input 
                                type="text" 
                                className={inputPremium} 
                                placeholder="np. Najem okazjonalny, od 01.07" 
                                value={data.rentType || ''} 
                                onChange={(e) => updateData({ rentType: e.target.value })} 
                              />
                            </div>
                            <div className="flex flex-col justify-end">
                              <label className={labelPremium}>Zwierzęta</label>
                              <button
                                type="button"
                                onClick={() => updateData({ petsAllowed: !data.petsAllowed })}
                                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all duration-300 ${data.petsAllowed ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                              >
                                <span className="font-bold uppercase tracking-widest text-[10px]">Akceptuję zwierzęta</span>
                                {data.petsAllowed ? <CheckCircle size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

              <div>
                    <label className={labelPremium}>Udogodnienia (Premium)</label>
                    <div className="flex flex-wrap gap-2">
                      {AMENITIES.map(item => {
                        const isSelected = data.amenities.includes(item);
                        return (
                          <button key={item} onClick={() => {
                            const nextSelected = !isSelected;
                            updateData({
                              amenities: isSelected ? data.amenities.filter((a: string) => a !== item) : [...data.amenities, item],
                              ...getAmenityPatch(item, nextSelected),
                            });
                          }} 
                                  className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${isSelected ? 'bg-[#10b981] text-black border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-[1.05]' : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20'}`}>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* KROK 5: DANE KONTAKTOWE */}
            {!initialUser?.isLoggedIn && (
              <section className={`${glassPanel} ${currentStep === 5 ? '' : 'hidden'} ring-1 ring-white/5 ${isMediaDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <div className="flex items-center gap-5 mb-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isContactDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                    {isContactDone ? <Check size={24} /> : '5'}
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest text-white">Profil Ogłoszeniodawcy</h2>
                </div>

                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full max-w-md mb-8">
                  <button onClick={() => updateData({ advertiserType: 'private' })} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${data.advertiserType === 'private' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}>Osoba Prywatna</button>
                  <button onClick={() => updateData({ advertiserType: 'agency' })} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${data.advertiserType === 'agency' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}>Agencja / Biuro</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {data.advertiserType === 'agency' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="md:col-span-2">
                      <label className={labelPremium}>Nazwa Agencji Nieruchomości *</label>
                      <input type="text" className={inputPremium} onChange={(e) => updateData({ agencyName: e.target.value })} value={data.agencyName || ''} placeholder="Wpisz nazwę biura..." />
                    </motion.div>
                  )}
                  
                  <div>
                    <label className={labelPremium}><User size={14}/> Imię i Nazwisko / Agent *</label>
                    <input type="text" className={inputPremium} onChange={(e) => updateData({ contactName: e.target.value })} value={data.contactName || ''} />
                  </div>
                  <div>
                    <label className={labelPremium}><Phone size={14}/> Telefon *</label>
                    <div className="relative">
                      <input type="tel" placeholder="+48 500 600 700" className={`${inputPremium} pr-12 ${phoneStatus === 'invalid' || phoneStatus === 'taken' ? 'border-red-500/50' : ''}`} onChange={handlePhoneChange} value={data.contactPhone || ''} />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {phoneStatus === 'checking' && <Loader2 size={18} className="animate-spin text-zinc-500" />}
                        {phoneStatus === 'available' && <CheckCircle size={18} className="text-[#10b981]" />}
                        {(phoneStatus === 'invalid' || phoneStatus === 'taken') && <X size={18} className="text-red-500" />}
                      </div>
                    </div>
                    {phoneStatus === 'taken' && <p className="text-[10px] text-red-400 mt-2 font-bold">Ten numer jest przypisany do innego konta.</p>}
                  </div>
                  <div>
                    <label className={labelPremium}><Mail size={14}/> E-mail *</label>
                    <div className="relative">
                      <input type="email" placeholder="jan@kowalski.pl" className={`${inputPremium} pr-12 ${emailStatus === 'invalid' || emailStatus === 'taken' ? 'border-red-500/50' : ''}`} onChange={(e) => updateData({ email: e.target.value })} value={data.email || ''} />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {emailStatus === 'checking' && <Loader2 size={18} className="animate-spin text-zinc-500" />}
                        {emailStatus === 'available' && <CheckCircle size={18} className="text-[#10b981]" />}
                        {(emailStatus === 'invalid' || emailStatus === 'taken') && <X size={18} className="text-red-500" />}
                      </div>
                    </div>
                    {emailStatus === 'taken' && <p className="text-[10px] text-red-400 mt-2 font-bold">Adres jest już zajęty. Zaloguj się.</p>}
                  </div>
                  <div>
                    <label className={labelPremium}><Lock size={14}/> Hasło (Min. 6 znaków) *</label>
                    <input type="password" placeholder="••••••••" className={inputPremium} onChange={(e) => updateData({ password: e.target.value })} value={data.password || ''} />
                  </div>
                </div>
              </section>
            )}

            {/* FINAŁOWY PRZYCISK APPLE LUXURY */}
            <div className={`pt-8 pb-24 relative z-50 ${currentStep === totalSteps ? '' : 'hidden'}`}>
              <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !canPublish} 
                className={`w-full py-6 md:py-8 rounded-[2rem] flex items-center justify-center gap-4 transition-all duration-500 overflow-hidden relative group font-sans ${
                  (!canPublish || isSubmitting)
                    ? 'bg-white/5 border border-white/10 text-zinc-500 cursor-not-allowed backdrop-blur-md'
                    : 'bg-white/10 border border-white/20 text-[#f5f5f7] cursor-pointer backdrop-blur-xl hover:bg-[#10b981] hover:border-[#10b981] hover:text-black shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-95'
                }`}
              >
                <span className="relative z-10 flex items-center gap-3 text-xl md:text-2xl font-black uppercase tracking-[0.2em]">
                  {isSubmitting ? <Loader2 className="animate-spin" size={28} /> : (!canPublish ? <Lock size={24} /> : <Crown size={32} className="group-hover:animate-bounce" />)}
                  {isSubmitting ? (uploadProgress || 'Przetwarzanie...') : (!canPublish ? 'Uzupełnij brakujące dane' : 'ZAKOŃCZ I OPUBLIKUJ')}
                </span>
              </button>
            </div>

            <div className={`pb-12 ${currentStep === totalSteps ? 'hidden' : ''}`}>
              <div className="flex gap-3 bg-white/[0.03] border border-white/10 rounded-[1.5rem] p-3 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.22em] transition-all ${currentStep === 1 ? 'border-white/10 text-white/25 cursor-not-allowed' : 'border-white/20 text-white/70 hover:bg-white/10'}`}
                >
                  Wstecz
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canAdvanceStep(currentStep)}
                  className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.22em] transition-all ${
                    canAdvanceStep(currentStep)
                      ? 'border-emerald-300/70 text-black bg-gradient-to-r from-emerald-300 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:-translate-y-[1px]'
                      : 'border-white/20 text-white/55 bg-white/5 cursor-not-allowed'
                  }`}
                >
                  Dalej
                </button>
              </div>
              {!canAdvanceStep(currentStep) && (
                <p className="mt-3 text-[10px] text-red-400/80 font-bold uppercase tracking-[0.16em] text-center">
                  Uzupełnij wymagane pola tego kroku, aby przejść dalej.
                </p>
              )}
            </div>

          </motion.div>
        </AnimatePresence>
      </div>

      
      {/* 1. STANDARDOWE OKNA (BŁĄD, LIMIT, SUKCES ZWYKŁY) */}
      <AnimatePresence>
        {actionModal !== "none" && actionModal !== "payment_success" && actionModal !== "oferta_plus" && (
          <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl relative text-center">
              <button onClick={() => setActionModal("none")} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
              
              {actionModal === "success" && (
                <>
                  <div className="w-24 h-24 bg-[#10b981]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#10b981]/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]"><CheckCircle className="text-[#10b981]" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-4">Gotowe!</h2>
                  <p className="text-zinc-400 mb-8 leading-relaxed">Ekskluzywna oferta została dodana do bazy i oczekuje na weryfikację.</p>
                  <button onClick={() => { window.location.href = '/moje-konto/crm'; }} className="w-full py-4 bg-white/10 border border-white/20 text-white hover:bg-[#10b981] hover:text-black font-black uppercase tracking-widest rounded-2xl transition-all duration-300">Panel Zarządzania</button>
                </>
              )}

              {actionModal === "error" && (
                <>
                  <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30"><AlertCircle className="text-red-500" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-4">Odrzucono</h2>
                  <p className="text-zinc-400 mb-8 leading-relaxed">{serverErrorMessage || "Sprawdź poprawność wprowadzonych danych."}</p>
                  <button onClick={() => setActionModal("none")} className="w-full py-4 bg-white/10 border border-white/20 text-white hover:bg-red-500 font-black uppercase tracking-widest rounded-2xl transition-all duration-300">Popraw dane</button>
                </>
              )}

              {actionModal === "limit" && (
                <>
                  <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)]"><Sparkles className="text-blue-400" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Osiągnięto Limit</h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 animate-pulse">⚡ Oferta Limitowana</div>
                  <p className="text-zinc-400 mb-8 leading-relaxed font-medium">Odblokuj to ogłoszenie w specjalnej cenie: <br/><span className="text-zinc-600 line-through text-lg mr-2 decoration-red-500/40">49,99 zł</span><span className="text-white font-black text-3xl">29,99 zł</span></p>
                  <button onClick={handlePlusPayment} disabled={isProcessingPlus} className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all duration-300 hover:bg-blue-500 hover:brightness-125 shadow-xl flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessingPlus ? <span>ŁADOWANIE KASY...</span> : <><span>ODBLOKUJ I OPUBLIKUJ</span><span className="text-[9px] opacity-70 mt-1 font-bold">AUTOPUBLIKACJA PO PŁATNOŚCI</span></>}
                  </button>
                  <button onClick={() => setActionModal("none")} className="mt-6 text-[10px] text-zinc-500 uppercase tracking-widest font-bold hover:text-white transition-colors">Wróć do edycji</button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. RYTUAŁ PRO (ROLLS ROYCE) */}
      {actionModal === "payment_success" && (
        <div className="fixed inset-0 z-[999999] flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center bg-black font-sans m-0 p-0" style={{ margin: '-40px' }}>
          
          {/* FAZA 1: Kosmiczne Zaćmienie (Apple Keynote Style) */}
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 4.2 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              {/* Obracająca się korona zaćmienia (Tytanowy blask) */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.2, 0.05], opacity: [0, 1, 1], rotate: 180 }}
                transition={{ duration: 4, times: [0, 0.7, 1], ease: [0.25, 1, 0.5, 1] }}
                className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border-[1px] border-white/20 shadow-[0_0_80px_rgba(255,255,255,0.15)] flex items-center justify-center"
              >
                {/* Oślepiająca flara na krawędzi */}
                <motion.div className="absolute top-0 w-24 h-1 md:w-32 md:h-2 bg-white rounded-full blur-[4px] shadow-[0_0_30px_rgba(255,255,255,1)]" />
              </motion.div>

              {/* Osobliwość - zapada się i eksploduje czystym światłem */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 0.2, 0.5, 50], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 4.5, times: [0, 0.6, 0.9, 1], ease: "easeInOut" }}
                className="absolute w-6 h-6 md:w-10 md:h-10 bg-white rounded-full blur-[2px] shadow-[0_0_100px_rgba(255,255,255,1)]"
              />
            </motion.div>
          </AnimatePresence>

          {/* FAZA 2: Bezszelestna Szklana Fala Uderzeniowa (Glassmorphism Wave) */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 3] }}
              transition={{ duration: 2.5, delay: 3.8, ease: "easeOut" }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[150vw] h-[150vw] rounded-full border-[15vw] border-white/5 backdrop-blur-2xl" />
            </motion.div>
          </AnimatePresence>

          {/* FAZA 3: Monolit PRO (Apple Typography) */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 4.5 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center font-sans"
            >
              {/* Bardzo subtelne tło studyjne (ciemny grafit, jak tył iPhone Pro) */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,20,22,1)_0%,rgba(0,0,0,1)_80%)]" />

              <motion.div
                initial={{ scale: 0.9, y: 30, opacity: 0, filter: "blur(15px)" }}
                animate={{ scale: 1, y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 2.5, delay: 4.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex flex-col items-center text-center px-6"
              >
                {/* Tytanowy napis PRO. (Gruby, ciasny tracking) */}
                <div className="relative mb-2 overflow-visible">
                  <h1 className="text-[120px] md:text-[200px] font-semibold tracking-[-0.05em] text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#e2e2e2] to-[#666666] drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] leading-none px-4" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    PRO.
                  </h1>
                  
                  {/* Efekt skanowania światłem (Light Sweep) po literach */}
                  <motion.div
                    initial={{ x: '-150%', opacity: 0 }}
                    animate={{ x: '150%', opacity: [0, 0.5, 0] }}
                    transition={{ duration: 3.5, delay: 6.8, ease: "easeInOut" }}
                    className="absolute inset-0 top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 blur-[8px] mix-blend-overlay pointer-events-none"
                  />
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.5, delay: 5.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xl md:text-3xl text-[#a1a1a6] font-normal tracking-wide max-w-2xl mt-4"
                >
                  Witamy w absolutnej elicie <span className="text-white font-medium">EstateOS</span>.
                </motion.p>

                {/* Luksusowy przycisk w stylu Apple (Frost Glass) */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1.5, delay: 6.8, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => { window.location.href = '/moje-konto/crm'; }}
                  className="mt-16 px-12 py-5 btn-apple-glass text-sm md:text-base font-bold tracking-[0.2em] uppercase rounded-full group"
                >
                  <span className="relative z-10 transition-transform duration-500 group-hover:scale-105 inline-block">Rozpocznij</span>
                </motion.button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {actionModal === "oferta_plus" && (
        <div className="fixed inset-0 z-[999999] flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center bg-[#030712] overflow-hidden font-sans m-0 p-0" style={{ margin: '-40px' }}>
          <AnimatePresence mode="wait">
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, delay: 3.5 }} className="absolute inset-0 flex items-center justify-center z-10">
              <motion.div animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 3, ease: "easeInOut" }} className="absolute inset-0 bg-blue-600/30 blur-[150px] rounded-full" />
              
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                {[...Array(24)].map((_, i) => {
                  const angle = (i / 24) * Math.PI * 2;
                  const distance = Math.random() * 350 + 150;
                  return (
                    <motion.div key={'card'+i} initial={{ scale: 0, x: 0, y: 0, opacity: 0, rotate: 0 }} animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: [0, 1, 1.2, 0.8], opacity: [0, 1, 0.8, 0], rotate: Math.random() * 180 - 90 }} transition={{ duration: 2.2, ease: "easeOut", delay: 1 + (i * 0.05) }} className="absolute w-32 h-44 bg-[#0f172a] border border-blue-500/30 rounded-xl flex flex-col p-2">
                      <div className="w-full h-1/2 bg-[#1e293b] rounded-md mb-2 flex items-center justify-center"><Home className="text-blue-500/30" size={24} /></div>
                      <div className="w-3/4 h-2 bg-[#334155] rounded-full mb-1"></div>
                      <div className="w-1/2 h-2 bg-[#334155] rounded-full"></div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div initial={{ scale: 0, y: 50 }} animate={{ scale: [0, 1, 1.05, 1, 0], opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 3.5, times: [0, 0.15, 0.3, 0.8, 1], ease: "easeInOut" }} className="relative w-56 h-80 bg-gradient-to-br from-[#0f172a] to-black border border-blue-400/50 rounded-2xl shadow-[0_0_80px_rgba(59,130,246,0.6)] flex flex-col p-4 z-20">
                <div className="w-full h-1/2 bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                   <Home className="text-blue-400 relative z-10" size={50} />
                </div>
                <div className="w-full h-3 bg-[#334155] rounded-full mb-3"></div>
                <div className="w-4/5 h-3 bg-[#334155] rounded-full mb-3"></div>
                <div className="w-full h-10 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center mt-auto">
                   <span className="text-blue-400 font-bold text-xs">PLUS+ LISTING</span>
                </div>
              </motion.div>

              {/* LATAJĄCE PLUSIKI JAK KONFETTI */}
              <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                {[...Array(120)].map((_, i) => {
                  const angle = Math.random() * Math.PI * 2;
                  const distance = Math.random() * 800 + 100;
                  return (
                    <motion.div
                      key={'plus'+i}
                      className="absolute font-black drop-shadow-[0_0_15px_rgba(96,165,250,0.9)]"
                      style={{ color: Math.random() > 0.5 ? '#60a5fa' : '#38bdf8', fontSize: Math.random() * 30 + 20 + 'px' }}
                      initial={{ x: '50vw', y: '50vh', scale: 0, opacity: 1, rotate: 0 }}
                      animate={{ x: `calc(50vw + ${Math.cos(angle) * distance}px)`, y: `calc(50vh + ${Math.sin(angle) * distance}px)`, scale: [0, Math.random() * 1.5 + 0.5, 0], opacity: [1, 1, 0], rotate: Math.random() * 720 - 360 }}
                      transition={{ duration: 2.5 + Math.random(), ease: "easeOut", delay: 1.8 }}
                    >
                      +
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.2, times: [0, 0.1, 0.8, 1], delay: 3.2, ease: "easeInOut" }} className="absolute inset-0 z-50 bg-gradient-to-br from-white via-blue-100 to-white flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-white blur-[100px]" />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 3.8 }} className="absolute inset-0 z-40 bg-[#020617] flex flex-col items-center justify-center font-sans">
              <motion.div initial={{ scale: 0.5, y: 100, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ duration: 2.5, delay: 4.0, type: "spring", bounce: 0.3 }} className="relative z-10 flex flex-col items-center text-center px-6 overflow-visible">
                <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 5.0, type: "spring" }} className="mb-8 px-6 py-2 rounded-full border border-blue-400/50 bg-blue-900/30 flex items-center gap-3">
                   <Sparkles className="text-blue-300" size={20} />
                   <span className="text-blue-200 font-bold tracking-[0.3em] uppercase text-xs">Zasięg Zwielokrotniony</span>
                </motion.div>
                <div className="relative mb-6 overflow-visible">
                  <h1 className="text-[60px] md:text-[110px] font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-blue-100 via-white to-blue-500 drop-shadow-[0_0_80px_rgba(59,130,246,0.8)] p-4" style={{ lineHeight: 1 }}>
                    OFERTA <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300">PLUS+</span>
                  </h1>
                </div>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5.5, duration: 1 }} className="text-2xl md:text-3xl text-zinc-300 font-medium max-w-3xl tracking-wide">
                  Aktywowana. Twoje ogłoszenie trafia właśnie do <span className="text-white font-bold">tysięcy inwestorów</span>.
                </motion.p>
                
                {/* NAPRAWIONY TAG MOTION.BUTTON ZAMIAST BUTTON */}
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 7.0, duration: 1 }} onClick={() => { window.location.href = '/moje-konto/crm'; }} className="mt-16 px-12 py-6 bg-blue-900/20 border-2 border-blue-500 text-white font-black uppercase tracking-[0.3em] rounded-full hover:bg-blue-600 transition-all duration-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] text-xl relative overflow-hidden group">
                  <span className="relative z-10 drop-shadow-md">Zobacz Statystyki</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                </motion.button>

              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}