'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Check, Eye, Heading, Italic, List, Minus, Pencil, Redo2, Smile, Underline, Undo2 } from 'lucide-react';
import OfferDescriptionBody from '@/components/offer/OfferDescriptionBody';
import { listingDescriptionToSafeHtml } from '@/lib/offerDescriptionHtml';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

const EMOJI_PRESETS = ['🏠', '🌳', '🚗', '✅', '📍', '☀️', '🛗', '🅿️', '✨', '💎', '🌿', '🏡'];

function run(command: string, value?: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

function sync(ref: React.RefObject<HTMLDivElement | null>, onChange: (html: string) => void, fromSelf: React.MutableRefObject<boolean>) {
  fromSelf.current = true;
  onChange(ref.current?.innerHTML || '');
}

export default function ListingDescriptionEditor({ value, onChange, placeholder, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fromSelf = useRef(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (!ref.current || mode !== 'edit') return;
    const next = value || '';
    if (fromSelf.current) {
      fromSelf.current = false;
      return;
    }
    if (ref.current.innerHTML === next) return;
    ref.current.innerHTML = next;
  }, [value, mode]);

  const apply = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
    fn();
    sync(ref, onChange, fromSelf);
  };

  const insertChecklist = () => {
    const root = ref.current;
    if (!root) return;
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    if (anchor && root.contains(anchor)) {
      const li = (anchor as HTMLElement).closest?.('li[data-kind="check"]');
      if (li) {
        const ul = li.parentElement;
        li.remove();
        if (ul && ul.tagName === 'UL' && ul.children.length === 0) ul.remove();
        return;
      }
    }
    run('insertHTML', '<ul><li data-kind="check">&nbsp;</li></ul>');
  };

  const insertEmoji = (emoji: string) => {
    run('insertText', emoji);
    setEmojiOpen(false);
  };

  const previewHtml = listingDescriptionToSafeHtml(value);

  return (
    <div className={`overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.18)] transition-colors focus-within:border-[#10b981] ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/35 px-3 py-2.5">
        <div className="inline-flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] transition-colors ${mode === 'edit' ? 'bg-emerald-500/15 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Pencil size={13} />
            Edytuj
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] transition-colors ${mode === 'preview' ? 'bg-emerald-500/15 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Eye size={13} />
            Podgląd
          </button>
        </div>
        <span className="text-[11px] font-medium tabular-nums text-zinc-500">EstateOS Editorial</span>
      </div>

      {mode === 'edit' ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/40 p-2.5">
            <button type="button" title="Pogrubienie" onMouseDown={apply(() => run('bold'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Bold size={16} />
            </button>
            <button type="button" title="Kursywa" onMouseDown={apply(() => run('italic'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Italic size={16} />
            </button>
            <button type="button" title="Podkreślenie" onMouseDown={apply(() => run('underline'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Underline size={16} />
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" title="Nagłówek sekcji" onMouseDown={apply(() => run('formatBlock', 'H3'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Heading size={16} />
            </button>
            <button type="button" title="Lista punktowana" onMouseDown={apply(() => run('insertUnorderedList'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <List size={16} />
            </button>
            <button
              type="button"
              title="Ptaszek (kliknij ponownie, aby usunąć punkt)"
              onMouseDown={apply(insertChecklist)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Check size={16} />
            </button>
            <button type="button" title="Separator sekcji" onMouseDown={apply(() => run('insertHTML', '<hr>'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Minus size={16} />
            </button>
            <div className="relative">
              <button
                type="button"
                title="Emotikony"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setEmojiOpen((open) => !open);
                }}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Smile size={16} />
              </button>
              {emojiOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#111]/95 p-2 shadow-xl backdrop-blur-md">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded-lg px-2 py-1 text-lg hover:bg-white/10"
                      onMouseDown={apply(() => insertEmoji(emoji))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" title="Cofnij" onMouseDown={apply(() => run('undo'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Undo2 size={16} />
            </button>
            <button type="button" title="Ponów" onMouseDown={apply(() => run('redo'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
              <Redo2 size={16} />
            </button>
          </div>
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder || ''}
            className="listing-desc-editor min-h-[16rem] w-full overflow-y-auto px-6 py-5 font-[family-name:var(--font-geist-sans)] text-[17px] font-light leading-[1.85] tracking-[0.015em] text-[#f5f5f7] outline-none [text-shadow:0_1px_1px_rgba(0,0,0,0.25)] empty:before:pointer-events-none empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)] [&_b]:font-semibold [&_b]:text-white [&_em]:italic [&_h3]:mb-2.5 [&_h3]:mt-5 [&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-white/90 [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#c4a574]/40 [&_li]:mb-1.5 [&_li]:pl-1 [&_li[data-kind=check]]:list-none [&_p]:mb-3.5 [&_p:first-child]:text-[#ececf1] [&_strong]:font-semibold [&_strong]:text-white [&_u]:underline [&_u]:decoration-[#c4a574]/80 [&_ul]:mb-4 [&_ul]:list-none [&_ul]:pl-0 [&_ul_li]:relative [&_ul_li]:pl-5 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:text-[#c4a574] [&_ul_li]:before:content-['•'] [&_ul_li[data-kind=check]]:before:content-['✓']"
            onInput={(e) => {
              fromSelf.current = true;
              onChange(e.currentTarget.innerHTML);
            }}
          />
        </>
      ) : (
        <div className="min-h-[16rem] px-6 py-5">
          {previewHtml ? (
            <OfferDescriptionBody description={value} />
          ) : (
            <p className="text-[16px] font-light italic leading-relaxed text-zinc-500">
              {placeholder || 'Podgląd sformatowanego opisu pojawi się tutaj.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
