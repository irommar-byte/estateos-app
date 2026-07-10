import { API_URL } from '../config/network';

export type CarInquiryPayload = {
  message: string;
  viewingPreference: string;
  phone?: string;
};

export type CarInquiryResult = {
  threadId: number;
  peerUserId: number;
};

export async function submitCarInquiry(
  token: string,
  carId: number,
  payload: CarInquiryPayload,
): Promise<CarInquiryResult> {
  const response = await fetch(`${API_URL}/api/cars/${carId}/inquiry`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się wysłać zapytania.');
  }
  return {
    threadId: Number(data.threadId),
    peerUserId: Number(data.peerUserId),
  };
}
