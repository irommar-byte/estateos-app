import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  grantOfficeCreditsFromCheckout,
  memberMonthlyLimit,
  officeContext,
  officeCreditPack,
  officeCreditsSummary,
  setMemberMonthlyLimit,
  setOfficeCoinVisibility,
} from '@/lib/crm/officeCredits';
import { logTeamEvent } from '@/lib/crm/teamLog';

export const dynamic = 'force-dynamic';

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Płatności są chwilowo niedostępne.');
  return new Stripe(key, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion });
}

/** Granatowa moneta: stan puli biura, historia, paczki do kupienia. */
export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ success: true, office: null });
  const memberLimitFor = Number(new URL(req.url).searchParams.get('memberLimit') || 0);
  if (memberLimitFor > 0) {
    return NextResponse.json({ success: true, memberLimit: await memberMonthlyLimit(userId, memberLimitFor) });
  }
  const office = await officeCreditsSummary(userId);
  return NextResponse.json({ success: true, office });
}

export async function POST(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla biur i agentów.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  try {
    if (action === 'set_visibility') {
      await setOfficeCoinVisibility(userId, Boolean(body.visible));
      return NextResponse.json({ success: true });
    }

    if (action === 'set_limit') {
      await setMemberMonthlyLimit(userId, Number(body.memberUserId), Number(body.limit));
      return NextResponse.json({ success: true });
    }

    if (action === 'checkout') {
      const ctx = await officeContext(userId);
      if (!ctx?.isManager) return NextResponse.json({ error: 'Kredyty biurowe kupuje kierownik biura.' }, { status: 403 });
      if (!ctx.poolActive) {
        return NextResponse.json(
          { error: 'Najpierw aktywuj pakiet Partner — kredyty biurowe działają tylko przy aktywnym pakiecie.', code: 'PARTNER_REQUIRED' },
          { status: 409 },
        );
      }
      const pack = officeCreditPack(body.pack);
      if (!pack) return NextResponse.json({ error: 'Wybierz paczkę kredytów.' }, { status: 400 });
      const origin = req.headers.get('origin') || 'https://estateos.pl';
      const back = String(body.returnPath || '/moje-konto/crm').replace(/^(?!\/)/, '/').slice(0, 200);
      const sep = back.includes('?') ? '&' : '?';
      const session = await stripeClient().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'blik'],
        line_items: [
          {
            price_data: {
              currency: 'pln',
              product_data: {
                name: `Kredyty biurowe EstateOS™ · ${pack.credits} szt.`,
                description: `${pack.unitPln} zł za kredyt. Pula biura ${ctx.companyName} — publikacje ogłoszeń i usługi biura, przy aktywnym pakiecie Partner.`,
              },
              unit_amount: pack.unitPln * 100,
            },
            quantity: pack.credits,
          },
        ],
        // Faktura na biuro: nazwa i NIP z danych firmy (NIP można poprawić w formularzu płatności).
        customer_creation: 'always',
        tax_id_collection: { enabled: true },
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Kredyty biurowe · ${ctx.companyName}`,
            custom_fields: [
              { name: 'Biuro', value: ctx.companyName.slice(0, 30) },
              ...(ctx.nip ? [{ name: 'NIP', value: ctx.nip.slice(0, 30) }] : []),
            ],
            metadata: { company_id: String(ctx.companyId) },
          },
        },
        metadata: {
          plan_type: pack.id,
          company_id: String(ctx.companyId),
          user_id: String(userId),
          credits: String(pack.credits),
        },
        success_url: `${origin}${back}${sep}office_credits=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${back}`,
      });
      return NextResponse.json({ success: true, url: session.url });
    }

    if (action === 'sync') {
      // Powrót z płatności — dopisujemy od razu, nie czekając na webhook (zapis jest jednorazowy).
      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId) return NextResponse.json({ error: 'Brak sesji płatności.' }, { status: 400 });
      const session = await stripeClient().checkout.sessions.retrieve(sessionId);
      const pack = officeCreditPack(session.metadata?.plan_type);
      const companyId = Number(session.metadata?.company_id || 0);
      const ctx = await officeContext(userId);
      if (!pack || !companyId || ctx?.companyId !== companyId || session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Płatność nie jest jeszcze potwierdzona.' }, { status: 409 });
      }
      const granted = await grantOfficeCreditsFromCheckout({
        sessionId,
        companyId,
        credits: Number(session.metadata?.credits || pack.credits),
        buyerUserId: Number(session.metadata?.user_id || 0) || null,
      });
      if (granted) void logTeamEvent({ userId, kind: 'OFFICE_CREDITS_BOUGHT', title: `Dokupił ${pack.credits} kredytów biurowych` });
      return NextResponse.json({ success: true, granted });
    }

    return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nie udało się.' }, { status: 400 });
  }
}
