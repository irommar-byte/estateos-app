export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#050505] pt-12 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-white/30 text-xs font-medium tracking-wide">
          © 2026 LuxEstate Premium. Wszelkie prawa zastrzeżone.
        </div>
        <div className="flex gap-8 text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">
          <a href="#" className="hover:text-white transition-colors">Regulamin</a>
          <a href="#" className="hover:text-white transition-colors">Prywatność</a>
          {/* Dyskretny link do panelu admina */}
          <a href="/admin" className="hover:text-white transition-colors">Centrala</a>
        </div>
      </div>
    </footer>
  );
}
