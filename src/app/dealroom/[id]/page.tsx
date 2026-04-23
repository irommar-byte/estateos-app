"use client";
import { use, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Send, Lock, FileText, ArrowLeft, Loader2, Paperclip, Download, Eye, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function DealRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/dealroom/messages?dealId=${dealId}`);
      if (res.ok) setMessages(await res.json());
    } catch(e) {}
  };

  useEffect(() => {
    fetch('/api/auth/check').then(r => r.json()).then(d => { if(d.loggedIn) setCurrentUser(d.user); });
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [dealId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/dealroom/messages', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ dealId, text: text.trim() }) 
      });
      if (res.ok) { setText(""); fetchMessages(); }
    } catch(e) {} finally { setIsSending(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("files", file);
    
    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (uploadRes.ok) {
          const dataU = await uploadRes.json();
          const url = dataU.images[0];
          
          // Kluczowa poprawka: Wysyłamy wiadomość nawet jeśli pole tekstowe jest puste
          await fetch('/api/dealroom/messages', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              dealId, 
              text: text.trim() || `Przesłano plik: ${file.name}`, 
              attachmentUrl: url,
              attachmentType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
            }) 
          });
          setText("");
          fetchMessages();
      } else {
          alert("Błąd przesyłania dokumentu.");
      }
    } catch(err) {
      alert("Błąd połączenia.");
    } finally {
      setIsUploading(false);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!currentUser) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-24 pb-10 px-4 md:px-0">
      
      {/* HEADER */}
      <div className="w-full max-w-4xl bg-[#0a0a0a] border border-emerald-500/30 rounded-t-[2.5rem] p-6 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative overflow-hidden shrink-0 flex flex-col md:flex-row items-center justify-between gap-4 z-10">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-bl-full pointer-events-none blur-2xl"></div>
         <div className="flex items-center gap-4 relative z-10">
            <Link href="/moje-konto/crm" className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"><ArrowLeft size={18}/></Link>
            <div>
               <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5"><Lock size={10}/> Szyfrowany Pokój Negocjacji</span>
               </div>
               <h1 className="text-2xl md:text-3xl font-black tracking-tighter">Deal Room <span className="text-white/20">#{dealId.slice(-4)}</span></h1>
            </div>
         </div>
         <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-3 rounded-full flex items-center gap-3 relative z-10">
            <CheckCircle2 size={20} className="text-emerald-500 animate-pulse"/>
            <div>
               <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest">Wymiana Dokumentów</p>
               <p className="text-sm font-black text-emerald-500">Aktywna</p>
            </div>
         </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="w-full max-w-4xl flex-1 bg-[#0d0d0d] border-x border-white/5 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar relative">
         {messages.map((msg, idx) => {
            const isMe = String(msg.senderId) === String(currentUser.id);
            const isDoc = msg.attachmentUrl && (msg.attachmentUrl.toLowerCase().endsWith('.pdf') || msg.attachmentType?.includes('pdf'));

            return (
              <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                 <span className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-black mb-2 px-2">{isMe ? 'Ty' : msg.senderName || 'Uczestnik'}</span>
                 
                 <div className={`group relative flex flex-col gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* BĄBELEK TEKSTU */}
                    {msg.text && (
                      <div className={`px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-xl ${isMe ? 'bg-emerald-500 text-black rounded-tr-sm font-medium' : 'bg-[#1a1a1a] text-white border border-white/10 rounded-tl-sm'}`}>
                         {msg.text}
                      </div>
                    )}

                    {/* DOKUMENT / PDF */}
                    {msg.attachmentUrl && isDoc && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-4 p-5 rounded-3xl border transition-all hover:scale-[1.02] shadow-2xl ${isMe ? 'bg-[#111] border-emerald-500/40' : 'bg-[#111] border-white/10'}`}>
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isMe ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-white/50'}`}>
                            <FileText size={24} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white uppercase tracking-widest truncate">Dokument PDF / Umowa</p>
                            <p className="text-[10px] text-white/40 mt-1">Kliknij, aby otworzyć podgląd</p>
                         </div>
                         <Download size={18} className="text-white/20 group-hover:text-white transition-colors ml-2" />
                      </a>
                    )}

                    {/* OBRAZ / SKAN */}
                    {msg.attachmentUrl && !isDoc && (
                      <div className="relative group/img overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                         <img src={msg.attachmentUrl} alt="Załącznik" className="max-w-full h-auto md:max-w-[300px] object-cover transition-transform duration-500 group-hover/img:scale-105" />
                         <a href={msg.attachmentUrl} target="_blank" className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <Eye size={20} className="text-white" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Powiększ skan</span>
                         </a>
                      </div>
                    )}
                 </div>
                 <span className="text-[8px] text-white/10 mt-2 font-mono px-2">{new Date(msg.createdAt).toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'})}</span>
              </motion.div>
            )
         })}
         <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-b-[2.5rem] p-4 shrink-0 shadow-2xl relative">
          <AnimatePresence>
            {isUploading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                 <Loader2 size={14} className="animate-spin" /> Przesyłanie dokumentu do deal roomu...
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSend} className="flex items-center gap-3 bg-[#111] p-2 rounded-full border border-white/5 focus-within:border-emerald-500/50 transition-all">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,image/*" className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-12 h-12 flex items-center justify-center text-white/30 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-full transition-all disabled:opacity-50 shrink-0">
               <Paperclip size={22} />
            </button>

            <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Napisz do uczestnika lub dołącz dokument..." className="flex-1 bg-transparent px-4 text-sm outline-none text-white placeholder:text-white/20" />
            
            <button type="submit" disabled={isSending || !text.trim()} className="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/20 text-black rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:shadow-none shrink-0 group">
               {isSending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} className="ml-1 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"/>}
            </button>
          </form>
      </div>
    </main>
  );
}
