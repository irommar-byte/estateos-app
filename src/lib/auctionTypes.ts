export type AuctionStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'SETTLED';

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
  timeRemainingMs: number;
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
  recentBids: AuctionBidRecord[];
};
