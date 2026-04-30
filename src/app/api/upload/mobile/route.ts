import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { getWebFormData } from '@/lib/requestFormData';

export async function POST(req: Request) {
  try {
    const formData = await getWebFormData(req);
    const file = (formData.get('file') || formData.get('document') || formData.get('attachment')) as File | null;
    const offerId = String(
      formData.get('offerId') ||
      formData.get('listingId') ||
      formData.get('dealId') ||
      ''
    );
    const isFloorPlan = formData.get('isFloorPlan') === 'true';
    const purpose = String(formData.get('purpose') || '');

    console.log("UPLOAD MOBILE HIT", Date.now());

    if (!file || !offerId) {
      return NextResponse.json({ error: 'Brak pliku lub ID oferty' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const lowerName = String(file.name || '').toLowerCase();
    const mimeType = String(file.type || '').toLowerCase();
    const extFromName = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
    const isImage =
      mimeType.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(lowerName);
    const isHeifFamily =
      mimeType.includes('heic') ||
      mimeType.includes('heif') ||
      extFromName === '.heic' ||
      extFromName === '.heif';

    const offerDirName = `offer_${offerId}`;
    const uploadDir = path.join('/home/rommar/uploads', offerDirName);
    if (!fs.existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    if (!isImage) {
      const safeExt = extFromName && extFromName.length <= 10 ? extFromName : '';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
      const finalName = `attachment-${uniqueSuffix}${safeExt}`;
      const filePath = path.join(uploadDir, finalName);
      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/${offerDirName}/${finalName}`;
      return NextResponse.json({ success: true, url: fileUrl });
    }

    let finalBuffer = buffer;
    let outputExt = '.jpg';
    const sharp = require("sharp");
    if (isHeifFamily) {
      // Fallback: serwer nie zawsze ma wsparcie HEIF w libvips.
      finalBuffer = buffer;
      outputExt = extFromName || '.heic';
    } else {
      try {
        let image = sharp(buffer).rotate();

        // 🔥 LUKSUSOWY ZNAK WODNY TYPOGRAFICZNY (Generowany w pamięci) 🔥
        const svgWatermark = `
          <svg width="450" height="350" xmlns="http://www.w3.org/2000/svg">
            <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle"
                  font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="48"
                  fill="rgba(255, 255, 255, 0.22)"
                  stroke="rgba(0, 0, 0, 0.08)" stroke-width="1.5"
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

        finalBuffer = await image.jpeg({ quality: 85 }).toBuffer();
        outputExt = '.jpg';
      } catch (sharpError) {
        console.warn('UPLOAD MOBILE fallback to original buffer:', sharpError);
        finalBuffer = buffer;
        outputExt = extFromName || '.jpg';
      }
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
    const prefix = isFloorPlan ? 'floorplan' : 'photo';
    const finalName = `${prefix}-${uniqueSuffix}${outputExt}`;
    const filePath = path.join(uploadDir, finalName);

    await writeFile(filePath, finalBuffer);

    const fileUrl = `/uploads/${offerDirName}/${finalName}`;

    const offer = await prisma.offer.findUnique({
      where: { id: parseInt(offerId) }
    });

    if (offer && purpose !== 'dealroomAttachment') {
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
