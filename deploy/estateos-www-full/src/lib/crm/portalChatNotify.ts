export function portalChatNotifyTarget(params: {
  from: 'agent' | 'client';
  activityOnly?: boolean;
  contactMirrored?: boolean;
}): 'agent' | 'client' | 'none' {
  if (params.activityOnly) return 'none';
  if (params.from === 'client') return 'agent';
  return 'client';
}
