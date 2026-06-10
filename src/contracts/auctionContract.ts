export type AuctionStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'SETTLED';

export type AuctionTickerItem = {
  id: string;
  type: 'AUCTION';
  eventId: number;
  offerId: number;
  hostUserId?: number;
  title: string | null;
  city: string;
  district: string;
  currentPrice: number;
  currency: string;
  startsAt?: string;
  endsAt: string;
  status: AuctionStatus;
  bidCount?: number;
  imageUrl: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type AuctionBidRecord = {
  id: number;
  amount: number;
  currency: string;
  status: 'VALID' | 'OUTBID' | 'WINNING';
  createdAt: string;
  bidderLabel: string;
  isMine: boolean;
};

export type AuctionEventRecord = {
  id: number;
  offerId: number;
  hostUserId: number;
  title: string | null;
  description: string | null;
  currency: string;
  startPrice: number;
  reservePrice: number | null;
  reserveMet: boolean | null;
  minIncrement: number;
  currentPrice: number;
  nextMinBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  effectiveEndsAt: string;
  status: AuctionStatus;
  winnerUserId: number | null;
  publishedAt: string | null;
  isHost: boolean;
  isLeading: boolean;
  timeUntilStartMs?: number;
  timeRemainingMs: number;
  host?: {
    id: number;
    name: string | null;
  };
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
    lat?: number | null;
    lng?: number | null;
  };
  recentBids: AuctionBidRecord[];
};

export type AuctionMyBidRecord = {
  bidId: number;
  amount: number;
  currency: string;
  status: 'VALID' | 'OUTBID' | 'WINNING';
  createdAt: string;
  event: AuctionEventRecord;
};
