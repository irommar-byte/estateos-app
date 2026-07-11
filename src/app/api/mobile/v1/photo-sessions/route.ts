import {
  createPhotoSessionRequest,
  listMyPhotoSessionRequests,
} from '@/lib/mobilePhotoSessionHandlers';

export async function GET(req: Request) {
  return listMyPhotoSessionRequests(req);
}

export async function POST(req: Request) {
  return createPhotoSessionRequest(req);
}
