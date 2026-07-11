import {
  acceptAdminPhotoSessionRequest,
  getAdminPhotoSessionQueue,
} from '@/lib/mobilePhotoSessionHandlers';

export async function GET(req: Request) {
  return getAdminPhotoSessionQueue(req);
}

export async function POST(req: Request) {
  return acceptAdminPhotoSessionRequest(req);
}
