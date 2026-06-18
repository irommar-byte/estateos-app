import { NextResponse } from 'next/server';
import { listCompaniesForRegistration } from '@/lib/agencyCompany';

export async function GET() {
  try {
    const companies = await listCompaniesForRegistration();
    return NextResponse.json({ success: true, companies });
  } catch (e) {
    console.error('agency-company/list', e);
    return NextResponse.json({ success: false, message: 'Nie udało się pobrać listy firm.' }, { status: 500 });
  }
}
