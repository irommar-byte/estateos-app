"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Flame, Briefcase, CheckCircle, Star, X, Info, ChevronRight, ShieldAlert , Diamond } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    window.addEventListener('refreshNotifications', fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshNotifications', fetchNotifications);
    };
  }, []);

  // Zamknięcie po kliknięciu poza panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await fetch('/api/notifications', { method: 'PUT', body: JSON.stringify({ id: notif.id }) });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    }
    setIsOpen(false);
    
    // Inteligentny system routingu - sam wyciąga ID z treści, jeśli brakuje oficjalnego linku
    let finalLink = notif.link;
    if (notif.link?.includes('/dealroom/') || notif.link?.includes('appId=')) {
        finalLink = notif.link;
    } else if (notif.title.includes('Nowa Oferta Zakupu') || notif.title.includes('💎')) {
       // Sprytne przekierowanie dla starych i nowych ofert
       finalLink = notif.link || '/moje-konto/crm';
    }
    
    if (finalLink) router.push(finalLink);
  };

    const handleMarkAllAsRead = async () => {
    // Szybki update w UI dla błyskawicznego odczucia luksusu
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    
    // Wysłanie zapytania w tle do API
    try {
      await fetch('/api/notifications', { method: 'PATCH' });
    } catch(e) {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIconAndColor = (title: string, type: string) => {
    if (title.includes('Deal Room') || title.includes('Wiadomość') || type === 'DEAL_UPDATE') return { icon: <Briefcase size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (title.includes('Oferta Zakupu') || title.includes('💎')) return { icon: <Diamond size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    if (title.includes('Gorąca') || title.includes('VIP')) return { icon: <Flame size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    if (title.includes('✅') || title.includes('Gratulacje')) return { icon: <CheckCircle size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (title.includes('❌') || title.includes('Odrzucona')) return { icon: <ShieldAlert size={16} />, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (title.includes('Concierge')) return { icon: <Star size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    return { icon: <Info size={16} />, color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' };
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* IKONA DZWONKA */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 text-white/70 hover:text-white transition-colors flex items-center justify-center"
      >
        <Bell size={22} className={unreadCount > 0 ? 'animate-[wiggle_3s_ease-in-out_infinite]' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-black rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
        )}
      </button>

      {/* ROZWIJANY PANEL POWIADOMIEŃ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-12 right-[-60px] md:right-0 w-[340px] md:w-[400px] bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden z-[9999]"
          >
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#050505]">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                Powiadomienia {unreadCount > 0 && <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full text-[9px]">{unreadCount} Nowe</span>}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-xs font-medium">Brak nowych wiadomości.</div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => {
                    const style = getIconAndColor(notif.title, notif.type);
                    return (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors relative group ${!notif.isRead ? 'bg-[#111]' : ''}`}
                      >
                        {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>}
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.color} border ${style.border} ${notif.type === 'DEAL_UPDATE' ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                            {style.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-sm font-bold mb-1 flex items-center gap-2 ${!notif.isRead ? 'text-white' : 'text-white/70'}`}>
                            {notif.title}
                            {(notif.message?.match(/ID:\s*(\d+)/i) || notif.link?.match(/appId=(\d+)/)) && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest rounded border border-emerald-500/30 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.1)]">ID: {(notif.message?.match(/ID:\s*(\d+)/i) || notif.link?.match(/appId=(\d+)/))[1]}</span>
                            )}
                          </h4>
                            <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{notif.message}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-3 block">
                              {new Date(notif.createdAt).toLocaleDateString('pl-PL')} • {new Date(notif.createdAt).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          {(notif.link || notif.title.includes('Nowa Oferta Zakupu')) && (
                            <div className="flex items-center shrink-0 text-white/10 group-hover:text-white/50 group-hover:translate-x-1 transition-all">
                              <ChevronRight size={16} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-3 bg-[#050505] border-t border-white/5 text-center">
               <button onClick={handleMarkAllAsRead} className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">Oznacz wszystkie jako przeczytane</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
