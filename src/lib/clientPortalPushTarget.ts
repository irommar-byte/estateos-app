export function isClientPortalPushKind(value: unknown): boolean {
  const kind = String(value || "")
    .trim()
    .toUpperCase();
  return [
    "CLIENT_PORTAL",
    "CLIENT_PORTAL_MESSAGE",
    "SELLER_MARKETING",
    "FEEDBACK_REMINDER",
  ].includes(kind);
}
