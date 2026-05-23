"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Star, MapPin, Award, Phone, Mail, CheckCircle, Crown, Loader2, ShieldAlert } from "lucide-react";

export default function ExpertProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/ekspert/${resolvedParams.id}`).then(r => r.json()).then(d => setData(d));
  }, [resolvedParams.id]);

  if (!data) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;
  if (data.error) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-6">
       <ShieldAlert size={60} className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
       <h1 className="text-3xl font-black">Ekspert nie odnaleziony</h1>
       <Link href="/eksperci" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest transition-colors">Wróć do katalogu</Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-32 pb-40 relative selection:bg-orange-500 selection:text-black">
      <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-orange-500/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <Link href="/eksperci" className="text-white/40 hover:text-white mb-8 inline-block text-[10px] uppercase tracking-widest font-bold transition-colors">← Wróć do katalogu</Link>
        
        {/* HEADER PROFILU */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl mb-12 flex flex-col md:flex-row items-center md:items-start gap-10 relative overflow-hidden">
           <div className="absolute -left-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
           
           <div className="w-32 h-32 md:w-40 md:h-40 bg-[#111] border border-white/10 rounded-[2rem] flex items-center justify-center text-5xl font-black text-white shadow-inner shrink-0 relative">
             {data.user?.name ? data.user.name[0] : '?'}
             <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(249,115,22,0.5)]"><Award size={24}/></div>
           </div>
           
           <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                 <ShieldCheck size={18} className="text-emerald-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Zweryfikowany Partner PRO</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">{data.user?.name}</h1>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
                 <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-full">
                    <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-black text-yellow-500">{data.avgRating} / 5.0</span>
                    <span className="text-[10px] text-yellow-500/50 uppercase tracking-widest">({data.reviews?.length || 0} opinii)</span>
                 </div>
                 <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-bold text-white/80">
                    <CheckCircle size={16} className="text-white/40"/> Licencja KNF
                 </div>
              </div>

              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                 <a href={`tel:${data.user?.phone}`} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"><Phone size={14}/> Zadzwoń</a>
                 <a href={`mailto:${data.user?.email}`} className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all"><Mail size={14}/> Napisz</a>
              </div>
           </div>
        </div>

        {/* EKSKLUZYWNE OFERTY AGENTA */}
        <h2 className="text-2xl font-black tracking-tight mb-6">Portfolio Eksperta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {data.offers?.length === 0 ? <p className="text-white/40">Agent nie ma obecnie aktywnych ofert.</p> : data.offers?.map((o: any) => (
             <Link key={o.id} href={`/oferta/${o.id}`} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden group hover:border-orange-500/50 transition-all shadow-xl">
                <div className="h-48 overflow-hidden relative">
                   <img src={o.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                   <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5"><Crown size={10}/> Premium</div>
                </div>
                <div className="p-6">
                   <h3 className="font-bold text-lg mb-1 truncate group-hover:text-orange-400 transition-colors">{o.title}</h3>
                   <p className="text-xs text-white/40 flex items-center gap-1 mb-4"><MapPin size={12}/> {o.district}</p>
                   <p className="text-xl font-black text-white">{Number(o.price.replace(/\D/g, '')).toLocaleString('pl-PL')} PLN</p>
                </div>
             </Link>
          ))}
        </div>

        {/* OPINIE */}
        <h2 className="text-2xl font-black tracking-tight mb-6">Opinie Klientów</h2>
        <div className="space-y-4">
           {data.reviews?.length === 0 ? <p className="text-white/40">Brak opinii. Bądź pierwszy!</p> : data.reviews?.map((r: any) => (
             <div key={r.id} className="bg-[#111] border border-white/5 p-6 rounded-[2rem] flex flex-col gap-3">
                <div className="flex items-center gap-1">
                   {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < r.rating ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />)}
                </div>
                <p className="text-white/80 text-sm leading-relaxed">{r.comment || "Użytkownik ocenił współpracę bez komentarza."}</p>
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{new Date(r.createdAt).toLocaleDateString('pl-PL')}</span>
             </div>
           ))}
        </div>
      </div>
    </main>
  );
}
