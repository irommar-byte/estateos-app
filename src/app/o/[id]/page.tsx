import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OfferPublicView, { type OfferPublicPayload } from "./OfferPublicView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return { title: "Oferta | EstateOS" };
  }
  const offer = await prisma.offer.findFirst({
    where: { id, status: "ACTIVE" },
    select: { title: true, city: true, district: true },
  });
  if (!offer) {
    return { title: "Oferta niedostępna | EstateOS" };
  }
  const loc = [offer.district.replaceAll("_", " "), offer.city].filter(Boolean).join(" · ");
  return {
    title: `${offer.title} | EstateOS`,
    description: loc || undefined,
  };
}

export default async function PublicOfferPage({ params }: PageProps) {
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const row = await prisma.offer.findFirst({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      area: true,
      rooms: true,
      propertyType: true,
      transactionType: true,
      city: true,
      district: true,
      images: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          companyName: true,
          buyerType: true,
          role: true,
        },
      },
    },
  });

  if (!row) notFound();

  const u = row.user;
  const displayName =
    (u.companyName && u.companyName.trim()) || u.name?.trim() || `Właściciel #${u.id}`;
  const isAgency = u.buyerType === "agency" || Boolean(u.companyName && u.companyName.trim());

  const offer: OfferPublicPayload = {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    area: row.area,
    rooms: row.rooms,
    propertyType: row.propertyType,
    transactionType: row.transactionType,
    city: row.city,
    district: row.district,
    images: row.images,
    seller: {
      id: u.id,
      displayName,
      image: u.image,
      profileHref: `/profil/${u.id}`,
      isAgency,
    },
  };

  return <OfferPublicView offer={offer} />;
}
