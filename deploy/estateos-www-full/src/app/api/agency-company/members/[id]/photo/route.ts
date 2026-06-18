import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { requireActiveAgencyAdmin, updateMemberProfile } from '@/lib/agencyCompany';
import { saveAgencyBrandingFile } from '@/lib/upload/agencyBrandingUpload';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy identyfikator.' }, { status: 400 });
  }

  const member = await prisma.agencyCompanyMember.findFirst({
    where: { id: memberId, companyId: admin.companyId },
  });
  if (!member) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono pracownika.' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ success: false, message: 'Błąd formularza.' }, { status: 400 });
  }

  const file = (formData.get('file') || formData.get('photo')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, message: 'Wybierz zdjęcie.' }, { status: 400 });
  }

  const mime = String(file.type || '');
  if (!mime.startsWith('image/')) {
    return NextResponse.json({ success: false, message: 'Zdjęcie agenta musi być plikiem graficznym (JPG, PNG, WEBP, GIF).' }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveAgencyBrandingFile({
      buffer,
      mimeTypeDeclared: mime,
      originalFileName: String((file as File & { name?: string }).name || 'agent.jpg'),
    });
    if (!saved.ok) {
      return NextResponse.json({ success: false, message: saved.error }, { status: saved.status });
    }

    const updated = await updateMemberProfile({
      companyId: admin.companyId,
      adminUserId: userId,
      memberId,
      profilePhotoUrl: saved.url,
    });

    return NextResponse.json({
      success: true,
      url: saved.url,
      member: { id: updated.id, profilePhotoUrl: updated.profilePhotoUrl },
    });
  } catch (e) {
    console.error('member photo upload', e);
    return NextResponse.json({ success: false, message: 'Błąd serwera.' }, { status: 500 });
  }
}
