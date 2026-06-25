import ForceLightTheme from '@/components/onboarding/ForceLightTheme';

export default function DolaczLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-onboarding-light min-h-[100dvh] bg-[#f4f3f0] text-[#141416]">
      <ForceLightTheme />
      {children}
    </div>
  );
}
