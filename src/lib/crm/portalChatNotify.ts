export function portalChatNotifyTarget(params: {
  from: 'agent' | 'client';
  activityOnly?: boolean;
  contactMirrored?: boolean;
  audience?: 'client' | 'agent' | 'both';
}): 'agent' | 'client' | 'none' {
  if (params.activityOnly) return 'none';
  if (params.audience === 'agent') return 'none';
  if (params.from === 'client') return 'agent';
  return 'client';
}
