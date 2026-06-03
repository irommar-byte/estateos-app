export type InvestorProUpsellReason = 'off_market' | 'import' | 'premium_tools';

export type InvestorProUpsellRequest = {
  reason: InvestorProUpsellReason;
};

type Listener = (request: InvestorProUpsellRequest | null) => void;

const listeners = new Set<Listener>();

export function subscribeInvestorProUpsell(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestInvestorProUpsell(reason: InvestorProUpsellReason): void {
  for (const listener of listeners) {
    try {
      listener({ reason });
    } catch {
      // ignore
    }
  }
}

export function dismissInvestorProUpsell(): void {
  for (const listener of listeners) {
    try {
      listener(null);
    } catch {
      // ignore
    }
  }
}
