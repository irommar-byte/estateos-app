import { NextResponse } from "next/server";
import { getStrictCities, getStrictDistrictCatalog } from "@/lib/location/locationCatalog";
import { attachCacheHeaders } from "@/lib/httpCache";

export async function GET() {
  const strictCities = getStrictCities();
  const strictCityDistricts = getStrictDistrictCatalog();

  return attachCacheHeaders(
    NextResponse.json({
      strictCities,
      strictCityDistricts,
    }),
    86400,
    604800,
  );
}
