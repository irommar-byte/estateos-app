export const PRESENTATION_FLOW_OPEN_EVENT = "presentation-flow:open";

export function requestPresentationFlowOpen() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRESENTATION_FLOW_OPEN_EVENT));
}
