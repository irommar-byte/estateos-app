"use client";

export default function GoldFeaturedFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`eos-gold-featured ${className}`}>
      <span className="eos-gold-featured__metal" aria-hidden />
      <span className="eos-gold-featured__shine" aria-hidden />
      <span className="eos-gold-featured__corner eos-gold-featured__corner--tl" aria-hidden />
      <span className="eos-gold-featured__corner eos-gold-featured__corner--tr" aria-hidden />
      <span className="eos-gold-featured__corner eos-gold-featured__corner--bl" aria-hidden />
      <span className="eos-gold-featured__corner eos-gold-featured__corner--br" aria-hidden />
      <div className="eos-gold-featured__inner">{children}</div>
    </div>
  );
}
