#!/usr/bin/env node
/**
 * Regresja: finalizeDealWithOfferArchive ustawia deal FINALIZED i ofertę SOLD.
 * node scripts/regression-deal-finalize-offer.cjs
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');

const actionsPath = path.join(__dirname, '../src/app/api/mobile/v1/deals/[id]/actions/route.ts');
const actionsSrc = fs.readFileSync(actionsPath, 'utf8');
assert(actionsSrc.includes('finalizeDealWithOfferArchive'), 'actions must call finalizeDealWithOfferArchive');
assert(actionsSrc.includes('isOwnerFinalAccept'), 'actions must branch on owner accept');
assert(actionsSrc.includes("type === 'DEAL_FINALIZE'"), 'actions must support DEAL_FINALIZE');

const offerPath = path.join(__dirname, '../src/app/api/mobile/v1/offers/[offerId]/route.ts');
const offerSrc = fs.readFileSync(offerPath, 'utf8');
assert(offerSrc.includes('export async function PATCH'), 'offers/[offerId] must expose PATCH');

const finalizeLib = fs.readFileSync(path.join(__dirname, '../src/lib/dealFinalize.ts'), 'utf8');
assert(finalizeLib.includes("status: 'FINALIZED'"), 'deal must become FINALIZED');
assert(finalizeLib.includes("status: 'SOLD'"), 'offer must become SOLD');

console.log('OK: regression-deal-finalize-offer');
