import { NextResponse } from "next/server";
import {
  CATALOG_RESOURCES,
  fetchOtomotoCatalog,
  parseCatalogQuery,
  type CatalogResource,
} from "@/lib/otomotoCatalog";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = parseCatalogQuery(searchParams);

    if (!CATALOG_RESOURCES.includes(query.resource)) {
      return NextResponse.json({ error: "Nieprawidłowy parametr resource." }, { status: 400 });
    }

    const options = await fetchOtomotoCatalog(query);
    return NextResponse.json(
      {
        resource: query.resource as CatalogResource,
        options,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać katalogu aut.";
    return NextResponse.json({ error: message, options: [] }, { status: 502 });
  }
}
