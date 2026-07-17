"use client";

import PublishAuthGate from "@/components/auth/PublishAuthGate";

type CarPublishAuthGateProps = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (report: (step: string) => void) => void | Promise<void>;
};

export default function CarPublishAuthGate(props: CarPublishAuthGateProps) {
  return <PublishAuthGate brand="car" {...props} />;
}
