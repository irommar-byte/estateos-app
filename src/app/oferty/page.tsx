"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Tymczasowe, piękne zdjęcia dla zachowania standardu Apple
const OFFERS = [
  { id: 1, title: "Willa na Mokotowie", price: "8 500 000 PLN", area: "320 m²", image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop" },
  { id: 2, title: "Penthouse Złota 44", price: "12 000 000 PLN", area: "210 m²", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop" },
  { id: 3, title: "Rezydencja Wilanów", price: "15 400 000 PLN", area: "450 m²", image: "https://images.unsplash.com/photo-1600607687931-cecebd803622?q=80&w=2070&auto=format&fit=crop" },
  { id: 4, title: "Apartament Powiśle", price: "4 200 000 PLN", area: "110 m²", image: "https://images.unsplash.com/photo-1600607687644-aac4c15cecb1?q=80&w=2070&auto=format&fit=crop" }
];

export default function CatalogPage() {
  return (
    <main className="bg-black min-h-screen text-white font-sans pt-40 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Potężny, kinowy nagłówek */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-24 border-b border-white/10 pb-12">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none mb-8">
            Katalog <br/><span className="text-white/30 italic">rezydencji.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/50 max-w-3xl font-light tracking-wide">
            Odkryj najbardziej ekskluzywne nieruchomości w Warszawie. Zaprojektowane dla tych, którzy cenią bezkompromisowy luksus.
          </p>
        </motion.div>

        {/* Siatka z ofertami */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          {OFFERS.map((offer, i) => (
            <Link href={`/oferta/${offer.id}`} key={offer.id}>
              <motion.div 
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="group cursor-pointer"
              >
                {/* Zdjęcie z efektem powiększenia (Zoom) */}
                <div className="relative w-full aspect-[4/3] rounded-[2rem] overflow-hidden mb-6 bg-[#0a0a0a] border border-white/5">
                  <img 
                    src={offer.image} 
                    alt={offer.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out opacity-80 group-hover:opacity-100"
                  />
                  {/* Cień na dole zdjęcia, by tekst był czytelny (jeśli byśmy go tam dali) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </div>
                
                {/* Minimalistyczne napisy pod zdjęciem */}
                <div className="flex justify-between items-start px-2">
                  <div>
                    <h3 className="text-3xl font-bold tracking-tight mb-2 group-hover:text-white transition-colors">{offer.title}</h3>
                    <p className="text-white/40 font-medium tracking-widest text-xs uppercase">{offer.area}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xl font-bold">{offer.price}</p>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30 group-hover:text-white mt-3 transition-colors">
                      Odkryj <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}
