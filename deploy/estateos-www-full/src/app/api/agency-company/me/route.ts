import { NextResponse } from 'next/server';
import {
  ensureAgencyCompanyForAgentUser,
  getAgencyTeamForViewer,
  shapeAgencyMembershipResponse,
} from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  const membership = await ensureAgencyCompanyForAgentUser(userId);
  if (!membership) {
    return NextResponse.json({ success: true, membership: null });
  }

  const { team } = await getAgencyTeamForViewer(userId);

  return NextResponse.json({
    success: true,
    membership: shapeAgencyMembershipResponse(membership, team),
  });
}
