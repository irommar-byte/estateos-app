"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ShieldCheck, Lock, Check, CheckCheck, Loader2, Building2, Paperclip, X } from 'lucide-react';
import EliteStatusBadges from '@/components/ui/EliteStatusBadges';

const EVENT_PREFIX = '[[DEAL_EVENT]]';

const FINALIZED_STATUSES = new Set(['FINALIZED', 'CLOSED', 'COMPLETED', 'DONE', 'SOLD']);

function normalizeEventAction(action?: string): string {
  const raw = String(action || '').toUpperCase();
  if (raw === 'ACCEPT') return 'ACCEPTED';
  if (raw === 'REJECT') return 'REJECTED';
  if (raw === 'DECLINE') return 'DECLINED';
  if (raw === 'PROPOSE') return 'PROPOSED';
  if (raw === 'COUNTER') return 'COUNTERED';
  return raw;
}

function normalizeEventStatus(status?: string): string {
  const raw = String(status || '').toUpperCase();
  if (raw === 'ACCEPT') return 'ACCEPTED';
  if (raw === 'REJECT') return 'REJECTED';
  if (raw === 'DECLINE') return 'DECLINED';
  return raw;
}

function parseDealEvent(content?: string) {
  if (!content || !content.startsWith(EVENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(EVENT_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      action: normalizeEventAction(parsed.action),
      status: normalizeEventStatus(parsed.status),
      note: parsed.note ?? parsed.message ?? null,
    };
  } catch {
    return null;
  }
}

export default function DealRoom({ dealId, currentUserId }: { dealId: number, currentUserId: number }) {
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bidActionModal, setBidActionModal] = useState<{ bidId: number; action: 'ACCEPT' | 'REJECT' | 'COUNTER' } | null>(null);
  const [appointmentActionModal, setAppointmentActionModal] = useState<{ appointmentId: number; action: 'ACCEPT' | 'DECLINE' | 'RESCHEDULE' } | null>(null);
  const [counterBidAmount, setCounterBidAmount] = useState('');
  const [counterAppointmentNote, setCounterAppointmentNote] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserScrolling = useRef(false);
  const sseRef = useRef<EventSource | null>(null);
  const typingTimeout = useRef<any>(null);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )deal_token=([^;]+)'));
    if (match) return match[2];
    return localStorage.getItem('token');
  };

  const fetchDeal = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}?_t=${Date.now()}&${Math.random()}`, { cache: 'no-store', headers: { 'Pragma': 'no-cache' } });
      const data = await res.json();
      if (data.success) setDeal(data.deal);
    } catch (e) { } finally { setLoading(false); }
  };

  const refetchDealAndMessages = async () => {
    await Promise.allSettled([
      fetchDeal(),
      fetch(`/api/deals/${dealId}/messages?_t=${Date.now()}&${Math.random()}`, { cache: 'no-store' }),
    ]);
  };

  const markAsRead = async () => {
    const token = getToken();
    try {
      await fetch(`/api/deals/${dealId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  };

  // 🚀 SILNIK SERVER-SENT EVENTS (SSE) - CZAS RZECZYWISTY
  useEffect(() => {
    fetchDeal().then(() => markAsRead());

    const token = getToken();
    if (sseRef.current) sseRef.current.close();
    
    // Podłączamy się do strumienia wydarzeń
    const sse = new EventSource(`/api/realtime?userId=${currentUserId}`);
    sseRef.current = sse;
    const fallbackInterval = setInterval(fetchDeal, 1500);

    sse.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        if (incoming.type === 'PING') return;

        if (incoming.type === 'NEW_MESSAGE' || incoming.type === 'READ') {
          // Brutalne pobranie nowych danych przy każdym sygnale
          fetch(`/api/deals/${dealId}?_t=${Date.now()}&${Math.random()}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
              if(d.success) setDeal(d.deal);
              if (incoming.type === 'NEW_MESSAGE') markAsRead();
            });
        }

        if (incoming.type === 'TYPING' && String(incoming.payload.dealId) === String(dealId) && String(incoming.payload.userId) !== String(currentUserId)) {
          setIsTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
        }
      } catch(err) {}
    };

    sse.onerror = () => {
      sse.close();
      setTimeout(() => { if (sseRef.current?.readyState === EventSource.CLOSED) sseRef.current = new EventSource(`/api/realtime?userId=${currentUserId}`); }, 5000);
    };

    return () => {
      sse.close();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      clearInterval(fallbackInterval);
    };
  }, [dealId, currentUserId]);

  // INTELIGENTNY SCROLL (NAPRAWIONY)
  const prevMsgCount = useRef(0);
  const initializedScroll = useRef(false);

  useEffect(() => {
    const currentCount = deal?.messages?.length || 0;
    
    // 1. Pierwsze załadowanie pokoju - zjeżdżamy na dół
    if (!initializedScroll.current && currentCount > 0) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      initializedScroll.current = true;
      prevMsgCount.current = currentCount;
    } 
    // 2. Przyszła NOWA wiadomość (liczba się zwiększyła)
    else if (currentCount > prevMsgCount.current) {
      if (!isUserScrolling.current) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      prevMsgCount.current = currentCount;
    }
    // UWAGA: Jeśli zmienił się tylko status (Dostarczono -> Odczytano), 
    // liczba wiadomości jest taka sama, więc scroll ANI DRGNIE!
  }, [deal?.messages]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      isUserScrolling.current = scrollHeight - scrollTop - clientHeight > 100;
    }
  };

  const notifyTyping = () => {
  if (typeof window !== 'undefined') {
      const now = Date.now();
      if ((window as any)._lastTyping && now - (window as any)._lastTyping < 1500) return;
      (window as any)._lastTyping = now;
  }
  const token = getToken();
  fetch(`/api/deals/${dealId}/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId: currentUserId })
  }).catch(() => {});
};

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    notifyTyping(); // Informujemy serwer, że piszemy
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileSnapshot = pendingFile;
    const textSnapshot = inputText.trim();
    if ((!textSnapshot && !fileSnapshot) || isSending) return;

    setIsSending(true);
    const token = getToken();
    const tempId = Date.now();
    const typedContent = (textSnapshot || (fileSnapshot ? `📎 ${fileSnapshot.name}` : '')).trim();
    const tempMsg = {
      id: tempId,
      senderId: currentUserId,
      content: typedContent,
      attachment: null as string | null,
      createdAt: new Date().toISOString(),
      pending: true,
      isRead: false,
    };

    setDeal((prev: any) => ({ ...prev, messages: [...(prev?.messages || []), tempMsg] }));
    setInputText('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    isUserScrolling.current = false;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      let res: Response;
      if (fileSnapshot) {
        const fd = new FormData();
        if (textSnapshot) fd.append('content', textSnapshot);
        fd.append('file', fileSnapshot);
        fd.append('senderId', String(currentUserId));
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        res = await fetch(`/api/deals/${dealId}/messages`, {
          method: 'POST',
          headers,
          body: fd,
        });
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        res = await fetch(`/api/deals/${dealId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: typedContent, senderId: currentUserId }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Nie udało się wysłać wiadomości');
      }
      refetchDealAndMessages();
    } catch (err) {
      setDeal((prev: any) => ({
        ...prev,
        messages: (prev?.messages || []).filter((m: any) => m.id !== tempId),
      }));
      setInputText(textSnapshot);
      if (fileSnapshot) setPendingFile(fileSnapshot);
      const errMsg =
        err instanceof Error ? err.message : 'Nie udało się wysłać wiadomości';
      alert(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  const respondBid = async (
    bidId: number,
    action: 'ACCEPT' | 'REJECT' | 'COUNTER',
    counterAmount?: number
  ) => {
    const token = getToken();
    if (!token) return;
    let payload: any = { action };
    if (action === 'COUNTER') {
      const numeric = Number(counterAmount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        alert('Nieprawidłowa kwota kontroferty.');
        return;
      }
      payload.counterAmount = numeric;
    }
    setActionLoading(`bid-${bidId}-${action}`);
    try {
      const res = await fetch(`/api/deals/${dealId}/bids/${bidId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Błąd odpowiedzi na ofertę');
      refetchDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Nie udało się wykonać akcji.');
    } finally {
      setActionLoading(null);
    }
  };

  const respondAppointment = async (
    appointmentId: number,
    action: 'ACCEPT' | 'DECLINE' | 'RESCHEDULE',
    message?: string
  ) => {
    const token = getToken();
    if (!token) return;
    let payload: any = { action };
    if (action === 'RESCHEDULE') {
      const note = String(message || '').trim();
      if (!note) return;
      payload.message = note;
    }
    setActionLoading(`appointment-${appointmentId}-${action}`);
    try {
      const res = await fetch(`/api/deals/${dealId}/appointments/${appointmentId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Błąd odpowiedzi na termin');
      refetchDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Nie udało się wykonać akcji.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="w-full h-[600px] flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>;
  if (!deal) return <div className="text-center text-white/40 py-20 font-bold uppercase tracking-widest text-xs">Brak dostępu do pokoju.</div>;

  const otherParty = deal.buyerId === currentUserId ? deal.seller : deal.buyer;
  const isBuyer = deal.buyerId === currentUserId;
  const isFinalizationReady = deal?.status === 'AGREED' && !!deal?.acceptedBidId;
  const isFinalized = FINALIZED_STATUSES.has(String(deal?.status || '').toUpperCase()) || isFinalizationReady;
  const actionableBids = !isFinalized
    ? (deal.bids || []).filter((b: any) => (b.status === 'PENDING' || b.status === 'COUNTER_OFFER') && b.senderId !== currentUserId)
    : [];
  const actionableAppointments = !isFinalized
    ? (deal.appointments || []).filter((a: any) => a.status === 'PENDING' && a.proposedById !== currentUserId)
    : [];
  const activeBid = bidActionModal ? (deal.bids || []).find((b: any) => b.id === bidActionModal.bidId) : null;
  const activeAppointment = appointmentActionModal ? (deal.appointments || []).find((a: any) => a.id === appointmentActionModal.appointmentId) : null;

  return (
    <div className="flex flex-col h-[750px] bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_0_80px_rgba(0,0,0,0.6)] relative isolate font-sans">
      
      {/* HEADER */}
      <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shrink-0">
             <img src={(Array.isArray(deal.offer?.images) ? deal.offer.images[0] : typeof deal.offer?.images === 'string' && deal.offer.images.startsWith('[') ? JSON.parse(deal.offer.images)[0] : deal.offer?.images) || deal.offer?.imageUrl || '/placeholder.jpg'} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-white font-black text-lg">{deal.offer?.title || 'Transakcja'}</h3>
            <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-widest font-bold">
              <span className="text-emerald-500">{Number(String(deal.offer?.price || 0).replace(/\D/g, '')).toLocaleString('pl-PL')} PLN</span>
              <span className="w-1 h-1 rounded-full bg-white/20"></span>
              <span className="text-white/40">{isBuyer ? 'Kupujesz od:' : 'Sprzedajesz dla:'} <span className="text-white/80">{otherParty?.name || otherParty?.email?.split('@')[0]}</span></span>
            </div>
            <EliteStatusBadges subject={otherParty} isDark compact className="mt-2" />
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">Szyfrowanie E2E</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.16em] border ${isFinalizationReady ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/15 text-white/50'}`}>
              finalization-ready: {isFinalizationReady ? 'yes' : 'no'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.16em] border ${isFinalized ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/15 text-white/50'}`}>
              finalized: {isFinalized ? 'yes' : 'no'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.16em] border bg-white/5 border-white/15 text-white/50">
              acceptedBidId: {deal?.acceptedBidId ?? 'null'}
            </span>
          </div>
        </div>
      </div>

      {/* CZAT (Z inteligentnym scrollem i statusem iMessage) */}
      <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar relative z-10 scroll-smooth">
        {isFinalized && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-1">Transakcja zamknięta</p>
            <p className="text-sm text-white/80">Negocjacje zostały zakończone. Status: <span className="font-black text-emerald-300">{String(deal?.status || 'FINALIZED')}</span>.</p>
            <div className="mt-3 rounded-xl border border-white/15 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-white/60">Ocena współpracy</p>
              <p className="text-xs text-white/60 mt-1">Wystaw ocenę po obu stronach, aby domknąć historię transakcji w ekosystemie web+app.</p>
            </div>
          </div>
        )}

        {!isFinalized && (actionableBids.length > 0 || actionableAppointments.length > 0) && (
          <div className="space-y-4">
            {actionableBids.map((bid: any) => (
              <div key={`action-bid-${bid.id}`} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-[10px] uppercase tracking-widest font-black text-amber-300 mb-2">Oferta ceny od {bid.sender?.name || 'użytkownika'}: {Number(bid.amount || 0).toLocaleString('pl-PL')} PLN</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'ACCEPT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest">Akceptuj</button>
                  <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'COUNTER' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">Kontroferta</button>
                  <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'REJECT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-widest">Odrzuć</button>
                </div>
              </div>
            ))}
            {actionableAppointments.map((app: any) => (
              <div key={`action-app-${app.id}`} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
                <p className="text-[10px] uppercase tracking-widest font-black text-blue-300 mb-2">Propozycja terminu od {app.proposedBy?.name || 'użytkownika'}: {new Date(app.proposedDate).toLocaleString('pl-PL')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'ACCEPT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest">Akceptuj</button>
                  <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'RESCHEDULE' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">Kontroferta</button>
                  <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'DECLINE' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-widest">Odrzuć</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(!deal.messages || deal.messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 mt-10">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
               <Lock size={24} className="text-white/30" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Deal Room Aktywny</p>
            <p className="text-xs font-medium text-white/30 max-w-sm text-center">Napisz wiadomość. Komunikacja jest zabezpieczona certyfikatem EstateOS Ultra.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {deal.messages?.map((msg: any, i: number) => {
            const msgContent = String(msg?.content || '');
            const isMe = msg.senderId === currentUserId;
            const eventPayload = parseDealEvent(msgContent);

            if (eventPayload?.entity === 'BID') {
              return (
                <div key={msg.id || i} className="flex justify-center my-10">
                  <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-emerald-500/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_20px_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(16,185,129,0.07)] text-center relative overflow-hidden">
                    <p className="text-[9px] uppercase tracking-[0.4em] font-black text-emerald-500/80 mb-3 relative z-10">Negocjacja Ceny</p>
                    <p className="text-xl font-black text-white relative z-10">
                      {eventPayload.action === 'ACCEPTED' ? 'Oferta zaakceptowana' : eventPayload.action === 'REJECTED' ? 'Oferta odrzucona' : eventPayload.action === 'COUNTERED' ? 'Kontroferta' : 'Nowa propozycja'}
                    </p>
                    <p className="text-3xl font-black text-emerald-400 relative z-10 mt-2">
                      {Number(eventPayload.amount || 0).toLocaleString('pl-PL')} PLN
                    </p>
                    {eventPayload.note ? <p className="text-xs text-white/50 mt-3">{eventPayload.note}</p> : null}
                  </div>
                </div>
              );
            }

            if (eventPayload?.entity === 'APPOINTMENT') {
              return (
                <div key={msg.id || i} className="flex justify-center my-10">
                  <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-blue-500/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_20px_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(59,130,246,0.07)] text-center relative overflow-hidden">
                    <p className="text-[9px] uppercase tracking-[0.4em] font-black text-blue-400/80 mb-3 relative z-10">Negocjacja Terminu</p>
                    <p className="text-xl font-black text-white relative z-10">
                      {eventPayload.action === 'ACCEPTED' ? 'Termin zaakceptowany' : (eventPayload.action === 'DECLINED' || eventPayload.action === 'REJECTED') ? 'Termin odrzucony' : eventPayload.action === 'COUNTERED' ? 'Kontroferta terminu' : 'Nowa propozycja'}
                    </p>
                    <p className="text-sm font-black text-blue-300 relative z-10 mt-2">
                      {eventPayload.proposedDate ? new Date(eventPayload.proposedDate).toLocaleString('pl-PL') : '-'}
                    </p>
                    {eventPayload.note ? <p className="text-xs text-white/50 mt-3">{eventPayload.note}</p> : null}
                  </div>
                </div>
              );
            }
            
            if (msgContent.startsWith('[SYSTEM_BID:')) {
              const amount = msgContent.replace(/\D/g, '');
              return (
                <div key={msg.id || i} className="flex justify-center my-10">
                  <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-amber-500/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_20px_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(245,158,11,0.05)] text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-amber-500/20 transition-all duration-700"></div>
                    <p className="text-[9px] uppercase tracking-[0.4em] font-black text-amber-500/70 mb-3 relative z-10">Propozycja Cenowa</p>
                    <p className="text-3xl font-black text-amber-400 relative z-10 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">{Number(amount).toLocaleString('pl-PL')} PLN</p>
                  </div>
                </div>
              );
            }

            return (
              <motion.div key={msg.id || i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#222] to-[#111] border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                      <span className="text-[10px] font-black text-white/50">{otherParty?.name?.charAt(0) || '👤'}</span>
                    </div>
                  )}
                  
                  <div className={`px-6 py-4 shadow-xl ${isMe ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-black rounded-[1.8rem] rounded-br-[0.5rem] shadow-[0_10px_25px_rgba(16,185,129,0.2)]' : 'bg-white/5 border border-white/10 text-white/90 rounded-[1.8rem] rounded-bl-[0.5rem] backdrop-blur-md'}`}>
                    <p className={`text-[15px] leading-relaxed tracking-wide ${isMe ? 'font-semibold' : 'font-normal'}`}>{msgContent}</p>
                    {msg.attachment ? (
                      <a
                        href={msg.attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-3 block text-[13px] font-bold truncate max-w-[min(260px,70vw)] underline ${isMe ? 'text-black/85' : 'text-emerald-400'}`}
                      >
                        📎 Załącznik
                      </a>
                    ) : null}
                  </div>
                </div>
                
                {/* STATUS I CZAS iMessage */}
                <div className={`flex items-center gap-1.5 mt-2 ${isMe ? 'mr-3' : 'ml-11'}`}>
                  {isMe && (
                     <div className="flex items-center justify-center">
                        {msg.pending ? (
                           <Loader2 size={12} className="text-white/30 animate-spin" />
                        ) : msg.isRead ? (
                           <span className="text-[9px] font-bold text-blue-400 flex items-center gap-1"><CheckCheck size={12} className="text-blue-500" /> Odczytano</span>
                        ) : (
                           <span className="text-[9px] font-bold text-white/40 flex items-center gap-1"><Check size={12} className="text-emerald-500/80" /> Dostarczono</span>
                        )}
                     </div>
                  )}
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-1">
                    {new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {/* ANIMACJA PISANIA (Typing Indicator) */}
          {isTyping && (
             <motion.div key="typing-indicator" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-end gap-3 ml-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#222] to-[#111] border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <span className="text-[10px] font-black text-white/50">{otherParty?.name?.charAt(0) || '👤'}</span>
                </div>
                <div className="px-5 py-4 bg-white/5 border border-white/10 rounded-[1.8rem] rounded-bl-[0.5rem] flex items-center gap-1.5 backdrop-blur-md w-fit">
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                </div>
             </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* KONSOLA WPISYWANIA */}
      <div className="p-4 md:p-6 md:pb-8 relative z-20 bg-gradient-to-t from-[#080808] via-[#080808] to-transparent shrink-0">
        {isFinalized ? (
          <div className="relative max-w-4xl mx-auto rounded-[2rem] border border-white/10 bg-[#111] px-5 py-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] font-black text-white/45">Tryb tylko do odczytu</p>
            <p className="text-sm text-white/75 mt-1">Ten DealRoom jest zamknięty po finalizacji.</p>
          </div>
        ) : (
        <form onSubmit={sendMessage} className="relative max-w-4xl mx-auto flex items-center gap-2 md:gap-3 bg-[#111] border border-white/10 p-2 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus-within:border-emerald-500/40 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all duration-500">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              setPendingFile(f || null);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 shrink-0 rounded-[1.2rem] flex items-center justify-center text-white/50 hover:text-emerald-400 hover:bg-white/5 transition-colors cursor-pointer"
            title="Dodaj załącznik"
          >
            <Paperclip size={18} />
          </button>
          {pendingFile ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold max-w-[40%] truncate">
              {pendingFile.name}
              <button
                type="button"
                onClick={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-0.5 rounded-full hover:bg-white/10 shrink-0"
                aria-label="Usuń plik"
              >
                <X size={14} />
              </button>
            </span>
          ) : null}
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            placeholder="Wiadomość..."
            className="flex-1 bg-transparent text-white placeholder-white/30 text-[15px] px-2 md:px-5 py-2.5 outline-none font-medium tracking-wide min-w-0"
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && !pendingFile) || isSending}
            className="w-10 h-10 shrink-0 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-[1.2rem] flex items-center justify-center text-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:grayscale transition-all duration-300 shadow-[0_5px_15px_rgba(16,185,129,0.4)] cursor-pointer"
          >
            {isSending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="ml-0.5 text-white drop-shadow-md" />}
          </button>
        </form>
        )}
      </div>

      <AnimatePresence>
        {bidActionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0d] p-6 shadow-2xl">
              <h4 className="text-white font-black text-lg mb-2">Decyzja negocjacyjna — cena</h4>
              <p className="text-white/50 text-sm mb-4">
                {bidActionModal.action === 'ACCEPT' && `Akceptujesz ofertę ${Number(activeBid?.amount || 0).toLocaleString('pl-PL')} PLN.`}
                {bidActionModal.action === 'REJECT' && `Odrzucasz ofertę ${Number(activeBid?.amount || 0).toLocaleString('pl-PL')} PLN.`}
                {bidActionModal.action === 'COUNTER' && 'Podaj kwotę kontroferty.'}
              </p>
              {bidActionModal.action === 'COUNTER' && (
                <input
                  value={counterBidAmount}
                  onChange={(e) => setCounterBidAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="np. 485000"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none mb-4"
                />
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setBidActionModal(null); setCounterBidAmount(''); }} className="px-4 py-2 rounded-xl border border-white/15 text-white/70 text-xs font-black uppercase tracking-widest">Anuluj</button>
                <button
                  disabled={!!actionLoading}
                  onClick={async () => {
                    const numeric = Number(String(counterBidAmount).replace(',', '.'));
                    await respondBid(
                      bidActionModal.bidId,
                      bidActionModal.action,
                      bidActionModal.action === 'COUNTER' ? numeric : undefined
                    );
                    setBidActionModal(null);
                    setCounterBidAmount('');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase tracking-widest disabled:opacity-40"
                >
                  Potwierdź
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appointmentActionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0d] p-6 shadow-2xl">
              <h4 className="text-white font-black text-lg mb-2">Decyzja negocjacyjna — termin</h4>
              <p className="text-white/50 text-sm mb-4">
                {appointmentActionModal.action === 'ACCEPT' && `Akceptujesz termin: ${activeAppointment?.proposedDate ? new Date(activeAppointment.proposedDate).toLocaleString('pl-PL') : '-'}.`}
                {appointmentActionModal.action === 'DECLINE' && 'Odrzucasz zaproponowany termin.'}
                {appointmentActionModal.action === 'RESCHEDULE' && 'Podaj propozycję nowego terminu (tekst).'}
              </p>
              {appointmentActionModal.action === 'RESCHEDULE' && (
                <textarea
                  value={counterAppointmentNote}
                  onChange={(e) => setCounterAppointmentNote(e.target.value)}
                  placeholder='np. "Jutro 18:30 lub pojutrze 9:00"'
                  className="w-full min-h-[90px] rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none mb-4"
                />
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAppointmentActionModal(null); setCounterAppointmentNote(''); }} className="px-4 py-2 rounded-xl border border-white/15 text-white/70 text-xs font-black uppercase tracking-widest">Anuluj</button>
                <button
                  disabled={!!actionLoading}
                  onClick={async () => {
                    await respondAppointment(
                      appointmentActionModal.appointmentId,
                      appointmentActionModal.action,
                      appointmentActionModal.action === 'RESCHEDULE' ? counterAppointmentNote : undefined
                    );
                    setAppointmentActionModal(null);
                    setCounterAppointmentNote('');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase tracking-widest disabled:opacity-40"
                >
                  Potwierdź
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
