import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    let { email, otp } = await req.json();
    email = email ? email.trim().toLowerCase() : "";
    const cleanOtp = String(otp).trim();

    const user = await prisma.user.findUnique({ where: { email } });

    // 1. WERYFIKACJA KODU I CZASU WAŻNOŚCI
    if (!user || !user.otpCode) {
        return NextResponse.json({ success: false, error: "Brak aktywnego kodu weryfikacyjnego." }, { status: 400 });
    }

    if (String(user.otpCode).trim() !== cleanOtp) {
        return NextResponse.json({ success: false, error: "Nieprawidłowy kod weryfikacyjny." }, { status: 400 });
    }

    // Sprawdzenie czy kod nie wygasł
    if (user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
        return NextResponse.json({ success: false, error: "Kod weryfikacyjny wygasł. Wygeneruj nowy." }, { status: 400 });
    }

    // 2. OZNACZENIE JAKO ZWERYFIKOWANY
    await prisma.user.update({
        where: { email },
        data: { 
          isVerified: true, 
          otpCode: null, 
          otpExpiry: null 
        }
    });

    // 3. WYSYŁKA MAILA POWITALNEGO (W tle, żeby nie blokować użytkownika)
    try {
        const firstName = user.name ? user.name.split(' ')[0] : 'Inwestorze';
        const type = user.searchType || 'Dowolny';
        const districts = user.searchDistricts ? user.searchDistricts.split(',').join(', ') : 'Wszystkie';
        const maxPrice = user.searchMaxPrice ? user.searchMaxPrice + ' PLN' : 'Bez limitu';

        // Wysyłamy bez await - jeśli Resend zawiedzie, użytkownik i tak przejdzie dalej
        fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'EstateOS <powiadomienia@estateos.pl>',
                to: email, 
                subject: `EstateOS | Twój profil inwestorski jest aktywny`,
                html: `<div style="font-family:sans-serif;background:#000;color:#fff;padding:40px;border-radius:20px;text-align:center;">
                        <h1 style="color:#10b981;">EstateOS</h1>
                        <p style="text-transform:uppercase;letter-spacing:2px;font-size:10px;">Profil Aktywny</p>
                        <div style="text-align:left;background:#111;padding:20px;border-radius:15px;margin:20px 0;border:1px solid #222;">
                          <p>Witaj <b>${firstName}</b>,</p>
                          <p>Twój profil został zweryfikowany. Monitorujemy rynek dla: <b>${type}</b> w lokalizacji <b>${districts}</b> do <b>${maxPrice}</b>.</p>
                        </div>
                        <a href="https://estateos.pl/login" style="background:#10b981;color:#000;padding:15px 30px;border-radius:30px;text-decoration:none;font-weight:bold;display:inline-block;">WEJDŹ DO PANELU</a>
                      </div>`
            })
        }).catch(err => console.error("Resend background error:", err));
        
    } catch (mailError) {
      console.error("Błąd wysyłki powitalnej:", mailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) { 
    console.error("Critical Verification Error:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 }); 
  }
}
