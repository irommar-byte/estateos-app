export type OpenHouseVisitMode = 'FLEX' | 'SLOT_30' | 'SLOT_60';

export type OpenHouseTickerItem = {
  id: string;
  type: 'OPEN_HOUSE';
  eventId: number;
  offerId: number;
  title: string;
  city: string;
  district: string;
  startsAt: string | null;
  spotsLeft: number;
  imageUrl: string | null;
  hostUserId?: number;
  lat?: number | null;
  lng?: number | null;
};

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
  reservations: Array<{
    id: number;
    userId: number;
    guestCount: number;
    note: string | null;
    createdAt: string;
    userName: string;
  }>;
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
  createdAt: string;
  updatedAt: string;
  isHost: boolean;
  nextSlotStartsAt: string | null;
  totalSpotsLeft: number;
  host: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
  } | null;
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
    propertyType: string;
    transactionType: string;
    imageUrl: string | null;
    lat: number | null;
    lng: number | null;
    status: string;
  };
  slots: OpenHouseSlotRecord[];
};

export type OpenHouseSlotDraft = {
  date: Date;
  startHour: string;
  endHour: string;
  capacity: number;
};

export type OpenHouseWindowDraft = OpenHouseSlotDraft;

export type OpenHouseReservationRecord = {
  reservationId: number;
  guestCount: number;
  note: string | null;
  slotId: number;
  startsAt: string;
  endsAt: string;
  event: OpenHouseEventRecord;
};
