import { NextResponse } from "next/server";
import { getStrictCities, getStrictDistrictCatalog } from "@/lib/location/locationCatalog";

export async function GET() {
  const strictCities = getStrictCities();
  const strictCityDistricts = getStrictDistrictCatalog();

  return NextResponse.json({
    strictCities,
    strictCityDistricts,
  });
}

