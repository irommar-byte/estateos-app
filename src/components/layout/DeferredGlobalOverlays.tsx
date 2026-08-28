"use client";

import dynamic from "next/dynamic";

const RadarLiveCounter = dynamic(() => import("@/components/home/RadarLiveCounter"), { ssr: false });
const DiscoveryPulse = dynamic(() => import("@/components/home/DiscoveryPulse"), { ssr: false });
const IntelligenceEnableSheet = dynamic(() => import("@/components/discovery/IntelligenceEnableSheet"), {
  ssr: false,
});
const WebNotificationPrompt = dynamic(() => import("@/components/layout/WebNotificationPrompt"), { ssr: false });
const PresentationFlowOrchestrator = dynamic(
  () => import("@/components/presentation/PresentationFlowOrchestrator"),
  { ssr: false },
);
const FloatingPreferencesDock = dynamic(() => import("@/components/layout/FloatingPreferencesDock"), { ssr: false });
const EcosystemVerticalTransition = dynamic(
  () => import("@/components/ecosystem/EcosystemVerticalTransition"),
  { ssr: false },
);

/** Heavy global overlays — lazy-loaded after first paint to reduce main-thread work on every route. */
export default function DeferredGlobalOverlays() {
  return (
    <>
      <EcosystemVerticalTransition />
      <FloatingPreferencesDock />
      <RadarLiveCounter />
      <DiscoveryPulse />
      <IntelligenceEnableSheet />
      <WebNotificationPrompt />
      <PresentationFlowOrchestrator />
    </>
  );
}
