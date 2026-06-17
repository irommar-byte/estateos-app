import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { requireActiveAgencyAdmin, updateCompanyLogo } from '@/lib/agencyCompany';
import { saveAgencyBrandingFile } from '@/lib/upload/agencyBrandingUpload';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ success: false, message: 'Błąd formularza.' }, { status: 400 });
  }

  const file = (formData.get('file') || formData.get('logo')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, message: 'Wybierz plik logo.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveAgencyBrandingFile({
      buffer,
      mimeTypeDeclared: String(file.type || ''),
      originalFileName: String((file as File & { name?: string }).name || 'logo'),
    });
    if (!saved.ok) {
      return NextResponse.json({ success: false, message: saved.error }, { status: saved.status });
    }

    await updateCompanyLogo({
      companyId: admin.companyId,
      adminUserId: userId,
      logoUrl: saved.url,
    });

    return NextResponse.json({ success: true, url: saved.url });
  } catch (e) {
    console.error('company logo upload', e);
    return NextResponse.json({ success: false, message: 'Błąd serwera.' }, { status: 500 });
  }
}
