import { Fraunces } from 'next/font/google';

const luxSerif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-lux-serif',
  display: 'swap',
});

export default function SzukamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`buyer-intake-shell ${luxSerif.variable} h-[100dvh] max-h-[100dvh] overflow-hidden`}>{children}</div>
  );
}
