import { CommonActions, StackActions } from '@react-navigation/native';
import type { TabBarTickerAction } from '../contracts/tabBarTickerContract';
import { navigationRef } from '../../navigationRef';
import { useOpenHouseLiveStore } from '../store/useOpenHouseLiveStore';
import { requestInvestorProUpsell } from '../services/investorProUpsell';

export function navigateTabBarTickerAction(action: TabBarTickerAction): boolean {
  if (!navigationRef.isReady()) return false;

  try {
    switch (action.type) {
      case 'offer':
        navigationRef.dispatch(
          StackActions.push('OfferDetail', {
            offer: { id: action.offerId },
            id: action.offerId,
            offerId: action.offerId,
          }),
        );
        return true;
      case 'open_house':
        navigationRef.dispatch(
          StackActions.push('OpenHouseEvent', {
            eventId: action.eventId,
            offerId: action.offerId,
          }),
        );
        return true;
      case 'auction':
        navigationRef.dispatch(
          StackActions.push('AuctionEvent', {
            eventId: action.eventId,
            offerId: action.offerId,
          }),
        );
        return true;
      case 'live_panel':
        useOpenHouseLiveStore.getState().openPanel();
        return true;
      case 'radar_calibration':
        navigationRef.dispatch(
          CommonActions.navigate({
            name: 'MainTabs',
            params: {
              screen: 'Explore',
              params: { openCalibration: true, exploreLive: true, radarBrowseMode: 'RADAR' },
            },
          }),
        );
        return true;
      case 'auction_hub':
        navigationRef.dispatch(StackActions.push('AuctionHub'));
        return true;
      case 'open_house_hub':
        navigationRef.dispatch(StackActions.push('OpenHouseHub'));
        return true;
      case 'pro_upsell':
        requestInvestorProUpsell(action.reason);
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
