/**
 * Pierwszy focus klawiatury — przeskoczenie do głównej treści (WCAG 2.4.1 „Bypass Blocks”).
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="absolute left-[-9999px] top-0 z-[100] h-px w-px overflow-hidden whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-lg outline-none focus-visible:left-4 focus-visible:top-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.35rem))] focus-visible:h-auto focus-visible:w-auto focus-visible:overflow-visible focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      Przejdź do treści
    </a>
  );
}
