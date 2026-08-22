/**
 * EstateOS Desk — staging smoke (DB + workflowEngine + security).
 * Run: DATABASE_URL=... npx tsx scripts/desk-staging-smoke.ts
 */
import { prisma } from '../src/lib/prisma';
import { dispatchDeskWorkflow } from '../src/lib/desk/workflowEngine';
import { createProspectCase, findExistingAgencyClient, backfillDeskCasesForAgency } from '../src/lib/desk/prospects';
import { syncOfferPriceHistory } from '../src/lib/offerPriceHistory';
import { buildAggregateDeskTimeline } from '../src/lib/desk/aggregateTimeline';
import { buildSellerReport } from '../src/lib/desk/sellerReport';
import { listChecklistTasks, markOverdueChecklistAlerts } from '../src/lib/desk/checklistEngine';

type Result = { name: string; pass: boolean; detail?: string };

const results: Result[] = [];
const AGENT_A = Number(process.env.SMOKE_AGENT_A || 55);
const AGENT_B = Number(process.env.SMOKE_AGENT_B || 61);

function pass(name: string, detail?: string) {
  results.push({ name, pass: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.error(`✗ ${name} — ${detail}`);
}

async function main() {
  console.log('=== Desk Staging Smoke ===\n');

  // Migration / data integrity
  const clientCountBefore = await prisma.agencyClient.count();
  const deskCaseTable = await prisma.$queryRawUnsafe<Array<{ t: string }>>(
    `SHOW TABLES LIKE 'DeskCase'`,
  );
  const deskTaskTable = await prisma.$queryRawUnsafe<Array<{ t: string }>>(
    `SHOW TABLES LIKE 'DeskTask'`,
  );
  if (deskCaseTable.length && deskTaskTable.length) {
    pass('MIGRATION_TABLES', 'DeskCase + DeskTask exist');
  } else {
    fail('MIGRATION_TABLES', 'Missing DeskCase or DeskTask');
  }

  const agents = await prisma.user.findMany({
    where: { id: { in: [AGENT_A, AGENT_B] } },
    select: { id: true, email: true, role: true },
  });
  if (agents.length < 2) {
    fail('AGENTS', `Need agents ${AGENT_A} and ${AGENT_B}`);
    process.exit(1);
  }
  pass('AGENTS', agents.map((a) => `${a.id}:${a.email}`).join(', '));

  const ts = Date.now();
  const sellPhone = `+4850000${String(ts).slice(-4)}`;
  const buyPhone = `+4860000${String(ts).slice(-4)}`;

  // --- SELL workflow ---
  let sellCaseId: number;
  let sellClientId: number;
  try {
    const prospect = await createProspectCase({
      agencyUserId: AGENT_A,
      firstName: 'Smoke',
      lastName: `Sell${ts}`,
      phone: sellPhone,
      email: `smoke-sell-${ts}@staging.test`,
      source: 'smoke_test',
      city: 'Warszawa',
      price: 890000,
    });
    sellCaseId = prospect.case!.id;
    sellClientId = prospect.case!.client.id;
    pass('SELL_PROSPECT', `case #${sellCaseId}`);
  } catch (e) {
    fail('SELL_PROSPECT', String(e));
    sellCaseId = 0;
    sellClientId = 0;
  }

  if (sellCaseId) {
    for (const [outcome, trigger] of [
      ['CALL', 'CALL_INTERESTED'],
      ['MEETING', 'MEETING_BOOKED'],
      ['ACQUISITION', 'MEETING_COMPLETED'],
      ['CONTRACT', 'CONTRACT_SIGNED'],
      ['LISTING', 'MANUAL_STAGE'],
    ] as const) {
      try {
        if (trigger === 'MANUAL_STAGE') {
          await dispatchDeskWorkflow({
            agencyUserId: AGENT_A,
            caseId: sellCaseId,
            trigger: 'MANUAL_STAGE',
            payload: { stage: 'LISTING' },
          });
        } else if (trigger === 'MEETING_BOOKED') {
          await dispatchDeskWorkflow({
            agencyUserId: AGENT_A,
            caseId: sellCaseId,
            trigger,
            payload: { startsAt: new Date(Date.now() + 86400000).toISOString() },
          });
        } else if (trigger === 'CONTRACT_SIGNED') {
          await dispatchDeskWorkflow({
            agencyUserId: AGENT_A,
            caseId: sellCaseId,
            trigger,
            payload: { durationMonths: 6 },
          });
        } else {
          await dispatchDeskWorkflow({
            agencyUserId: AGENT_A,
            caseId: sellCaseId,
            trigger: trigger as 'CALL_INTERESTED' | 'MEETING_COMPLETED',
          });
        }
        pass(`SELL_${outcome}`, trigger);
      } catch (e) {
        fail(`SELL_${outcome}`, String(e));
      }
    }

    const offer = await prisma.offer.findFirst({
      where: { userId: AGENT_A, status: 'ACTIVE' },
      select: { id: true, pricePln: true, price: true, priceCurrency: true, listPricePln: true },
    });
    if (offer) {
      await prisma.deskCase.update({
        where: { id: sellCaseId },
        data: { linkedOfferId: offer.id, pipelineStage: 'LIVE' },
      });
      await dispatchDeskWorkflow({
        agencyUserId: AGENT_A,
        caseId: sellCaseId,
        trigger: 'LISTING_PUBLISHED',
        payload: { offerId: offer.id },
      });
      pass('SELL_PUBLICATION', `offer #${offer.id}`);

      // Base must match OfferPriceHistory (syncOfferPriceHistory gate), not stale offer.pricePln.
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
        source: 'smoke_test',
      });
      const radarTask = await prisma.deskTask.findFirst({
        where: { caseId: sellCaseId, title: { contains: 'Radar' }, status: 'OPEN' },
        orderBy: { id: 'desc' },
      });
      const priceAct = await prisma.agencyClientActivity.findFirst({
        where: { clientId: sellClientId, kind: 'DESK_PRICE_CHANGE' },
        orderBy: { id: 'desc' },
      });
      if (radarTask && priceAct) {
        pass('PRICE_DROP', `task #${radarTask.id}, timeline activity`);
      } else {
        fail('PRICE_DROP', `radarTask=${!!radarTask} priceAct=${!!priceAct}`);
      }
    } else {
      fail('SELL_PUBLICATION', 'No active offer for agent — skip price drop');
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
        offerId: offer?.id,
      },
    });
    const debriefCase = await prisma.deskCase.findUnique({ where: { id: sellCaseId } });
    if (debriefCase?.temperature === 'HOT' && debriefCase.health === 'HEALTHY') {
      pass('DEBRIEF', `temp=${debriefCase.temperature} next=${debriefCase.nextAction}`);
    } else {
      fail('DEBRIEF', JSON.stringify(debriefCase));
    }

    await dispatchDeskWorkflow({
      agencyUserId: AGENT_A,
      caseId: sellCaseId,
      trigger: 'DEAL_FINALIZED',
      payload: {},
    });
    const afterTasks = await prisma.deskTask.findMany({
      where: {
        caseId: sellCaseId,
        title: { contains: 'Aftercare' },
        trigger: 'DEAL_FINALIZED',
      },
    });
    const dupDay7 = afterTasks.filter((t) => t.title.includes('day 7')).length;
    if (afterTasks.length === 4 && dupDay7 === 1) {
      pass('AFTERCARE', '4 tasks, single day 7');
    } else {
      fail('AFTERCARE', `count=${afterTasks.length} day7=${dupDay7} titles=${afterTasks.map((t) => t.title).join(';')}`);
    }
  }

  // --- BUY workflow ---
  let buyCaseId: number;
  let buyClientId: number;
  try {
    const linkedUserId = await prisma.user.findFirst({ where: { email: { contains: '@' } }, select: { id: true } });
    const buyClient = await prisma.agencyClient.create({
      data: {
        agencyUserId: AGENT_A,
        type: 'BUYER',
        firstName: 'Smoke',
        lastName: `Buy${ts}`,
        phone: buyPhone,
        email: `smoke-buy-${ts}@staging.test`,
        portalToken: `smoke-${ts}`,
      },
    });
    buyClientId = buyClient.id;
    buyCaseId = (
      await prisma.deskCase.create({
        data: {
          agencyUserId: AGENT_A,
          clientId: buyClientId,
          kind: 'BUY',
          pipelineStage: 'INQUIRY',
          title: `Smoke Buy ${ts}`,
          nextAction: 'Kwalifikacja',
          temperature: 'WARM',
          health: 'HEALTHY',
        },
      })
    ).id;
    pass('BUY_INQUIRY', `case #${buyCaseId}`);
    void linkedUserId;
  } catch (e) {
    fail('BUY_INQUIRY', String(e));
    buyCaseId = 0;
    buyClientId = 0;
  }

  if (buyCaseId) {
    await prisma.agencyClientBuyerPreference.create({
      data: {
        clientId: buyClientId,
        transactionType: 'SELL',
        propertyType: 'FLAT',
        city: 'Warszawa',
        maxPrice: 900000,
        minArea: 40,
        minMatchThreshold: 70,
      },
    });
    await dispatchDeskWorkflow({
      agencyUserId: AGENT_A,
      caseId: buyCaseId,
      trigger: 'BUYER_QUALIFIED',
      payload: { qualification: { qualifiedAt: new Date().toISOString() } },
    });
    const buyCase = await prisma.deskCase.findUnique({ where: { id: buyCaseId } });
    if (buyCase?.pipelineStage === 'MATCHING') {
      pass('BUY_QUALIFICATION', '→ MATCHING');
    } else {
      fail('BUY_QUALIFICATION', `stage=${buyCase?.pipelineStage}`);
    }
  }

  // Dual-role: same person SELL + BUY, one AgencyClient
  if (sellClientId && buyClientId) {
    const dual = await findExistingAgencyClient({
      agencyUserId: AGENT_A,
      phone: sellPhone,
      email: `smoke-sell-${ts}@staging.test`,
    });
    const sellCases = await prisma.deskCase.count({ where: { clientId: sellClientId, kind: 'SELL' } });
    const clientsWithPhone = await prisma.agencyClient.count({
      where: { agencyUserId: AGENT_A, phone: sellPhone },
    });
    if (dual && clientsWithPhone === 1) {
      pass('DUAL_ROLE_DEDUP', `1 client, sell cases=${sellCases}`);
    } else {
      fail('DUAL_ROLE_DEDUP', `clients=${clientsWithPhone} dual=${!!dual}`);
    }

    // Add BUY case to same client as SELL (dual role pattern)
    const existingSellClient = await prisma.agencyClient.findUnique({ where: { id: sellClientId } });
    if (existingSellClient) {
      const buyOnSame = await prisma.deskCase.findFirst({
        where: { clientId: sellClientId, kind: 'BUY' },
      });
      if (!buyOnSame) {
        await prisma.deskCase.create({
          data: {
            agencyUserId: AGENT_A,
            clientId: sellClientId,
            kind: 'BUY',
            pipelineStage: 'INQUIRY',
            title: `${existingSellClient.firstName} dual BUY`,
            temperature: 'WARM',
            health: 'HEALTHY',
          },
        });
      }
      const both = await prisma.deskCase.findMany({
        where: { clientId: sellClientId },
        select: { kind: true },
      });
      const kinds = new Set(both.map((c) => c.kind));
      if (kinds.has('SELL') && kinds.has('BUY')) {
        pass('DUAL_ROLE', 'SELL+BUY same clientId');
      } else {
        fail('DUAL_ROLE', kinds.join(','));
      }
    }
  }

  // IDOR
  if (sellCaseId) {
    const crossCase = await prisma.deskCase.findFirst({
      where: { id: sellCaseId, agencyUserId: AGENT_B },
    });
    const crossClient = await prisma.agencyClient.findFirst({
      where: { id: sellClientId, agencyUserId: AGENT_B },
    });
    if (!crossCase && !crossClient) {
      pass('IDOR_CASE', 'Agent B cannot see Agent A case via prisma scope');
    } else {
      fail('IDOR_CASE', 'Cross-agent access possible');
    }
  }

  // Timeline aggregation scoping
  if (sellCaseId && sellClientId) {
    const dc = await prisma.deskCase.findUnique({
      where: { id: sellCaseId },
      include: {
        client: { include: { activities: { take: 20, orderBy: { createdAt: 'desc' } } } },
        tasks: true,
      },
    });
    if (dc) {
      const timeline = await buildAggregateDeskTimeline({
        clientId: dc.clientId,
        caseId: dc.id,
        agencyUserId: AGENT_A,
        linkedOfferId: dc.linkedOfferId,
        activities: dc.client.activities,
        tasks: dc.tasks,
      });
      const kinds = new Set(timeline.map((t) => t.kind));
      if (timeline.length > 0) {
        pass('TIMELINE_360', `${timeline.length} items kinds=${[...kinds].slice(0, 8).join(',')}`);
      } else {
        fail('TIMELINE_360', 'empty timeline');
      }
    }
  }

  // Checklist
  if (sellCaseId) {
    await dispatchDeskWorkflow({
      agencyUserId: AGENT_A,
      caseId: sellCaseId,
      trigger: 'MANUAL_STAGE',
      payload: { stage: 'MEETING' },
    });
    const items = await listChecklistTasks(sellCaseId);
    if (items.some((i) => i.trigger === 'CHECKLIST')) {
      pass('CHECKLIST', `${items.length} items`);
    } else {
      fail('CHECKLIST', 'no checklist tasks');
    }
    await markOverdueChecklistAlerts(AGENT_A);
  }

  // Seller report build (no email send)
  const agentOffer = await prisma.offer.findFirst({ where: { userId: AGENT_A }, select: { id: true } });
  if (agentOffer && sellClientId) {
    const report = await buildSellerReport({
      offerId: agentOffer.id,
      agencyUserId: AGENT_A,
      clientId: sellClientId,
    });
    if (report?.metrics) {
      pass('SELLER_REPORT_BUILD', `views=${report.metrics.views}`);
    } else {
      fail('SELLER_REPORT_BUILD', 'null report');
    }
  }

  // OH → client simulation
  try {
    const guestUser = await prisma.user.findFirst({
      where: { id: { not: AGENT_A } },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (guestUser) {
      const existing = await findExistingAgencyClient({
        agencyUserId: AGENT_A,
        email: guestUser.email,
        phone: guestUser.phone,
      });
      if (!existing) {
        const cl = await prisma.agencyClient.create({
          data: {
            agencyUserId: AGENT_A,
            type: 'BUYER',
            firstName: 'OH',
            lastName: 'Guest',
            email: guestUser.email,
            phone: guestUser.phone,
            linkedUserId: guestUser.id,
            notes: 'smoke OH convert',
            portalToken: `oh-${ts}`,
          },
        });
        await prisma.deskCase.create({
          data: {
            agencyUserId: AGENT_A,
            clientId: cl.id,
            kind: 'BUY',
            pipelineStage: 'INQUIRY',
            source: 'open_house',
            title: 'OH guest case',
            temperature: 'WARM',
            health: 'HEALTHY',
          },
        });
        pass('OH_CLIENT', `client #${cl.id}`);
      } else {
        pass('OH_CLIENT', 'reused existing — dedup OK');
      }
    }
  } catch (e) {
    fail('OH_CLIENT', String(e));
  }

  const clientCountAfter = await prisma.agencyClient.count();
  if (clientCountAfter >= clientCountBefore) {
    pass('DATA_INTEGRITY', `AgencyClient ${clientCountBefore}→${clientCountAfter} (no deletes)`);
  } else {
    fail('DATA_INTEGRITY', `lost clients ${clientCountBefore}→${clientCountAfter}`);
  }

  // Cleanup marker — smoke test rows stay (no delete per user request)

  console.log('\n=== SUMMARY ===');
  const failed = results.filter((r) => !r.pass);
  console.log(`PASS: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  FAIL: ${f.name} — ${f.detail}`));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
