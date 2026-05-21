/** Kontrakt publikacji ofert — zgodny z backend `offerPublication.ts`. */

export type PublicationKind = 'FREE_FIRST' | 'PLUS_PAID';

export type PublicationQuoteReason =
  | 'FREE_FIRST_AVAILABLE'
  | 'NOT_FIRST_OFFER'
  | 'FREE_ALREADY_USED'
  | 'REACTIVATION'
  | 'REACTIVATION_AFTER_ARCHIVE'
  | 'REACTIVATION_AFTER_SOLD'
  | 'PUBLICATION_REQUIRES_PLUS'
  | string;

export type PublicationQuote = {
  offerId?: number | null;
  action?: 'CREATE_AND_ACTIVATE' | 'ACTIVATE' | string;
  requiresPayment: boolean;
  allowedFreeFirst?: boolean;
  kind?: PublicationKind;
  reason?: PublicationQuoteReason;
  productId?: string;
  message?: string;
};

export type OfferPublicationPayload = {
  kind: PublicationKind;
  iapTransactionId?: string;
  consumePlusPublication?: boolean;
};

export type ActivateOfferPublicationResponse = {
  offer?: Record<string, unknown>;
  publication?: {
    status?: string;
    kind?: PublicationKind;
    endsAt?: string;
    endReason?: string | null;
  };
  message?: string;
  error?: string;
  errorCode?: string;
};
