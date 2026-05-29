import type { Appointment, AppointmentStatus, Deal } from '@prisma/client';

/** Bufor po planowanym terminie — dopiero wtedy prosimy o domknięcie wizyty. */
export const PRESENTATION_GRACE_MS = 2 * 60 * 60 * 1000;

export const TERMINAL_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
];

export const REVIEWABLE_OUTCOMES: AppointmentStatus[] = ['COMPLETED', 'NO_SHOW'];

export type PresentationOutcomeInput = 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export function isTerminalAppointmentStatus(status: string): boolean {
  return TERMINAL_APPOINTMENT_STATUSES.includes(status as AppointmentStatus);
}

export function isReviewableOutcome(status: string): boolean {
  return REVIEWABLE_OUTCOMES.includes(status as AppointmentStatus);
}

export function getPresentationCloseAt(proposedDate: Date): Date {
  return new Date(proposedDate.getTime() + PRESENTATION_GRACE_MS);
}

export function isPresentationPastDue(proposedDate: Date, now = new Date()): boolean {
  return now.getTime() >= getPresentationCloseAt(proposedDate).getTime();
}

export function canClosePresentation(
  appointment: Pick<Appointment, 'status' | 'proposedDate'>,
  now = new Date(),
): boolean {
  if (appointment.status !== 'ACCEPTED') return false;
  return isPresentationPastDue(appointment.proposedDate, now);
}

export function isDealParticipant(
  deal: Pick<Deal, 'buyerId' | 'sellerId'>,
  userId: number,
): boolean {
  return deal.buyerId === userId || deal.sellerId === userId;
}

export function counterpartyId(
  deal: Pick<Deal, 'buyerId' | 'sellerId'>,
  userId: number,
): number | null {
  if (deal.buyerId === userId) return deal.sellerId;
  if (deal.sellerId === userId) return deal.buyerId;
  return null;
}

export function mapOutcomeInput(input: string): PresentationOutcomeInput | null {
  const u = String(input || '').toUpperCase();
  if (u === 'COMPLETED' || u === 'HELD' || u === 'DONE') return 'COMPLETED';
  if (u === 'NO_SHOW' || u === 'NOSHOW' || u === 'ABSENT') return 'NO_SHOW';
  if (u === 'CANCELLED' || u === 'CANCELED' || u === 'CANCEL') return 'CANCELLED';
  return null;
}

export function computePresentationStats(
  appointments: Array<Pick<Appointment, 'status'>>,
): { held: number; noShow: number; scheduled: number } {
  let held = 0;
  let noShow = 0;
  for (const a of appointments) {
    if (a.status === 'COMPLETED') held += 1;
    else if (a.status === 'NO_SHOW') noShow += 1;
  }
  return { held, noShow, scheduled: held + noShow };
}
