import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const offerId = formData.get('offerId') as string;
    const isFloorPlan = formData.get('isFloorPlan') === 'true';

    console.log("UPLOAD MOBILE HIT", Date.now());

    if (!file || !offerId) {
      return NextResponse.json({ error: 'Brak pliku lub ID oferty' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sharp = require("sharp");

    let image = sharp(buffer).rotate();

    const metadata = await image.metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;

    const baseSize = Math.max(width, height);

    const watermarkSize = Math.min(
      Math.max(Math.floor(baseSize * 0.25), 300),
      1200
    );

    
    // 🔥 LUKSUSOWY ZNAK WODNY TYPOGRAFICZNY (Generowany w pamięci) 🔥
    const svgWatermark = `
      <svg width="450" height="350" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle"
              font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="52"
              fill="rgba(255, 255, 255, 0.35)"
              stroke="rgba(0, 0, 0, 0.15)" stroke-width="2"
              transform="rotate(-25 225 175)">
          EstateOS™
        </text>
      </svg>
    `;

    const watermarkBuffer = await sharp(Buffer.from(svgWatermark))
      .png()
      .toBuffer();

    image = image.composite([{
      input: watermarkBuffer,
      tile: true,
      blend: 'over'
    }]);

    const finalBuffer = await image.jpeg({ quality: 85 }).toBuffer();

    const offerDirName = `offer_${offerId}`;
    const uploadDir = path.join('/home/rommar/uploads', offerDirName);

    if (!fs.existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
    const prefix = isFloorPlan ? 'floorplan' : 'photo';
    const finalName = `${prefix}-${uniqueSuffix}.jpg`;
    const filePath = path.join(uploadDir, finalName);

    await writeFile(filePath, finalBuffer);

    const fileUrl = `/uploads/${offerDirName}/${finalName}`;

    const offer = await prisma.offer.findUnique({
      where: { id: parseInt(offerId) }
    });

    if (offer) {
      if (isFloorPlan) {
        await prisma.offer.update({
          where: { id: parseInt(offerId) },
          data: { floorPlanUrl: fileUrl }
        });
      } else {
        let currentImages = [];

        try {
          currentImages = offer.images ? JSON.parse(offer.images as string) : [];
          if (!Array.isArray(currentImages)) currentImages = [];
        } catch {}

        currentImages.push(fileUrl);

        await prisma.offer.update({
          where: { id: parseInt(offerId) },
          data: { images: JSON.stringify(currentImages) }
        });
      }
    }

    return NextResponse.json({ success: true, url: fileUrl });

  } catch (error: any) {
    console.error('BŁĄD UPLOADU MOBILE:', error.message);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
