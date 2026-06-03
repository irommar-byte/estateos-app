import { getInvestorProProductId } from './iapInvestorPro';
import { IAPManager, type SubscriptionStoreListing } from './iapManager';

export async function fetchInvestorProStoreListing(): Promise<SubscriptionStoreListing | null> {
  return IAPManager.getSubscriptionListing(getInvestorProProductId());
}
