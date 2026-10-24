export default function PortalLuxFooter({ agencyName, partner }: { agencyName: string; partner?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-[24px] bg-black px-5 py-6">
      <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="h-[22px] w-auto" />
      <p className="text-center text-xs text-[#BDB6AA]">
        {agencyName} · panel prywatny{partner ? " · dostęp dla drugiej osoby" : ""}
      </p>
    </div>
  );
}
