import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      transactionType,
      propertyType,
      city,
      selectedDistricts,
      maxPrice,
      minArea,
      minYear,
      requireBalcony,
      requireGarden,
      requireElevator,
      requireParking,
      requireFurnished,
      pushNotifications,
      lat,
      lng,
      radius
    } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Brak userId' });
    }

    const pref = await prisma.radarPreference.upsert({
      where: { userId: Number(userId) },
      update: {
        transactionType,
        propertyType,
        city,
        districts: selectedDistricts || [],
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minArea: minArea ? Number(minArea) : null,
        minYear: minYear ? Number(minYear) : null,
        requireBalcony: !!requireBalcony,
        requireGarden: !!requireGarden,
        requireElevator: !!requireElevator,
        requireParking: !!requireParking,
        requireFurnished: !!requireFurnished,
        pushNotifications: pushNotifications !== false,
        minMatchThreshold: body.minMatchThreshold ?? 70,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        radius: radius ? Number(radius) : null
      },
      create: {
        userId: Number(userId),
        transactionType,
        propertyType,
        city,
        districts: selectedDistricts || [],
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minArea: minArea ? Number(minArea) : null,
        minYear: minYear ? Number(minYear) : null,
        requireBalcony: !!requireBalcony,
        requireGarden: !!requireGarden,
        requireElevator: !!requireElevator,
        requireParking: !!requireParking,
        requireFurnished: !!requireFurnished,
        pushNotifications: pushNotifications !== false,
        minMatchThreshold: body.minMatchThreshold ?? 70,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        radius: radius ? Number(radius) : null
      }
    });

    return NextResponse.json({ success: true, pref });

  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message });
  }
}
