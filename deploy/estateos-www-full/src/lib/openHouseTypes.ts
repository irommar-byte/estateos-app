export type OpenHouseVisitMode = 'FLEX' | 'SLOT_30' | 'SLOT_60';

export type OpenHouseSlotRecord = {
  id: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservedCount: number;
  spotsLeft: number;
  isFull: boolean;
  myReservation: {
    id: number;
    guestCount: number;
    note: string | null;
    createdAt: string;
  } | null;
};

export type OpenHouseEventRecord = {
  id: number;
  offerId: number;
  hostUserId: number;
  title: string;
  description: string | null;
  visitMode: OpenHouseVisitMode;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  publishedAt: string | null;
  nextSlotStartsAt: string | null;
  totalSpotsLeft: number;
  isHost: boolean;
  offer: {
    id: number;
    title: string;
    city: string;
    district: string;
    street: string | null;
    price: number;
    priceCurrency: string;
    area: number;
    rooms: number | null;
    imageUrl: string | null;
  };
  slots: OpenHouseSlotRecord[];
};
