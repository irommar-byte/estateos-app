"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import {
  formatContactBytes,
  isAllowedContactAttachment,
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
  parseContactMessageParts,
  formatContactLastMessagePreview,
  CONTACT_ATTACHMENT_PREFIX,
} from "@/lib/contactAttachmentShared";
import {
  ContactMessageRow,
  ContactThreadAttachmentsInfo,
  ContactThreadRow,
  dispatchContactUnreadRefresh,
  fetchContactAttachmentsWeb,
  fetchContactMessagesWeb,
  fetchContactThreadsWeb,
  initContactThreadWeb,
  sendContactMessageWeb,
  sendContactTypingWeb,
  uploadContactAttachmentWeb,
} from "@/lib/contactServiceWeb";

type CurrentUser = { id: number; name?: string | null };

const ACCEPTED_FILE_TYPES =
  "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.gif,.mp3,.mp4,.mov,.webm";

/** Kolejne wiadomości jednej osoby w tym odstępie tworzą jedną grupę (jeden podpis z godziną). */
const GROUP_GAP_MS = 5 * 60_000;
const GOLD = "#a8844c";

function initials(name: string | null | undefined): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Dziś";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Godzina z dziś, „wczoraj” albo data — jak na liście rozmów w telefonie. */
function listTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const label = dayLabel(iso);
  if (label === "Dziś") return hm(iso);
  if (label === "Wczoraj") return "wczoraj";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function presence(thread: ContactThreadRow): { online: boolean; text: string } {
  if (thread.peerIsOnline ?? thread.peer?.isOnline) return { online: true, text: "Teraz online" };
  const iso = thread.peerLastSeenAt ?? thread.peer?.lastSeenAt;
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return { online: false, text: "Offline" };
  const label = dayLabel(iso);
  const when = label === "Dziś" ? `dziś o ${hm(iso)}` : label === "Wczoraj" ? `wczoraj o ${hm(iso)}` : `${listTime(iso)} o ${hm(iso)}`;
  return { online: false, text: `Był(a) online ${when}` };
}

function preview(thread: ContactThreadRow): string {
  const raw = String(thread.lastMessage || "");
  if (!raw) return "Rozpocznij rozmowę";
  if (raw.includes(CONTACT_ATTACHMENT_PREFIX)) return formatContactLastMessagePreview({ content: raw }) || "Załącznik";
  return raw;
}

function Avatar({ thread, size = 44 }: { thread: ContactThreadRow; size?: number }) {
  const online = Boolean(thread.peerIsOnline ?? thread.peer?.isOnline);
  const [broken, setBroken] = useState(false);
  const image = broken ? null : thread.peer?.image;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex size-full items-center justify-center overflow-hidden rounded-full border border-[var(--eos-border)] bg-[linear-gradient(145deg,#f4ebda,#e2d2b4)] text-[13px] font-semibold tracking-wide text-[#5c4626]"
        style={{ fontSize: Math.round(size * 0.32) }}
      >
        {image ? (
          <img src={image} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
        ) : (
          initials(thread.peerUserName)
        )}
      </span>
      {online ? (
        <span
          className="eos-online absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--eos-card)]"
          aria-label="Online"
        />
      ) : null}
    </span>
  );
}

export default function ContactInboxClient({
  currentUser,
  basePath = "/moje-konto/wiadomosci",
  embedded = false,
}: {
  currentUser: CurrentUser;
  /** Adres, pod którym działa skrzynka (osobna strona albo zakładka CRM). */
  basePath?: string;
  /** Wewnątrz CRM: bez własnego nagłówka i przycisku „Wróć”. */
  embedded?: boolean;
}) {
  const withQuery = (q: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}${q}`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<ContactThreadRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [findError, setFindError] = useState<string | null>(null);
  const [findLoading, setFindLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachmentsInfo, setAttachmentsInfo] = useState<ContactThreadAttachmentsInfo | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const typingRef = useRef<number | null>(null);
  const isUserScrolling = useRef(false);
  const prevMsgCount = useRef(0);
  const initializedScroll = useRef(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const showMobileChat = activeThreadId != null;

  const usageBytes = attachmentsInfo?.usageBytes ?? 0;
  const limitBytes = attachmentsInfo?.limitBytes ?? MAX_CONTACT_THREAD_BYTES;
  const attachmentCount = attachmentsInfo?.attachments?.length ?? 0;

  const q = query.trim().toLowerCase();
  const idQuery = /^\d+$/.test(q) ? Number(q) : null;
  const visibleThreads = useMemo(
    () => (q && idQuery == null ? threads.filter((t) => t.peerUserName.toLowerCase().includes(q)) : threads),
    [threads, q, idQuery]
  );

  const flash = useCallback((text: string) => setNotice(text), []);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const handlePageBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/moje-konto");
  }, [router]);

  const handleMobileChatBack = useCallback(() => {
    const from = searchParams.get("from");
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (from) {
      router.push(from);
      return;
    }
    router.replace(basePath);
  }, [router, searchParams, basePath]);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isUserScrolling.current = false;
    setShowScrollBottom(false);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolling.current = distance > 100;
    setShowScrollBottom(distance > 100);
  }, []);

  const loadAttachmentsInfo = useCallback(async (threadId: number) => {
    setLoadingAttachments(true);
    try {
      setAttachmentsInfo(await fetchContactAttachmentsWeb(threadId));
    } catch {
      setAttachmentsInfo(null);
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const { threads: rows } = await fetchContactThreadsWeb();
      setThreads(rows);
      dispatchContactUnreadRefresh();
      return rows;
    } catch {
      setThreads([]);
      return [];
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const openThread = useCallback(
    async (threadId: number) => {
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      setAttachmentsOpen(false);
      setConfirmDelete(false);
      initializedScroll.current = false;
      prevMsgCount.current = 0;
      try {
        const data = await fetchContactMessagesWeb(threadId);
        setMessages(data.messages);
        setIsTyping(Boolean(data.isTyping));
        dispatchContactUnreadRefresh();
        await Promise.all([loadThreads(), loadAttachmentsInfo(threadId)]);
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadAttachmentsInfo, loadThreads]
  );

  const navigateToThread = useCallback(
    (threadId: number, peerUserId: number) => {
      // Otwarcie rozmowy robi efekt na zmianę adresu — tu tylko nawigujemy.
      if (threadId === activeThreadId) return;
      router.push(withQuery(`thread=${threadId}&peer=${peerUserId}`));
    },
    [activeThreadId, router, basePath] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    // Blokada przewijania strony tylko w osobnym, pełnoekranowym widoku — w CRM strona ma się przewijać normalnie.
    if (embedded) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [embedded]);

  useEffect(() => {
    const threadParam = Number(searchParams.get("thread"));
    const peerParam = Number(searchParams.get("peer"));

    void (async () => {
      const rows = await loadThreads();
      if (Number.isFinite(threadParam) && threadParam > 0) {
        await openThread(threadParam);
        return;
      }
      if (Number.isFinite(peerParam) && peerParam > 0) {
        const existing = rows.find((t) => t.peerUserId === peerParam);
        if (existing) {
          await openThread(existing.id);
          return;
        }
        try {
          const created = await initContactThreadWeb(peerParam);
          await loadThreads();
          await openThread(created.id);
        } catch {
          /* handled on write button path */
        }
        return;
      }
      setActiveThreadId(null);
      setMessages([]);
      setAttachmentsInfo(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!activeThreadId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || sendingRef.current) return;
      void fetchContactMessagesWeb(activeThreadId)
        .then((data) => {
          // Nie nadpisuj wiadomości wysyłanej w tej chwili (zniknęłaby na moment z ekranu).
          if (sendingRef.current) return;
          setMessages(data.messages);
          setIsTyping(Boolean(data.isTyping));
        })
        .catch(() => undefined);
      void loadThreads();
    }, 8_000);
    return () => window.clearInterval(id);
  }, [activeThreadId, loadThreads]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadThreads();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [loadThreads]);

  useEffect(() => {
    const currentCount = messages.length;
    if (!initializedScroll.current && currentCount > 0 && !loadingMessages) {
      window.setTimeout(() => scrollChatToBottom("auto"), 80);
      initializedScroll.current = true;
      prevMsgCount.current = currentCount;
      return;
    }
    if (currentCount > prevMsgCount.current && !isUserScrolling.current) {
      window.setTimeout(() => scrollChatToBottom("smooth"), 80);
    }
    prevMsgCount.current = currentCount;
  }, [messages, isTyping, loadingMessages, scrollChatToBottom]);

  // Pole wiadomości rośnie razem z tekstem (do kilku linii).
  useEffect(() => {
    const el = draftInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const handleJumpToBottom = () => {
    scrollChatToBottom("smooth");
    window.setTimeout(() => draftInputRef.current?.focus(), 120);
  };

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CONTACT_FILE_BYTES) {
      flash(`Plik jest za duży — do ${formatContactBytes(MAX_CONTACT_FILE_BYTES)} na załącznik.`);
      return;
    }
    if (!isAllowedContactAttachment(file.type, file.name)) {
      flash("Tego typu pliku nie można wysłać.");
      return;
    }
    if (usageBytes + file.size > limitBytes) {
      flash(`W tej rozmowie zostało ${formatContactBytes(Math.max(0, limitBytes - usageBytes))} na załączniki.`);
      return;
    }
    setPendingFile(file);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeThreadId || sending || uploading) return;
    const content = draft.trim();
    const fileSnapshot = pendingFile;
    if (!content && !fileSnapshot) return;

    setSending(true);
    sendingRef.current = true;
    setDraft("");
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const optimistic: ContactMessageRow = {
      id: -Date.now(),
      threadId: activeThreadId,
      senderId: currentUser.id,
      content: content || (fileSnapshot ? `📎 ${fileSnapshot.name}` : ""),
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    isUserScrolling.current = false;
    scrollChatToBottom("smooth");

    try {
      let attachmentMeta = null;
      if (fileSnapshot) {
        setUploading(true);
        attachmentMeta = await uploadContactAttachmentWeb(activeThreadId, fileSnapshot);
        setUploading(false);
      }
      const saved = await sendContactMessageWeb(activeThreadId, content, attachmentMeta);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
      await Promise.all([loadThreads(), fileSnapshot ? loadAttachmentsInfo(activeThreadId) : null]);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      if (fileSnapshot) setPendingFile(fileSnapshot);
      flash(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości.");
    } finally {
      sendingRef.current = false;
      setSending(false);
      setUploading(false);
    }
  };

  const startById = async (peerId: number) => {
    setFindError(null);
    if (peerId === currentUser.id) {
      setFindError("To Twoje konto.");
      return;
    }
    const existing = threads.find((t) => t.peerUserId === peerId);
    if (existing) {
      setQuery("");
      navigateToThread(existing.id, peerId);
      return;
    }
    setFindLoading(true);
    try {
      const thread = await initContactThreadWeb(peerId);
      await loadThreads();
      setQuery("");
      navigateToThread(thread.id, peerId);
    } catch (err: unknown) {
      setFindError(err instanceof Error ? err.message : "Nie ma użytkownika o takim ID.");
    } finally {
      setFindLoading(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!activeThreadId) return;
    try {
      const res = await fetch(`/api/contact/threads/${activeThreadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się usunąć rozmowy."));
      setActiveThreadId(null);
      setMessages([]);
      setAttachmentsInfo(null);
      setConfirmDelete(false);
      router.replace(basePath);
      await loadThreads();
    } catch (err: unknown) {
      setConfirmDelete(false);
      flash(err instanceof Error ? err.message : "Nie udało się usunąć rozmowy.");
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!activeThreadId) return;
    if (typingRef.current != null) window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => {
      void sendContactTypingWeb(activeThreadId);
    }, 350);
  };

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].senderId === currentUser.id) return messages[i].id;
    return null;
  }, [messages, currentUser.id]);

  const activePresence = activeThread ? presence(activeThread) : null;

  return (
    <div
      className={
        embedded
          ? "flex h-[calc(100dvh-14rem)] min-h-[560px] flex-col gap-3 overflow-hidden"
          : "theme-aware-dashboard mx-auto flex h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] max-w-6xl flex-col gap-3 overflow-hidden px-4 py-4 md:py-6"
      }
    >
      {embedded ? null : (
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handlePageBack}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            aria-label="Wróć"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
              EstateOS™
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--eos-text)] md:text-2xl">Wiadomości</h1>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_24px_60px_-30px_rgba(21,23,26,0.25)] md:grid-cols-[minmax(0,330px)_1fr]">
        {/* ── Lista rozmów ── */}
        <aside
          className={`min-h-0 flex-col border-[var(--eos-border)] md:border-r ${showMobileChat ? "hidden md:flex" : "flex"}`}
        >
          <div className="shrink-0 px-4 pb-3 pt-4">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                if (idQuery) void startById(idQuery);
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--eos-subtle)]" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFindError(null);
                }}
                placeholder="Szukaj osoby albo wpisz ID"
                className="w-full rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] py-2.5 pl-10 pr-9 text-[14px] text-[var(--eos-text)] outline-none transition placeholder:text-[var(--eos-subtle)] focus:border-[#a8844c]/50"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
                  aria-label="Wyczyść"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </form>
            {idQuery ? (
              <button
                type="button"
                disabled={findLoading}
                onClick={() => void startById(idQuery)}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#a8844c]/35 bg-[#a8844c]/8 px-3 py-2.5 text-left transition hover:bg-[#a8844c]/12 disabled:opacity-60"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-[var(--eos-text)] text-[var(--eos-bg)]">
                  {findLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--eos-text)]">Napisz do ID {idQuery}</span>
                  <span className="block text-[11.5px] text-[var(--eos-muted)]">Otworzy rozmowę z tym użytkownikiem</span>
                </span>
              </button>
            ) : null}
            {findError ? <p className="mt-2 text-[12px] text-[var(--lux-danger,#b93a26)]">{findError}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
            {loadingThreads ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="size-5 animate-spin" style={{ color: GOLD }} />
              </div>
            ) : visibleThreads.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] leading-relaxed text-[var(--eos-muted)]">
                {threads.length
                  ? "Nikt o takim imieniu."
                  : "Nie masz jeszcze rozmów. Wpisz ID użytkownika albo kliknij „Napisz” przy ofercie."}
              </p>
            ) : (
              visibleThreads.map((thread) => {
                const unread = Number(thread.unread ?? thread.unreadCount ?? 0);
                const selected = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => navigateToThread(thread.id, thread.peerUserId)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors ${
                      selected ? "bg-[var(--eos-text)]/[0.06]" : "hover:bg-[var(--eos-input)]"
                    }`}
                  >
                    <Avatar thread={thread} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[14.5px] text-[var(--eos-text)] ${unread ? "font-bold" : "font-semibold"}`}>
                          {thread.peerUserName}
                        </span>
                        <span className={`shrink-0 text-[11.5px] ${unread ? "font-semibold" : "text-[var(--eos-subtle)]"}`} style={unread ? { color: GOLD } : undefined}>
                          {listTime(thread.updatedAt || thread.time)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-[13px] ${unread ? "font-medium text-[var(--eos-text)]" : "text-[var(--eos-muted)]"}`}>
                          {preview(thread)}
                        </span>
                        {unread > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold text-white" style={{ background: GOLD }}>
                            {unread > 9 ? "9+" : unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Rozmowa ── */}
        <motion.section
          key={activeThreadId ?? "inbox-empty"}
          initial={{ x: "100%", opacity: 0.98 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          className={`eos-contact-panel relative flex min-h-0 min-w-0 flex-col bg-[var(--eos-bg)] md:!transform-none md:!opacity-100 ${
            showMobileChat ? "fixed inset-0 z-30 flex md:relative md:inset-auto md:z-auto" : "hidden md:flex"
          }`}
        >
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <span className="flex size-16 items-center justify-center rounded-full border border-[#a8844c]/30 bg-[var(--eos-card)] shadow-[0_14px_34px_-18px_rgba(21,23,26,0.35)]">
                <MessageCircle className="size-6" style={{ color: GOLD }} />
              </span>
              <div>
                <p className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">Wybierz rozmowę</p>
                <p className="mt-1 max-w-xs text-[13.5px] leading-relaxed text-[var(--eos-muted)]">
                  Klienci, agenci i kupujący w jednym miejscu — z plikami i potwierdzeniem odczytu.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="shrink-0 border-b border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-3 md:px-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleMobileChatBack}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--eos-muted)] hover:bg-[var(--eos-input)] md:hidden"
                    aria-label="Wróć do listy rozmów"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <Avatar thread={activeThread} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold tracking-tight text-[var(--eos-text)]">
                      {activeThread.peerUserName}
                    </p>
                    <p className={`truncate text-[12px] ${activePresence?.online ? "font-medium text-[#23855a]" : "text-[var(--eos-subtle)]"}`}>
                      {isTyping ? "pisze…" : activePresence?.text}
                    </p>
                  </div>
                  {confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="hidden text-[12.5px] text-[var(--eos-muted)] sm:inline">Usunąć rozmowę?</span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteThread()}
                        className="rounded-full bg-[#b93a26] px-3 py-1.5 text-[12px] font-semibold text-white"
                      >
                        Usuń
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--eos-text)]"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAttachmentsOpen((v) => !v)}
                        aria-expanded={attachmentsOpen}
                        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition ${
                          attachmentsOpen
                            ? "border-[var(--eos-text)] bg-[var(--eos-text)] text-[var(--eos-bg)]"
                            : "border-[var(--eos-border)] text-[var(--eos-text)] hover:bg-[var(--eos-input)]"
                        }`}
                      >
                        <Paperclip className="size-3.5" />
                        <span className="hidden sm:inline">Pliki</span>
                        {attachmentCount ? <span className="opacity-70">{attachmentCount}</span> : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex size-9 items-center justify-center rounded-full text-[var(--eos-subtle)] transition hover:bg-[#b93a26]/10 hover:text-[#b93a26]"
                        aria-label="Usuń rozmowę"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </header>

              <AnimatePresence>
                {attachmentsOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="shrink-0 overflow-hidden border-b border-[var(--eos-border)] bg-[var(--eos-card)]"
                  >
                    <div className="max-h-56 overflow-y-auto px-4 py-3 custom-scrollbar md:px-5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[11.5px] text-[var(--eos-subtle)]">
                        <span>Pliki w tej rozmowie</span>
                        <span>
                          {formatContactBytes(usageBytes)} z {formatContactBytes(limitBytes)} · do{" "}
                          {formatContactBytes(MAX_CONTACT_FILE_BYTES)} na plik
                        </span>
                      </div>
                      {loadingAttachments && !attachmentsInfo ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--eos-subtle)]">
                          <Loader2 className="size-4 animate-spin" /> Wczytuję…
                        </div>
                      ) : !attachmentCount ? (
                        <p className="text-[12.5px] text-[var(--eos-muted)]">Nikt jeszcze nie wysłał pliku. Dodasz go plusem przy polu wiadomości.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {attachmentsInfo!.attachments.map((att) => (
                            <a
                              key={`${att.messageId}-${att.url}`}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 transition hover:border-[#a8844c]/40"
                            >
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#a8844c]/12" style={{ color: GOLD }}>
                                <FileText className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-semibold text-[var(--eos-text)]">{att.name}</span>
                                <span className="block text-[11px] text-[var(--eos-subtle)]">
                                  {formatContactBytes(att.size)} · {listTime(att.createdAt)}
                                </span>
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-8 custom-scrollbar"
              >
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin" style={{ color: GOLD }} />
                  </div>
                ) : !messages.length ? (
                  <p className="py-16 text-center text-[13.5px] text-[var(--eos-muted)]">
                    Napisz pierwszą wiadomość do {activeThread.peerUserName.split(" ")[0]}.
                  </p>
                ) : (
                  <div className="mx-auto max-w-3xl">
                    <AnimatePresence initial={false}>
                      {messages.map((msg, i) => {
                        const isMe = msg.senderId === currentUser.id;
                        const prev = messages[i - 1];
                        const next = messages[i + 1];
                        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt);
                        const groupStart =
                          newDay ||
                          prev.senderId !== msg.senderId ||
                          new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
                        const groupEnd =
                          !next ||
                          next.senderId !== msg.senderId ||
                          dayKey(next.createdAt) !== dayKey(msg.createdAt) ||
                          new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > GROUP_GAP_MS;
                        const { text, attachment } = parseContactMessageParts(msg);
                        const corner = isMe
                          ? `rounded-br-md ${groupStart ? "" : "rounded-tr-md"}`
                          : `rounded-bl-md ${groupStart ? "" : "rounded-tl-md"}`;
                        return (
                          <Fragment key={msg.id || i}>
                            {newDay ? (
                              <div className="my-5 flex items-center gap-3 first:mt-0">
                                <span className="h-px flex-1 bg-[var(--eos-border)]" />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--eos-subtle)]">
                                  {dayLabel(msg.createdAt)}
                                </span>
                                <span className="h-px flex-1 bg-[var(--eos-border)]" />
                              </div>
                            ) : null}
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} ${groupStart ? "mt-3" : "mt-1"}`}
                            >
                              {!isMe ? (
                                <span className="w-8 shrink-0">
                                  {groupEnd ? <Avatar thread={activeThread} size={32} /> : null}
                                </span>
                              ) : null}
                              <div className={`flex max-w-[82%] flex-col md:max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
                                <div
                                  className={`rounded-[20px] px-4 py-2.5 ${corner} ${
                                    isMe ? "eos-chat-bubble eos-chat-bubble--me" : "eos-chat-bubble eos-chat-bubble--peer"
                                  } ${msg.id < 0 ? "opacity-70" : ""}`}
                                >
                                  {text ? (
                                    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.45]">{text}</p>
                                  ) : null}
                                  {attachment ? <ContactAttachmentBubble attachment={attachment} isMe={isMe} /> : null}
                                </div>
                                {groupEnd ? (
                                  <span className="mt-1 flex items-center gap-1 px-1 text-[10.5px] text-[var(--eos-subtle)]">
                                    {hm(msg.createdAt)}
                                    {isMe && msg.id === lastMineId ? (
                                      msg.id < 0 ? (
                                        <> · wysyłam…</>
                                      ) : msg.isRead ? (
                                        <>
                                          {" · "}
                                          <CheckCheck className="size-3" style={{ color: GOLD }} />
                                          <span style={{ color: GOLD }}>Przeczytane</span>
                                        </>
                                      ) : (
                                        <>
                                          {" · "}
                                          <Check className="size-3" /> Dostarczone
                                        </>
                                      )
                                    ) : null}
                                  </span>
                                ) : null}
                              </div>
                            </motion.div>
                          </Fragment>
                        );
                      })}
                      {isTyping ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-end gap-2">
                          <Avatar thread={activeThread} size={32} />
                          <div className="flex gap-1.5 rounded-[20px] rounded-bl-md border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3.5">
                            {[0, 0.2, 0.4].map((delay) => (
                              <motion.span
                                key={delay}
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay }}
                                className="size-1.5 rounded-full bg-[#a8844c]/70"
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )}

                <AnimatePresence>
                  {showScrollBottom ? (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={handleJumpToBottom}
                      className="sticky bottom-2 left-1/2 z-10 mx-auto flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] shadow-[0_10px_30px_-10px_rgba(21,23,26,0.4)]"
                      aria-label="Przewiń do najnowszych"
                    >
                      <ArrowDown className="size-4" style={{ color: GOLD }} />
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>

              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-[var(--eos-border)] bg-[var(--eos-card)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:px-6"
              >
                <AnimatePresence>
                  {notice ? (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mx-auto mb-2 max-w-3xl rounded-xl bg-[#b93a26]/10 px-3 py-2 text-[12.5px] text-[#b93a26]"
                    >
                      {notice}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                {pendingFile ? (
                  <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-2xl border border-[#a8844c]/30 bg-[#a8844c]/8 px-3 py-2">
                    <Paperclip className="size-4 shrink-0" style={{ color: GOLD }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--eos-text)]">{pendingFile.name}</span>
                      <span className="block text-[11px] text-[var(--eos-muted)]">{formatContactBytes(pendingFile.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="flex size-7 items-center justify-center rounded-full text-[var(--eos-muted)] hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
                      aria-label="Usuń załącznik"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}

                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[26px] border border-[var(--eos-border)] bg-[var(--eos-bg)] p-1.5 transition focus-within:border-[#a8844c]/50 focus-within:shadow-[0_0_0_4px_rgba(168,132,76,0.1)]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploading}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--eos-muted)] transition hover:bg-[var(--eos-input)] hover:text-[#a8844c] disabled:opacity-40"
                    aria-label="Dodaj plik"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                  </button>
                  <textarea
                    ref={draftInputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Napisz wiadomość…"
                    className="max-h-40 min-w-0 flex-1 resize-none !rounded-none !border-0 !bg-transparent px-1 py-2.5 !shadow-none !ring-0 text-[14.5px] leading-[1.4] text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)]"
                  />
                  <button
                    type="submit"
                    disabled={(!draft.trim() && !pendingFile) || sending || uploading}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--eos-text)] text-[var(--eos-bg)] transition hover:opacity-90 disabled:opacity-25"
                    aria-label="Wyślij"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.section>
      </div>
    </div>
  );
}
