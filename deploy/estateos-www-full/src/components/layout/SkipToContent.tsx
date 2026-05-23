/**
 * Pierwszy focus klawiatury — przeskoczenie do głównej treści (WCAG 2.4.1).
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(env(safe-area-inset-top,0px)+1rem)] focus:z-[200] focus:inline-flex focus:items-center focus:rounded-full focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-[11px] focus:font-semibold focus:uppercase focus:tracking-widest focus:text-black focus:outline-none focus:ring-2 focus:ring-emerald-300/80"
    >
      Przejdź do treści
    </a>
  );
}
