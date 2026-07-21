"use client";

import PublishAuthGate, { type AuthGateContext } from "@/components/auth/PublishAuthGate";

type CarPublishAuthGateProps = {
  open: boolean;
  onClose: () => void;
  context?: AuthGateContext;
  onAuthenticated: (report: (step: string) => void) => void | Promise<void>;
};

export default function CarPublishAuthGate({ context = "publish", ...props }: CarPublishAuthGateProps) {
  return <PublishAuthGate brand="car" context={context} {...props} />;
}
