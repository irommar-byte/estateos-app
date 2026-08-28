import type { Metadata } from 'next';
import ClientPortalShell from '@/components/portal/ClientPortalShell';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Panel Klienta · EstateOS™',
    description: 'Oferty, terminy i bezpośredni Live Chat z Twoim agentem.',
    manifest: `/klient/${encodeURIComponent(token)}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: 'Panel EstateOS',
      statusBarStyle: 'black-translucent',
    },
  };
}

export default function ClientPortalLayout({ children }: LayoutProps) {
  return <ClientPortalShell>{children}</ClientPortalShell>;
}
