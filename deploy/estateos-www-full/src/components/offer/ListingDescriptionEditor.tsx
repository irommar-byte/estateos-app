'use client';

import { useEffect, useRef } from 'react';
import { Bold, Check, Heading, Italic, List, Minus, Underline } from 'lucide-react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

function run(command: string, value?: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

export default function ListingDescriptionEditor({ value, onChange, placeholder, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fromSelf = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const next = value || '';
    if (fromSelf.current) {
      fromSelf.current = false;
      return;
    }
    if (ref.current.innerHTML === next) return;
    ref.current.innerHTML = next;
  }, [value]);

  const apply = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
    fn();
    fromSelf.current = true;
    onChange(ref.current?.innerHTML || '');
  };

  return (
    <div className={`overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-inner transition-colors focus-within:border-[#10b981] ${className}`.trim()}>
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
        <button type="button" title="Nagłówek" onMouseDown={apply(() => run('formatBlock', 'H3'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
          <Heading size={16} />
        </button>
        <button type="button" title="Lista" onMouseDown={apply(() => run('insertUnorderedList'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
          <List size={16} />
        </button>
        <button
          type="button"
          title="Ptaszek"
          onMouseDown={apply(() => run('insertHTML', '<ul><li data-kind="check"> </li></ul>'))}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Check size={16} />
        </button>
        <button type="button" title="Separator" onMouseDown={apply(() => run('insertHTML', '<hr>'))} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
          <Minus size={16} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || ''}
        className="listing-desc-editor min-h-[16rem] w-full overflow-y-auto px-6 py-5 text-[15px] font-light leading-[1.8] tracking-[0.01em] text-[#f5f5f7] outline-none [text-shadow:0_1px_1px_rgba(0,0,0,0.25)] empty:before:pointer-events-none empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)] [&_em]:italic [&_h3]:mb-2 [&_h3]:text-[11px] [&_h3]:font-light [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-white/70 [&_hr]:my-5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#c4a574]/40 [&_li]:mb-1.5 [&_li]:pl-1 [&_li[data-kind=check]]:list-none [&_p]:mb-3 [&_strong]:font-medium [&_strong]:text-white [&_u]:underline [&_u]:decoration-[#c4a574]/80 [&_ul]:mb-4 [&_ul]:list-none [&_ul]:pl-0 [&_ul_li]:relative [&_ul_li]:pl-5 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:text-[#c4a574] [&_ul_li]:before:content-['•'] [&_ul_li[data-kind=check]]:before:content-['✓']"
        onInput={(e) => {
          fromSelf.current = true;
          onChange(e.currentTarget.innerHTML);
        }}
      />
    </div>
  );
}
