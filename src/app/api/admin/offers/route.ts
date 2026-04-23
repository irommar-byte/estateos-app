import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from "nodemailer";

export async function GET() {
  try {
    const offers = await prisma.offer.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(offers);
  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();
    const updated = await prisma.offer.update({ where: { id: Number(id) }, data: { status } });

    // === SILNIK ALERTÓW - Uruchamia się TYLKO przy akceptacji oferty ===
    if (status === 'ACTIVE') {
      const matchingBuyers = await prisma.user.findMany({
        where: {
          searchType: { not: null },
          searchDistricts: { contains: updated.district },
          OR: [
            { searchMaxPrice: null }, 
            { searchMaxPrice: { gte: parseInt(String(updated.price).replace(/\D/g, '') || '0') } }
          ]
        }
      });

      if (matchingBuyers.length > 0) {
        // Konfiguracja pobierana z pliku .env
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || "smtp.gmail.com", 
          port: Number(process.env.EMAIL_PORT) || 465, 
          secure: true,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        const formattedPrice = new Intl.NumberFormat('pl-PL').format(parseInt(String(updated.price).replace(/\D/g, ''))) + " PLN";
        
        // Ujednolicone tagi EstateOS Premium
        const unifiedAdaptableLogo = `<strong><span style="color: #10b981;">E</span>state<span style="color: #10b981;">OS</span>&trade;</strong>`;
        const unifiedAdaptableFooter = `<p style="font-size: 11px; color: #777; margin-top: 40px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">Wiadomość wygenerowana automatycznie, prosimy na nią nie odpowiadać.<br>W sprawach wsparcia zapraszamy do kontaktu: <a href="mailto:powiadomienia@estateos.pl" style="color: #10b981; text-decoration: none; font-weight: bold;">powiadomienia@estateos.pl</a></p>`;

        for (const buyer of matchingBuyers) {
          const firstName = buyer.name ? buyer.name.split(' ')[0] : 'Inwestorze';
          const mailOptions = {
            from: `"EstateOS" <powiadomienia@estateos.pl>`,
            to: buyer.email,
            subject: `Nowa nieruchomość dopasowana do Twoich kryteriów | EstateOS`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center;">
                <h1 style="font-size: 28px; font-weight: 900; margin-bottom: 5px; letter-spacing: -1px;">${unifiedAdaptableLogo}</h1>
                
                <div style="background-color: #f9f9f9; padding: 40px; border-radius: 24px; border: 1px solid #eee; margin: 30px auto; max-width: 500px; text-align: left;">
                  <h2 style="font-size: 20px; margin-bottom: 15px; font-weight: 800; color: #000;">Witaj ${firstName}, mamy nową propozycję!</h2>
                  <p style="line-height: 1.6; color: #000; font-size: 15px; margin-bottom: 30px;">
                    W naszym portfolio pojawiła się właśnie nieruchomość, która idealnie odpowiada zdefiniowanym przez Ciebie parametrom inwestycyjnym. Została przed chwilą pomyślnie zweryfikowana i dodana do platformy.
                  </p>
                  
                  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #eee; margin: 20px 0;">
                    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">${updated.title}</p>
                    <p style="margin: 5px 0; color: #10b981; font-size: 20px; font-weight: bold;">${formattedPrice}</p>
                    <p style="margin: 5px 0; color: #666;">📍 ${updated.district} | 📐 ${updated.area} m²</p>
                  </div>
                  
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://estateos.pl/oferta/${updated.id}" style="background-color: #111; color: #fff; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 12px; display: inline-block;">ZOBACZ SZCZEGÓŁY OFERTY ➔</a>
                  </div>
                  ${unifiedAdaptableFooter}
                </div>
              </div>
            `,
          };
          await transporter.sendMail(mailOptions);
        }
      }
    }

    return NextResponse.json({ success: true, offer: updated });
  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false }, { status: 400 });
  try {
    await prisma.offer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}
