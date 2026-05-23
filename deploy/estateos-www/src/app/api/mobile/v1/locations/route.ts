import { NextResponse } from "next/server";
import { getStrictCities, getStrictDistrictCatalog } from "@/lib/location/locationCatalog";

export async function GET() {
  return NextResponse.json({
    success: true,
    strictCities: getStrictCities(),
    strictCityDistricts: getStrictDistrictCatalog(),
  });
}

