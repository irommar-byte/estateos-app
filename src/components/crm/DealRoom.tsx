"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  ShieldCheck,
  Lock,
  Check,
  CheckCheck,
  Loader2,
  Paperclip,
  X,
  CalendarClock,
  Banknote,
  MessageCircle,
} from 'lucide-react';
import EliteStatusBadges from '@/components/ui/EliteStatusBadges';
import DealRoomAppointmentPicker from '@/components/crm/DealRoomAppointmentPicker';
import DealRoomPostSaleReview from '@/components/crm/DealRoomPostSaleReview';
import PresentationFlowBanner from '@/components/presentation/PresentationFlowBanner';
import { formatDealChatMessage } from '@/lib/dealroomReviewMessage';
import {
  buildChatTimeline,
  buildNegotiationEvents,
  type NegotiationEventEntry,
} from '@/components/crm/dealRoomUtils';
import {
  BUYER_ACCEPT_OWNER_PRICE_NOTE,
  canFinalizeTransition,
  detectFinalAcceptanceContext,
  isDealTransactionFinalized,
} from '@/lib/dealPriceNegotiationUi';

export default function DealRoom({ dealId, currentUserId }: { dealId: number, currentUserId: number }) {
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [appointmentExpanded, setAppointmentExpanded] = useState(true);
  const [priceExpanded, setPriceExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bidActionModal, setBidActionModal] = useState<{ bidId: number; action: 'ACCEPT' | 'REJECT' | 'COUNTER' } | null>(null);
  const [appointmentActionModal, setAppointmentActionModal] = useState<{ appointmentId: number; action: 'ACCEPT' | 'DECLINE' | 'RESCHEDULE' } | null>(null);
  const [counterBidAmount, setCounterBidAmount] = useState('');
  
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

  const authHeaders = (json = false): Record<string, string> => {
    const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const fetchDeal = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}?_t=${Date.now()}&${Math.random()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Pragma': 'no-cache', ...authHeaders() },
      });
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
        credentials: 'include',
        headers: authHeaders(),
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
          credentials: 'include',
          headers,
          body: fd,
        });
      } else {
        res = await fetch(`/api/deals/${dealId}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(true),
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

  const chatMessages = useMemo(() => (deal ? buildChatTimeline(deal) : []), [deal]);
  const negotiationEvents = useMemo(() => (deal ? buildNegotiationEvents(deal) : []), [deal]);
  const appointmentEvents = useMemo(
    () => negotiationEvents.filter((e) => e.event?.entity === 'APPOINTMENT'),
    [negotiationEvents]
  );
  const bidEvents = useMemo(
    () => negotiationEvents.filter((e) => e.event?.entity === 'BID'),
    [negotiationEvents]
  );

  const finalizeDealSale = async () => {
    setActionLoading('finalize-deal');
    try {
      const res = await fetch(`/api/deals/${dealId}/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Nie udało się sfinalizować sprzedaży');
      }
      refetchDealAndMessages();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Błąd finalizacji');
    } finally {
      setActionLoading(null);
    }
  };

  const respondBid = async (
    bidId: number,
    action: 'ACCEPT' | 'REJECT' | 'COUNTER',
    opts?: { counterAmount?: number; message?: string; intent?: string }
  ) => {
    let payload: Record<string, unknown> = { action };
    if (action === 'COUNTER') {
      const numeric = Number(opts?.counterAmount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        alert('Nieprawidłowa kwota kontroferty.');
        return;
      }
      payload.counterAmount = numeric;
      if (opts?.message) payload.message = opts.message;
      if (opts?.intent) payload.intent = opts.intent;
    }
    if (opts?.message && action !== 'COUNTER') payload.message = opts.message;
    setActionLoading(`bid-${bidId}-${action}`);
    try {
      const res = await fetch(`/api/deals/${dealId}/bids/${bidId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
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
    opts?: { message?: string; proposedDate?: string }
  ) => {
    const payload: Record<string, unknown> = { action };
    if (action === 'RESCHEDULE') {
      if (!opts?.proposedDate) {
        alert('Wybierz datę i godzinę w kalendarzu.');
        return;
      }
      payload.proposedDate = opts.proposedDate;
      if (opts.message) payload.message = opts.message;
    }
    setActionLoading(`appointment-${appointmentId}-${action}`);
    try {
      const res = await fetch(`/api/deals/${dealId}/appointments/${appointmentId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
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
  if (!deal) return <div className="theme-aware-dashboard text-center text-[var(--eos-subtle)] py-20 font-bold uppercase tracking-widest text-xs">Brak dostępu do pokoju.</div>;

  const otherParty = deal.buyerId === currentUserId ? deal.seller : deal.buyer;
  const isBuyer = deal.buyerId === currentUserId;
  const isListingOwner = deal.sellerId === currentUserId;
  const dealStatus = String(deal?.status || '').toUpperCase();
  const acceptedBidId = Number(deal?.acceptedBidId || 0);
  const transactionFinalized = isDealTransactionFinalized({ dealStatus: deal?.status });
  const dealPriceAgreed = canFinalizeTransition({ dealStatus: deal?.status, acceptedBidId: deal?.acceptedBidId });
  const isFinalizationReady = dealPriceAgreed && isListingOwner && !transactionFinalized;
  const isFinalized = transactionFinalized;
  const latestPendingBid = !isFinalized
    ? [...(deal.bids || [])]
        .filter((b: any) => b.status === 'PENDING')
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
    : null;
  const actionableBids =
    latestPendingBid && latestPendingBid.senderId !== currentUserId ? [latestPendingBid] : [];

  const latestPendingAppointment = !isFinalized
    ? [...(deal.appointments || [])]
        .filter((a: any) => a.status === 'PENDING')
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
    : null;
  const actionableAppointments =
    latestPendingAppointment && latestPendingAppointment.proposedById !== currentUserId
      ? [latestPendingAppointment]
      : [];
  const waitingOnMyAppointment =
    !!latestPendingAppointment && latestPendingAppointment.proposedById === currentUserId;
  const waitingOnMyBid = !!latestPendingBid && latestPendingBid.senderId === currentUserId;
  const activeBid = bidActionModal ? (deal.bids || []).find((b: any) => b.id === bidActionModal.bidId) : null;
  const activeAppointment = appointmentActionModal ? (deal.appointments || []).find((a: any) => a.id === appointmentActionModal.appointmentId) : null;

  const formatActor = (senderId?: number | null) => {
    if (senderId === currentUserId) return 'Ty';
    return otherParty?.name || otherParty?.email?.split('@')[0] || 'Kontrahent';
  };

  const latestAppointment = appointmentEvents[appointmentEvents.length - 1] || null;
  const latestBid = bidEvents[bidEvents.length - 1] || null;

  const appointmentStatus = (() => {
    if (!latestAppointment) return 'IDLE' as const;
    const action = String(latestAppointment.event?.action || '').toUpperCase();
    if (action === 'ACCEPTED') return 'ACCEPTED' as const;
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING' as const;
    return 'IDLE' as const;
  })();

  const finalAcceptanceContext = detectFinalAcceptanceContext(bidEvents);
  const ownerNeedsFinalDecision =
    !!finalAcceptanceContext && isListingOwner && !transactionFinalized && !dealPriceAgreed;
  const isBuyerWaitingOnOwnerDecision =
    !!finalAcceptanceContext &&
    isBuyer &&
    String(currentUserId) === finalAcceptanceContext.buyerSenderId &&
    !transactionFinalized;

  const awaitingOwnerPriceFinalize = (() => {
    if (!latestBid) return false;
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (action !== 'ACCEPTED') return false;
    return !dealPriceAgreed && !transactionFinalized;
  })();

  const priceStatus = (() => {
    if (!latestBid) return 'IDLE' as const;
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (awaitingOwnerPriceFinalize || ownerNeedsFinalDecision || isBuyerWaitingOnOwnerDecision) {
      return 'PENDING' as const;
    }
    if (dealPriceAgreed || (action === 'ACCEPTED' && dealPriceAgreed)) return 'ACCEPTED' as const;
    if (action === 'ACCEPTED' && !dealPriceAgreed) return 'PENDING' as const;
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING' as const;
    return 'IDLE' as const;
  })();

  const appointmentStatusLabel =
    appointmentStatus === 'ACCEPTED' ? 'Termin uzgodniony' :
    waitingOnMyAppointment ? 'Twoja propozycja czeka na odpowiedź kontrahenta' :
    appointmentStatus === 'PENDING' ? 'Oczekuje na Twoją decyzję' :
    'Brak aktywnej propozycji';

  const priceStatusLabel =
    transactionFinalized ? 'Transakcja sfinalizowana' :
    dealPriceAgreed ? 'Cena uzgodniona — gotowe do finalizacji przez właściciela' :
    isBuyerWaitingOnOwnerDecision ? 'Czekasz na ostateczne potwierdzenie sprzedaży przez właściciela' :
    ownerNeedsFinalDecision ? 'Kupujący zaakceptował cenę — Twoja ostateczna decyzja' :
    priceStatus === 'ACCEPTED' ? 'Cena uzgodniona' :
    waitingOnMyBid ? 'Twoja propozycja czeka na odpowiedź kontrahenta' :
    priceStatus === 'PENDING' ? 'Oczekuje na Twoją decyzję' :
    'Brak aktywnej propozycji';

  const renderEventTimeline = (
    entries: NegotiationEventEntry[],
    kind: 'APPOINTMENT' | 'BID'
  ) => (
    <div className="space-y-0 pl-1">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        const action = String(entry.event?.action || '').toUpperCase();
        const actor = formatActor(entry.msg?.senderId);
        const note = String(entry.event?.note || entry.event?.message || '').trim();
        const main =
          kind === 'APPOINTMENT'
            ? `${actor} ${
                action === 'ACCEPTED' ? 'zaakceptował(a) termin' :
                action === 'COUNTERED' ? 'zaproponował(a) kontrofertę terminu' :
                action === 'DECLINED' || action === 'REJECTED' ? 'odrzucił(a) termin' :
                'zaproponował(a) termin'
              }: ${entry.event?.proposedDate ? new Date(entry.event.proposedDate).toLocaleString('pl-PL') : '—'}`
            : `${actor} ${
                action === 'ACCEPTED' ? 'zaakceptował(a) ofertę' :
                action === 'COUNTERED' ? 'wysłał(a) kontrofertę' :
                action === 'REJECTED' ? 'odrzucił(a) ofertę' :
                'zaproponował(a) cenę'
              }: ${Number(entry.event?.amount || 0).toLocaleString('pl-PL')} PLN`;
        return (
          <div key={`${kind}-${entry.msg?.id || idx}`} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className={`w-2 h-2 rounded-full ${kind === 'APPOINTMENT' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
              {!isLast ? <div className="w-px flex-1 min-h-[28px] bg-white/10 mt-1" /> : null}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className="text-sm text-white/90 font-semibold leading-snug">{main}</p>
              {note ? <p className="text-xs text-white/45 mt-1">„{note}”</p> : null}
              <p className="text-[9px] text-white/25 mt-1 uppercase tracking-widest font-bold">
                {new Date(entry.msg?.createdAt || Date.now()).toLocaleString('pl-PL')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="theme-aware-dashboard flex flex-col h-[750px] bg-[var(--eos-bg-elevated)] border border-[var(--eos-border)] rounded-[2.5rem] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.25)] relative isolate font-sans text-[var(--eos-text)]">
      <div className="px-4 pt-4 shrink-0">
        <PresentationFlowBanner variant="dealroom" />
      </div>
      {/* HEADER */}
      <div className="relative z-10 flex items-center justify-between p-6 border-b border-[var(--eos-border)] bg-[var(--eos-bg)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[var(--eos-border)] shrink-0">
             <img src={(Array.isArray(deal.offer?.images) ? deal.offer.images[0] : typeof deal.offer?.images === 'string' && deal.offer.images.startsWith('[') ? JSON.parse(deal.offer.images)[0] : deal.offer?.images) || deal.offer?.imageUrl || '/placeholder.jpg'} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[var(--eos-text)] font-black text-lg">{deal.offer?.title || 'Transakcja'}</h3>
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
          <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.16em] border ${isFinalized ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : isFinalizationReady ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/15 text-white/50'}`}>
            {isFinalized ? 'Transakcja zamknięta' : isFinalizationReady ? 'Potwierdź finalizację sprzedaży' : ownerNeedsFinalDecision ? 'Oczekuje Twojej decyzji' : 'Negocjacje aktywne'}
          </span>
        </div>
      </div>

      <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar relative z-10 scroll-smooth">
        {isFinalized && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-1">Transakcja zamknięta</p>
            <p className="text-sm text-white/80">Negocjacje zostały zakończone. Status: <span className="font-black text-emerald-300">{String(deal?.status || 'FINALIZED')}</span>.</p>
          </div>
        )}

        {/* Panel negocjacji — jak w aplikacji mobilnej */}
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => setAppointmentExpanded((v) => !v)}
            className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${appointmentStatus === 'PENDING' ? 'border-amber-500/40 bg-amber-500/10' : appointmentStatus === 'ACCEPTED' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <CalendarClock size={16} className={appointmentStatus === 'PENDING' ? 'text-amber-400' : appointmentStatus === 'ACCEPTED' ? 'text-emerald-400' : 'text-white/40'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Dział 1 — Prezentacje</p>
              <p className="text-sm font-bold text-white mt-0.5">Terminy oglądania</p>
              <p className="text-xs text-white/50 mt-0.5">{appointmentStatusLabel}</p>
            </div>
            <span className="text-white/40 font-black text-lg">{appointmentExpanded ? '−' : '+'}</span>
          </button>

          {appointmentExpanded && (
            <div className="px-4 pb-4 border-t border-white/5">
              {appointmentEvents.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Brak propozycji terminu</p>
              ) : (
                renderEventTimeline(appointmentEvents, 'APPOINTMENT')
              )}
              {!isFinalized && waitingOnMyAppointment && (
                <p className="mt-3 text-xs text-white/55 text-center font-semibold leading-relaxed px-2">
                  Oczekujemy na odpowiedź kontrahenta. Nie możesz zaakceptować własnej propozycji.
                </p>
              )}
              {!isFinalized && actionableAppointments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {actionableAppointments.map((app: any) => (
                    <div key={`action-app-${app.id}`} className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-widest font-black text-blue-300 mb-2">
                        Decyzja: {new Date(app.proposedDate).toLocaleString('pl-PL')}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'ACCEPT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase">Akceptuj</button>
                        <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'RESCHEDULE' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase">Kontroferta</button>
                        <button onClick={() => setAppointmentActionModal({ appointmentId: app.id, action: 'DECLINE' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase">Odrzuć</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="h-px bg-white/5" />

          <button
            type="button"
            onClick={() => setPriceExpanded((v) => !v)}
            className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${priceStatus === 'PENDING' ? 'border-amber-500/40 bg-amber-500/10' : priceStatus === 'ACCEPTED' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <Banknote size={16} className={priceStatus === 'PENDING' ? 'text-amber-400' : priceStatus === 'ACCEPTED' ? 'text-emerald-400' : 'text-white/40'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Dział 2 — Propozycje cenowe</p>
              <p className="text-sm font-bold text-white mt-0.5">Negocjacja ceny</p>
              <p className="text-xs text-white/50 mt-0.5">{priceStatusLabel}</p>
            </div>
            <span className="text-white/40 font-black text-lg">{priceExpanded ? '−' : '+'}</span>
          </button>

          {priceExpanded && (
            <div className="px-4 pb-4 border-t border-white/5">
              {bidEvents.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Brak propozycji cenowych</p>
              ) : (
                renderEventTimeline(bidEvents, 'BID')
              )}
              {!isFinalized && waitingOnMyBid && (
                <p className="mt-3 text-xs text-white/55 text-center font-semibold leading-relaxed px-2">
                  Oczekujemy na odpowiedź kontrahenta. Nie możesz zaakceptować własnej propozycji.
                </p>
              )}
              {!isFinalized && isBuyerWaitingOnOwnerDecision && (
                <p className="mt-3 text-xs text-amber-200/80 text-center font-semibold leading-relaxed px-2">
                  Zaakceptowałeś cenę właściciela. Sprzedaż zostanie zamknięta dopiero po jego świadomym potwierdzeniu.
                </p>
              )}
              {!isFinalized && ownerNeedsFinalDecision && finalAcceptanceContext && (
                <div className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-yellow-300 mb-2">
                    Ostateczna decyzja sprzedaży
                  </p>
                  <p className="text-sm text-white/80 mb-3">
                    Kupujący zaakceptował {finalAcceptanceContext.amount.toLocaleString('pl-PL')} PLN. Potwierdź, aby sfinalizować transakcję i zdjąć ofertę z rynku.
                  </p>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => setBidActionModal({ bidId: finalAcceptanceContext.bidId, action: 'ACCEPT' })}
                    className="w-full py-3 rounded-xl bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    Potwierdzam sprzedaż
                  </button>
                </div>
              )}
              {!isFinalized && isFinalizationReady && acceptedBidId > 0 && (
                <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <p className="text-sm text-white/80 mb-3">
                    Cena została uzgodniona. Kliknij poniżej, aby sfinalizować sprzedaż (oferta zniknie z rynku).
                  </p>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => void finalizeDealSale()}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    Sfinalizuj sprzedaż
                  </button>
                </div>
              )}
              {!isFinalized && !ownerNeedsFinalDecision && !isFinalizationReady && actionableBids.length > 0 && (
                <div className="mt-3 space-y-2">
                  {actionableBids.map((bid: any) => (
                    <div key={`action-bid-${bid.id}`} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-widest font-black text-amber-300 mb-2">
                        Decyzja: {Number(bid.amount || 0).toLocaleString('pl-PL')} PLN
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'ACCEPT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase">Zgoda</button>
                        <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'COUNTER' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase">Kontroferta</button>
                        <button onClick={() => setBidActionModal({ bidId: bid.id, action: 'REJECT' })} disabled={!!actionLoading} className="py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase">Odrzuć</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dział 3 — Rozmowa (czat) */}
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-white/5">
            <MessageCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Dział 3 — Rozmowa</p>
              <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                Czat szyfrowany E2E
                <ShieldCheck size={14} className="text-emerald-500" />
              </p>
              <p className="text-xs text-white/50 mt-0.5">Wiadomości tekstowe i załączniki — bez mieszania z negocjacjami.</p>
            </div>
          </div>

          {chatMessages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center py-10 opacity-50">
              <Lock size={22} className="text-white/30 mb-2" />
              <p className="text-xs text-white/40 text-center">Brak wiadomości — napisz pierwszą poniżej.</p>
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {chatMessages.map((msg: any, i: number) => {
                const msgContent = formatDealChatMessage(String(msg?.content || ''));
                if (!msgContent) return null;
                const isMe = msg.senderId === currentUserId;
                return (
                  <motion.div key={msg.id || i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#222] to-[#111] border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                          <span className="text-[10px] font-black text-white/50">{otherParty?.name?.charAt(0) || '👤'}</span>
                        </div>
                      )}
                      <div className={`px-6 py-4 shadow-xl ${isMe ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-black rounded-[1.8rem] rounded-br-[0.5rem]' : 'bg-white/5 border border-white/10 text-white/90 rounded-[1.8rem] rounded-bl-[0.5rem] backdrop-blur-md'}`}>
                        <p className={`text-[15px] leading-relaxed ${isMe ? 'font-semibold' : 'font-normal'}`}>{msgContent}</p>
                        {msg.attachment ? (
                          <a href={msg.attachment} target="_blank" rel="noopener noreferrer" className={`mt-3 block text-[13px] font-bold underline ${isMe ? 'text-black/85' : 'text-emerald-400'}`}>
                            📎 Załącznik
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 mt-2 ${isMe ? 'mr-3' : 'ml-11'}`}>
                      {isMe && (
                        msg.pending ? (
                          <Loader2 size={12} className="text-white/30 animate-spin" />
                        ) : msg.isRead ? (
                          <span className="text-[9px] font-bold text-blue-400 flex items-center gap-1"><CheckCheck size={12} /> Odczytano</span>
                        ) : (
                          <span className="text-[9px] font-bold text-white/40 flex items-center gap-1"><Check size={12} /> Dostarczono</span>
                        )
                      )}
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        {new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {isTyping && (
                <motion.div key="typing-indicator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 ml-1">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-white/50">{otherParty?.name?.charAt(0) || '👤'}</span>
                  </div>
                  <div className="px-5 py-4 bg-white/5 border border-white/10 rounded-[1.8rem] rounded-bl-[0.5rem] flex gap-1.5">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 md:p-6 md:pb-8 relative z-20 bg-gradient-to-t from-[#080808] via-[#080808] to-transparent shrink-0 border-t border-white/5">
        {isFinalized ? (
          <div className="relative max-w-4xl mx-auto space-y-4">
            <DealRoomPostSaleReview
              dealId={dealId}
              currentUserId={currentUserId}
              counterparty={{
                id: Number(otherParty?.id || (isBuyer ? deal.sellerId : deal.buyerId)),
                name: otherParty?.name,
                email: otherParty?.email,
              }}
              myReviewSubmitted={Boolean(deal?.myReviewSubmitted)}
              partnerReviewVisible={Boolean(deal?.partnerReviewVisible)}
              partnerReview={
                deal?.partnerReview
                  ? {
                      rating: Number(deal.partnerReview.rating || 0),
                      comment: deal.partnerReview.comment,
                    }
                  : null
              }
              reviewRevealUnlocked={Boolean(deal?.reviewRevealUnlocked)}
              authHeaders={authHeaders}
              onUpdated={() => void refetchDealAndMessages()}
            />
            <div className="rounded-[2rem] border border-white/10 bg-[#111] px-5 py-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] font-black text-white/45">Tryb tylko do odczytu</p>
              <p className="text-sm text-white/75 mt-1">Ten DealRoom jest zamknięty po finalizacji — czat pozostaje archiwum rozmowy.</p>
            </div>
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
            className="w-10 h-10 shrink-0 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-[1.2rem] flex items-center justify-center text-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:grayscale transition-all duration-300 shadow-[0_5px_15px_rgba(16,185,129,0.4)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          >
            {isSending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="ml-0.5 text-white drop-shadow-md" />}
          </button>
        </form>
        )}
      </div>

      <AnimatePresence>
        {bidActionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0d] p-6 shadow-2xl">
              <h4 className="text-white font-black text-lg mb-2 leading-tight">Decyzja negocjacyjna — cena</h4>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                {bidActionModal.action === 'ACCEPT' && isFinalizationReady && `Sfinalizujesz sprzedaż za ${Number(activeBid?.amount || 0).toLocaleString('pl-PL')} PLN. Oferta zostanie zdjęta z rynku.`}
                {bidActionModal.action === 'ACCEPT' && ownerNeedsFinalDecision && `Potwierdzasz ostateczną sprzedaż za ${Number(activeBid?.amount || finalAcceptanceContext?.amount || 0).toLocaleString('pl-PL')} PLN.`}
                {bidActionModal.action === 'ACCEPT' && !isFinalizationReady && !ownerNeedsFinalDecision && isBuyer && `Zgadzasz się na ${Number(activeBid?.amount || 0).toLocaleString('pl-PL')} PLN. Właściciel musi jeszcze potwierdzić sprzedaż.`}
                {bidActionModal.action === 'ACCEPT' && !isFinalizationReady && !ownerNeedsFinalDecision && !isBuyer && `Akceptujesz propozycję ${Number(activeBid?.amount || 0).toLocaleString('pl-PL')} PLN (cena uzgodniona, bez finalizacji).`}
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
                    let action = bidActionModal.action;
                    const bidAmount = Number(activeBid?.amount || 0);
                    const opts: { counterAmount?: number; message?: string; intent?: string } = {};

                    if (action === 'ACCEPT' && isBuyer && !dealPriceAgreed && !ownerNeedsFinalDecision && bidAmount > 0) {
                      action = 'COUNTER';
                      opts.counterAmount = bidAmount;
                      opts.message = BUYER_ACCEPT_OWNER_PRICE_NOTE;
                      opts.intent = 'FINAL_ACCEPTANCE';
                    } else if (action === 'COUNTER') {
                      opts.counterAmount = numeric;
                    }

                    await respondBid(bidActionModal.bidId, action, opts);
                    if (
                      action === 'ACCEPT' &&
                      isListingOwner &&
                      (ownerNeedsFinalDecision || isFinalizationReady)
                    ) {
                      await finalizeDealSale();
                    }
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className={`w-full rounded-3xl border border-white/10 bg-[#0b0b0d] p-6 shadow-2xl ${appointmentActionModal.action === 'RESCHEDULE' ? 'max-w-lg' : 'max-w-md'}`}>
              <h4 className="text-white font-black text-lg mb-2 leading-tight">Decyzja negocjacyjna — termin</h4>
              {appointmentActionModal.action === 'RESCHEDULE' ? (
                <DealRoomAppointmentPicker
                  loading={!!actionLoading}
                  onCancel={() => setAppointmentActionModal(null)}
                  onSubmit={async (isoDate, note) => {
                    await respondAppointment(appointmentActionModal.appointmentId, 'RESCHEDULE', {
                      proposedDate: isoDate,
                      message: note || undefined,
                    });
                    setAppointmentActionModal(null);
                  }}
                />
              ) : (
                <>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">
                    {appointmentActionModal.action === 'ACCEPT' && `Akceptujesz termin: ${activeAppointment?.proposedDate ? new Date(activeAppointment.proposedDate).toLocaleString('pl-PL') : '-'}.`}
                    {appointmentActionModal.action === 'DECLINE' && 'Odrzucasz zaproponowany termin.'}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setAppointmentActionModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-white/70 text-xs font-black uppercase tracking-widest">Anuluj</button>
                    <button
                      disabled={!!actionLoading}
                      onClick={async () => {
                        await respondAppointment(appointmentActionModal.appointmentId, appointmentActionModal.action);
                        setAppointmentActionModal(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase tracking-widest disabled:opacity-40"
                    >
                      Potwierdź
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
