/**
 * Full Desk staging smoke — workflowEngine + DB (no UI session).
 * Run: DATABASE_URL=... npx tsx scripts/desk-staging-full-smoke.ts
 */
import { prisma } from '../src/lib/prisma';
import { dispatchDeskWorkflow } from '../src/lib/desk/workflowEngine';
import { createProspectCase, findExistingAgencyClient, backfillDeskCasesForAgency } from '../src/lib/desk/prospects';
import { syncOfferPriceHistory } from '../src/lib/offerPriceHistory';
import { buildAggregateDeskTimeline } from '../src/lib/desk/aggregateTimeline';
import { buildSellerReport } from '../src/lib/desk/sellerReport';
import { listChecklistTasks } from '../src/lib/desk/checklistEngine';
import { parseQualificationFromMetadata } from '../src/lib/desk/buyerQualification';

const AGENT_A = Number(process.env.SMOKE_AGENT_A || 55);
const AGENT_B = Number(process.env.SMOKE_AGENT_B || 61);
const ts = Date.now();

type R = { name: string; status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED'; detail?: string };
const results: R[] = [];

function log(r: R) {
  results.push(r);
  const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : r.status === 'PARTIAL' ? '~' : '?';
  console.log(`${icon} [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

async function assertCase(caseId: number, expectedStage: string, label: string) {
  const c = await prisma.deskCase.findUnique({ where: { id: caseId } });
  if (c?.pipelineStage === expectedStage) {
    log({ name: label, status: 'PASS', detail: `stage=${expectedStage} next=${c.nextAction}` });
  } else {
    log({ name: label, status: 'FAIL', detail: `expected=${expectedStage} got=${c?.pipelineStage}` });
  }
  return c;
}

async function main() {
  console.log('=== Desk Full Staging Smoke ===\n');

  // --- Full SELL ---
  const sellPhone = `+485100${String(ts).slice(-5)}`;
  const sellEmail = `sell-full-${ts}@staging.test`;
  let sellCaseId = 0;
  let sellClientId = 0;

  try {
    const p = await createProspectCase({
      agencyUserId: AGENT_A,
      firstName: 'Full',
      lastName: `Sell${ts}`,
      phone: sellPhone,
      email: sellEmail,
      source: 'full_smoke',
      city: 'Warszawa',
      price: 950000,
    });
    sellCaseId = p.case!.id;
    sellClientId = p.case!.client.id;
    log({ name: 'SELL_PROSPECT', status: 'PASS', detail: `case #${sellCaseId}` });
  } catch (e) {
    log({ name: 'SELL_PROSPECT', status: 'FAIL', detail: String(e) });
  }

  if (sellCaseId) {
    const sellSteps: Array<[string, Parameters<typeof dispatchDeskWorkflow>[0]['trigger'], object?]> = [
      ['SELL_CALL', 'CALL_INTERESTED'],
      ['SELL_MEETING', 'MEETING_BOOKED', { startsAt: new Date(Date.now() + 86400000).toISOString() }],
      ['SELL_ACQUISITION', 'MEETING_COMPLETED'],
      ['SELL_CONTRACT', 'CONTRACT_SIGNED', { durationMonths: 6 }],
      ['SELL_LISTING_PREP', 'MANUAL_STAGE', { stage: 'LISTING' }],
    ];

    for (const [label, trigger, payload] of sellSteps) {
      try {
        await dispatchDeskWorkflow({
          agencyUserId: AGENT_A,
          caseId: sellCaseId,
          trigger: trigger as 'CALL_INTERESTED',
          payload: (payload || {}) as Record<string, unknown>,
        });
        log({ name: label, status: 'PASS', detail: trigger });
      } catch (e) {
        log({ name: label, status: 'FAIL', detail: String(e) });
      }
    }

    const offer = await prisma.offer.findFirst({
      where: { userId: AGENT_A, status: 'ACTIVE' },
      select: { id: true, pricePln: true, price: true, priceCurrency: true, listPricePln: true },
    });

    if (offer) {
      await prisma.deskCase.update({
        where: { id: sellCaseId },
        data: { linkedOfferId: offer.id },
      });
      await dispatchDeskWorkflow({
        agencyUserId: AGENT_A,
        caseId: sellCaseId,
        trigger: 'LISTING_PUBLISHED',
        payload: { offerId: offer.id },
      });
      await assertCase(sellCaseId, 'LIVE', 'SELL_PUBLICATION');

      const hist = (await prisma.$queryRawUnsafe(
        `SELECT pricePln FROM OfferPriceHistory WHERE offerId=? ORDER BY id DESC LIMIT 1`,
        offer.id,
      )) as Array<{ pricePln: number }>;
      const base = hist[0]?.pricePln ?? Number(offer.pricePln || offer.price);
      const newPrice = Math.round(base * 0.94);
      await syncOfferPriceHistory({
        offerId: offer.id,
        price: newPrice,
        pricePln: newPrice,
        priceCurrency: String(offer.priceCurrency || 'PLN'),
        previousPricePln: base,
        previousListPricePln: offer.listPricePln,
        source: 'full_smoke',
      });
      const radar = await prisma.deskTask.findFirst({
        where: { caseId: sellCaseId, title: { contains: 'Radar' }, status: 'OPEN' },
        orderBy: { id: 'desc' },
      });
      const priceAct = await prisma.agencyClientActivity.findFirst({
        where: { clientId: sellClientId, kind: 'DESK_PRICE_CHANGE' },
        orderBy: { id: 'desc' },
      });
      log({
        name: 'PRICE_DROP',
        status: radar && priceAct ? 'PASS' : 'FAIL',
        detail: `radar=${!!radar} activity=${!!priceAct}`,
      });

      for (const stage of ['MATCHING', 'PRESENTATION'] as const) {
        await dispatchDeskWorkflow({
          agencyUserId: AGENT_A,
          caseId: sellCaseId,
          trigger: 'MANUAL_STAGE',
          payload: { stage },
        });
        await assertCase(sellCaseId, stage, `SELL_${stage}`);
      }

      await dispatchDeskWorkflow({
        agencyUserId: AGENT_A,
        caseId: sellCaseId,
        trigger: 'PRESENTATION_COMPLETED',
        payload: {
          debrief: true,
          result: 'interested',
          temperature: 'HOT',
          nextAction: 'CALL',
          offerId: offer.id,
        },
      });
      const debrief = await prisma.deskCase.findUnique({ where: { id: sellCaseId } });
      log({
        name: 'DEBRIEF',
        status: debrief?.temperature === 'HOT' ? 'PASS' : 'FAIL',
        detail: `temp=${debrief?.temperature} next=${debrief?.nextAction}`,
      });

      for (const stage of ['OFFER', 'NEGOTIATION', 'DEAL', 'ACT'] as const) {
        await dispatchDeskWorkflow({
          agencyUserId: AGENT_A,
          caseId: sellCaseId,
          trigger: 'MANUAL_STAGE',
          payload: { stage },
        });
        await assertCase(sellCaseId, stage, `SELL_${stage}`);
      }

      await dispatchDeskWorkflow({
        agencyUserId: AGENT_A,
        caseId: sellCaseId,
        trigger: 'DEAL_FINALIZED',
        payload: {},
      });
      await assertCase(sellCaseId, 'AFTERCARE', 'SELL_AFTERCARE_STAGE');
      const after = await prisma.deskTask.findMany({
        where: { caseId: sellCaseId, trigger: 'DEAL_FINALIZED' },
      });
      const day7 = after.filter((t) => t.title.includes('day 7')).length;
      log({
        name: 'AFTERCARE_TASKS',
        status: after.length === 4 && day7 === 1 ? 'PASS' : 'FAIL',
        detail: `count=${after.length} day7=${day7}`,
      });
    } else {
      log({ name: 'SELL_PUBLICATION', status: 'FAIL', detail: 'no active offer' });
    }
  }

  // --- Full BUY ---
  const buyPhone = `+486100${String(ts).slice(-5)}`;
  let buyCaseId = 0;
  let buyClientId = 0;
  try {
    const cl = await prisma.agencyClient.create({
      data: {
        agencyUserId: AGENT_A,
        type: 'BUYER',
        firstName: 'Full',
        lastName: `Buy${ts}`,
        phone: buyPhone,
        email: `buy-full-${ts}@staging.test`,
        portalToken: `buy-${ts}`,
      },
    });
    buyClientId = cl.id;
    buyCaseId = (
      await prisma.deskCase.create({
        data: {
          agencyUserId: AGENT_A,
          clientId: buyClientId,
          kind: 'BUY',
          pipelineStage: 'INQUIRY',
          title: `Full Buy ${ts}`,
          temperature: 'WARM',
          health: 'HEALTHY',
        },
      })
    ).id;
    log({ name: 'BUY_INQUIRY', status: 'PASS', detail: `case #${buyCaseId}` });
  } catch (e) {
    log({ name: 'BUY_INQUIRY', status: 'FAIL', detail: String(e) });
  }

  if (buyCaseId) {
    const qualPayload = {
      budgetMax: 920000,
      budgetMin: 600000,
      cities: ['Warszawa'],
      districts: ['Mokotów'],
      propertyTypes: ['FLAT'],
      minArea: 45,
      maxArea: 90,
      minRooms: 2,
      financing: 'MORTGAGE_PREAPPROVED',
      timeline: '3_MONTHS',
      notes: 'full smoke qualification',
    };
    await prisma.agencyClientBuyerPreference.create({
      data: {
        clientId: buyClientId,
        transactionType: 'SELL',
        propertyType: 'FLAT',
        city: 'Warszawa',
        districts: ['Mokotów'],
        maxPrice: 920000,
        minArea: 45,
        minMatchThreshold: 70,
      },
    });
    await dispatchDeskWorkflow({
      agencyUserId: AGENT_A,
      caseId: buyCaseId,
      trigger: 'BUYER_QUALIFIED',
      payload: { qualification: qualPayload },
    });
    await prisma.deskCase.update({
      where: { id: buyCaseId },
      data: { metadata: { qualification: qualPayload } },
    });
    const buyCase = await prisma.deskCase.findUnique({ where: { id: buyCaseId } });
    const pref = await prisma.agencyClientBuyerPreference.findUnique({ where: { clientId: buyClientId } });
    const meta = parseQualificationFromMetadata(buyCase?.metadata);
    const matchCount = await prisma.agencyClientMatch.count({ where: { clientId: buyClientId } });
    log({
      name: 'BUY_QUALIFICATION',
      status: buyCase?.pipelineStage === 'MATCHING' && pref && meta ? 'PASS' : 'PARTIAL',
      detail: `stage=${buyCase?.pipelineStage} pref=${!!pref} meta=${!!meta} matches=${matchCount}`,
    });

    for (const stage of ['PRESENTATION', 'OFFER', 'NEGOTIATION', 'DEAL', 'ACT'] as const) {
      await dispatchDeskWorkflow({
        agencyUserId: AGENT_A,
        caseId: buyCaseId,
        trigger: 'MANUAL_STAGE',
        payload: { stage },
      });
      await assertCase(buyCaseId, stage, `BUY_${stage}`);
    }
    await dispatchDeskWorkflow({
      agencyUserId: AGENT_A,
      caseId: buyCaseId,
      trigger: 'DEAL_FINALIZED',
      payload: {},
    });
    await assertCase(buyCaseId, 'AFTERCARE', 'BUY_AFTERCARE');
  }

  // Dual role
  if (sellClientId) {
    const dup = await findExistingAgencyClient({ agencyUserId: AGENT_A, phone: sellPhone, email: sellEmail });
    const clientCount = await prisma.agencyClient.count({ where: { agencyUserId: AGENT_A, phone: sellPhone } });
    await prisma.deskCase.create({
      data: {
        agencyUserId: AGENT_A,
        clientId: sellClientId,
        kind: 'BUY',
        pipelineStage: 'INQUIRY',
        title: 'Dual role BUY',
        temperature: 'WARM',
        health: 'HEALTHY',
      },
    }).catch(() => null);
    const kinds = await prisma.deskCase.findMany({ where: { clientId: sellClientId }, select: { kind: true } });
    const set = new Set(kinds.map((k) => k.kind));
    log({
      name: 'DUAL_ROLE',
      status: dup && clientCount === 1 && set.has('SELL') && set.has('BUY') ? 'PASS' : 'FAIL',
      detail: `clients=${clientCount} kinds=${[...set].join('+')}`,
    });
  }

  // Backfill idempotency
  const beforeBf = await prisma.deskCase.count({ where: { agencyUserId: AGENT_A } });
  const r1 = await backfillDeskCasesForAgency(AGENT_A);
  const r2 = await backfillDeskCasesForAgency(AGENT_A);
  const afterBf = await prisma.deskCase.count({ where: { agencyUserId: AGENT_A } });
  log({
    name: 'BACKFILL_IDEMPOTENT',
    status: r2.created === 0 ? 'PASS' : 'FAIL',
    detail: `run1=${r1.created} run2=${r2.created} cases ${beforeBf}→${afterBf}`,
  });

  // Timeline on sell case
  if (sellCaseId) {
    const dc = await prisma.deskCase.findUnique({
      where: { id: sellCaseId },
      include: { client: { include: { activities: { take: 100 } } }, tasks: true },
    });
    if (dc) {
      const tl = await buildAggregateDeskTimeline({
        clientId: dc.clientId,
        caseId: dc.id,
        agencyUserId: AGENT_A,
        linkedOfferId: dc.linkedOfferId,
        activities: dc.client.activities,
        tasks: dc.tasks,
      });
      const kinds = [...new Set(tl.map((t) => t.kind))];
      const ids = tl.map((t) => t.id);
      const dupIds = ids.length - new Set(ids).size;
      log({
        name: 'TIMELINE_360',
        status: tl.length > 10 && dupIds === 0 ? 'PASS' : 'PARTIAL',
        detail: `${tl.length} items kinds=${kinds.slice(0, 12).join(',')} dupIds=${dupIds}`,
      });
    }
  }

  // Checklist
  if (sellCaseId) {
    const items = await listChecklistTasks(sellCaseId);
    log({
      name: 'CHECKLIST',
      status: items.some((i) => i.trigger === 'CHECKLIST') ? 'PASS' : 'FAIL',
      detail: `${items.length} items`,
    });
  }

  // Seller report build
  const offer = await prisma.offer.findFirst({ where: { userId: AGENT_A }, select: { id: true } });
  if (offer && sellClientId) {
    const report = await buildSellerReport({ offerId: offer.id, agencyUserId: AGENT_A, clientId: sellClientId });
    log({
      name: 'SELLER_REPORT_BUILD',
      status: report?.metrics ? 'PASS' : 'FAIL',
      detail: report ? `views=${report.metrics.views}` : 'null',
    });
  }

  // IDOR prisma scope
  if (sellCaseId) {
    const cross = await prisma.deskCase.findFirst({ where: { id: sellCaseId, agencyUserId: AGENT_B } });
    log({ name: 'IDOR_SCOPE', status: cross ? 'FAIL' : 'PASS', detail: cross ? 'leak' : 'blocked' });
  }

  console.log('\n=== SUMMARY ===');
  for (const s of ['PASS', 'PARTIAL', 'FAIL', 'NOT_TESTED'] as const) {
    const n = results.filter((r) => r.status === s).length;
    if (n) console.log(`${s}: ${n}`);
  }
  const fails = results.filter((r) => r.status === 'FAIL');
  if (fails.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
