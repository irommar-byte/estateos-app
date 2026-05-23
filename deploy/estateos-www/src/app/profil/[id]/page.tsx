"use client";
import { useEffect, useState, use } from "react";
import { motion } from "framer-motion";
import { Star, Calendar, Shield, MessageSquare, Loader2, ChevronLeft, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function UserProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/profil/${resolvedParams.id}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!data || data.error) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center"><h1 className="text-2xl font-black">Profil niedostępny</h1></div>;

  const { user, reviews, stats } = data;
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1) : "Brak";

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 pt-32 pb-40 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="#" onClick={(e) => { e.preventDefault(); window.close(); }} className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-8">
          <ChevronLeft size={14}/> Zamknij i wróć
        </Link>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 md:p-14 flex flex-col md:flex-row items-center gap-10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] mb-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          
          <div className="w-32 h-32 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-5xl font-black text-white/30 shadow-inner shrink-0 relative">
            {user.name?.[0] || 'U'}
            {user.buyerType === 'agency' && <div className="absolute -bottom-3 bg-orange-500 text-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest font-black shadow-lg">Agencja</div>}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">{user.name || 'Zarejestrowany Klient'}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-bold text-white/50 uppercase tracking-widest">
              <span className="flex items-center gap-2"><Calendar size={14}/> Dołączył: {new Date(user.createdAt).toLocaleDateString('pl-PL')}</span>
              <span className="flex items-center gap-2 text-emerald-500"><Shield size={14}/> Zweryfikowany ({stats.reliability}%)</span>
            </div>
          </div>

          <div className="text-center md:text-right shrink-0 bg-[#111] border border-white/5 p-6 rounded-[2rem] hover:bg-[#151515] transition-colors">
            <div className="flex items-center justify-center md:justify-end gap-2 text-5xl font-black text-yellow-500 mb-2">
              <Star size={36} className="fill-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]"/> {avgRating}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Na podstawie {reviews.length} opinii</p>
          </div>
        </div>

        {/* NOWA SEKCJA STATYSTYK I NIEZAWODNOŚCI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
           <div className="bg-[#111] border border-white/5 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="text-emerald-500 mb-4" size={32} />
              <span className="text-3xl font-black text-white mb-1">{stats.completed}</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Odbyte Spotkania</span>
           </div>
           <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center">
              <AlertCircle className="text-white/30 mb-4" size={32} />
              <span className="text-3xl font-black text-white mb-1">{stats.canceled}</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Usprawiedliwione<br/>(odwołane przed czasem)</span>
           </div>
           <div className="bg-red-500/5 border border-red-500/10 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-80">
              <XCircle className="text-red-500 mb-4" size={32} />
              <span className="text-3xl font-black text-red-500 mb-1">{stats.declined}</span>
              <span className="text-[9px] uppercase tracking-widest text-red-500/50 font-bold">Odrzucone wizyty</span>
           </div>
        </div>

        <div>
          <h3 className="text-xl font-black uppercase tracking-widest mb-8 flex items-center gap-3"><MessageSquare className="text-emerald-500"/> Historia Współpracy</h3>
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-white/5 rounded-[2.5rem] text-center text-white/30 font-medium">
                Ten użytkownik nie posiada jeszcze żadnych ocen.
              </div>
            ) : (
              reviews.map((rev: any) => (
                <div key={rev.id} className="bg-[#111] border border-white/5 rounded-[2rem] p-8 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} className={i < rev.rating ? "text-yellow-500 fill-yellow-500" : "text-white/10 fill-white/10"} />
                    ))}
                  </div>
                  <p className="text-white/70 italic leading-relaxed text-sm">"{rev.comment || 'Użytkownik wystawił ocenę bez komentarza.'}"</p>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mt-6 font-bold">{new Date(rev.createdAt).toLocaleDateString('pl-PL')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
