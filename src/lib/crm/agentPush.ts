export function crmAgentPushData(clientId: number, extra: Record<string, unknown> = {}) {
  return {
    targetType: 'CRM_CLIENT',
    targetId: String(clientId),
    screen: 'AgencyClientDetail',
    route: 'AgencyClientDetail',
    notificationType: 'crm_client',
    href: `/moje-konto/crm?tab=klienci&clientId=${clientId}`,
    deeplink: `estateos://crm/client/${clientId}`,
    ...extra,
    clientId,
  };
}

/** Jeden stos powiadomień iOS/Android per klient CRM (wiadomości z panelu klienta). */
export function crmClientChatThreadId(clientId: number) {
  return `estateos-crm-client-${clientId}`;
}
