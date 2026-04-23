import { sendNotification } from '@/lib/core/notification.core';

export const radarService = {
  async matchNewOffer(offer: any) {
    console.log(`[RADAR] ${offer.title}`);

    // TODO: tu później będzie dynamiczny user (matching)
    const userId = 17;

    await sendNotification({
      userId,
      type: 'RADAR_MATCH',
      title: '🚨 Nowa oferta!',
      body: `${offer.title} za ${offer.price} PLN`,
      data: { offerId: offer.id },
    });
  }
};
