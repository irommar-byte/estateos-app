import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json({ error: 'Brak pliku lub ID usera' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Zapisujemy w nowym folderze avatars
    const uploadDir = `/home/rommar/uploads/avatars`;
    fs.mkdirSync(uploadDir, { recursive: true });

    // Dodajemy Date.now(), aby ominąć cache przeglądarki po zmianie zdjęcia na nowe
    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/avatars/${fileName}`;

    // Aktualizujemy URL w bazie danych usera
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { image: publicUrl }
    });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload awatara nie powiódł się' }, { status: 500 });
  }
}
