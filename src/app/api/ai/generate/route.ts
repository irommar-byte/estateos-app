import { NextResponse } from "next/server";

// ====== BAZA SŁÓW ======
const hooks = [
  "To nie jest oferta dla każdego.",
  "Adres, który zaczyna pracować od pierwszego dnia.",
  "Rynek nie wybacza zwłoki przy takich okazjach.",
  "Tu decyzje podejmuje się szybko.",
  "To jedna z tych nieruchomości, które znikają natychmiast.",
];

const lifestyles = [
  "Przestrzeń zaprojektowana pod realne życie.",
  "Układ, który nie marnuje ani jednego metra.",
  "Funkcjonalność i komfort bez kompromisów.",
  "Miejsce, które działa zarówno dla życia, jak i inwestycji.",
];

const endings = [
  "Zainteresowanych zapraszam do kontaktu.",
  "Takie oferty nie czekają długo.",
  "Decyzje w tej lokalizacji zapadają szybko.",
];

function rand(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ====== SCORING NIERUCHOMOŚCI ======
function calculateScore(data: any): number {
  let score = 0;

  const price = parseInt((data.price || "").replace(/\D/g, ""));
  const area = parseFloat((data.area || "").replace(",", "."));

  if (price && area) {
    const ppm = price / area;

    if (ppm < 12000) score += 30; // okazja
    else if (ppm < 20000) score += 20;
    else score += 10;
  }

  if (data.rooms >= 3) score += 15;
  if (area > 50) score += 15;
  if (data.district) score += 10;
  if (data.amenities?.length > 0) score += 10;

  return Math.min(score, 100);
}

// ====== GENERATOR TEKSTU ======
function buildText(data: any): string {
  const price = data.price ? `**${data.price} PLN**` : "";
  const area = data.area ? `**${data.area} m²**` : "";
  const rooms = data.rooms ? `**${data.rooms} pokoi**` : "";

  return `
${rand(hooks)}

${data.propertyType || "Nieruchomość"} w ${data.district || "Warszawie"}.

Powierzchnia: ${area}  
Cena: ${price}  
Układ: ${rooms}

${rand(lifestyles)}

• dobra lokalizacja  
• funkcjonalny układ  
• potencjał inwestycyjny  

${rand(endings)}
`.trim();
}

// ====== OCENA JAKOŚCI OPISU ======
function scoreDescription(text: string): number {
  let score = 0;

  if (text.length > 200) score += 20;
  if (text.includes("•")) score += 20;
  if (text.includes("**")) score += 20;
  if (text.split("\n").length > 6) score += 20;

  score += Math.random() * 20; // losowość = różnorodność

  return score;
}

// ====== API ======
export async function POST(req: Request) {
  try {
    const data = await req.json();

    const variants = [];

    for (let i = 0; i < 30; i++) {
      const text = buildText(data);
      variants.push({
        text,
        score: scoreDescription(text)
      });
    }

    // wybór najlepszego
    const best = variants.sort((a, b) => b.score - a.score)[0];

    const propertyScore = calculateScore(data);

    return NextResponse.json({
      description: best.text,
      variants: variants.map(v => v.text),
      propertyScore
    });

  } catch (e) {
    return NextResponse.json({
      description: "Błąd systemu AI"
    });
  }
}
