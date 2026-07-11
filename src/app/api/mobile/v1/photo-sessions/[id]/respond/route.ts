import { respondPhotoSessionRequest } from '@/lib/mobilePhotoSessionHandlers';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const requestId = Number(id);
  return respondPhotoSessionRequest(req, requestId);
}
