import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import ClientPortalShell from '@/components/portal/ClientPortalShell';

const luxSerif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-lux-serif',
  display: 'swap',
});

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
      statusBarStyle: 'black',
    },
  };
}

export default function ClientPortalLayout({ children }: LayoutProps) {
  return <ClientPortalShell fontClassName={luxSerif.variable}>{children}</ClientPortalShell>;
}
